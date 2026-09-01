import { useEffect, useState } from 'react';
import { supabaseClient } from '../../lib/supabaseClient.js';
import { Reveal } from '../common/Reveal.jsx';

function usd(cents) {
  return 'US$' + (cents / 100).toFixed(2);
}

// Pestaña "Facturación" del admin (paso 7 del plan de suscripciones):
// MRR, suscripciones activas, ingresos por paquetes y el gasto REAL de
// IA medido en ai_usage_events — no la estimación teórica. Lee directo
// de Supabase con las políticas de admin (PARTE 18 y 21 del schema).
export function BillingTab() {
  const [stats, setStats] = useState(null);
  const [subs, setSubs] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [subsRes, purchasesRes, aiRes] = await Promise.all([
          supabaseClient
            .from('subscriptions')
            .select('status, plan_id, current_period_end, plans (name, monthly_price_cents)')
            .order('created_at', { ascending: false }),
          supabaseClient.from('purchases').select('kind, amount_cents, created_at'),
          supabaseClient.from('ai_usage_events').select('cost_usd_estimate, input_tokens, output_tokens'),
        ]);
        if (subsRes.error) throw new Error(subsRes.error.message);

        const allSubs = subsRes.data || [];
        const activeSubs = allSubs.filter((s) => s.status === 'active' || s.status === 'trialing');
        const mrrCents = activeSubs.reduce((sum, s) => sum + (s.plans?.monthly_price_cents || 0), 0);

        const purchases = purchasesRes.data || [];
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const packRevenueMonthCents = purchases
          .filter((p) => p.kind === 'credit_package' && new Date(p.created_at) >= monthStart)
          .reduce((sum, p) => sum + p.amount_cents, 0);
        const totalRevenueCents = purchases.reduce((sum, p) => sum + p.amount_cents, 0);

        const aiEvents = aiRes.data || [];
        const aiCostUsd = aiEvents.reduce((sum, e) => sum + Number(e.cost_usd_estimate || 0), 0);

        setStats([
          { label: 'MRR (suscripciones activas)', value: usd(mrrCents) },
          { label: 'Suscripciones activas', value: activeSubs.length },
          { label: 'Paquetes vendidos (este mes)', value: usd(packRevenueMonthCents) },
          { label: 'Ingresos totales cobrados', value: usd(totalRevenueCents) },
          { label: 'Gasto real de IA (histórico)', value: 'US$' + aiCostUsd.toFixed(2) },
          { label: 'Análisis con IA medidos', value: aiEvents.length },
          {
            label: 'Costo IA promedio por análisis',
            value: aiEvents.length ? 'US$' + (aiCostUsd / aiEvents.length).toFixed(4) : '—',
          },
          {
            label: 'Margen IA sobre ingresos',
            value: totalRevenueCents
              ? Math.round((1 - aiCostUsd / (totalRevenueCents / 100)) * 100) + '%'
              : '—',
          },
        ]);
        setSubs(allSubs);
      } catch (e) {
        setError('No se pudo cargar facturación: ' + e.message);
      }
    })();
  }, []);

  return (
    <div className="text-sm space-y-4">
      <p className="text-on-surface-variant">
        Ingresos reales vía Paddle y costo real de IA — medido por análisis, no estimado.
      </p>
      {error && <p className="text-process-magenta">{error}</p>}
      {stats === null && !error && <p className="text-on-surface-variant">Cargando…</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats?.map((s, i) => (
          <Reveal key={s.label} delay={i * 60}>
            <div className="rounded-xl p-4 bg-background border border-outline-variant">
              <div className="text-xl font-bold text-process-cyan">{s.value}</div>
              <div className="text-[11px] text-on-surface-variant mt-0.5">{s.label}</div>
            </div>
          </Reveal>
        ))}
      </div>

      {subs.length > 0 && (
        <div className="pt-2">
          <div className="text-on-surface font-semibold mb-2">Suscripciones</div>
          <div className="space-y-2">
            {subs.map((s, i) => (
              <div key={i} className="rounded-xl px-4 py-3 bg-background border border-outline-variant flex flex-wrap items-center justify-between gap-2">
                <span className="text-on-surface font-semibold">{s.plans?.name || s.plan_id}</span>
                <span className="flex items-center gap-2">
                  <span className={`bx-status-pill ${s.status === 'active' || s.status === 'trialing' ? 'bx-status-ok' : s.status === 'past_due' ? 'bx-status-warn' : 'bx-status-muted'}`}>
                    {s.status}
                  </span>
                  {s.current_period_end && (
                    <span className="text-on-surface-variant text-xs">
                      renueva {new Date(s.current_period_end).toLocaleDateString('es-BO')}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {stats !== null && subs.length === 0 && !error && (
        <p className="text-on-surface-variant">Todavía no hay suscripciones registradas.</p>
      )}
    </div>
  );
}
