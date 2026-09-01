// Ported verbatim from src/legacy/legacyApp.js ("MOTOR DE ANÁLISIS").
// Pure color math — no DOM, no React. Formulas unchanged from production.

export function relLuminance(r, g, b) {
  const chan = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

export function contrastRatioOf(c1, c2) {
  const L1 = relLuminance(c1.r, c1.g, c1.b);
  const L2 = relLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function colorDistance(c1, c2) {
  return Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2);
}

// Percepción de color (Lab) — para fusionar tonos que un ojo humano vería
// como "el mismo color de marca" aunque el ruido de una foto los haya
// dispersado en RGB.
export function rgbToLab(r, g, b) {
  let [rl, gl, bl] = [r, g, b].map((c) => {
    c = c / 255;
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  });
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175) / 1.0;
  let z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function deltaE(lab1, lab2) {
  return Math.sqrt((lab1.L - lab2.L) ** 2 + (lab1.a - lab2.a) ** 2 + (lab1.b - lab2.b) ** 2);
}

// Recibe cubetas de la cuantización cruda y las fusiona por cercanía
// perceptual real (Lab/ΔE), no por cercanía numérica en RGB. Empieza por
// las cubetas más grandes para que los colores dominantes "atraigan" al
// ruido cercano en vez de fragmentarse entre sí.
export function mergePerceptualColors(buckets, threshold) {
  const sorted = buckets.slice().sort((a, b) => b.count - a.count);
  const clusters = [];
  sorted.forEach((bucket) => {
    const lab = rgbToLab(bucket.r, bucket.g, bucket.b);
    let target = null;
    let best = Infinity;
    for (const c of clusters) {
      const d = deltaE(lab, c.lab);
      if (d < threshold && d < best) {
        target = c;
        best = d;
      }
    }
    if (target) {
      const n = target.count + bucket.count;
      target.r = (target.r * target.count + bucket.r * bucket.count) / n;
      target.g = (target.g * target.count + bucket.g * bucket.count) / n;
      target.b = (target.b * target.count + bucket.b * bucket.count) / n;
      target.count = n;
      target.lab = rgbToLab(target.r, target.g, target.b);
    } else {
      clusters.push({ r: bucket.r, g: bucket.g, b: bucket.b, count: bucket.count, lab });
    }
  });
  return clusters;
}
