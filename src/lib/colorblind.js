// Ported verbatim from src/legacy/legacyApp.js. Aproximación matemática
// (matrices Brettel/Viénot en sRGB) — no reemplaza una prueba clínica.
export const colorblindMatrices = {
  protanopia: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
  deuteranopia: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  tritanopia: [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]],
};

export function simulateColorblind(rgb, type) {
  const m = colorblindMatrices[type];
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const clamp = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return {
    r: clamp(m[0][0] * r + m[0][1] * g + m[0][2] * b),
    g: clamp(m[1][0] * r + m[1][1] * g + m[1][2] * b),
    b: clamp(m[2][0] * r + m[2][1] * g + m[2][2] * b),
  };
}
