import { useEffect, useState } from 'react';
import { supabaseClient } from '../../lib/supabaseClient.js';
import { Reveal } from '../common/Reveal.jsx';

export function MetricsTab() {
  const [stats, setStats] = useState(null);
  const [publicStats, setPublicStats] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [usersRes, grantedRes, spentRes, diagRes, calibRes, recogRes, settingsRes] = await Promise.all([
          supabaseClient.from('users').select('total_analyses', { count: 'exact' }),
          supabaseClient.from('credit_history').select('amount'),
          supabaseClient.from('credit_usage_log').select('amount'),
          supabaseClient.from('diagnosis_history').select('id', { count: 'exact', head: true }),
          supabaseClient.from('calibration_samples').select('id', { count: 'exact', head: true }),
          supabaseClient.from('recognition_responses').select('correct'),
          supabaseClient.from('app_settings').select('show_public_stats').eq('id', 1).single(),
        ]);
        const totalUsers = usersRes.count ?? (usersRes.data || []).length;
        const totalAnalyses = (usersRes.data || []).reduce((s, u) => s + (u.total_analyses || 0), 0);
        const creditsGranted = (grantedRes.data || []).reduce((s, r) => s + r.amount, 0);
        const creditsSpent = (spentRes.data || []).reduce((s, r) => s + r.amount, 0);
        const recognitionTotal = (recogRes.data || []).length;
        const recognitionCorrect = (recogRes.data || []).filter((r) => r.correct).length;
        setStats([
          { label: 'Usuarios registrados', value: totalUsers },
          { label: 'Análisis realizados', value: totalAnalyses },
          { label: 'Créditos otorgados', value: creditsGranted },
          { label: 'Créditos gastados', value: creditsSpent },
          { label: 'Diagnósticos guardados', value: diagRes.count ?? 0 },
          { label: 'Muestras de calibración', value: calibRes.count ?? 0 },
          { label: 'Respuestas de reconocimiento', value: recognitionTotal },
          { label: 'Aciertos de reconocimiento', value: recognitionTotal ? Math.round((recognitionCorrect / recognitionTotal) * 100) + '%' : '0%' },
        ]);
        setPublicStats(settingsRes.data ? settingsRes.data.show_public_stats : false);
      } catch {
        setStats([]);
      }
    })();
  }, []);

  const toggle = async (checked) => {
    setPublicStats(checked);
    await supabaseClient.from('app_settings').update({ show_public_stats: checked }).eq('id', 1);
  };

  return (
    <div className="text-sm space-y-4">
      <p className="text-on-surface-variant">Salud general del proyecto — no solo créditos, también uso real y participación en calibración.</p>
      {stats === null && <p className="text-on-surface-variant">Cargando…</p>}
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
      <label className="flex items-center gap-2 pt-2">
        <input type="checkbox" checked={publicStats} onChange={(e) => toggle(e.target.checked)} className="accent-process-cyan" />
        <span className="text-on-surface-variant">Mostrar estas estadísticas en la pantalla de login (público)</span>
      </label>
    </div>
  );
}
