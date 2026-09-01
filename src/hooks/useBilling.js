import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient.js';

// Facturación con Paddle. El navegador solo ABRE el checkout — quién
// pagó, cuánto y qué créditos corresponden lo decide siempre el webhook
// (api/webhooks/paddle.js) server-side. Después de un checkout exitoso
// acá solo se re-consulta /api/subscription-status hasta que el webhook
// haya impactado el saldo.

const PADDLE_JS_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';

let paddleLoadPromise = null;

function loadPaddleJs() {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (!paddleLoadPromise) {
    paddleLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PADDLE_JS_URL;
      script.async = true;
      script.onload = () => resolve(window.Paddle);
      script.onerror = () => {
        paddleLoadPromise = null;
        reject(new Error('No se pudo cargar el checkout de Paddle'));
      };
      document.head.appendChild(script);
    });
  }
  return paddleLoadPromise;
}

async function authHeaders() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) throw new Error('Tu sesión expiró — vuelve a entrar');
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token };
}

export function useBilling({ user, patchUser }) {
  const [status, setStatus] = useState(null); // { credits, subscription, catalog }
  const [statusError, setStatusError] = useState(null);
  const [checkoutMsg, setCheckoutMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const paddleReady = useRef(false);
  const pollTimer = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/subscription-status', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo consultar tu plan');
      setStatus(data);
      setStatusError(null);
      if (data.credits !== undefined) patchUser({ credits: data.credits });
      return data;
    } catch (e) {
      setStatusError(e.message);
      return null;
    }
  }, [patchUser]);

  useEffect(() => {
    if (user?.id) fetchStatus();
    return () => clearTimeout(pollTimer.current);
  }, [user?.id, fetchStatus]);

  // El webhook tarda unos segundos en acreditar después de que Paddle
  // confirma el pago — se re-consulta con backoff hasta ver el cambio.
  const pollAfterPurchase = useCallback((previousCredits, attempt = 0) => {
    if (attempt >= 6) {
      setCheckoutMsg('Pago recibido. Si el saldo no se actualiza en unos minutos, recargá la página.');
      return;
    }
    pollTimer.current = setTimeout(async () => {
      const data = await fetchStatus();
      if (data && data.credits !== previousCredits) {
        setCheckoutMsg('¡Listo! Tu compra ya está acreditada.');
        return;
      }
      pollAfterPurchase(previousCredits, attempt + 1);
    }, 3000 + attempt * 2000);
  }, [fetchStatus]);

  const openCheckout = useCallback(
    async ({ planId, packageId }) => {
      setCheckoutMsg(null);
      setBusy(true);
      try {
        const headers = await authHeaders();
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers,
          body: JSON.stringify(planId ? { planId } : { packageId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo iniciar el pago');

        const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
        if (!clientToken) throw new Error('Falta configurar VITE_PADDLE_CLIENT_TOKEN');

        const Paddle = await loadPaddleJs();
        if (!paddleReady.current) {
          if (data.environment === 'sandbox') Paddle.Environment.set('sandbox');
          Paddle.Initialize({
            token: clientToken,
            eventCallback: (event) => {
              if (event.name === 'checkout.completed') {
                setCheckoutMsg('Pago confirmado — acreditando…');
                pollAfterPurchase(status?.credits ?? user?.credits ?? null);
              }
            },
          });
          paddleReady.current = true;
        }

        Paddle.Checkout.open({
          items: [{ priceId: data.priceId, quantity: 1 }],
          customData: data.customData,
          customer: data.customerEmail ? { email: data.customerEmail } : undefined,
          settings: { displayMode: 'overlay', locale: 'es' },
        });
      } catch (e) {
        setCheckoutMsg(e.message);
      } finally {
        setBusy(false);
      }
    },
    [status?.credits, user?.credits, pollAfterPurchase]
  );

  const openCustomerPortal = useCallback(async () => {
    setBusy(true);
    setCheckoutMsg(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/customer-portal', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo abrir el portal de facturación');
      window.open(data.url, '_blank', 'noopener');
    } catch (e) {
      setCheckoutMsg(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, statusError, checkoutMsg, busy, fetchStatus, openCheckout, openCustomerPortal };
}
