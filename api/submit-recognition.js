// api/submit-recognition.js
// Recibe la respuesta del usuario al test de reconocimiento, la compara
// contra la tipología real (que solo el servidor conoce en este punto),
// y acredita 1 crédito — protegido contra responder la misma muestra
// dos veces por la restricción UNIQUE de la base de datos.

import { createClient } from '@supabase/supabase-js';
import { checkOrigin, getAuthedUser, rateLimit, sanitizeText } from './_utils.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    if (!checkOrigin(req, res)) return;

    const { sampleId } = req.body || {};
    const answeredType = sanitizeText((req.body || {}).answeredType, 60);
    if (!sampleId || !Number.isInteger(Number(sampleId)) || !answeredType) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const user = await getAuthedUser(req, res, supabaseAdmin);
    if (!user) return;
    const ok = await rateLimit(res, supabaseAdmin, {
        identifier: user.id, endpoint: 'submit-recognition', max: 60, windowMinutes: 60,
    });
    if (!ok) return;

    const { data: sample, error: sampleError } = await supabaseAdmin
        .from('calibration_samples')
        .select('typology, notes, brand_name')
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

    // add_credits (PARTE 19) suma en una sola sentencia — sin carrera si
    // llegan dos requests a la vez, a diferencia del viejo leer-y-escribir.
    const { data: newCredits } = await supabaseAdmin.rpc('add_credits', {
        p_user_id: user.id,
        p_delta: 1,
    });

    return res.status(200).json({
        correct,
        correctType: sample.typology,
        remainingCredits: newCredits,
        notes: sample.notes || null,
        correctBrandName: sample.brand_name || null,
    });
};
