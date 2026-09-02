import { useEffect, useState } from 'react';
import { Plus, Ticket, Ban, CheckCircle2 } from 'lucide-react';
import { supabaseClient } from '../../lib/supabaseClient.js';

function randomCode() {
  return 'BX' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Administración de cupones (create/list/activar-desactivar) vía el
// cliente normal de Supabase: la política "admins administran cupones"
// (PARTE 23) ya autoriza estas operaciones por RLS, no hace falta un
// endpoint de servidor aparte para esto — el canje del usuario sí pasa
// por api/redeem-coupon.js porque ese toca créditos.
export function CouponsTab() {
  const [coupons, setCoupons] = useState(null);
  const [error, setError] = useState(null);
  const [code, setCode] = useState('');
  const [credits, setCredits] = useState(100);
  const [maxUses, setMaxUses] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    const { data, error } = await supabaseClient
      .from('coupons')
      .select('id, code, credits, max_uses, uses_count, active, created_at')
      .order('created_at', { ascending: false });
    if (error) { setError(error.message); return; }
    setCoupons(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMessage(null);
    const finalCode = (code.trim() || randomCode()).toUpperCase();
    const { error } = await supabaseClient.from('coupons').insert({
      code: finalCode,
      credits: Number(credits),
      max_uses: maxUses ? Number(maxUses) : null,
    });
    setCreating(false);
    if (error) {
      setMessage({ ok: false, text: error.code === '23505' ? 'Ese código ya existe' : error.message });
      return;
    }
    setMessage({ ok: true, text: 'Cupón ' + finalCode + ' creado' });
    setCode('');
    setCredits(100);
    setMaxUses('');
    load();
  };

  const toggleActive = async (coupon) => {
    await supabaseClient.from('coupons').update({ active: !coupon.active }).eq('id', coupon.id);
    load();
  };

  const totals = coupons
    ? {
        cupones: coupons.length,
        canjes: coupons.reduce((s, c) => s + c.uses_count, 0),
        creditosOtorgados: coupons.reduce((s, c) => s + c.uses_count * c.credits, 0),
      }
    : null;

  return (
    <div className="text-sm space-y-5">
      <p className="text-on-surface-variant">
        Cupones de créditos — un mismo código no se puede canjear dos veces con la misma cuenta.
        Dejá "Usos máximos" vacío para que no tenga tope global.
      </p>

      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bx-indicator-item">
        <div className="bx-form-group">
          <label>Código (opcional)</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Autogenerado" className="bx-form-input uppercase" />
        </div>
        <div className="bx-form-group">
          <label>Créditos</label>
          <input type="number" min="1" value={credits} onChange={(e) => setCredits(e.target.value)} className="bx-form-input" required />
        </div>
        <div className="bx-form-group">
          <label>Usos máximos (global)</label>
          <input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Ilimitado" className="bx-form-input" />
        </div>
        <button type="submit" disabled={creating} className="bx-btn bx-btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
          <Plus className="w-4 h-4" /> Crear cupón
        </button>
      </form>
      {message && <p className={message.ok ? 'text-process-cyan' : 'text-process-magenta'}>{message.text}</p>}

      {totals && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 bg-background border border-outline-variant text-center">
            <div className="text-lg font-bold text-process-cyan">{totals.cupones}</div>
            <div className="text-[11px] text-on-surface-variant">Cupones creados</div>
          </div>
          <div className="rounded-xl p-3 bg-background border border-outline-variant text-center">
            <div className="text-lg font-bold text-process-cyan">{totals.canjes}</div>
            <div className="text-[11px] text-on-surface-variant">Canjes totales</div>
          </div>
          <div className="rounded-xl p-3 bg-background border border-outline-variant text-center">
            <div className="text-lg font-bold text-process-cyan">{totals.creditosOtorgados}</div>
            <div className="text-[11px] text-on-surface-variant">Créditos otorgados</div>
          </div>
        </div>
      )}

      {error && <p className="text-process-magenta">{error}</p>}
      {coupons === null && !error && <p className="text-on-surface-variant">Cargando…</p>}
      {coupons && coupons.length === 0 && <p className="text-on-surface-variant">Todavía no creaste ningún cupón.</p>}

      <div className="space-y-2">
        {coupons?.map((c) => (
          <div key={c.id} className="bx-indicator-item flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-process-cyan" />
                <span className="font-mono font-semibold text-on-surface">{c.code}</span>
                <span className={'bx-status-pill ' + (c.active ? 'bx-status-ok' : 'bx-status-muted')}>
                  {c.active ? 'Activo' : 'Desactivado'}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                {c.credits} créditos · {c.uses_count} uso{c.uses_count === 1 ? '' : 's'}
                {c.max_uses ? ' / ' + c.max_uses : ' (sin tope)'} · creado {new Date(c.created_at).toLocaleDateString('es-BO')}
              </p>
            </div>
            <button onClick={() => toggleActive(c)} className="bx-btn flex items-center gap-2">
              {c.active ? (<><Ban className="w-3.5 h-3.5" /> Desactivar</>) : (<><CheckCircle2 className="w-3.5 h-3.5" /> Reactivar</>)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
