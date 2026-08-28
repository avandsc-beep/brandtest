// api/credit-user.js
// Función de servidor de Vercel. Corre en el servidor, nunca en el
// navegador — por eso es el único lugar donde es seguro usar la
// SERVICE ROLE KEY (la que puede saltarse las reglas de seguridad y
// editar la fila de CUALQUIER usuario, no solo la propia).
//
// Variables de entorno que necesita (se configuran en Vercel, nunca
// en el código ni en GitHub):
//   SUPABASE_URL               -> el mismo Project URL de siempre
//   SUPABASE_SERVICE_ROLE_KEY  -> Settings > API Keys > Secret keys (Supabase)
//   ADMIN_SECRET                -> una contraseña que solo tú conoces,
//                                  para que nadie más pueda llamar a esta
//                                  función y regalarse créditos.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { whatsapp, amount, adminSecret } = req.body || {};

    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    if (!whatsapp || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Faltan datos (whatsapp o monto inválido)' });
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user, error: findError } = await supabaseAdmin
        .from('users')
        .select('id, credits')
        .eq('whatsapp', whatsapp)
        .single();

    if (findError || !user) {
        return res.status(404).json({ error: 'No se encontró ningún usuario con ese WhatsApp' });
    }

    const newCredits = user.credits + Number(amount);
    const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ credits: newCredits })
        .eq('id', user.id);

    if (updateError) {
        return res.status(500).json({ error: updateError.message });
    }

    await supabaseAdmin
        .from('credit_history')
        .insert({ whatsapp, amount: Number(amount), admin_note: 'Acreditado desde el panel admin' });

    return res.status(200).json({ success: true, newCredits });
};
