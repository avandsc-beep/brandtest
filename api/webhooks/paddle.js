// api/webhooks/paddle.js
// El endpoint más sensible del sistema: es el ÚNICO lugar donde un pago
// se convierte en créditos/suscripción. Paddle lo llama server-to-server;
// el frontend jamás decide nada sobre dinero.
//
// Garantías que implementa (sección 5 del plan de suscripciones):
//   1. Firma Paddle-Signature verificada con HMAC-SHA256 — un webhook
//      sin firma válida se rechaza antes de leer nada más.
//   2. Idempotencia doble: webhook_events (por event_id, para reintentos
//      del mismo evento) y purchases.paddle_transaction_id unique (por
//      transacción, para que un mismo pago jamás acredite dos veces).
//   3. Los créditos se acreditan en transaction.completed — ese evento
//      dispara exactamente una vez por cobro exitoso (alta + cada
//      renovación), así que no hace falta rastrear períodos a mano.
//      Los eventos subscription.* solo mantienen el estado de la tabla
//      subscriptions (para el dashboard), nunca tocan créditos.
//
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// PADDLE_WEBHOOK_SECRET.

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Leemos el body crudo del stream SIN tocar req.body: la firma se calcula
// sobre los bytes exactos que mandó Paddle, y el parseo automático de
// Vercel los alteraría (re-serializar JSON no garantiza los mismos bytes).
async function getRawBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
}

// Formato del header: "ts=1671552777;h1=abc123...". Firma esperada:
// HMAC-SHA256(secret, `${ts}:${rawBody}`) en hex.
function verifyPaddleSignature(rawBody, signatureHeader, secret) {
    if (!signatureHeader || !secret) return false;
    const parts = Object.fromEntries(
        signatureHeader.split(';').map((p) => p.split('=', 2))
    );
    const { ts, h1 } = parts;
    if (!ts || !h1) return false;

    // Rechaza webhooks con timestamp de hace más de 5 minutos (replay).
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(ts));
    if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

    const expected = crypto
        .createHmac('sha256', secret)
        .update(`${ts}:`)
        .update(rawBody)
        .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(h1, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Los ítems de una transacción/suscripción traen price.id de Paddle;
// acá se traducen a filas de nuestro catálogo. Un checkout solo puede
// haber salido de price_ids que nosotros cargamos, así que si no matchea
// nada es un evento que no nos concierne (se registra y se ignora).
async function resolveCatalogItems(supabase, priceIds) {
    const [{ data: plans }, { data: packages }] = await Promise.all([
        supabase.from('plans').select('id, credits_included, paddle_price_id').in('paddle_price_id', priceIds),
        supabase.from('credit_packages').select('id, credits, paddle_price_id').in('paddle_price_id', priceIds),
    ]);
    return { plans: plans || [], packages: packages || [] };
}

async function upsertSubscription(supabase, data) {
    const userId = data.custom_data?.user_id;
    if (!userId) return; // sin user_id no hay a quién asignarla

    const priceIds = (data.items || []).map((i) => i.price?.id).filter(Boolean);
    const { plans } = await resolveCatalogItems(supabase, priceIds.length ? priceIds : ['-']);
    const planId = plans[0]?.id || data.custom_data?.plan_id || null;
    if (!planId) return;

    await supabase.from('subscriptions').upsert(
        {
            user_id: userId,
            plan_id: planId,
            status: data.status,
            paddle_subscription_id: data.id,
            paddle_customer_id: data.customer_id || null,
            current_period_start: data.current_billing_period?.starts_at || null,
            current_period_end: data.current_billing_period?.ends_at || null,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'paddle_subscription_id' }
    );
}

async function handleTransactionCompleted(supabase, data) {
    const userId = data.custom_data?.user_id;
    if (!userId) return;

    const priceIds = (data.items || []).map((i) => i.price?.id).filter(Boolean);
    if (!priceIds.length) return;
    const { plans, packages } = await resolveCatalogItems(supabase, priceIds);

    const isSubscription = plans.length > 0;
    const pkg = packages[0] || null;
    const creditsToAdd = isSubscription
        ? plans.reduce((sum, p) => sum + p.credits_included, 0)
        : pkg
          ? pkg.credits
          : 0;
    if (!creditsToAdd) return; // price desconocido: no es de nuestro catálogo

    // El insert en purchases es el candado contra doble acreditación:
    // paddle_transaction_id es unique, así que si este pago ya se procesó
    // (webhook reenviado con otro event_id), el insert falla con 23505 y
    // NO se acreditan créditos de nuevo.
    const { error: purchaseError } = await supabase.from('purchases').insert({
        user_id: userId,
        kind: isSubscription ? 'subscription' : 'credit_package',
        package_id: pkg ? pkg.id : null,
        amount_cents: parseInt(data.details?.totals?.total || '0', 10),
        paddle_transaction_id: data.id,
        status: 'completed',
    });
    if (purchaseError) {
        if (purchaseError.code === '23505') return; // ya procesada — no duplicar
        throw new Error('No se pudo registrar la compra: ' + purchaseError.message);
    }

    const { error: creditError } = await supabase.rpc('add_credits', {
        p_user_id: userId,
        p_delta: creditsToAdd,
    });
    if (creditError) {
        throw new Error('Compra registrada pero fallo al acreditar: ' + creditError.message);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const rawBody = await getRawBody(req);
    const valid = verifyPaddleSignature(
        rawBody,
        req.headers['paddle-signature'],
        process.env.PADDLE_WEBHOOK_SECRET
    );
    if (!valid) {
        return res.status(401).json({ error: 'Firma inválida' });
    }

    let event;
    try {
        event = JSON.parse(rawBody.toString('utf8'));
    } catch {
        return res.status(400).json({ error: 'Body inválido' });
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Idempotencia por evento: si Paddle reintenta el MISMO evento
    // (mismo event_id), respondemos 200 sin procesar nada.
    const { data: seen } = await supabase
        .from('webhook_events')
        .select('id')
        .eq('provider', 'paddle')
        .eq('event_id', event.event_id)
        .maybeSingle();
    if (seen) {
        return res.status(200).json({ received: true, duplicate: true });
    }

    try {
        switch (event.event_type) {
            case 'subscription.created':
            case 'subscription.activated':
            case 'subscription.updated':
            case 'subscription.canceled':
            case 'subscription.paused':
            case 'subscription.resumed':
                // Cancelar/pausar solo cambia el estado — los créditos ya
                // otorgados del período en curso no se revocan (plan, §5).
                await upsertSubscription(supabase, event.data);
                break;
            case 'transaction.completed':
                await handleTransactionCompleted(supabase, event.data);
                break;
            case 'transaction.payment_failed':
                // Solo queda registrado en webhook_events; no toca créditos.
                break;
            default:
                break; // evento que no nos concierne — registrar y responder 200
        }
    } catch (err) {
        // NO registramos el event_id: al responder 500, Paddle reintenta y
        // el reintento sí podrá procesarse (la protección contra doble
        // acreditación es purchases, no este registro).
        console.error('paddle webhook error:', err.message);
        return res.status(500).json({ error: 'Error procesando el evento' });
    }

    // Recién acá, con todo procesado, el evento queda marcado como visto.
    await supabase.from('webhook_events').insert({
        provider: 'paddle',
        event_id: event.event_id,
        event_type: event.event_type,
    });

    return res.status(200).json({ received: true });
}
