// api/customer-portal.js
// Genera un link de sesión al Customer Portal hosteado de Paddle (ver
// facturas, cambiar tarjeta, cancelar la suscripción). Usamos el portal
// de Paddle en vez de construir una pantalla de facturación propia
// (sección 2 del plan). Requiere que el usuario tenga una suscripción
// registrada por el webhook (de ahí sale su paddle_customer_id).
//
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// PADDLE_API_KEY, PADDLE_ENV.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
        return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('paddle_customer_id')
        .eq('user_id', user.id)
        .not('paddle_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!sub) {
        return res.status(404).json({ error: 'No encontramos una suscripción tuya para gestionar' });
    }

    const apiBase = process.env.PADDLE_ENV === 'production'
        ? 'https://api.paddle.com'
        : 'https://sandbox-api.paddle.com';
    const portalRes = await fetch(
        `${apiBase}/customers/${sub.paddle_customer_id}/portal-sessions`,
        {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + process.env.PADDLE_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        }
    );
    if (!portalRes.ok) {
        return res.status(502).json({ error: 'Paddle no pudo generar el portal de facturación' });
    }
    const portal = await portalRes.json();
    const url = portal.data?.urls?.general?.overview;
    if (!url) {
        return res.status(502).json({ error: 'Respuesta inesperada de Paddle' });
    }

    return res.status(200).json({ url });
}
