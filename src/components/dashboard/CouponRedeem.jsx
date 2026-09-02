import { useState } from 'react';
import { Ticket } from 'lucide-react';
import { useCoupon } from '../../hooks/useCoupon.js';
import { Reveal } from '../common/Reveal.jsx';

export function CouponRedeem({ patchUser }) {
  const [code, setCode] = useState('');
  const { redeem, busy, message } = useCoupon({ patchUser });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    redeem(code.trim());
  };

  return (
    <Reveal delay={140}>
      <div className="bx-card">
        <div className="bx-card-title">Canjear cupón</div>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="bx-form-group flex-1">
            <label>Código de cupón</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej: PRUEBA100"
              className="bx-form-input uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="bx-btn bx-btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Ticket className="w-4 h-4" /> Canjear
          </button>
        </form>
        {message && (
          <p className={`text-sm mt-3 ${message.ok ? 'text-process-cyan' : 'text-process-magenta'}`}>
            {message.text}
          </p>
        )}
      </div>
    </Reveal>
  );
}
