import { useCallback } from 'react';
import { supabaseClient } from '../lib/supabaseClient.js';

// Kill-switch manual — debe quedar en false en producción (ver
// src/legacy/legacyApp.js, mismo nombre y mismo comentario).
export const TESTING_MODE = false;

function checkGuestPermission(plan) {
  if (plan !== 'libre') {
    return { allowed: false, message: 'Como invitado solo puedes usar el plan Libre — crea una cuenta gratis para Estándar o Pro' };
  }
  const last = localStorage.getItem('brandtest_guest_last_use');
  if (last) {
    const hoursSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 48) {
      return { allowed: false, message: 'Espera ' + Math.ceil(48 - hoursSince) + ' horas para otro análisis sin registro, o crea una cuenta' };
    }
  }
  return { allowed: true };
}

/**
 * Verificación y descuento de créditos. El permiso y el descuento real
 * NUNCA se deciden en el cliente para cuentas reales — credits/plan/
 * total_analyses/last_free_analysis están protegidas a nivel de columna
 * en Supabase, así que solo /api/consume-credit (con la sesión real
 * verificada) puede tocarlas. El único caso resuelto localmente es
 * invitado, que no tiene fila de DB que proteger.
 */
export function useCredits({ user, isGuest, patchUser }) {
  const checkAndConsume = useCallback(
    async (plan) => {
      const unlimited = TESTING_MODE || (user && user.is_admin);
      if (isGuest) return checkGuestPermission(plan);
      if (unlimited) return { allowed: true };

      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return { allowed: false, message: 'Tu sesión expiró — vuelve a entrar' };
      try {
        const res = await fetch('/api/consume-credit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ plan }),
        });
        const data = await res.json();
        if (!res.ok) return { allowed: false, message: data.error || 'No se pudo verificar tu plan' };
        patchUser({
          ...(data.remainingCredits !== undefined ? { credits: data.remainingCredits } : {}),
          ...(data.plan ? { plan: data.plan } : {}),
          ...(data.totalAnalyses !== undefined ? { total_analyses: data.totalAnalyses } : {}),
        });
        return { allowed: true };
      } catch (e) {
        return { allowed: false, message: 'Error de conexión al verificar tu plan: ' + e.message };
      }
    },
    [user, isGuest, patchUser]
  );

  const markGuestUsed = useCallback(() => {
    if (isGuest) localStorage.setItem('brandtest_guest_last_use', new Date().toISOString());
  }, [isGuest]);

  return { checkAndConsume, markGuestUsed };
}
