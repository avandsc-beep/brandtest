// api/submit-recognition.js
// Recibe la respuesta del usuario al test de reconocimiento, la compara
// contra la tipología real (que solo el servidor conoce en este punto),
// y acredita 1 crédito — protegido contra responder la misma muestra
// dos veces por la restricción UNIQUE de la base de datos.

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { sampleId, answeredType } = req.body || {};
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    if (!sampleId || !answeredType) return res.status(400).json({ error: 'Faltan datos' });

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Sesión inválida' });

    const { data: sample, error: sampleError } = await supabaseAdmin
        .from('calibration_samples')
        .select('typology')
        .eq('id', sampleId)
        .single();
    if (sampleError || !sample) return res.status(404).json({ error: 'Muestra no encontrada' });

    const correct = sample.typology === answeredType;

    const { error: insertError } = await supabaseAdmin
        .from('recognition_responses')
        .insert({ sample_id: sampleId, user_id: user.id, answered_type: answeredType, correct });

    if (insertError) {
        if (insertError.code === '23505') {
            return res.status(409).json({ error: 'Ya respondiste esta muestra antes' });
        }
        return res.status(500).json({ error: insertError.message });
    }

    const { data: profile } = await supabaseAdmin.from('users').select('credits').eq('id', user.id).single();
    const newCredits = (profile ? profile.credits : 0) + 1;
    await supabaseAdmin.from('users').update({ credits: newCredits }).eq('id', user.id);

    return res.status(200).json({ correct, correctType: sample.typology, remainingCredits: newCredits });
};
