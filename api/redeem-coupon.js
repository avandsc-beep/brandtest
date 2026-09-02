// api/redeem-coupon.js
// El usuario canjea un código de cupón. Toda la lógica de negocio (existe,
// está activo, no superó el tope global, esta cuenta no lo usó antes, y
// acreditar) vive en la función atómica redeem_coupon() (PARTE 23) — acá
// solo se verifica la sesión real y se traduce el error a un mensaje.

import { createClient } from '@supabase/supabase-js';
import { checkOrigin, getAuthedUser, rateLimit, sanitizeText } from './_utils.js';

const ERROR_MESSAGES = {
    CUPON_NO_EXISTE: 'Ese código no existe',
    CUPON_INACTIVO: 'Ese cupón ya no está activo',
    CUPON_AGOTADO: 'Ese cupón alcanzó su límite de usos',
    CUPON_YA_USADO: 'Ya usaste este cupón con esta cuenta',
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    if (!checkOrigin(req, res)) return;

    const code = sanitizeText((req.body || {}).code, 40);
    if (!code) {
        return res.status(400).json({ error: 'Ingresa un código' });
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const user = await getAuthedUser(req, res, supabaseAdmin);
    if (!user) return;
    // Generoso pero acotado: frena a quien intente adivinar códigos por
    // fuerza bruta sin molestar a nadie que se equivoca tipeando.
    const ok = await rateLimit(res, supabaseAdmin, {
        identifier: user.id, endpoint: 'redeem-coupon', max: 10, windowMinutes: 60,
    });
    if (!ok) return;

    const { data: newCredits, error } = await supabaseAdmin.rpc('redeem_coupon', {
        p_user_id: user.id,
        p_code: code,
    });

    if (error) {
        const key = (error.message || '').match(/CUPON_\w+/)?.[0];
        return res.status(400).json({ error: ERROR_MESSAGES[key] || 'No se pudo canjear el cupón' });
    }

    return res.status(200).json({ success: true, remainingCredits: newCredits });
}
