const SLIDERS = [
  { key: 'brightness', label: 'Brillo', min: -100, max: 100 },
  { key: 'contrast', label: 'Contraste', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturación', min: -100, max: 100 },
  { key: 'rotation', label: 'Rotación', min: -180, max: 180, suffix: '°' },
];

const WHITE_BALANCE_OPTIONS = [
  { value: 'none', label: 'Sin ajuste' },
  { value: 'auto', label: 'Automático' },
  { value: 'daylight', label: 'Luz día' },
  { value: 'tungsten', label: 'Tungsteno' },
  { value: 'fluorescent', label: 'Fluorescente' },
  { value: 'shade', label: 'Sombra' },
];

// Los ajustes se hornean en píxeles reales vía canvas (src/lib/imageAdjustments.js)
// cada vez que cambia un valor — no es un filtro CSS de sólo vista previa.
export function ImageAdjustmentPanel({ adjustments, onChange }) {
  return (
    <div className="mt-4 pt-4 border-t border-outline-variant">
      {SLIDERS.map(({ key, label, min, max, suffix }) => (
        <div key={key} className="bx-control-row">
          <label>{label}</label>
          <input
            type="range" min={min} max={max} value={adjustments[key]}
            onChange={(e) => onChange({ [key]: Number(e.target.value) })}
          />
          <span>{adjustments[key]}{suffix || ''}</span>
        </div>
      ))}
      <div className="bx-control-row">
        <label>Balance</label>
        <select
          value={adjustments.whiteBalance}
          onChange={(e) => onChange({ whiteBalance: e.target.value })}
          className="bx-form-input flex-1 py-1.5 text-xs"
        >
          {WHITE_BALANCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
