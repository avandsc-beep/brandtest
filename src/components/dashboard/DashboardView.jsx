import { useEffect, useState } from 'react';
import { Coins, Search, MessageCircle, ShieldCheck, Sparkles, FileText, Trash2, ExternalLink, CalendarDays } from 'lucide-react';
import { supabaseClient } from '../../lib/supabaseClient.js';
import { typologies } from '../../lib/typology.js';
import { diagnosticVerdict } from '../../lib/scoring.js';
import { useDiagnosisHistory } from '../../hooks/useDiagnosisHistory.js';
import { Reveal } from '../common/Reveal.jsx';
import { BillingSection } from './BillingSection.jsx';
import { CouponRedeem } from './CouponRedeem.jsx';
import { getInitials } from '../../lib/textUtils.js';

const SUPPORT_WHATSAPP = '59170857324';

function StatusBadge({ score }) {
  const verdict = diagnosticVerdict(score);
  return (
    <span
      className="px-2 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap"
      style={{ color: verdict.color, background: verdict.color + '1f' }}
    >
      {verdict.stampLabel}
    </span>
  );
}

export function DashboardView({ user, patchUser, onViewHistoryResult }) {
  const { fetchHistory, loadHistoryEntry, deleteHistoryEntry } = useDiagnosisHistory({ user, isGuest: false });
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchHistory()
      .then(setHistory)
      .catch(() => setHistoryError('No se pudo cargar el historial.'));
  }, [fetchHistory]);

  const handleSaveWhatsapp = async (e) => {
    e.preventDefault();
    const digits = whatsapp.trim().replace(/\D/g, '');
    if (!digits) return;
    setSavingWhatsapp(true);
    const { error } = await supabaseClient.from('users').update({ whatsapp: digits }).eq('id', user.id);
    setSavingWhatsapp(false);
    if (error) {
      setWhatsappMsg('No se pudo guardar: ' + error.message);
      return;
    }
    patchUser({ whatsapp: digits });
    setWhatsappMsg('WhatsApp guardado.');
  };

  const handleRequestCredits = () => {
    const number = (user?.whatsapp || whatsapp).trim();
    if (!number) {
      setWhatsappMsg('Primero guardá tu WhatsApp para poder solicitar créditos.');
      return;
    }
    const message = `Hola Marco, solicito créditos para BRANDEX. Mi número es ${number}`;
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleOpenEntry = async (id) => {
    try {
      const results = await loadHistoryEntry(id);
      onViewHistoryResult(results);
    } catch (err) {
      setHistoryError(err.message);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar este diagnóstico de tu historial? No se puede deshacer.')) return;
    setDeletingId(id);
    const { error } = await deleteHistoryEntry(id);
    setDeletingId(null);
    if (error) {
      setHistoryError('No se pudo eliminar: ' + error);
      return;
    }
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const filtered = (history || []).filter((h) =>
    !search || (h.brand_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const memberSince = user?.registration_date
    ? new Date(user.registration_date).toLocaleDateString('es-BO', { year: 'numeric', month: 'long' })
    : null;

  const stats = [
    { icon: Coins, label: 'Créditos disponibles', value: user?.credits?.toLocaleString() ?? 0, colorClass: 'text-process-cyan' },
    { icon: Sparkles, label: 'Análisis realizados', value: user?.total_analyses ?? 0, colorClass: 'text-process-magenta' },
    { icon: FileText, label: 'Diagnósticos guardados', value: history?.length ?? '—', colorClass: 'text-process-yellow' },
    { icon: ShieldCheck, label: 'Plan actual', value: (user?.plan || 'libre').toUpperCase(), colorClass: 'text-on-surface' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <Reveal>
        <div className="bx-card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-background border-2 border-process-cyan flex items-center justify-center overflow-hidden shrink-0">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-xl font-bold text-process-cyan">{getInitials(user?.name)}</span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-on-surface">{user?.name}</h1>
                {user?.is_admin && (
                  <span className="px-2 py-0.5 rounded-full bg-process-yellow/15 text-process-yellow text-[11px] font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                )}
              </div>
              <p className="text-sm text-on-surface-variant mt-1">{user?.email}</p>
              {memberSince && (
                <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3" /> Miembro desde {memberSince}
                </p>
              )}
            </div>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <Reveal key={s.label} delay={i * 70}>
              <div className="bx-card py-4">
                <Icon className={`w-4 h-4 mb-2 ${s.colorClass}`} />
                <div className={`font-display text-xl font-bold ${s.colorClass}`}>{s.value}</div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">{s.label}</div>
              </div>
            </Reveal>
          );
        })}
      </div>

      <CouponRedeem patchUser={patchUser} />

      <BillingSection user={user} patchUser={patchUser} />

      <Reveal delay={150}>
        <div className="bx-card">
          <div className="bx-card-title">Créditos & soporte</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <form onSubmit={handleSaveWhatsapp}>
              <div className="bx-form-group">
                <label>WhatsApp (para soporte y solicitar créditos)</label>
                <div className="flex gap-2">
                  <input
                    value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="Ej: 59171234567"
                    className="bx-form-input"
                  />
                  <button type="submit" disabled={savingWhatsapp} className="bx-btn disabled:opacity-50">
                    {savingWhatsapp ? '…' : 'Guardar'}
                  </button>
                </div>
              </div>
              {whatsappMsg && <p className="text-sm text-on-surface-variant">{whatsappMsg}</p>}
            </form>

            <div className="flex flex-col justify-center items-start sm:items-end text-left sm:text-right gap-2">
              <p className="text-sm text-on-surface-variant max-w-xs">
                ¿Te quedaste sin créditos? Pedí más directo por WhatsApp — te respondemos a la brevedad.
              </p>
              <button onClick={handleRequestCredits} className="bx-btn bx-btn-primary flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> Solicitar créditos
              </button>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={200}>
        <div className="bx-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant pb-4 mb-4">
            <h2 className="font-display text-xl font-bold text-on-surface">Historial de diagnósticos</h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar marca…"
                className="bx-form-input pl-8 py-2 w-56"
              />
            </div>
          </div>

          {historyError && <p className="text-sm text-process-magenta">{historyError}</p>}
          {history === null && !historyError && <p className="text-sm text-on-surface-variant">Cargando…</p>}
          {history && history.length === 0 && (
            <div className="text-center py-10">
              <FileText className="w-8 h-8 text-outline-variant mx-auto mb-3" />
              <p className="text-sm text-on-surface-variant">Todavía no guardaste ningún diagnóstico.</p>
            </div>
          )}
          {history && history.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-on-surface-variant">Ningún diagnóstico coincide con "{search}".</p>
          )}

          {filtered.length > 0 && (
            <div className="space-y-2.5">
              {filtered.map((h, i) => (
                <Reveal key={h.id} delay={i * 40}>
                  <button
                    onClick={() => handleOpenEntry(h.id)}
                    className="bx-indicator-item w-full text-left flex items-center justify-between gap-4 hover:border-process-cyan transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-on-surface font-semibold text-sm truncate">{h.brand_name || 'Marca sin nombre'}</span>
                        <StatusBadge score={h.overall_score} />
                      </div>
                      <div className="text-on-surface-variant text-xs mt-1">
                        {typologies[h.typology]?.name || h.typology} · {new Date(h.created_at).toLocaleDateString('es-BO')} · Plan {h.plan}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-display text-xl font-bold text-process-cyan">{h.overall_score}%</span>
                      <ExternalLink className="w-4 h-4 text-on-surface-variant group-hover:text-process-cyan transition-colors" />
                      <button
                        onClick={(e) => handleDelete(e, h.id)}
                        disabled={deletingId === h.id}
                        title="Eliminar de mi historial"
                        className="p-1.5 rounded-full text-on-surface-variant hover:text-process-magenta hover:bg-process-magenta/10 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </button>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
