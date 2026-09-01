import { describeAreaRatio } from './imageAnalysis.js';

// Ported verbatim from src/legacy/legacyApp.js.
export const typologies = {
  logotipo_puro: {
    name: 'Logotipo Puro',
    description: 'Solo texto tipográfico sin elementos gráficos adicionales.',
    ventajas: ['Máxima simplicidad', 'Fácil instalación', 'Alta reproducibilidad'],
    desventajas: ['Depende enteramente de la calidad del nombre', 'Menor capacidad de síntesis visual a distancia'],
  },
  logotipo_con_fondo: {
    name: 'Logotipo con Fondo',
    description: 'Texto contenido dentro de una figura o superficie de color.',
    ventajas: ['Mayor carácter marcario', 'Reproducibilidad uniforme en distintos soportes', 'Mayor impacto visual'],
    desventajas: ['Rendimiento limitado en espacios angostos (cenefas, barras)', 'Puede condicionar el registro de un mensaje elegante o institucional'],
  },
  logotipo_con_simbolo: {
    name: 'Logotipo con Símbolo',
    description: 'Texto y símbolo funcionando como elementos independientes.',
    ventajas: ['Capacidad emblemática (el símbolo puede funcionar solo)', 'Mayor llamado de atención', 'Permite construir arquitectura de marca'],
    desventajas: ['Requiere instalar la convención símbolo–nombre en el público', 'Más difícil de aplicar por tratarse de dos elementos'],
  },
  logotipo_con_accesorio: {
    name: 'Logotipo con Accesorio',
    description: 'Texto acompañado de un elemento decorativo menor, sin autonomía propia.',
    ventajas: ['Más carácter que el logotipo puro', 'Flexible en distintos soportes'],
    desventajas: ['Sin capacidad emblemática independiente', 'El accesorio puede volverse prescindible'],
  },
  logo_simbolo: {
    name: 'Logo-símbolo',
    description: 'Texto y símbolo fusionados en una sola unidad indivisible.',
    ventajas: ['Unidad total: siempre se ve igual, aprovecha la repetición', 'Combina ventajas del fondo y del símbolo'],
    desventajas: ['Puede perder legibilidad en formatos muy horizontales o muy pequeños', 'Mayor complejidad de ejecución'],
  },
  simbolo_solo: {
    name: 'Símbolo Solo',
    description: 'Solo ícono gráfico, sin caracteres tipográficos.',
    ventajas: ['Máxima síntesis visual', 'Alta capacidad emblemática una vez instalado'],
    desventajas: ['Requiere un proceso previo de instalación en el público', 'No comunica el nombre por sí mismo'],
  },
};

// d: el objeto que devuelve analyzeImage() de src/lib/imageAnalysis.js.
export function detectTypologyReal(d) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  if (d.hasFondo) {
    return {
      type: 'logotipo_con_fondo',
      confidence: clamp(70 + Math.round((1 - d.inkRatio) * 20), 65, 93),
      justification:
        'Se detectó una superficie de color dominante que cubre el ' +
        Math.round((1 - d.inkRatio) * 100) +
        '% del encuadre, con el contenido principal contenido dentro de ella (bordes del encuadre mayormente sin interrupciones).',
    };
  }
  const letters = d.textGroup.length;
  const extra = d.extras.length ? d.extras.reduce((max, c) => (c.area > (max ? max.area : 0) ? c : max), null) : null;
  if (extra) {
    const areaRatio = d.avgLetterArea > 0 ? extra.area / d.avgLetterArea : 99;
    const textBox = d.textGroup.length
      ? {
          minX: Math.min(...d.textGroup.map((c) => c.minX)),
          maxX: Math.max(...d.textGroup.map((c) => c.maxX)),
          minY: Math.min(...d.textGroup.map((c) => c.minY)),
          maxY: Math.max(...d.textGroup.map((c) => c.maxY)),
        }
      : null;
    const touches =
      textBox &&
      !(extra.maxX < textBox.minX - 3 || extra.minX > textBox.maxX + 3 || extra.maxY < textBox.minY - 3 || extra.minY > textBox.maxY + 3);
    if (letters === 0) {
      return {
        type: 'simbolo_solo',
        confidence: clamp(75 + (d.componentCount <= 3 ? 10 : 0), 65, 94),
        justification:
          'No se detectó un patrón de elementos alineados y de altura similar (propio del texto); se identificó un elemento gráfico único de ' +
          Math.round((extra.area / (d.W * d.H)) * 100) +
          '% de superficie.',
      };
    }
    if (areaRatio < 0.6) {
      return {
        type: 'logotipo_con_accesorio',
        confidence: clamp(68 + Math.round((0.6 - areaRatio) * 40), 60, 90),
        justification:
          'Junto a ' + letters + ' elementos alineados de tipo texto, se detectó un elemento adicional de tamaño menor (' +
          Math.round(areaRatio * 100) + '% del área promedio de las letras), compatible con un accesorio decorativo.',
      };
    }
    if (touches) {
      return {
        type: 'logo_simbolo',
        confidence: clamp(70 + Math.round(areaRatio * 8), 65, 92),
        justification:
          'El elemento adicional detectado tiene ' + describeAreaRatio(areaRatio) +
          ' y su posición se superpone o toca directamente el bloque de texto, sugiriendo una unidad fusionada.',
      };
    }
    return {
      type: 'logotipo_con_simbolo',
      confidence: clamp(70 + Math.round(areaRatio * 6), 65, 91),
      justification:
        'El elemento adicional detectado tiene ' + describeAreaRatio(areaRatio) +
        ' y aparece separado del bloque de texto, funcionando como un elemento independiente.',
    };
  }
  if (letters >= 2) {
    return {
      type: 'logotipo_puro',
      confidence: clamp(72 + (letters >= 3 ? 10 : 0), 65, 93),
      justification:
        'Se detectaron ' + letters + ' elementos alineados en altura y posición vertical, sin elementos gráficos adicionales — patrón compatible con un bloque de texto.',
    };
  }
  return {
    type: 'simbolo_solo',
    confidence: clamp(65 + (d.componentCount <= 2 ? 12 : 0), 60, 90),
    justification:
      'No se detectó un patrón de elementos alineados de tipo texto; predomina una forma única (' +
      d.componentCount + ' elemento' + (d.componentCount === 1 ? '' : 's') + ' detectado' + (d.componentCount === 1 ? '' : 's') + ').',
  };
}
