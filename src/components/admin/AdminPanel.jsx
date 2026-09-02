import { useState } from 'react';
import { X } from 'lucide-react';
import { CreditsTab } from './CreditsTab.jsx';
import { ValoracionTab } from './ValoracionTab.jsx';
import { MetricsTab } from './MetricsTab.jsx';
import { BillingTab } from './BillingTab.jsx';
import { CouponsTab } from './CouponsTab.jsx';
import { Reveal } from '../common/Reveal.jsx';

const TABS = [
  { id: 'creditos', label: 'Créditos' },
  { id: 'cupones', label: 'Cupones' },
  { id: 'valoracion', label: 'Valoración de marca' },
  { id: 'metricas', label: 'Métricas' },
  { id: 'facturacion', label: 'Facturación' },
];

export function AdminPanel({ user, onClose }) {
  const [tab, setTab] = useState('creditos');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Reveal>
      <div className="bx-card">
        <div className="bx-card-title">
          Panel de administración
          <button onClick={onClose} className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${tab === t.id ? 'bg-process-cyan text-ink-black border-process-cyan font-semibold' : 'bg-surface-container-highest border-outline-variant text-on-surface-variant hover:border-process-cyan'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'creditos' && <CreditsTab />}
        {tab === 'cupones' && <CouponsTab />}
        {tab === 'valoracion' && <ValoracionTab user={user} />}
        {tab === 'metricas' && <MetricsTab />}
        {tab === 'facturacion' && <BillingTab />}
      </div>
      </Reveal>
    </div>
  );
}
