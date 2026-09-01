import { simulateColorblind } from '../../lib/colorblind.js';

const TYPES = [
  { key: 'protanopia', label: 'Protanopia (rojo-verde)' },
  { key: 'deuteranopia', label: 'Deuteranopia (rojo-verde)' },
  { key: 'tritanopia', label: 'Tritanopia (azul-amarillo)' },
];

export function ColorblindPanel({ palette }) {
  return (
    <div className="space-y-3">
      {TYPES.map((t) => (
        <div key={t.key} className="flex items-center gap-3">
          <span className="w-40 shrink-0 text-[11px] font-mono text-outline">{t.label}</span>
          <div className="flex gap-1.5 flex-wrap">
            {palette.map((c, i) => {
              const sim = simulateColorblind(c.rgb, t.key);
              const hex = '#' + [sim.r, sim.g, sim.b].map((v) => v.toString(16).padStart(2, '0')).join('');
              return <div key={i} className="w-7 h-7 rounded border border-outline-variant" style={{ background: hex }} />;
            })}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-outline font-mono">
        Aproximación (matrices Brettel/Viénot) — no reemplaza una prueba clínica de daltonismo.
      </p>
    </div>
  );
}
