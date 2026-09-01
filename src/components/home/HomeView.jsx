import { Layers, Maximize2, Eye, BrainCircuit, Target, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { BrandMark } from '../layout/BrandLogo.jsx';
import { Reveal } from '../common/Reveal.jsx';

// Definiciones idénticas a las usadas por el motor real (src/lib/scoring.js) —
// no se inventan descripciones nuevas para el marketing.
const PARAMETERS = [
  { title: 'Calidad Gráfica', icon: Layers, desc: 'Competencia técnica en la ejecución del trazo: consistencia de grosores, limpieza de remates y calidad de las uniones entre formas.' },
  { title: 'Reproducibilidad', icon: Maximize2, desc: 'Estabilidad del signo al reducirse de escala, pasar a monocromía o cambiar de soporte de impresión.' },
  { title: 'Legibilidad', icon: Eye, desc: 'Relación figura-fondo y contraste tonal que sostienen una lectura fluida del signo.' },
  { title: 'Inteligibilidad', icon: BrainCircuit, desc: 'Síntesis formal y relación ícono-referente que permiten decodificar el mensaje sin apoyo textual adicional.' },
  { title: 'Vocatividad', icon: Target, desc: 'Peso visual y jerarquía perceptual del signo: su capacidad de captar la atención dentro de un campo visual competido.' },
  { title: 'Pregnancia', icon: Sparkles, desc: 'Cierre gestáltico y memorabilidad de la forma: cuán fácil resulta evocarla y reproducirla de memoria.' },
];

const PLANS = [
  { id: 'libre', name: 'Libre', price: '0', desc: '1 análisis cada 12 horas · Informe básico.', features: ['Puntaje general y tipología marcaria', 'Diagnóstico resumido'] },
  { id: 'estandar', name: 'Estándar', price: '10', popular: true, desc: 'Informe detallado y exportación completa.', features: ['Los 6 indicadores completos', 'Diagnóstico técnico detallado', 'Exportar informe (PDF)'] },
  { id: 'pro', name: 'Pro', price: '20', desc: 'Máxima precisión y análisis avanzado.', features: ['Todo lo de Estándar', 'Mayor precisión de análisis', 'Prioridad de procesamiento'] },
];

const STEPS = [
  'Entrá con tu cuenta de Google',
  'Subí una foto de tu marca o tomala con la cámara',
  'Ajustá la imagen si lo necesitás',
  'Agregá contexto opcional (nombre, rubro, competencia)',
  'Elegí tu plan y analizá',
  'Recibí resultados con gráficos y diagnóstico técnico',
];

// Calcado del sistema del colaborador: tarjetas redondeadas (.bx-card),
// sin sombra dura ni miras de registro, tipografía en caja normal (su
// .intro-title/.login-title no llevan text-transform). El hero es la
// misma tarjeta de acceso que .login-card, no un titular gigante en
// mayúsculas — la landing completa (parámetros, planes) vive debajo como
// contenido de apoyo, igual que él la distribuyó dentro del modal
// "Cómo funciona".
export function HomeView({ onRequireAuth, onOpenMethodology }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <Reveal>
        <div className="bx-login-card mx-auto">
          <div className="bx-login-stage">
            <div className="bx-login-icon-wrap"><BrandMark className="w-full h-full text-process-cyan" /></div>
          </div>
          <p className="font-mono text-xs text-on-surface-variant uppercase tracking-widest mb-2">Laboratorio de identidad visual</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">Bienvenido a BRANDEX</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-8 max-w-sm mx-auto">
            Instrumento de medición y diagnóstico de marcas gráficas: 6 de los 14 indicadores de calidad de Chaves y
            Belluccia, calculados sobre la imagen real de tu marca.
          </p>
          <button onClick={onRequireAuth} className="bx-btn bx-btn-primary w-full py-3.5 flex items-center justify-center gap-2">
            <span>Iniciar diagnóstico</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={onOpenMethodology} className="mt-3 text-sm text-process-cyan hover:underline font-medium">
            Ver metodología técnica
          </button>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bx-card py-4 px-2">
            <div className="font-display text-xl font-bold text-process-cyan">6</div>
            <div className="text-[11px] text-on-surface-variant">dimensiones</div>
          </div>
          <div className="bx-card py-4 px-2">
            <div className="font-display text-xl font-bold text-process-magenta">Píxel real</div>
            <div className="text-[11px] text-on-surface-variant">origen de datos</div>
          </div>
          <div className="bx-card py-4 px-2">
            <div className="font-display text-xl font-bold text-on-surface">10 gratis</div>
            <div className="text-[11px] text-on-surface-variant">créditos de bienvenida</div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="bx-card">
          <div className="bx-card-title">Parámetros de análisis <span className="bx-eyebrow">Seis indicadores medidos</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PARAMETERS.map((param) => {
              const Icon = param.icon;
              return (
                <div key={param.title} className="flex gap-3">
                  <div className="w-9 h-9 rounded-full border border-outline-variant flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-process-cyan" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-on-surface">{param.title}</div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{param.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      <Reveal delay={160}>
        <div className="bx-card">
          <div className="bx-card-title">Cómo funciona</div>
          <ol className="space-y-2 text-sm text-on-surface-variant list-decimal list-inside">
            {STEPS.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      </Reveal>

      <Reveal delay={200}>
        <div className="bx-card">
          <div className="bx-card-title">Planes</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {PLANS.map((plan) => (
              <div key={plan.id} className="bx-plan-card relative">
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-process-cyan text-ink-black text-[10px] font-bold uppercase tracking-wide">
                    Recomendado
                  </div>
                )}
                <div className="bx-plan-name">{plan.name}</div>
                <div className="bx-plan-price">{plan.price}</div>
                <p className="bx-plan-desc mb-3">{plan.desc}</p>
                <ul className="text-left space-y-1.5 text-[11px] text-on-surface-variant">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-process-cyan shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button onClick={onRequireAuth} className="bx-btn bx-btn-primary w-full py-3">Empezar ahora</button>
          <p className="mt-3 text-center text-xs text-on-surface-variant">
            Al registrarte con Google recibís <strong className="text-on-surface">10 créditos gratis</strong> para probar cualquier plan.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
