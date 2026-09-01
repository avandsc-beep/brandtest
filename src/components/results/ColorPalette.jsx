export function ColorPalette({ palette, excludedIndices, onToggleExclude, classification }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {palette.map((c, i) => {
          const excluded = excludedIndices.has(i);
          return (
            <button
              key={i} type="button" onClick={() => onToggleExclude(i)}
              title={`${c.hex} — ${c.percentage}%${excluded ? ' (excluido)' : ''}`}
              className={`relative w-11 h-11 rounded-lg border transition-all ${excluded ? 'opacity-30 border-outline' : 'border-outline-variant'}`}
              style={{ background: c.hex }}
            >
              {excluded && <span className="absolute inset-0 flex items-center justify-center text-white text-lg">✕</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs font-mono text-on-surface-variant">{classification}</p>
    </div>
  );
}
