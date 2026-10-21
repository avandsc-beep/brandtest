import { useEffect, useState } from 'react';
import { loadPaddleJs } from '../../hooks/useBilling.js';
import { Footer } from '../layout/Footer.jsx';

let paymentInit;

export function PaymentLinkView() {
  const [message, setMessage] = useState('Preparando tu pago…');
  useEffect(() => {
    let mounted = true;
    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
    if (!token || !/^(live_|test_)/.test(token)) {
      setMessage('El servicio de pagos todavía no está disponible. Contactá con soporte.');
      return;
    }
    const transaction = new URLSearchParams(window.location.search).get('_ptxn');
    if (transaction && !/^txn_[a-z0-9]{26}$/.test(transaction)) {
      setMessage('El enlace de pago no es válido. Abrí el enlace original de tu correo.');
      return;
    }
    if (!paymentInit) {
      paymentInit = loadPaddleJs().then((Paddle) => {
        if (token.startsWith('test_')) Paddle.Environment.set('sandbox');
        // Paddle abre automáticamente la transacción indicada por _ptxn.
        // No se otorgan créditos desde esta página: los acredita el webhook.
        Paddle.Initialize({ token, checkout: { settings: { displayMode: 'overlay', locale: 'es' } } });
      }).catch((error) => { paymentInit = null; throw error; });
    }
    paymentInit.then(() => {
      if (mounted) setMessage(transaction
        ? 'Completá el pago en la ventana de Paddle. Después, volvé a tu cuenta para consultar tus créditos.'
        : 'Abrí el enlace de pago recibido por correo o entrá a tu cuenta para elegir un plan o paquete.');
    }).catch(() => {
      if (mounted) setMessage('No pudimos abrir el pago. Recargá la página o contactá con soporte.');
    });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col">
      <main className="flex-1 max-w-xl mx-auto px-6 py-16">
        <div className="bx-card">
          <h1 className="font-display text-3xl font-bold mb-4">Pagos de BRANDEX</h1>
          <p role="status" className="text-sm text-on-surface-variant leading-relaxed">{message}</p>
          <a className="bx-btn bx-btn-primary mt-6" href="/">Volver a mi cuenta</a>
          <p className="text-xs text-on-surface-variant mt-4">Los pagos y los datos de tu tarjeta son procesados por Paddle.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
