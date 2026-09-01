import { ShieldAlert } from 'lucide-react';
import { typologies } from '../../lib/typology.js';
import {
  diagnosticVerdict, getGateInfo, isGateApplied, getCategoryBreakdown,
  getWeakRecommendations, evaluableIndicators,
} from '../../lib/scoring.js';
import { classifyColors } from '../../lib/imageAnalysis.js';
import { TESTING_MODE } from '../../hooks/useCredits.js';

// Reconstruye como JSX el mismo contenido que legacyApp.js generateDiagnostic()
// generaba como un solo bloque de HTML — separado en secciones reales de
// React en vez de un string armado a mano.
export function DiagnosticText({ typology, indicators, rawData, plan, aiSummary }) {
  const t = typologies[typology.type];
  const overall = Math.round(
    Object.keys(indicators).reduce((s, k) => s + indicators[k].score * evaluableIndicators[k].weight, 0) /
      Object.keys(indicators).reduce((s, k) => s + evaluableIndicators[k].weight, 0)
  );
  const verdict = diagnosticVerdict(overall);
  const gate = getGateInfo(indicators);
  const gateApplied = isGateApplied(indicators, overall);
  const breakdown = getCategoryBreakdown(indicators);
  const recommendations = getWeakRecommendations(indicators);
  const locked = plan === 'libre' && !TESTING_MODE;

  return (
    <div className="space-y-6 text-sm text-on-surface-variant leading-relaxed">
      <section>
        <h3 className="font-display text-base font-semibold text-process-cyan mb-2">Veredicto general</h3>
        <p><strong style={{ color: verdict.color }}>{verdict.title}</strong> — puntuación general {overall}%.</p>
        <p className="mt-1">{verdict.description}</p>
        <p className="mt-1"><strong className="text-on-surface">Recomendación general:</strong> {verdict.recommendation}</p>
      </section>

      {gateApplied && (
        <div className="p-3 rounded-xl bg-process-magenta/10 border border-process-magenta/40 text-sm flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-process-magenta shrink-0 mt-0.5" />
          <span>
            El puntaje general está limitado por <strong className="text-on-surface">{evaluableIndicators[gate.worstKey].name}</strong> ({gate.worstScore}%),
            el indicador más bajo — un problema grave en un solo indicador no se puede "diluir" promediándolo con los demás.
            Vocatividad queda fuera de este límite a propósito: su nivel adecuado depende de la identidad de cada marca
            (Chaves y Belluccia, 2.12), así que un puntaje alto ahí no compensa fallas reales en otro lado.
          </span>
        </div>
      )}

      <div className="p-3 rounded-xl bg-background border border-outline-variant text-sm">
        Este informe es una herramienta de apoyo objetiva, construida a partir de mediciones reales sobre la imagen
        cargada (contraste, geometría, color, composición){aiSummary ? ', complementadas con la lectura visual de un modelo de IA' : ''}.
        No reemplaza el criterio de un profesional del diseño.
        <br /><br />
        Los seis indicadores medidos forman parte del marco de 14 indicadores de calidad de marca desarrollado por
        Norberto Chaves y Raúl Belluccia (2003). Este informe mide 6 de los 14; los ocho restantes (suficiencia,
        vigencia, ajuste tipológico, corrección estilística, compatibilidad semántica, versatilidad, singularidad,
        declinabilidad) requieren contexto adicional que este instrumento no evalúa.
      </div>

      {aiSummary && (
        <section>
          <h3 className="font-display text-base font-semibold text-process-cyan mb-2">Lectura visual (IA)</h3>
          <p>{aiSummary}</p>
        </section>
      )}

      <section>
        <h3 className="font-display text-base font-semibold text-process-cyan mb-2">Análisis estructural</h3>
        <p>La marca fue clasificada como <strong className="text-on-surface">{t.name}</strong>. {t.description}</p>
        <p className="mt-1"><strong className="text-on-surface">Base de la clasificación:</strong> {typology.justification}</p>
      </section>

      <section>
        <h3 className="font-display text-base font-semibold text-process-cyan mb-2">Métricas calculadas</h3>
        <div className="flex flex-wrap gap-2 font-mono text-[11px]">
          {[
            ['Contraste', rawData.contrast.toFixed(2) + ':1'],
            ['Simetría', rawData.symmetryScore + '%'],
            ['Complejidad', rawData.edgeComplexity + '/100'],
            ['Elementos', rawData.effectiveComponentCount ?? rawData.componentCount],
            ['Colores', rawData.colorCount],
            ['Cobertura de tinta', Math.round(rawData.inkRatio * 100) + '%'],
          ].map(([label, value]) => (
            <span key={label} className="px-2.5 py-1 rounded-full bg-background border border-outline-variant">{label}: <strong className="text-on-surface">{value}</strong></span>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-display text-base font-semibold text-process-cyan mb-2">Desglose por categoría</h3>
        <ul className="list-disc list-inside space-y-1">
          {breakdown.map((b) => (
            <li key={b.name}><strong className="text-on-surface">{b.name} ({b.avg}%):</strong> desempeño {b.tier}.</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-display text-base font-semibold text-process-cyan mb-2">Recomendaciones para el diseñador</h3>
        {recommendations.length === 0 ? (
          <p>Los seis indicadores se ubican por encima del umbral de atención (75%): no hay recomendaciones prioritarias pendientes.</p>
        ) : (
          <ul className="list-disc list-inside space-y-1.5">
            {recommendations.map((r) => (
              <li key={r.key}><strong className="text-on-surface">{r.name} ({r.score}%) — {r.label}:</strong> {r.recommendation}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <section>
          <h3 className="font-display text-sm font-semibold text-process-cyan mb-2">Ventajas del tipo</h3>
          <ul className="list-disc list-inside space-y-1">{t.ventajas.map((v) => <li key={v}>{v}</li>)}</ul>
        </section>
        <section>
          <h3 className="font-display text-sm font-semibold text-process-cyan mb-2">Desventajas del tipo</h3>
          <ul className="list-disc list-inside space-y-1">{t.desventajas.map((v) => <li key={v}>{v}</li>)}</ul>
        </section>
      </div>

      {locked ? (
        <p className="text-process-yellow text-sm">
          <strong>Plan Libre:</strong> informe limitado. Actualiza a Estándar o Pro para el detalle completo de indicadores y criterios.
        </p>
      ) : (
        <section data-print-detail>
          <h3 className="font-display text-base font-semibold text-process-cyan mb-2">Resultados por indicador</h3>
          {Object.keys(indicators).map((k) => (
            <p key={k} className="mb-2"><strong className="text-on-surface">{evaluableIndicators[k].name}: {indicators[k].score}%</strong><br />{indicators[k].justification}</p>
          ))}
        </section>
      )}

      <section>
        <h3 className="font-display text-base font-semibold text-process-cyan mb-2">Análisis cromático</h3>
        <p>{rawData.colorCount} colores detectados. {classifyColors(rawData.colorCount)}.</p>
      </section>
    </div>
  );
}
