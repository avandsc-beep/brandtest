// Ported verbatim from src/legacy/legacyApp.js ("MOTOR DE ANÁLISIS").
// Componentes conectados, simetría y densidad de bordes sobre una máscara
// binaria — pure functions, sin DOM.

export function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function floodFillComponents(binary, w, h) {
  const visited = new Uint8Array(w * h);
  const components = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (binary[idx] === 1 && !visited[idx]) {
        const stack = [idx];
        visited[idx] = 1;
        let minX = x, maxX = x, minY = y, maxY = y, area = 0;
        while (stack.length) {
          const cur = stack.pop();
          const cy = Math.floor(cur / w), cx = cur % w;
          area++;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
          const cand = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
          for (const [nx, ny] of cand) {
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const nidx = ny * w + nx;
              if (binary[nidx] === 1 && !visited[nidx]) {
                visited[nidx] = 1;
                stack.push(nidx);
              }
            }
          }
        }
        components.push({
          minX, maxX, minY, maxY, area,
          w: maxX - minX + 1, h: maxY - minY + 1,
          cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
        });
      }
    }
  }
  return components;
}

export function computeSymmetry(binary, w, h) {
  let match = 0, total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < Math.floor(w / 2); x++) {
      total++;
      if (binary[y * w + x] === binary[y * w + (w - 1 - x)]) match++;
    }
  }
  return total > 0 ? Math.round((match / total) * 100) : 0;
}

export function computeEdgeDensity(gray, w, h) {
  let sum = 0, count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx = gray[idx + 1] - gray[idx - 1];
      const gy = gray[idx + w] - gray[idx - w];
      sum += Math.sqrt(gx * gx + gy * gy);
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

// Separa componentes en "bloque de texto" (altura similar ±45% de la
// mediana y centro vertical dentro de 12px de la mediana) vs "extras"
// (símbolos, accesorios). Componentes con area < 3 ya se filtran antes de
// llamar a esta función.
export function groupComponents(components) {
  const real = components.filter((c) => c.area >= 3);
  if (real.length === 0) return { textGroup: [], extras: [] };
  const heights = real.map((c) => c.h);
  const centers = real.map((c) => c.cy);
  const medH = median(heights);
  const medC = median(centers);
  const textGroup = [];
  const extras = [];
  real.forEach((c) => {
    const heightOk = medH > 0 && Math.abs(c.h - medH) / medH < 0.45;
    const centerOk = Math.abs(c.cy - medC) < 12;
    if (heightOk && centerOk) textGroup.push(c);
    else extras.push(c);
  });
  return { textGroup, extras };
}
