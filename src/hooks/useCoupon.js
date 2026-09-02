import { useCallback, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient.js';

export function useCoupon({ patchUser }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const redeem = useCallback(
    async (code) => {
      setBusy(true);
      setMessage(null);
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) throw new Error('Tu sesión expiró — vuelve a entrar');
        const res = await fetch('/api/redeem-coupon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage({ ok: false, text: data.error || 'No se pudo canjear el cupón' });
          return;
        }
        patchUser({ credits: data.remainingCredits });
        setMessage({ ok: true, text: '¡Cupón canjeado! Nuevo saldo: ' + data.remainingCredits + ' créditos' });
      } catch (e) {
        setMessage({ ok: false, text: e.message });
      } finally {
        setBusy(false);
      }
    },
    [patchUser]
  );

  return { redeem, busy, message };
}
