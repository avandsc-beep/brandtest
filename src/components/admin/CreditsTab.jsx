import { useEffect, useState } from 'react';
import { supabaseClient } from '../../lib/supabaseClient.js';

export function CreditsTab() {
  const [whatsapp, setWhatsapp] = useState('');
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState(null);

  const loadHistory = async () => {
    try {
      const [grantedRes, spentRes, usersRes] = await Promise.all([
        supabaseClient.from('credit_history').select('whatsapp, amount, created_at').order('created_at', { ascending: false }).limit(50),
        supabaseClient.from('credit_usage_log').select('user_id, amount, plan, created_at').order('created_at', { ascending: false }).limit(50),
        supabaseClient.from('users').select('id, name, email'),
      ]);
      const userMap = {};
      (usersRes.data || []).forEach((u) => { userMap[u.id] = u.name || u.email; });
      const entries = [
        ...(grantedRes.data || []).map((g) => ({ type: 'otorgado', label: g.whatsapp, amount: g.amount, date: g.created_at })),
        ...(spentRes.data || []).map((s) => ({ type: 'gastado', label: (userMap[s.user_id] || 'usuario') + ' (' + s.plan + ')', amount: s.amount, date: s.created_at })),
      ];
      entries.sort((a, b) => new Date(b.date) - new Date(a.date));
      setHistory(entries.slice(0, 60));
    } catch (e) {
      setHistory([]);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const acreditar = async (amount) => {
    if (!whatsapp.trim()) { setMessage('Ingresa el número de WhatsApp'); return; }
    let adminSecret = sessionStorage.getItem('brandtest_admin_secret');
    if (!adminSecret) {
      adminSecret = window.prompt('Contraseña de administrador:');
      if (!adminSecret) return;
      sessionStorage.setItem('brandtest_admin_secret', adminSecret);
    }
    try {
      const res = await fetch('/api/credit-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: whatsapp.trim(), amount, adminSecret }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 401) sessionStorage.removeItem('brandtest_admin_secret');
        setMessage('Error: ' + (result.error || 'no se pudo acreditar'));
        return;
      }
      setMessage('+' + amount + ' créditos para ' + whatsapp + ' (saldo nuevo: ' + result.newCredits + ')');
      setWhatsapp('');
      loadHistory();
    } catch (err) {
      setMessage('Error de conexión: ' + err.message);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="p-3 rounded-xl bg-background border border-outline-variant text-on-surface-variant">
        Créditos y login son reales (Supabase) — funcionan entre dispositivos. La primera vez te va a pedir la
        contraseña de administrador.
      </div>
      <div className="bx-form-group">
        <label>Número de WhatsApp del usuario</label>
        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="Ej: 59171234567" className="bx-form-input" />
      </div>
      <div className="flex gap-2 flex-wrap">
        {[20, 60, 100].map((amount) => (
          <button key={amount} onClick={() => acreditar(amount)} className="bx-btn bx-btn-primary">
            +{amount} créditos
          </button>
        ))}
      </div>
      {message && <p className="text-on-surface-variant">{message}</p>}
      <h3 className="text-on-surface font-semibold pt-2">Historial</h3>
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {history === null && <p className="text-on-surface-variant">Cargando…</p>}
        {history && history.length === 0 && <p className="text-on-surface-variant">Sin movimientos todavía.</p>}
        {history && history.map((e, i) => (
          <div key={i} className={e.type === 'otorgado' ? 'text-emerald-400' : 'text-on-surface-variant'}>
            {e.type === 'otorgado' ? '+' : '−'}{e.amount} — {e.label} — {new Date(e.date).toLocaleString('es-BO')}
          </div>
        ))}
      </div>
    </div>
  );
}
