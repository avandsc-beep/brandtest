// api/consume-credit.js
// Función de servidor de Vercel. Verifica quién hace la solicitud (con su
// sesión real de Supabase, no con lo que el navegador diga de sí mismo),
// y es la única que puede leer y modificar créditos/plan/fecha de último
// análisis libre — desde ahora esas columnas están protegidas y ni el
// propio usuario puede tocarlas directamente desde su navegador.
//
// Variables de entorno que necesita (ya deberían estar configuradas):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';
import { checkOrigin } from './_utils.js';

const VALID_PLANS = ['libre', 'estandar', 'pro'];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    if (!checkOrigin(req, res)) return;

    const { plan } = req.body || {};
    if (!VALID_PLANS.includes(plan)) {
        return res.status(400).json({ error: 'Plan inválido' });
    }
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Verifica el token contra Supabase — esto es lo que impide que
    // alguien mienta sobre quién es. No confiamos en nada que venga
    // del navegador salvo esta verificación.
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
        return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('credits, plan, total_analyses, last_free_analysis, is_admin')
        .eq('id', user.id)
        .single();
    if (profileError || !profile) {
        return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    if (profile.is_admin) {
        return res.status(200).json({ success: true, unlimited: true, remainingCredits: profile.credits });
    }

    if (plan === 'libre') {
        if (profile.last_free_analysis) {
            const hoursSince = (Date.now() - new Date(profile.last_free_analysis).getTime()) / (1000 * 60 * 60);
            if (hoursSince < 12) {
                return res.status(403).json({ error: 'Espera ' + Math.ceil(12 - hoursSince) + ' horas para otro análisis libre' });
            }
        }
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ last_free_analysis: new Date().toISOString() })
            .eq('id', user.id);
        if (updateError) return res.status(500).json({ error: updateError.message });
        return res.status(200).json({ success: true, remainingCredits: profile.credits, plan: profile.plan, totalAnalyses: profile.total_analyses });
    }

    const cost = plan === 'estandar' ? 10 : plan === 'pro' ? 20 : null;
    if (!cost) {
        return res.status(400).json({ error: 'Plan inválido' });
    }
    if (profile.credits < cost) {
        return res.status(403).json({ error: 'Créditos insuficientes. Necesitas ' + cost + '. Saldo: ' + profile.credits });
    }

    const newCredits = profile.credits - cost;
    const newTotal = (profile.total_analyses || 0) + 1;
    const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ credits: newCredits, total_analyses: newTotal, plan })
        .eq('id', user.id);
    if (updateError) {
        return res.status(500).json({ error: updateError.message });
    }

    await supabaseAdmin.from('credit_usage_log').insert({ user_id: user.id, amount: cost, plan });

    return res.status(200).json({ success: true, remainingCredits: newCredits, plan, totalAnalyses: newTotal });
};
