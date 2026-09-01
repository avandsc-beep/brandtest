import { X, BookOpen } from 'lucide-react';

// Contenido real: mismas definiciones, pesos y criterios que usa el motor
// de análisis (src/legacy/legacyApp.js, objeto `indicators`) — no fórmulas
// inventadas, para que este modal describa con precisión lo que la app
// realmente calcula.
const METHODOLOGY_ITEMS = [
  {
    num: '01', code: 'SYS_OK', title: 'Calidad Gráfica', weight: '17%',
    def: 'Competencia técnica en la ejecución del trazo: consistencia de grosores, limpieza de remates y calidad de las uniones entre formas.',
    criteria: ['Precisión en trazado', 'Consistencia de grosores', 'Alineación correcta', 'Limpieza visual', 'Calidad de uniones'],
  },
  {
    num: '02', code: 'PRT_CAL', title: 'Reproducibilidad', weight: '17%',
    def: 'Estabilidad del signo al reducirse de escala, pasar a monocromía o cambiar de soporte de impresión.',
    criteria: ['Legibilidad a 9px (7pt)', 'Funciona en blanco y negro', 'Sin degradados problemáticos', 'Paleta adecuada'],
  },
  {
    num: '03', code: 'VIS_ACT', title: 'Legibilidad', weight: '17%',
    def: 'Relación figura-fondo y contraste tonal que sostienen una lectura fluida del signo.',
    criteria: ['Contraste mínimo 4.5:1 (WCAG)', 'Tamaño adecuado', 'Grosor correcto', 'Espaciado adecuado', 'Sin interferencias visuales'],
  },
  {
    num: '04', code: 'COG_MAP', title: 'Inteligibilidad', weight: '17%',
    def: 'Síntesis formal y relación ícono-referente que permiten decodificar el mensaje sin apoyo textual adicional.',
    criteria: ['Forma reconocible', 'Relación ícono-referente', 'Sin necesidad de explicación adicional', 'Mensaje claro'],
  },
  {
    num: '05', code: 'ATT_LVL', title: 'Vocatividad', weight: '16%',
    def: 'Peso visual y jerarquía perceptual del signo: su capacidad de captar la atención dentro de un campo visual competido.',
    criteria: ['Atención en menos de 3 segundos', 'Contraste mayor a 30%', 'Elemento distintivo', 'Elemento principal ≥25% del área', 'Colores de impacto'],
  },
  {
    num: '06', code: 'MEM_IDX', title: 'Pregnancia', weight: '16%',
    def: 'Cierre gestáltico y memorabilidad de la forma: cuán fácil resulta evocarla y reproducirla de memoria.',
    criteria: ['Descripción verbal simple', '1 a 2 elementos visuales', 'Forma dominante clara', 'Dibujable de memoria'],
  },
];

export function MethodologyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bx-card relative w-full max-w-2xl max-h-[88vh] overflow-y-auto text-on-surface">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-on-surface-variant hover:text-on-surface">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center border-b border-outline-variant pb-5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-process-cyan mx-auto mb-3 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-ink-black" />
          </div>
          <h2 className="font-display text-2xl font-bold">Metodología BRANDEX</h2>
          <p className="font-mono text-xs text-on-surface-variant uppercase tracking-wide mt-1">Fundamentación técnica</p>
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
          BRANDEX calcula 6 de los 14 indicadores de calidad de marca gráfica formalizados por Norberto Chaves y
          Raúl Belluccia (2003), directamente sobre la imagen que cargás — no son estimaciones genéricas.
        </p>

        <div className="space-y-3">
          {METHODOLOGY_ITEMS.map((item) => (
            <div key={item.num} className="bx-indicator-item">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-sm text-on-surface">{item.title}</h4>
                <span className="font-mono text-xs text-process-cyan">Peso {item.weight}</span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-2">{item.def}</p>
              <div className="pt-2 border-t border-outline-variant text-[11px] text-on-surface-variant">
                <div className="uppercase tracking-wide mb-1 opacity-80">Se evalúa mediante:</div>
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {item.criteria.map((c) => (
                    <li key={c}>• {c}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="bx-btn bx-btn-primary w-full mt-5">
          Entendido
        </button>
      </div>
    </div>
  );
}
