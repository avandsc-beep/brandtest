// api/get-recognition-sample.js
// Devuelve una muestra del banco de calibración que este usuario todavía
// no respondió, con una URL firmada temporal (el bucket es privado) —
// nunca revela la tipología correcta, eso solo lo sabe el servidor.

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
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

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
        return res.status(401).json({ error: 'Sesión inválida' });
    }

    const { data: answered } = await supabaseAdmin
        .from('recognition_responses')
        .select('sample_id')
        .eq('user_id', user.id);
    const answeredIds = (answered || []).map(r => r.sample_id);

    let query = supabaseAdmin.from('calibration_samples').select('id, image_path, brand_name');
    if (answeredIds.length) query = query.not('id', 'in', '(' + answeredIds.join(',') + ')');
    const { data: samples, error: sampleError } = await query;

    if (sampleError) return res.status(500).json({ error: sampleError.message });
    if (!samples || !samples.length) {
        return res.status(200).json({ done: true, message: 'Ya respondiste todas las muestras disponibles — vuelve pronto por más.' });
    }

    const chosen = samples[Math.floor(Math.random() * samples.length)];
    const { data: signed, error: signError } = await supabaseAdmin
        .storage.from('calibration-images')
        .createSignedUrl(chosen.image_path, 300);
    if (signError) return res.status(500).json({ error: signError.message });

    return res.status(200).json({ sampleId: chosen.id, imageUrl: signed.signedUrl, brandName: chosen.brand_name });
};
