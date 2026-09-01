// api/_utils.js
// Helpers de seguridad compartidos por todos los endpoints. El prefijo
// "_" hace que Vercel NO exponga este archivo como función — es solo
// código importado por las demás.
//
// Tres capas que se repiten en cada endpoint del navegador:
//   1. checkOrigin  — un browser ajeno (otro sitio) no puede llamar al API.
//   2. rateLimit    — ventana móvil por usuario/IP contra abuso automatizado.
//   3. validadores  — los inputs se validan acá, nunca se confía en el cliente.
//
// El webhook de Paddle NO usa checkOrigin (es server-to-server, sin
// header Origin) — su protección es la firma HMAC.

// Si el request trae header Origin (lo mandan los navegadores en POSTs y
// cross-origin), debe coincidir con el host que sirve el API o ser un
// localhost de desarrollo. Sin Origin (curl, server-to-server) se deja
// pasar: la autorización real la da el Bearer token / firma — esto solo
// bloquea que OTRA página web use el API desde el navegador de un usuario.
export function checkOrigin(req, res) {
    const origin = req.headers.origin;
    if (!origin) return true;
    let host;
    try {
        host = new URL(origin).host;
    } catch {
        res.status(403).json({ error: 'Origen inválido' });
        return false;
    }
    const ownHost = req.headers['x-forwarded-host'] || req.headers.host || '';
    const isLocalDev = host === 'localhost:5173' || host === 'localhost:3000' || host === '127.0.0.1:5173';
    if (host === ownHost || isLocalDev) return true;
    res.status(403).json({ error: 'Origen no permitido' });
    return false;
}

// Extrae y verifica la sesión de Supabase. Devuelve el user o responde
// 401 y devuelve null.
export async function getAuthedUser(req, res, supabaseAdmin) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) {
        res.status(401).json({ error: 'No autenticado' });
        return null;
    }
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
        res.status(401).json({ error: 'Sesión inválida o expirada' });
        return null;
    }
    return user;
}

// IP real del request detrás del proxy de Vercel.
export function requestIp(req) {
    return ((req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown') + '')
        .split(',')[0]
        .trim();
}

// Ventana móvil sobre rate_limit_log (PARTE 22). Si se superó el máximo
// responde 429 y devuelve false. Falla abierto: si la consulta a la DB
// se rompe, no bloquea al usuario legítimo (el resto de las defensas
// sigue en pie). Limpia filas viejas de vez en cuando para que la tabla
// no crezca sin límite.
export async function rateLimit(res, supabaseAdmin, { identifier, endpoint, max, windowMinutes }) {
    try {
        const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
        const { count, error } = await supabaseAdmin
            .from('rate_limit_log')
            .select('id', { count: 'exact', head: true })
            .eq('identifier', identifier)
            .eq('endpoint', endpoint)
            .gte('created_at', since);
        if (!error && (count || 0) >= max) {
            res.status(429).json({ error: 'Demasiadas solicitudes — espera unos minutos e intenta de nuevo' });
            return false;
        }
        await supabaseAdmin.from('rate_limit_log').insert({ identifier, endpoint });
        if (Math.random() < 0.02) {
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            await supabaseAdmin.from('rate_limit_log').delete().lt('created_at', dayAgo);
        }
    } catch {
        // fallar abierto
    }
    return true;
}

// IDs de catálogo y similares: minúsculas/números/guiones, largo acotado.
export function isCatalogId(v) {
    return typeof v === 'string' && /^[a-z0-9_-]{1,40}$/.test(v);
}

// Texto libre que viaja a la DB o al prompt de IA: fuerza string y corta
// al largo máximo. React ya escapa al renderizar (XSS) y supabase-js
// parametriza (SQLi) — esto acota tamaño y tipo, que es lo que queda.
export function sanitizeText(v, maxLen) {
    if (typeof v !== 'string') return '';
    return v.slice(0, maxLen).trim();
}
