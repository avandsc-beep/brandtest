import { CreditCard, Coins, ExternalLink, BadgeCheck, AlertTriangle } from 'lucide-react';
import { useBilling } from '../../hooks/useBilling.js';
import { Reveal } from '../common/Reveal.jsx';

function formatUsd(cents) {
  const v = cents / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STATUS = {
  active: { label: 'Activa', cls: 'bx-status-ok' },
  trialing: { label: 'En prueba', cls: 'bx-status-ok' },
  past_due: { label: 'Pago pendiente', cls: 'bx-status-warn' },
  paused: { label: 'Pausada', cls: 'bx-status-muted' },
};

// El plan del medio es el que más conviene empujar (mejor relación
// precio/crédito de los tres) — coincide con el análisis financiero.
const FEATURED_PLAN = 'profesional';

// Suscripción y compra de créditos (pasos 4 y 6 del plan de
// suscripciones). Si el catálogo viene vacío (planes aún inactivos en la
// DB, sin price_id de Paddle), la sección entera no se muestra — así el
// deploy puede salir antes de habilitar los pagos sin ofrecer nada roto.
export function BillingSection({ user, patchUser }) {
  const { status, statusError, checkoutMsg, busy, openCheckout, openCustomerPortal } =
    useBilling({ user, patchUser });

  const plans = status?.catalog?.plans || [];
  const packages = status?.catalog?.creditPackages || [];
  const sub = status?.subscription;

  if (!statusError && plans.length === 0 && packages.length === 0 && !sub) return null;

  const subStatus = sub ? STATUS[sub.status] || { label: sub.status, cls: 'bx-status-muted' } : null;
  const renewal = sub ? formatDate(sub.currentPeriodEnd) : null;

  return (
    <Reveal delay={170}>
      <div className="bx-card">
        <div className="bx-card-title">
          Suscripción & créditos
          <span className="bx-eyebrow">Pago seguro vía Paddle</span>
        </div>

        {statusError && (
          <p className="text-sm text-process-magenta flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {statusError}
          </p>
        )}

        {sub && (
          <div className="bx-sub-banner mb-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <BadgeCheck className="w-4 h-4 text-process-cyan" />
                <span className="font-display font-semibold text-on-surface">Plan {sub.planName}</span>
                <span className={`bx-status-pill ${subStatus.cls}`}>{subStatus.label}</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1.5">
                {sub.creditsIncluded} créditos por mes
                {renewal ? ` · Se renueva el ${renewal}` : ''}
              </p>
            </div>
            <button
              onClick={openCustomerPortal}
              disabled={busy}
              className="bx-btn flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> Gestionar suscripción
            </button>
          </div>
        )}

        {!sub && plans.length > 0 && (
          <div className="mb-7">
            <p className="text-sm text-on-surface-variant mb-4">
              Suscribite y recibí créditos todos los meses — mucho más barato que comprarlos sueltos.
            </p>
            <div className="bx-price-grid pt-2">
              {plans.map((p) => {
                const featured = p.id === FEATURED_PLAN;
                const perCredit = p.monthly_price_cents / p.credits_included;
                return (
                  <div key={p.id} className={`bx-price-card${featured ? ' bx-featured' : ''}`}>
                    {featured && <span className="bx-featured-pill">Más elegido</span>}
                    <div className="bx-price-name">{p.name}</div>
                    <div className="bx-price-value">
                      <span className="bx-price-cur">US$</span>
                      {formatUsd(p.monthly_price_cents)}
                      <span className="bx-price-per">/mes</span>
                    </div>
                    <div className="bx-price-credits">{p.credits_included} créditos al mes</div>
                    <div className="bx-price-note">≈ US${(perCredit / 100).toFixed(2)} por análisis básico</div>
                    <button
                      onClick={() => openCheckout({ planId: p.id })}
                      disabled={busy}
                      className={`bx-btn${featured ? ' bx-btn-primary' : ''} flex items-center justify-center gap-2`}
                    >
                      <CreditCard className="w-3.5 h-3.5" /> Suscribirme
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {packages.length > 0 && (
          <div>
            <p className="text-sm text-on-surface-variant mb-4">
              {sub
                ? '¿Se te acabaron antes de la renovación? Sumá un paquete de una sola vez.'
                : 'O comprá créditos sueltos, sin suscripción — se acreditan al instante.'}
            </p>
            <div className="bx-price-grid">
              {packages.map((p) => (
                <div key={p.id} className="bx-price-card">
                  <div className="bx-price-name">{p.name}</div>
                  <div className="bx-price-value">
                    <span className="bx-price-cur">US$</span>
                    {formatUsd(p.price_cents)}
                  </div>
                  <div className="bx-price-credits">{p.credits} créditos</div>
                  <div className="bx-price-note">pago único</div>
                  <button
                    onClick={() => openCheckout({ packageId: p.id })}
                    disabled={busy}
                    className="bx-btn flex items-center justify-center gap-2"
                  >
                    <Coins className="w-3.5 h-3.5" /> Comprar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {checkoutMsg && (
          <p className="text-sm text-on-surface mt-5 bg-background border border-outline-variant rounded-xl px-4 py-3">
            {checkoutMsg}
          </p>
        )}
      </div>
    </Reveal>
  );
}
