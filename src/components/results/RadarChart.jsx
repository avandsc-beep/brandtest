import { useEffect, useRef, useState } from 'react';
import { evaluableIndicators, categoryHex } from '../../lib/scoring.js';

const RADAR_SHORT_LABELS = {
  calidad_grafica: 'Calidad',
  reproducibilidad: 'Reproducib.',
  legibilidad: 'Legibilidad',
  inteligibilidad: 'Inteligib.',
  vocatividad: 'Vocatividad',
  pregnancia: 'Pregnancia',
};

const SIZE = 340;
const CENTER = SIZE / 2;
const RADIUS = 112;
const LABEL_OFFSET = 30;

// Mismo trazado que legacyApp.js renderRadarChart(), como SVG declarativo
// de React en vez de innerHTML — con el mismo dibujo animado del polígono.
export function RadarChart({ indicators }) {
  const keys = Object.keys(evaluableIndicators);
  const values = keys.map((k) => indicators[k].score);
  const cats = keys.map((k) => evaluableIndicators[k].category);
  const count = keys.length;

  const polygonRef = useRef(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const points = keys.map((_, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const r = (RADIUS * values[i]) / 100;
    return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
  });
  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Radar de los 6 indicadores de calidad" className="w-full max-w-md mx-auto">
      {[1, 2, 3, 4, 5].map((level) => {
        const r = (RADIUS * level) / 5;
        return (
          <g key={level}>
            <circle cx={CENTER} cy={CENTER} r={r} fill="none" stroke="var(--outline-variant, #4A453C)" strokeWidth="0.75" />
            <text x={CENTER + 5} y={CENTER - r + 3} fontSize="8" fill="#C9C5BA" fontFamily="Montserrat, sans-serif">
              {level * 20}%
            </text>
          </g>
        );
      })}
      {keys.map((_, i) => {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        const x = CENTER + RADIUS * Math.cos(angle);
        const y = CENTER + RADIUS * Math.sin(angle);
        return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="var(--outline-variant, #4A453C)" strokeWidth="0.75" />;
      })}
      <polygon
        ref={polygonRef}
        points={polygonPoints}
        fill="rgba(217,224,33,0.18)"
        stroke="#D9E021"
        strokeWidth="2"
        style={{
          transformOrigin: `${CENTER}px ${CENTER}px`,
          transform: drawn ? 'scale(1)' : 'scale(0)',
          opacity: drawn ? 1 : 0,
          transition: 'transform 0.7s cubic-bezier(0.2,0.8,0.2,1), opacity 0.5s ease',
        }}
      />
      {points.map((p, i) => (
        <circle
          key={i} cx={p.x} cy={p.y} r="4.5" fill="#15130F" stroke="#D9E021" strokeWidth="2.5"
          style={{ opacity: drawn ? 1 : 0, transition: `opacity 0.3s ease ${0.4 + i * 0.06}s` }}
        />
      ))}
      {keys.map((k, i) => {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        const x = CENTER + (RADIUS + LABEL_OFFSET) * Math.cos(angle);
        const y = CENTER + (RADIUS + LABEL_OFFSET) * Math.sin(angle);
        const anchor = Math.abs(x - CENTER) < 18 ? 'middle' : x > CENTER ? 'start' : 'end';
        const catColor = categoryHex[cats[i]];
        return (
          <g key={k}>
            <text x={x} y={y} fontSize="9" fill="#C9C5BA" fontFamily="Montserrat, sans-serif" textAnchor={anchor} dominantBaseline="middle">
              {RADAR_SHORT_LABELS[k]}
            </text>
            <text x={x} y={y + 14} fontSize="12" fontWeight="700" fill={catColor} fontFamily="Montserrat, sans-serif" textAnchor={anchor} dominantBaseline="middle">
              {values[i]}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
