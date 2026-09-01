// Ported from src/legacy/legacyApp.js's analyzeImage(). The original read
// module-level closure variables (selectedImage/adjustedImage/imageSource);
// here they become explicit parameters so this is a pure-ish function
// (still touches the DOM via canvas/Image, which is intrinsic to the
// algorithm, not a React concern).
import { relLuminance, contrastRatioOf, colorDistance } from './colorMath.js';
import { floodFillComponents, computeSymmetry, computeEdgeDensity, groupComponents } from './imageComponents.js';
import { mergePerceptualColors } from './colorMath.js';

/**
 * @param {string} imageSrc - data URL o URL de la imagen a analizar (ya con
 *   los ajustes de brillo/contraste/etc. aplicados si corresponde).
 * @param {'upload'|'camera'} imageSource - determina el umbral de fusión
 *   perceptual de color (fotos de cámara tienen más ruido).
 */
export function analyzeImage(imageSrc, imageSource = 'upload') {
  const canvas = document.createElement('canvas');
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = () => {
      try {
        const W = 100, H = 100;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;

        const colorMap = new Map();
        const colors = [];
        const gray = new Float32Array(W * H);
        let darkCount = 0, totalCount = 0;
        for (let p = 0, i = 0; i < data.length; i += 4, p++) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          const rgb = a < 128 ? { r: 255, g: 255, b: 255 } : { r, g, b };
          colors.push(rgb);
          gray[p] = relLuminance(rgb.r, rgb.g, rgb.b) * 255;
          if (a >= 128) {
            totalCount++;
            if (gray[p] < 100) darkCount++;
            const qr = Math.round(r / 16) * 16, qg = Math.round(g / 16) * 16, qb = Math.round(b / 16) * 16;
            const key = qr + ',' + qg + ',' + qb;
            const entry = colorMap.get(key);
            if (entry) {
              entry.count++;
              entry.rSum += r;
              entry.gSum += g;
              entry.bSum += b;
            } else {
              colorMap.set(key, { count: 1, rSum: r, gSum: g, bSum: b });
            }
          }
        }
        const darkRatio = totalCount > 0 ? darkCount / totalCount : 0;

        const mergeThreshold = imageSource === 'upload' ? 3 : 7;
        const buckets = Array.from(colorMap.values()).map((e) => ({
          r: e.rSum / e.count, g: e.gSum / e.count, b: e.bSum / e.count, count: e.count,
        }));
        const merged = mergePerceptualColors(buckets, mergeThreshold).sort((a, b) => b.count - a.count);
        const significant = merged.filter((c) => c.count / totalCount > 0.02).slice(0, 9);
        const palette = significant.map((c) => {
          const rgb = { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) };
          const hex = '#' + [rgb.r, rgb.g, rgb.b].map((v) => v.toString(16).padStart(2, '0')).join('');
          return { hex, percentage: Math.round((c.count / totalCount) * 100), rgb };
        });
        const bg = palette[0] ? palette[0].rgb : { r: 255, g: 255, b: 255 };
        const bgIsNearWhite = bg.r > 232 && bg.g > 232 && bg.b > 232;
        const ink = palette.find((c) => colorDistance(c.rgb, bg) > 60) || palette[1] || { rgb: { r: 0, g: 0, b: 0 } };

        const binary = new Uint8Array(W * H);
        for (let p = 0; p < W * H; p++) binary[p] = colorDistance(colors[p], bg) > 45 ? 1 : 0;

        const symmetryScore = computeSymmetry(binary, W, H);
        const edgeRaw = computeEdgeDensity(gray, W, H);
        const edgeComplexity = Math.max(0, Math.min(100, Math.round(edgeRaw / 2.2)));
        const contrast = contrastRatioOf(bg, ink.rgb);

        const components = floodFillComponents(binary, W, H).filter((c) => c.area >= 3);
        let borderInk = 0, borderTotal = 0;
        for (let x = 0; x < W; x++) {
          borderTotal += 2;
          if (binary[x] === 1) borderInk++;
          if (binary[(H - 1) * W + x] === 1) borderInk++;
        }
        for (let y = 0; y < H; y++) {
          borderTotal += 2;
          if (binary[y * W] === 1) borderInk++;
          if (binary[y * W + (W - 1)] === 1) borderInk++;
        }
        const hasFondo = !bgIsNearWhite && borderInk / borderTotal < 0.15 && totalCount > 0 && 1 - darkRatio < 0.55;

        const { textGroup, extras } = groupComponents(components);
        const avgLetterArea = textGroup.length ? textGroup.reduce((a, c) => a + c.area, 0) / textGroup.length : 0;
        const totalInkArea = components.reduce((a, c) => a + c.area, 0) || 1;
        const largestComp = components.reduce((max, c) => (c.area > (max ? max.area : 0) ? c : max), null);
        const largestAreaRatio = largestComp ? largestComp.area / totalInkArea : 0;

        resolve({
          W, H, palette, colorCount: palette.length,
          bg, ink: ink.rgb, contrast, darkRatio,
          symmetryScore, edgeComplexity,
          components, componentCount: components.length,
          // Conteo efectivo: el bloque de texto cuenta como una sola
          // unidad (sin importar su largo); cada elemento no-texto cuenta
          // aparte. Se calcula una sola vez para que Inteligibilidad,
          // Pregnancia y la métrica visible usen siempre el mismo número.
          effectiveComponentCount: (textGroup.length > 0 ? 1 : 0) + extras.length,
          textGroup, extras, avgLetterArea, hasFondo,
          largestAreaRatio, inkRatio: totalInkArea / (W * H),
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para analizar'));
    img.src = imageSrc;
  });
}

export function classifyColors(count) {
  if (count <= 1) return 'Monocromía — Máxima versatilidad';
  if (count === 2) return 'Bicromía — Muy buena reproducibilidad';
  if (count === 3) return 'Tricromía — Buena reproducibilidad';
  if (count <= 4) return 'Cuatricromía — Reproducibilidad aceptable';
  if (count <= 6) return 'Policromía limitada — Reproducibilidad moderada';
  return 'Policromía alta — Reproducibilidad comprometida';
}

// Describe la relación de tamaño entre el elemento adicional y las letras
// de forma proporcional al número real.
export function describeAreaRatio(ratio) {
  if (ratio < 1.5) return 'un área similar a la de las letras (' + Math.round(ratio * 100) + '% del promedio)';
  if (ratio < 4) return 'un área notablemente mayor que las letras (' + Math.round(ratio * 100) + '% del promedio)';
  return 'un área mucho mayor que las letras (' + ratio.toFixed(1) + ' veces el promedio)';
}
