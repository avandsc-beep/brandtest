// api/public-stats.js
// Función pública (sin autenticación — se llama desde la pantalla de
// login, antes de que exista sesión). Solo devuelve datos si el admin
// activó el interruptor en app_settings; si no, responde enabled:false
// sin exponer ningún número.

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('show_public_stats')
        .eq('id', 1)
        .single();

    if (!settings || !settings.show_public_stats) {
        return res.status(200).json({ enabled: false });
    }

    const { count: userCount } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true });

    const { data: usersData } = await supabaseAdmin.from('users').select('total_analyses');
    const totalAnalyses = (usersData || []).reduce((sum, u) => sum + (u.total_analyses || 0), 0);

    return res.status(200).json({ enabled: true, userCount: userCount || 0, totalAnalyses });
};
