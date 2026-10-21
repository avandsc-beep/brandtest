import { useEffect, useState } from 'react';
import { supabaseClient } from '../../lib/supabaseClient.js';

const usd = (cents) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'USD' }).format(cents / 100);

export function PublicPricing({ onRequireAuth }) {
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    let mounted = true;
    Promise.all([
      supabaseClient.from('plans').select('id,name,monthly_price_cents,credits_included').eq('active', true).order('monthly_price_cents'),
      supabaseClient.from('credit_packages').select('id,name,price_cents,credits').eq('active', true).order('price_cents'),
    ]).then(([plans, packages]) => {
      if (mounted && !plans.error && !packages.error) setCatalog({ plans: plans.data || [], packages: packages.data || [] });
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  if (!catalog || (!catalog.plans.length && !catalog.packages.length)) return null;
  return (
    <section className="bx-card" aria-label="Precios de créditos">
      <h2 className="bx-card-title">Comprá créditos</h2>
      <p className="text-sm text-on-surface-variant mb-5">Usá tus créditos en los diagnósticos Estándar y Pro.</p>
      {catalog.plans.length > 0 && <>
        <h3 className="font-semibold mb-3">Suscripciones mensuales</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {catalog.plans.map(plan => <div className="bx-plan-card" key={plan.id}>
            <h4 className="bx-plan-name">{plan.name}</h4>
            <p className="font-bold text-xl my-2">{usd(plan.monthly_price_cents)} <span className="text-xs font-normal">/ mes</span></p>
            <p className="text-sm">{plan.credits_included} créditos por mes</p>
          </div>)}
        </div>
        <p className="text-xs text-on-surface-variant mb-5">Renovación automática mensual. Podés cancelar desde el portal de facturación de tu cuenta.</p>
      </>}
      {catalog.packages.length > 0 && <>
        <h3 className="font-semibold mb-3">Paquetes de pago único</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {catalog.packages.map(pkg => <div className="bx-plan-card" key={pkg.id}>
            <h4 className="bx-plan-name">{pkg.name}</h4>
            <p className="font-bold text-xl my-2">{usd(pkg.price_cents)}</p>
            <p className="text-sm">{pkg.credits} créditos · sin suscripción</p>
          </div>)}
        </div>
      </>}
      <p className="text-xs text-on-surface-variant mb-4">Precios base en USD. Los impuestos aplicables y el total se muestran en Paddle antes de pagar.</p>
      <button className="bx-btn bx-btn-primary w-full" onClick={onRequireAuth}>Entrar para comprar créditos</button>
    </section>
  );
}
