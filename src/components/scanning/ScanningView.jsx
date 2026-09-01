import { useEffect, useRef, useState } from 'react';
import { Cpu } from 'lucide-react';
import { useBrandAnalysis } from '../../hooks/useBrandAnalysis.js';

// A diferencia del mockup original (una animación con tiempos inventados),
// el progreso acá refleja hitos REALES del pipeline (useBrandAnalysis
// emite cada etapa según ocurre) — en el camino común (sin IA activa) esto
// dura bien menos de un segundo, así que se aplica un mínimo de tiempo
// visible por prolijidad, no un tiempo falso de análisis.
const STAGE_LABELS = {
  decoding: { pct: 20, log: 'Decodificando imagen…', stage: 'Ingesta de parámetros' },
  scoring: { pct: 55, log: 'Midiendo contraste, geometría y color…', stage: 'Análisis de factura formal' },
  ai: { pct: 75, log: 'Consultando motor de IA (con fallback a reglas locales)…', stage: 'Evaluación de indicadores' },
  finishing: { pct: 95, log: 'Aplicando veto de indicadores de piso…', stage: 'Generando informe' },
  done: { pct: 100, log: 'Diagnóstico finalizado.', stage: 'Completado' },
};

const MIN_VISIBLE_MS = 900;

export function ScanningView({ payload, isGuest, brandNameHint, onComplete, onError }) {
  const { runAnalysis } = useBrandAnalysis();
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [currentStage, setCurrentStage] = useState('Calibrando vectores');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const startedAt = Date.now();

    const onStage = (key) => {
      const info = STAGE_LABELS[key];
      if (!info) return;
      setProgress(info.pct);
      setCurrentStage(info.stage);
      setLogs((l) => [...l, info.log]);
    };

    (async () => {
      try {
        const results = await runAnalysis({ ...payload, isGuest, onStage });
        onStage('done');
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
        setTimeout(() => onComplete(results), wait);
      } catch (err) {
        onError(err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="bx-card w-full max-w-lg text-on-surface">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2.5 h-2.5 rounded-full bg-process-cyan animate-ping"></div>
          <span className="text-sm font-semibold text-process-cyan">Analizando marca</span>
        </div>

        <div className="text-center mb-6">
          <div className="w-32 h-32 mx-auto rounded-full border-2 border-process-cyan/40 flex items-center justify-center relative overflow-hidden bg-background">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-process-cyan/20 to-transparent animate-spin"></div>
            {payload.imageSrc ? (
              <img src={payload.imageSrc} alt="Marca en análisis" className="w-16 h-16 object-contain relative z-10" />
            ) : (
              <Cpu className="w-10 h-10 text-process-cyan relative z-10" />
            )}
          </div>
          <div className="mt-4 font-display text-2xl font-bold text-on-surface">{brandNameHint || 'Marca'}</div>
          <div className="text-xs text-process-cyan mt-1">{currentStage}</div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-on-surface-variant">
            <span>Progreso del diagnóstico</span>
            <span className="text-on-surface font-semibold">{progress}%</span>
          </div>
          <div className="bx-score-bar">
            <div className="bx-score-fill" style={{ width: `${progress}%`, background: 'var(--color-process-cyan)' }} />
          </div>
        </div>

        <div className="mt-5 p-3.5 rounded-xl bg-background border border-outline-variant text-xs h-28 overflow-y-auto space-y-1 text-on-surface-variant">
          {logs.map((log, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-process-cyan">&gt;</span>
              <span className={index === logs.length - 1 ? 'text-on-surface font-medium' : ''}>{log}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
