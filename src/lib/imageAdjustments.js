// Ported from src/legacy/legacyApp.js. renderAdjustedImage() originally
// read slider values via getElementById; here they're explicit params
// supplied by the React state that owns them (useImagePipeline).

// Correcciones aproximadas de balance de blancos (no son una
// transformación colorimétrica exacta de temperatura de color, pero
// corrigen la dirección correcta del tinte típico de cada fuente de luz).
export const whiteBalancePresets = {
  daylight: [1.0, 1.0, 1.0],
  tungsten: [0.82, 0.94, 1.28],
  fluorescent: [1.05, 0.98, 1.08],
  shade: [1.22, 1.02, 0.85],
};

export function clampWbFactor(f) {
  return Math.max(0.6, Math.min(1.6, f));
}

export function applyWhiteBalance(ctx, w, h, mode) {
  if (mode === 'none') return;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  let factors;
  if (mode === 'auto') {
    let sumR = 0, sumG = 0, sumB = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 10) continue;
      sumR += data[i];
      sumG += data[i + 1];
      sumB += data[i + 2];
      n++;
    }
    if (n === 0) return;
    const avgR = sumR / n, avgG = sumG / n, avgB = sumB / n;
    const avgGray = (avgR + avgG + avgB) / 3;
    factors = [clampWbFactor(avgGray / avgR), clampWbFactor(avgGray / avgG), clampWbFactor(avgGray / avgB)];
  } else {
    factors = whiteBalancePresets[mode] || [1, 1, 1];
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * factors[0]);
    data[i + 1] = Math.min(255, data[i + 1] * factors[1]);
    data[i + 2] = Math.min(255, data[i + 2] * factors[2]);
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Genera la imagen realmente corregida (no un filtro CSS de sólo vista
 * previa) — es la misma imagen que se analiza y la que se muestra, para
 * que nunca haya diferencia entre lo que el usuario ajusta y lo que el
 * motor mide.
 * @param {string} imageSrc
 * @param {{brightness?:number, contrast?:number, saturation?:number, rotation?:number, whiteBalance?:string}} adjustments
 * @returns {Promise<string>} data URL PNG
 */
export function renderAdjustedImage(imageSrc, adjustments = {}) {
  const { brightness: b = 0, contrast: c = 0, saturation: s = 0, rotation: rot = 0, whiteBalance: wb = 'none' } = adjustments;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const rad = (rot * Math.PI) / 180;
        const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
        const w = img.naturalWidth, h = img.naturalHeight;
        const newW = Math.round(w * cos + h * sin) || w;
        const newH = Math.round(w * sin + h * cos) || h;

        const canvas = document.createElement('canvas');
        canvas.width = newW;
        canvas.height = newH;
        const ctx = canvas.getContext('2d');

        let filter = '';
        if (b != 0) filter += ' brightness(' + (1 + b / 200) + ')';
        if (c != 0) filter += ' contrast(' + (1 + c / 200) + ')';
        if (s != 0) filter += ' saturate(' + (1 + s / 200) + ')';
        ctx.filter = filter.trim() || 'none';

        ctx.translate(newW / 2, newH / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -w / 2, -h / 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (wb && wb !== 'none') applyWhiteBalance(ctx, newW, newH, wb);

        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para ajustar'));
    img.src = imageSrc;
  });
}
