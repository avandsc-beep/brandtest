// Ported verbatim from src/legacy/legacyApp.js.

export const evaluableIndicators = {
  calidad_grafica: {
    name: 'Calidad Gráfica Genérica', category: 1, weight: 0.17,
    definition: 'Competencia técnica en la ejecución del trazo: consistencia de grosores, limpieza de remates y calidad de las uniones entre formas.',
    criteria: ['Precisión en trazado', 'Consistencia de grosores', 'Alineación correcta', 'Limpieza visual', 'Calidad de uniones'],
  },
  reproducibilidad: {
    name: 'Reproducibilidad', category: 1, weight: 0.17,
    definition: 'Estabilidad del signo al reducirse de escala, pasar a monocromía o cambiar de soporte de impresión.',
    criteria: ['Legibilidad a 9px (7pt)', 'Funciona en B/N', 'Sin degradados problemáticos', 'Paleta adecuada'],
  },
  legibilidad: {
    name: 'Legibilidad', category: 3, weight: 0.17,
    definition: 'Relación figura-fondo y contraste tonal que sostienen una lectura fluida del signo.',
    criteria: ['Contraste mínimo 4.5:1', 'Tamaño adecuado', 'Grosor correcto', 'Espaciado adecuado', 'Sin interferencias'],
  },
  inteligibilidad: {
    name: 'Inteligibilidad', category: 3, weight: 0.17,
    definition: 'Síntesis formal y relación ícono-referente que permiten decodificar el mensaje sin apoyo textual adicional.',
    criteria: ['Forma reconocible', 'Relación ícono-referente', 'Sin explicación adicional', 'Mensaje claro'],
  },
  vocatividad: {
    name: 'Vocatividad', category: 3, weight: 0.16,
    definition: 'Peso visual y jerarquía perceptual del signo: su capacidad de captar la atención dentro de un campo visual competido.',
    criteria: ['Atención en <3 seg', 'Contraste >30%', 'Elemento distintivo', 'Elemento principal ≥25%', 'Colores de impacto'],
  },
  pregnancia: {
    name: 'Pregnancia', category: 4, weight: 0.16,
    definition: 'Cierre gestáltico y memorabilidad de la forma: cuán fácil resulta evocarla y reproducirla de memoria.',
    criteria: ['Descripción verbal simple', '1-2 elementos visuales', 'Forma dominante clara', 'Dibujable de memoria'],
  },
};

export const categories = {
  1: { name: 'Ejecución Formal', color: 'var(--cat1)' },
  3: { name: 'Contenido y Comprensión', color: 'var(--cat3)' },
  4: { name: 'Desempeño Estratégico', color: 'var(--cat4)' },
};
export const categoryHex = { 1: '#D9E021', 3: '#E8604A', 4: '#D9E021' };

// d: salida de analyzeImage() (src/lib/imageAnalysis.js).
export function evaluateIndicatorsReal(d) {
  const clamp = (v, a, b) => Math.round(Math.max(a, Math.min(b, v)));
  const scores = {};
  const compAreas = d.components.map((c) => c.area);
  const meanArea = compAreas.length ? compAreas.reduce((a, b) => a + b, 0) / compAreas.length : 0;
  const variance = compAreas.length ? compAreas.reduce((a, v) => a + (v - meanArea) ** 2, 0) / compAreas.length : 0;
  const cv = meanArea > 0 ? Math.sqrt(variance) / meanArea : 0;
  const cvPct = Math.round(cv * 100);

  // Conteo EFECTIVO de unidades gráficas (ver imageAnalysis.js) — solo
  // aplica a Inteligibilidad y Pregnancia. Calidad Gráfica sigue
  // comparando letra por letra a propósito (mide consistencia de trazo).
  const effectiveComponentCount = d.effectiveComponentCount;

  scores.calidad_grafica = {
    score: clamp(98 - cv * 55, 50, 98),
    justification:
      'El trazo entre los ' + d.componentCount + ' elementos detectados muestra una variación de peso y proporción del ' + cvPct + '%. ' +
      (cvPct > 40
        ? 'Una variación así de alta señala grosores y remates poco uniformes entre sí — el conjunto todavía no se lee como un sistema coherente.'
        : 'Los trazos mantienen un peso y una proporción razonablemente consistentes entre sí, lo que aporta unidad gráfica al conjunto.'),
  };

  const colorPenalty = Math.max(0, d.colorCount - 2) * 7;
  const bnPenalty = d.contrast < 3 ? 15 : 0;
  scores.reproducibilidad = {
    score: clamp(95 - colorPenalty - bnPenalty, 40, 98),
    justification:
      'La marca trabaja con ' + d.colorCount + ' color(es) en su paleta. ' +
      (d.contrast >= 4.5
        ? 'El contraste entre fondo y tinta (' + d.contrast.toFixed(1) + ':1) es lo bastante alto como para sostener una reducción a escala de grises o a una sola tinta sin perder la figura — una condición clave para señalética y papelería de bajo costo.'
        : 'El contraste entre fondo y tinta (' + d.contrast.toFixed(1) + ':1) es ajustado; conviene verificar que la marca no pierda presencia al reducirse a escala de grises o a una sola tinta.'),
  };

  let legScore;
  if (d.contrast >= 7) legScore = 95;
  else if (d.contrast >= 4.5) legScore = 85;
  else if (d.contrast >= 3) legScore = 65;
  else legScore = 40;
  scores.legibilidad = {
    score: clamp(legScore, 30, 98),
    justification:
      'El contraste tonal entre fondo y tinta es de ' + d.contrast.toFixed(2) + ':1, frente a un umbral de referencia de 4.5:1 para una lectura clara. ' +
      (d.contrast >= 4.5
        ? 'Está por encima de ese umbral: la marca no depende del tamaño de reproducción para mantenerse legible.'
        : 'Está por debajo de ese umbral, lo que puede volver la lectura difícil a tamaños reducidos o en aplicaciones de baja calidad de impresión.'),
  };

  scores.inteligibilidad = {
    score: clamp(90 - Math.max(0, effectiveComponentCount - 3) * 6, 40, 95),
    justification:
      'Se identificaron ' + effectiveComponentCount + ' unidad(es) gráfica(s) conceptualmente independiente(s) (el bloque de texto cuenta como una sola unidad, sin importar su largo). ' +
      (effectiveComponentCount > 5
        ? 'Es una fragmentación alta para un signo que busca leerse de un solo golpe visual: cuantas más piezas sueltas debe reconstruir el ojo, más lento y menos inmediato resulta el reconocimiento del conjunto.'
        : 'La síntesis formal es razonable: pocas piezas independientes favorecen una lectura directa, sin necesidad de reconstruir el conjunto parte por parte.'),
  };

  const satScore = clamp((Math.max(d.ink.r, d.ink.g, d.ink.b) - Math.min(d.ink.r, d.ink.g, d.ink.b)) / 2.55, 0, 100);
  const contrastPct = clamp((d.contrast / 12) * 100, 0, 100);
  const dominantPct = Math.round(d.largestAreaRatio * 100);
  scores.vocatividad = {
    score: clamp(contrastPct * 0.5 + satScore * 0.3 + d.largestAreaRatio * 100 * 0.2, 35, 97),
    justification:
      'El contraste tonal está en ' + Math.round(contrastPct) + '% de su rango y el color dominante tiene una saturación de ' + Math.round(satScore) + '%. El elemento de mayor peso visual concentra ' + dominantPct + '% de la superficie de tinta total. ' +
      (dominantPct >= 25
        ? 'Hay un punto focal razonablemente claro que concentra la atención.'
        : 'Ningún elemento domina con claridad sobre el resto, lo que dispersa la atención en vez de concentrarla en un punto focal.'),
  };

  const complexityPenalty = Math.max(0, effectiveComponentCount - 4) * 5;
  scores.pregnancia = {
    score: clamp(d.symmetryScore * 0.4 + (100 - d.edgeComplexity) * 0.3 + (100 - complexityPenalty) * 0.3, 35, 96),
    justification:
      'La marca mantiene una simetría del ' + d.symmetryScore + '% respecto a su eje vertical y una complejidad de forma de ' + d.edgeComplexity + '/100, sobre ' + effectiveComponentCount + ' unidad(es) gráfica(s) conceptualmente independiente(s). ' +
      (effectiveComponentCount <= 3 && d.symmetryScore >= 60
        ? 'Esta combinación de simetría y baja complejidad favorece el cierre gestáltico y la memorabilidad de la forma.'
        : 'La cantidad de piezas independientes juega en contra de la memorabilidad: cuantas más partes sueltas tiene un signo, más difícil resulta evocarlo o dibujarlo de memoria.'),
  };

  Object.keys(scores).forEach((k) => {
    scores[k].score = Math.round(scores[k].score);
  });

  // Confianza por indicador — no mide qué tan "bien" se ejecutó el cálculo
  // (la fórmula siempre es la misma), sino qué tan cerca está el puntaje de
  // un corte de veredicto (35/50/70, los mismos que separan Rediseño /
  // Revisar / Ajuste leve / Aprobado, ver diagnosticVerdict). Cerca de un
  // corte, un margen de error razonable en la medición sí podría cambiar
  // la decisión final — lejos de todos los cortes, no. Se marca "revisión
  // manual sugerida" por debajo de 65%.
  const VERDICT_THRESHOLDS = [35, 50, 70];
  Object.keys(scores).forEach((k) => {
    const score = scores[k].score;
    const distance = Math.min(...VERDICT_THRESHOLDS.map((t) => Math.abs(score - t)));
    scores[k].confidence = Math.round(clamp(60 + distance * 2.3, 60, 96));
    scores[k].needsReview = scores[k].confidence < 65;
  });

  return scores;
}

export const designRecommendations = {
  calidad_grafica: {
    low: 'Igualar el peso, los remates y las uniones entre los trazos más dispares del conjunto para que se lea como un sistema y no como piezas sueltas.',
    mid: 'Revisar puntualmente los trazos que más se alejan del peso promedio del conjunto.',
  },
  reproducibilidad: {
    low: 'Simplificar la paleta cromática y confirmar que la marca se mantenga reconocible en una sola tinta antes de producirla en papelería o señalética.',
    mid: 'Confirmar el comportamiento de la marca en blanco y negro antes de aplicaciones de bajo costo de impresión.',
  },
  legibilidad: {
    low: 'Aumentar el contraste entre fondo y tinta, o revisar el grosor de los trazos a los tamaños mínimos de aplicación.',
    mid: 'Verificar la legibilidad a los tamaños mínimos previstos (favicon, redes sociales, merchandising).',
  },
  inteligibilidad: {
    low: 'Evaluar una síntesis formal del signo: reducir el número de elementos independientes o considerar una versión reducida (isotipo o monograma) para usos donde el reconocimiento inmediato es crítico.',
    mid: 'Revisar si todos los elementos actuales aportan a la lectura del conjunto o si alguno puede integrarse o eliminarse.',
  },
  vocatividad: {
    low: 'Definir con más claridad un elemento dominante — por color, tamaño o posición — que concentre la atención antes que el resto de la composición.',
    mid: 'Reforzar el peso visual del elemento principal frente al resto de la composición.',
  },
  pregnancia: {
    low: 'Buscar mayor síntesis formal: un signo con menos partes independientes y un eje de simetría claro es más fácil de recordar y de reproducir a mano.',
    mid: 'Simplificar puntualmente los detalles que más se alejan de la forma dominante del conjunto.',
  },
};

// Indicadores "de piso" (Chaves y Belluccia): un puntaje bajo ahí es
// objetivamente deficiente. Vocatividad queda fuera a propósito — su nivel
// adecuado depende de la identidad de cada marca (2.12): Mercedes-Benz es
// poco vocativa y es una marca excelente; Texaco es muy vocativa y también
// lo es. Un puntaje alto en Vocatividad no debe poder "tapar" fallas
// reales en los demás indicadores.
export const gateIndicatorKeys = ['calidad_grafica', 'reproducibilidad', 'legibilidad', 'inteligibilidad', 'pregnancia'];
export const GATE_MARGIN = 20;

export function getGateInfo(scores) {
  let worstKey = null, worstScore = 101;
  gateIndicatorKeys.forEach((k) => {
    if (scores[k] && scores[k].score < worstScore) {
      worstScore = scores[k].score;
      worstKey = k;
    }
  });
  return { worstKey, worstScore, cap: worstScore + GATE_MARGIN };
}

export function calculateOverall(scores) {
  let total = 0, weightSum = 0;
  Object.keys(scores).forEach((k) => {
    total += scores[k].score * evaluableIndicators[k].weight;
    weightSum += evaluableIndicators[k].weight;
  });
  const weightedAvg = total / weightSum;
  const gate = getGateInfo(scores);
  return Math.round(Math.min(weightedAvg, gate.cap));
}

// Ported de legacyApp.js recalculatePalette() — recalcula SOLO
// reproducibilidad (y de ahí el overall) cuando el usuario excluye colores
// de la paleta. Es un límite de alcance conocido y ya existente: los
// otros 5 indicadores no se vuelven a calcular con la paleta curada.
export function recalculateReproducibilidad(effectiveCount, contrast, excludedCount, totalCount) {
  const colorPenalty = Math.max(0, effectiveCount - 2) * 7;
  const bnPenalty = contrast < 3 ? 15 : 0;
  const score = Math.round(Math.max(40, Math.min(98, 95 - colorPenalty - bnPenalty)));
  const excludedNote = excludedCount
    ? ' (se excluyeron ' + excludedCount + ' de ' + totalCount + ' colores detectados, marcados como ajenos a la marca).'
    : '';
  const justification =
    'La marca trabaja con ' + effectiveCount + ' color(es) en su paleta efectiva' + excludedNote + ' ' +
    (contrast >= 4.5
      ? 'El contraste entre fondo y tinta (' + contrast.toFixed(1) + ':1) es lo bastante alto como para sostener una reducción a escala de grises o a una sola tinta sin perder la figura.'
      : 'El contraste entre fondo y tinta (' + contrast.toFixed(1) + ':1) es ajustado; conviene verificar que la marca no pierda presencia al reducirse a escala de grises o a una sola tinta.');
  return { score, justification };
}

export function getCategoryBreakdown(scores) {
  return Object.keys(categories).map((catKey) => {
    const catScores = [];
    Object.keys(evaluableIndicators).forEach((k) => {
      if (evaluableIndicators[k].category === parseInt(catKey, 10)) catScores.push(scores[k].score);
    });
    const avg = Math.round(catScores.reduce((a, b) => a + b, 0) / catScores.length);
    const tier = avg >= 70 ? 'sólido' : avg >= 50 ? 'aceptable, con margen de mejora' : 'débil';
    return { name: categories[catKey].name, avg, tier };
  });
}

// Ported de legacyApp.js generateRecommendations() — devuelve datos, no HTML.
export function getWeakRecommendations(scores) {
  const entries = Object.keys(scores).map((k) => ({ key: k, name: evaluableIndicators[k].name, score: scores[k].score }));
  entries.sort((a, b) => a.score - b.score);
  const weak = entries.filter((e) => e.score < 75).slice(0, 3);
  return weak.map((e) => {
    const tier = e.score < 50 ? 'low' : 'mid';
    return {
      key: e.key, name: e.name, score: e.score,
      label: e.score < 50 ? 'Atención prioritaria' : 'Ajuste puntual',
      recommendation: designRecommendations[e.key][tier],
    };
  });
}

// gateApplied: si el veto de piso efectivamente bajó el puntaje respecto
// al promedio ponderado sin capar.
export function isGateApplied(scores, overall) {
  const weightedAvg =
    Object.keys(scores).reduce((s, k) => s + scores[k].score * evaluableIndicators[k].weight, 0) /
    Object.keys(scores).reduce((s, k) => s + evaluableIndicators[k].weight, 0);
  return overall < Math.round(weightedAvg) - 0.5;
}

// Colores literales (no CSS custom properties) — este módulo no debe
// depender de qué hoja de estilos esté cargada en un momento dado.
export function diagnosticVerdict(score) {
  if (score >= 70) {
    return {
      title: 'No necesita ajustes', color: '#7ED957', stampLabel: 'Aprobado',
      description: 'La marca cumple de forma consistente los seis indicadores medidos: no se detectan problemas estructurales en la ejecución, el contraste o la composición.',
      recommendation: 'Mantener el sistema de marca actual. Conviene repetir esta medición cada vez que se ajuste la paleta, la tipografía o el símbolo, para verificar que el cambio no degrade el desempeño.',
    };
  }
  if (score >= 50) {
    return {
      title: 'Ajuste leve', color: '#D9E021', stampLabel: 'Ajuste leve',
      description: 'La marca funciona en la mayoría de los indicadores, con uno o dos puntos débiles concretos que conviene revisar antes de una aplicación intensiva (papelería, señalética, medios digitales a gran escala).',
      recommendation: 'Revisar puntualmente los indicadores con menor puntaje (ver Recomendaciones para el Diseñador) sin necesidad de rediseñar la marca completa.',
    };
  }
  if (score >= 35) {
    return {
      title: 'Necesita ajustes', color: '#E8604A', stampLabel: 'Revisar',
      description: 'Se detectan varias debilidades combinadas — contraste, complejidad de forma o reproducibilidad — que probablemente afecten el desempeño de la marca en aplicaciones reales.',
      recommendation: 'Planificar una intervención dirigida sobre los indicadores más bajos antes de invertir en producción a gran escala.',
    };
  }
  return {
    title: 'Necesita rediseño', color: '#E8604A', stampLabel: 'Rediseño',
    description: 'La combinación de indicadores bajos sugiere problemas estructurales — no puntuales — en la construcción de la marca.',
    recommendation: 'Considerar un proceso de rediseño integral en vez de ajustes puntuales, partiendo del marco de indicadores de Chaves y Belluccia.',
  };
}
