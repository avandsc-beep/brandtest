// api/subscription-status.js
// GET para el dashboard: plan activo (si hay), fecha de renovación, saldo
// de créditos y el catálogo de planes/paquetes a la venta. Solo lectura —
// el estado real siempre lo escribe el webhook de Paddle, nunca esto.
//
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
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

    const [profileRes, subscriptionRes, plansRes, packagesRes] = await Promise.all([
        supabaseAdmin.from('users').select('credits').eq('id', user.id).single(),
        supabaseAdmin
            .from('subscriptions')
            .select('status, current_period_start, current_period_end, plan_id, plans (name, monthly_price_cents, credits_included)')
            .eq('user_id', user.id)
            .in('status', ['active', 'trialing', 'past_due', 'paused'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabaseAdmin
            .from('plans')
            .select('id, name, monthly_price_cents, credits_included')
            .eq('active', true)
            .order('monthly_price_cents'),
        supabaseAdmin
            .from('credit_packages')
            .select('id, name, price_cents, credits')
            .eq('active', true)
            .order('price_cents'),
    ]);

    if (profileRes.error) {
        return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const sub = subscriptionRes.data;
    return res.status(200).json({
        credits: profileRes.data.credits,
        subscription: sub
            ? {
                  planId: sub.plan_id,
                  planName: sub.plans?.name || sub.plan_id,
                  status: sub.status,
                  creditsIncluded: sub.plans?.credits_included ?? null,
                  monthlyPriceCents: sub.plans?.monthly_price_cents ?? null,
                  currentPeriodEnd: sub.current_period_end,
              }
            : null,
        catalog: {
            plans: plansRes.data || [],
            creditPackages: packagesRes.data || [],
        },
    });
}
