import { Check } from 'lucide-react';
import { typologies } from '../../lib/typology.js';

// Mismo patrón reutilizado en 3 lugares de legacy (selector principal,
// banco de calibración, test de reconocimiento) — acá como un solo
// componente en vez de HTML repetido.
export function TypologyGrid({ value, onChange, showAutoOption = true }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {showAutoOption && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`sm:col-span-2 p-4 rounded-xl border text-left transition-all ${
            value === null ? 'border-process-cyan border-2 bg-surface-container-highest' : 'border-outline-variant bg-background hover:border-outline'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-sm text-on-surface">Detectar automáticamente</span>
            {value === null && <Check className="w-4 h-4 text-process-cyan stroke-[3]" />}
          </div>
          <p className="text-xs text-on-surface-variant">
            El sistema analiza la geometría de la imagen y sugiere la tipología. Podrás corregirla después si hace falta.
          </p>
        </button>
      )}
      {Object.entries(typologies).map(([key, t]) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`p-4 rounded-xl border text-left transition-all ${
              selected ? 'border-process-cyan border-2 bg-surface-container-highest' : 'border-outline-variant bg-background hover:border-outline'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-on-surface">{t.name}</span>
              {selected && <Check className="w-4 h-4 text-process-cyan stroke-[3]" />}
            </div>
            <p className="text-xs text-on-surface-variant">{t.description}</p>
          </button>
        );
      })}
    </div>
  );
}
