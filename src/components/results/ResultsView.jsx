import { useState } from 'react';
import { Printer, RotateCcw, CheckCircle2, Eye, EyeOff, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useFeedback } from '../../hooks/useFeedback.js';
import { RadarChart } from './RadarChart.jsx';
import { CategoryBars } from './CategoryBars.jsx';
import { IndicatorGrid } from './IndicatorGrid.jsx';
import { ColorPalette } from './ColorPalette.jsx';
import { ColorblindPanel } from './ColorblindPanel.jsx';
import { DiagnosticText } from './DiagnosticText.jsx';
import { TypologyCorrectionModal } from './TypologyCorrectionModal.jsx';
import { typologies } from '../../lib/typology.js';
import { calculateOverall, recalculateReproducibilidad, diagnosticVerdict } from '../../lib/scoring.js';
import { classifyColors } from '../../lib/imageAnalysis.js';
import { TESTING_MODE } from '../../hooks/useCredits.js';

const PROFILE_OPTIONS = [
  { key: 'general', label: 'General' },
  { key: 'disenador', label: 'Diseñador / Estudiante' },
  { key: 'experto', label: 'Experto' },
];

// Maquetación calcada de la sección de resultados del index.html del
// colaborador (tarjetas redondeadas .bx-card, insignia de veredicto como
// pastilla simple sin rotar — su propio comentario dice que el sello de
// imprenta girado "no encaja con esta identidad nueva"), no el sistema de
// sombra dura/reg-marks de las primeras iteraciones de este archivo.
export function ResultsView({ result, user, isGuest, profile = 'general', onChangeProfile, onSaveToHistory, onNewAnalysis }) {
  const [current, setCurrent] = useState(result);
  const [excludedIndices, setExcludedIndices] = useState(new Set());
  const [showColorblind, setShowColorblind] = useState(false);
  const [isTypologyModalOpen, setIsTypologyModalOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const { reportTypologyCorrection, reportDiagnosticFeedback } = useFeedback({ user, isGuest });

  const locked = current.plan === 'libre' && !TESTING_MODE;

  const toggleExcludeColor = (index) => {
    const next = new Set(excludedIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setExcludedIndices(next);

    const total = current.colors.palette.length;
    const effectiveCount = Math.max(1, total - next.size);
    const reproDetail = recalculateReproducibilidad(effectiveCount, current.rawData.contrast, next.size, total);
    const nextIndicators = { ...current.indicators, reproducibilidad: reproDetail };
    const nextOverall = calculateOverall(nextIndicators);
    setCurrent({
      ...current,
      indicators: nextIndicators,
      overallScore: nextOverall,
      colors: {
        ...current.colors,
        classification: classifyColors(effectiveCount) + (next.size ? ' — paleta curada manualmente' : ''),
      },
    });
  };

  const handleAcceptTypology = (typeKey) => {
    reportTypologyCorrection(current.typology.type, typeKey);
    setCurrent({
      ...current,
      typology: {
        type: typeKey,
        name: typologies[typeKey].name,
        confidence: 100,
        justification: 'Tipología corregida manualmente por el usuario.',
      },
    });
    setIsTypologyModalOpen(false);
  };

  const handleDiagnosticFeedback = (positive) => {
    reportDiagnosticFeedback({ positive, typology: current.typology.type, overallScore: current.overallScore, plan: current.plan });
    setFeedbackSent(true);
  };

  const handleSave = () => {
    onSaveToHistory(current);
    setSaved(true);
  };

  const handlePrint = (mode) => {
    document.body.classList.toggle('print-summary', mode === 'summary');
    window.print();
    setTimeout(() => document.body.classList.remove('print-summary'), 500);
  };

  const verdict = diagnosticVerdict(current.overallScore);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {onChangeProfile && (
        <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
          <span className="text-sm text-on-surface-variant">Ver como:</span>
          {PROFILE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onChangeProfile(opt.key)}
              className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${
                profile === opt.key
                  ? 'bg-process-cyan text-ink-black border-process-cyan font-semibold'
                  : 'bg-surface-container-highest border-outline-variant text-on-surface-variant hover:border-process-cyan'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="bx-strip mb-4">
        <img src={current.imageUsed} alt={current.brandNameUsed} />
        <div className="min-w-0">
          <div className="font-semibold text-sm text-on-surface truncate">{current.brandNameUsed || 'Marca sin nombre'}</div>
          <div className="font-mono text-[11px] text-on-surface-variant uppercase tracking-wide">
            {current.sectorUsed || 'General'} · {current.typology.name} · Plan {current.plan}
          </div>
        </div>
      </div>

      <div className="relative mb-5">
        <div className="bx-score-display">
          <div className="bx-score-value">
            {current.overallScore}<span>%</span>
          </div>
          <div className="bx-score-label">Puntuación general</div>
        </div>
        <div className="bx-verdict-pill" style={{ background: verdict.color }}>
          <span className="bx-verdict-pill-text">{verdict.stampLabel}</span>
        </div>
      </div>

      <div className="bx-card mb-5">
        <div className="bx-card-title">
          Radar de indicadores <span className="bx-eyebrow">Vista principal del informe</span>
        </div>
        <div className="flex justify-center">
          <RadarChart indicators={current.indicators} />
        </div>
      </div>

      <div className="bx-card mb-5">
        <div className="bx-card-title">Resumen por categoría</div>
        <CategoryBars indicators={current.indicators} />
      </div>

      <div className="bx-card mb-5">
        <div className="bx-card-title">
          Tipología marcaria
          <button onClick={() => setIsTypologyModalOpen(true)} className="text-xs font-mono text-process-cyan hover:underline normal-case font-normal">Corregir</button>
        </div>
        <p className="text-sm text-on-surface-variant leading-relaxed max-w-[65ch]">{current.typology.justification}</p>
        <p className="font-mono text-[11px] text-on-surface-variant uppercase tracking-wide mt-2 mb-1">Confianza: {current.typology.confidence}%</p>
        <div className="bx-confidence-bar">
          <div className="bx-confidence-fill" style={{ width: `${current.typology.confidence}%` }} />
        </div>
      </div>

      <div className="bx-card mb-5">
        <div className="bx-card-title">Paleta cromática</div>
        <p className="text-sm text-on-surface-variant mb-3">Toca un color para excluirlo si no pertenece a la marca (ruido de foto, sombra, fondo) y recalcula.</p>
        <ColorPalette
          palette={current.colors.palette} excludedIndices={excludedIndices}
          onToggleExclude={toggleExcludeColor} classification={current.colors.classification}
        />
        <button
          onClick={() => setShowColorblind((v) => !v)}
          className="mt-4 px-3.5 py-1.5 rounded-full border border-outline-variant text-sm text-process-cyan hover:border-process-cyan flex items-center gap-1.5"
        >
          {showColorblind ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showColorblind ? 'Ocultar simulación de daltonismo' : 'Simular daltonismo'}
        </button>
        {showColorblind && <div className="mt-4"><ColorblindPanel palette={current.colors.palette} /></div>}
      </div>

      {!locked && profile !== 'general' && <div data-print-detail className="mb-5"><IndicatorGrid indicators={current.indicators} plan={current.plan} /></div>}

      {profile === 'experto' && (
        <div className="bx-card mb-5">
          <div className="bx-card-title">
            Variables crudas <span className="bx-eyebrow">Solo perfil Experto</span>
          </div>
          <p className="text-sm text-on-surface-variant mb-4">
            Las lecturas directas sobre la imagen, antes de convertirse en puntaje de indicador — para auditar el cálculo, no una interpretación.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="text-on-surface-variant">Contraste <span className="block text-on-surface text-sm">{current.rawData.contrast?.toFixed(2)}:1</span></div>
            <div className="text-on-surface-variant">Simetría <span className="block text-on-surface text-sm">{current.rawData.symmetryScore}%</span></div>
            <div className="text-on-surface-variant">Complejidad <span className="block text-on-surface text-sm">{current.rawData.edgeComplexity}/100</span></div>
            <div className="text-on-surface-variant">Elementos <span className="block text-on-surface text-sm">{current.rawData.effectiveComponentCount ?? current.rawData.componentCount}</span></div>
            <div className="text-on-surface-variant">Colores <span className="block text-on-surface text-sm">{current.rawData.colorCount}</span></div>
            <div className="text-on-surface-variant">Cobertura de tinta <span className="block text-on-surface text-sm">{Math.round((current.rawData.inkRatio ?? 0) * 100)}%</span></div>
            <div className="text-on-surface-variant">Ancho x alto <span className="block text-on-surface text-sm">{current.rawData.W} x {current.rawData.H}</span></div>
          </div>
        </div>
      )}

      <div className="bx-card mb-5">
        <div className="bx-card-title">
          Diagnóstico general <span className="bx-eyebrow">Basado en la imagen cargada</span>
        </div>
        <DiagnosticText
          typology={current.typology} indicators={current.indicators} rawData={current.rawData}
          plan={current.plan} aiSummary={current.aiSummary}
        />
        <div className="mt-5 pt-4 border-t border-outline-variant flex items-center gap-3 text-sm print:hidden">
          {feedbackSent ? (
            <span className="text-on-surface-variant">Gracias, quedó registrado.</span>
          ) : (
            <>
              <span className="text-on-surface-variant">¿Te parece acertado este diagnóstico?</span>
              <button onClick={() => handleDiagnosticFeedback(true)} className="px-3 py-1.5 rounded-full border border-outline-variant hover:border-process-cyan text-on-surface"><ThumbsUp className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDiagnosticFeedback(false)} className="px-3 py-1.5 rounded-full border border-outline-variant hover:border-process-magenta text-on-surface"><ThumbsDown className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      </div>

      {!locked && (
        <div className="bx-card mb-5 print:hidden">
          <div className="bx-card-title">Exportar informe</div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => handlePrint('complete')} className="bx-btn bx-btn-primary flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Informe completo
            </button>
            <button onClick={() => handlePrint('summary')} className="bx-btn flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Informe resumido
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 print:hidden">
        <button
          onClick={handleSave} disabled={saved}
          className={`bx-btn flex-1 flex items-center justify-center gap-2 ${saved ? "bx-btn-success" : ""}`}
        >
          <CheckCircle2 className="w-4 h-4" /> {saved ? 'Guardado en tu historial' : 'Guardar en mi historial'}
        </button>
        <button onClick={onNewAnalysis} className="bx-btn bx-btn-accent flex-1 flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" /> Nuevo análisis
        </button>
      </div>

      <TypologyCorrectionModal
        isOpen={isTypologyModalOpen} currentType={current.typology.type}
        onClose={() => setIsTypologyModalOpen(false)} onAccept={handleAcceptTypology}
      />
    </div>
  );
}
