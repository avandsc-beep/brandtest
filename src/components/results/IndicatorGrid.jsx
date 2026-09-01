import { Lock, AlertTriangle } from 'lucide-react';
import { categories, categoryHex, evaluableIndicators } from '../../lib/scoring.js';

function scoreColor(score) {
  if (score >= 80) return '#7ED957';
  if (score >= 60) return '#D9E021';
  return '#E8604A';
}

// Calcado de renderIndicators() del index.html del colaborador: una
// sección por categoría (.category-section con encabezado sólido del
// color de la categoría) conteniendo la lista de indicadores, no una
// grilla de tarjetas con sombra de color.
export function IndicatorGrid({ indicators, plan }) {
  const isLocked = plan === 'libre';
  return (
    <div>
      {Object.keys(categories).map((catKey) => {
        const keys = Object.keys(evaluableIndicators).filter((k) => evaluableIndicators[k].category === Number(catKey));
        const avg = Math.round(keys.reduce((s, k) => s + indicators[k].score, 0) / keys.length);
        const accent = categoryHex[catKey];
        return (
          <div key={catKey} className="bx-category-section">
            <div className="bx-category-header" style={{ backgroundColor: accent, color: '#0B1213' }}>
              <span>{categories[catKey].name}</span>
              <span>{avg}%</span>
            </div>
            <div className="bx-category-body">
              {keys.map((key) => {
                const def = evaluableIndicators[key];
                const result = indicators[key];
                return (
                  <div key={key} className="bx-indicator-item">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div>
                        <div className="font-semibold text-sm text-on-surface">{def.name}</div>
                        <div className="text-xs text-on-surface-variant">{def.definition}</div>
                      </div>
                      <span className="font-mono text-lg font-semibold whitespace-nowrap" style={{ color: scoreColor(result.score) }}>{result.score}%</span>
                    </div>
                    <div className="bx-score-bar">
                      <div className="bx-score-fill" style={{ width: `${result.score}%`, background: accent }} />
                    </div>
                    {result.confidence != null && (
                      <div className="text-[11px] text-on-surface-variant mt-1 opacity-85 flex items-center gap-1.5">
                        Confianza: {result.confidence}%
                        {result.needsReview && (
                          <span className="text-process-magenta opacity-100 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> cerca del límite entre veredictos, conviene revisión manual
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed max-w-[65ch]">{result.justification}</p>
                    {isLocked ? (
                      <div className="mt-2 pt-2 border-t border-outline-variant/40 flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                        <Lock className="w-3 h-3" />
                        <span>Criterios disponibles en plan Estándar o Pro</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-on-surface-variant mt-2 pl-2 border-l-2 border-outline-variant">
                        {def.criteria.map((c) => (
                          <div key={c}>• {c}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
