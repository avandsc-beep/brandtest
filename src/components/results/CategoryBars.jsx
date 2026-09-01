import { useEffect, useState } from 'react';
import { categories, categoryHex, evaluableIndicators } from '../../lib/scoring.js';

export function CategoryBars({ indicators }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="space-y-4">
      {Object.keys(categories).map((catKey) => {
        const catIndicatorKeys = Object.keys(evaluableIndicators).filter((k) => evaluableIndicators[k].category === parseInt(catKey, 10));
        const catScores = catIndicatorKeys.map((k) => indicators[k].score);
        const avg = Math.round(catScores.reduce((a, b) => a + b, 0) / catScores.length);
        const color = categoryHex[catKey];
        const tier = avg >= 70 ? 'Sólido' : avg >= 50 ? 'Aceptable' : 'Débil';
        return (
          <div key={catKey} className="mb-4 last:mb-0">
            <div className="flex justify-between items-baseline gap-3 mb-1.5">
              <span className="text-sm font-semibold text-on-surface">{categories[catKey].name}</span>
              <span style={{ color }} className="font-mono font-bold text-sm whitespace-nowrap">{avg}% — {tier}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-outline-variant overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: animated ? `${avg}%` : '0%', background: color }} />
            </div>
            <div className="mt-2 text-xs text-on-surface-variant leading-relaxed">
              {catIndicatorKeys.map((k, i) => (
                <span key={k}>
                  <strong className="text-on-surface">{evaluableIndicators[k].name}</strong> {indicators[k].score}%
                  {i < catIndicatorKeys.length - 1 ? '  ·  ' : ''}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
