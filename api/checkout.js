// api/checkout.js
// Prepara la apertura del checkout overlay de Paddle.js. El navegador
// manda { planId } o { packageId }; acá se verifica la sesión real (mismo
// patrón que consume-credit.js), se busca el price_id en el catálogo de
// Supabase (nunca hardcodeado en el frontend) y se devuelven los datos
// para Paddle.Checkout.open(). El user_id viaja en customData y vuelve
// en el webhook — así el pago se asigna a la cuenta correcta sin confiar
// en nada que diga el navegador.
//
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PADDLE_ENV.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { planId, packageId } = req.body || {};
    if ((!planId && !packageId) || (planId && packageId)) {
        return res.status(400).json({ error: 'Indica planId o packageId (uno solo)' });
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

    const table = planId ? 'plans' : 'credit_packages';
    const { data: item, error: itemError } = await supabaseAdmin
        .from(table)
        .select('id, name, paddle_price_id, active')
        .eq('id', planId || packageId)
        .single();
    if (itemError || !item) {
        return res.status(404).json({ error: 'Plan o paquete no encontrado' });
    }
    if (!item.active || item.paddle_price_id === 'pending') {
        return res.status(503).json({ error: 'Este producto todavía no está disponible para la venta' });
    }

    return res.status(200).json({
        priceId: item.paddle_price_id,
        customData: {
            user_id: user.id,
            ...(planId ? { plan_id: item.id } : { package_id: item.id }),
        },
        customerEmail: user.email,
        environment: process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox',
    });
}
