// test_engine.js — Pruebas de regresión del motor de BrandTest.
// Importa directamente los módulos puros de src/lib/* (ya no extrae
// funciones por regex del closure de src/legacy/legacyApp.js — ese
// mecanismo era necesario mientras el motor vivía atrapado ahí adentro;
// ahora que vive en módulos ES reales, importar es más simple y directo).
// Uso: node test_engine.js  (desde la raíz del proyecto)

import { relLuminance, contrastRatioOf, colorDistance, rgbToLab, deltaE, mergePerceptualColors } from './src/lib/colorMath.js';
import { computeSymmetry, computeEdgeDensity } from './src/lib/imageComponents.js';
import { classifyColors } from './src/lib/imageAnalysis.js';
import { typologies, detectTypologyReal } from './src/lib/typology.js';
import { evaluableIndicators, categories, evaluateIndicatorsReal, calculateOverall, diagnosticVerdict, getGateInfo, gateIndicatorKeys } from './src/lib/scoring.js';
import { simulateColorblind } from './src/lib/colorblind.js';
import { getInitials } from './src/lib/textUtils.js';

const M = {
  relLuminance, contrastRatioOf, colorDistance, rgbToLab, deltaE, mergePerceptualColors,
  computeSymmetry, computeEdgeDensity, classifyColors,
  typologies, detectTypologyReal,
  evaluableIndicators, categories, evaluateIndicatorsReal, calculateOverall, diagnosticVerdict,
  getGateInfo, gateIndicatorKeys,
  simulateColorblind, getInitials,
};

// ---- utilidades mínimas de aserción ----
let pass = 0, fail = 0;
function assert(cond, msg) {
    if (cond) { pass++; }
    else { fail++; console.error('FALLÓ:', msg); }
}
function approx(a, b, tol, msg) {
    assert(Math.abs(a - b) <= tol, msg + ` (obtuvo ${a}, esperaba ~${b})`);
}

// ---- construir un `d` sintético (forma de analyzeImage()) ----
function fakeD(overrides) {
    const base = {
        W: 100, H: 100,
        bg: { r: 255, g: 255, b: 255 },
        ink: { r: 20, g: 20, b: 20 },
        contrast: 15,
        symmetryScore: 90,
        edgeComplexity: 20,
        components: [
            { minX: 10, maxX: 20, minY: 40, maxY: 60, area: 80, w: 10, h: 20, cx: 15, cy: 50 },
            { minX: 25, maxX: 35, minY: 40, maxY: 60, area: 78, w: 10, h: 20, cx: 30, cy: 50 },
        ],
        componentCount: 2,
        textGroup: [], extras: [], avgLetterArea: 80,
        hasFondo: false, largestAreaRatio: 0.51, inkRatio: 0.06,
        colorCount: 2,
    };
    const merged = Object.assign(base, overrides);
    // Espeja el cálculo real (sección "Inteligibilidad y Pregnancia" de la
    // memoria técnica): el bloque de texto cuenta como una sola unidad
    // conceptual, sin importar su largo — evaluateIndicatorsReal() asume
    // que este campo ya viene calculado, igual que en analyzeImage().
    if (merged.effectiveComponentCount === undefined) {
        merged.effectiveComponentCount = (merged.textGroup.length > 0 ? 1 : 0) + merged.extras.length;
    }
    return merged;
}

// ============================================================
// 1. Matemática de color y contraste (WCAG) — debe ser exacta
// ============================================================
approx(M.relLuminance(255, 255, 255), 1, 0.001, 'luminancia del blanco debe ser 1');
approx(M.relLuminance(0, 0, 0), 0, 0.001, 'luminancia del negro debe ser 0');
approx(M.contrastRatioOf({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }), 21, 0.01, 'contraste blanco/negro debe ser 21:1 (máximo WCAG)');
approx(M.contrastRatioOf({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 }), 1, 0.01, 'contraste de un color contra sí mismo debe ser 1:1');
assert(M.colorDistance({ r: 10, g: 10, b: 10 }, { r: 10, g: 10, b: 10 }) === 0, 'distancia de color entre iguales debe ser 0');
assert(M.colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }) > 400, 'distancia blanco/negro debe ser máxima (~441)');

// ============================================================
// 2. Simetría y densidad de bordes — casos límite conocidos
// ============================================================
{
    const w = 10, h = 10;
    const symGrid = new Uint8Array(w * h); // todo en 0 → perfectamente "simétrico" (idéntico a su espejo)
    approx(M.computeSymmetry(symGrid, w, h), 100, 0.1, 'una grilla uniforme debe dar 100% de simetría');

    const asymGrid = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) asymGrid[y * w + 0] = 1; // solo la columna izquierda encendida
    const asymScore = M.computeSymmetry(asymGrid, w, h);
    assert(asymScore < 100, 'una grilla asimétrica debe dar menos de 100%: obtuvo ' + asymScore);
}

// ============================================================
// 3. classifyColors — límites de las categorías
// ============================================================
assert(/Monocrom/.test(M.classifyColors(1)), '1 color debe clasificar como monocromía');
assert(/Bicrom/.test(M.classifyColors(2)), '2 colores debe clasificar como bicromía');
assert(/alta/.test(M.classifyColors(10)), '10 colores debe clasificar como policromía alta');

// ============================================================
// 4. calculateOverall — los pesos deben sumar ~1 y ser lineales
// ============================================================
{
    const allZero = {}; const allHundred = {};
    Object.keys(M.evaluableIndicators).forEach(k => { allZero[k] = { score: 0 }; allHundred[k] = { score: 100 }; });
    approx(M.calculateOverall(allZero), 0, 0.5, 'todos los indicadores en 0 debe dar overall 0');
    approx(M.calculateOverall(allHundred), 100, 0.5, 'todos los indicadores en 100 debe dar overall 100');
    const weightSum = Object.values(M.evaluableIndicators).reduce((a, i) => a + i.weight, 0);
    approx(weightSum, 1, 0.02, 'los pesos de los 6 indicadores deben sumar ~1');
}

// ============================================================
// 5. diagnosticVerdict — los 4 umbrales deben mapear al veredicto correcto
// ============================================================
assert(M.diagnosticVerdict(85).title === 'No necesita ajustes', 'score 85 debe ser "No necesita ajustes"');
assert(M.diagnosticVerdict(60).title === 'Ajuste leve', 'score 60 debe ser "Ajuste leve"');
assert(M.diagnosticVerdict(40).title === 'Necesita ajustes', 'score 40 debe ser "Necesita ajustes"');
assert(M.diagnosticVerdict(10).title === 'Necesita rediseño', 'score 10 debe ser "Necesita rediseño"');

// ============================================================
// 6. evaluateIndicatorsReal — nunca debe devolver NaN ni fuera de [0,100]
// ============================================================
{
    const scores = M.evaluateIndicatorsReal(fakeD());
    Object.keys(M.evaluableIndicators).forEach(k => {
        const s = scores[k].score;
        assert(Number.isFinite(s), `${k}: el puntaje no debe ser NaN`);
        assert(s >= 0 && s <= 100, `${k}: el puntaje debe estar en [0,100], dio ${s}`);
        assert(typeof scores[k].justification === 'string' && scores[k].justification.length > 10, `${k}: debe traer una justificación con texto real`);
    });
}

// ============================================================
// 7. detectTypologyReal — casos sintéticos con respuesta conocida
// ============================================================
assert(M.detectTypologyReal(fakeD({ hasFondo: true })).type === 'logotipo_con_fondo', 'hasFondo=true debe detectar "logotipo_con_fondo"');
{
    // 3 letras alineadas, sin elementos extra → logotipo puro
    const d = fakeD({
        textGroup: [
            { minX: 0, maxX: 8, minY: 40, maxY: 60, area: 80, cy: 50 },
            { minX: 10, maxX: 18, minY: 40, maxY: 60, area: 78, cy: 50 },
            { minX: 20, maxX: 28, minY: 40, maxY: 60, area: 82, cy: 50 },
        ],
        extras: [], componentCount: 3,
    });
    assert(M.detectTypologyReal(d).type === 'logotipo_puro', 'texto alineado sin extras debe detectar "logotipo_puro"');
}
{
    // sin texto, un solo componente grande → símbolo solo
    const d = fakeD({ textGroup: [], extras: [], componentCount: 1 });
    assert(M.detectTypologyReal(d).type === 'simbolo_solo', 'un único elemento sin patrón de texto debe detectar "simbolo_solo"');
}

// ============================================================
// 8. getInitials — casos de nombre
// ============================================================
assert(M.getInitials('Marco Ramírez') === 'MR', 'iniciales de "Marco Ramírez" deben ser "MR"');
assert(M.getInitials('Usuario') === 'US', 'nombre de una palabra debe usar sus 2 primeras letras');
assert(M.getInitials('') === '?', 'nombre vacío debe devolver "?"');

// ============================================================
// 9. rgbToLab / deltaE / mergePerceptualColors — percepción de color
// ============================================================
{
    const white = M.rgbToLab(255, 255, 255);
    approx(white.L, 100, 0.5, 'L de blanco puro debe ser ~100');
    approx(white.a, 0, 0.5, 'a de blanco puro debe ser ~0');
    approx(white.b, 0, 0.5, 'b de blanco puro debe ser ~0');
    const black = M.rgbToLab(0, 0, 0);
    approx(black.L, 0, 0.5, 'L de negro puro debe ser ~0');

    approx(M.deltaE(white, white), 0, 0.01, 'deltaE de un color contra sí mismo debe ser 0');
    assert(M.deltaE(white, black) > 90, 'deltaE blanco/negro debe ser grande (~100)');

    // Dos cubetas de ruido fotográfico (mismo azul, variaciones mínimas de
    // luz) deben fusionarse en un solo color final.
    const noisyBlueBuckets = [
        { r: 20, g: 90, b: 200, count: 500 },
        { r: 24, g: 93, b: 204, count: 300 },
        { r: 18, g: 87, b: 197, count: 150 },
    ];
    const mergedNoise = M.mergePerceptualColors(noisyBlueBuckets, 9);
    assert(mergedNoise.length === 1, 'variaciones de ruido del mismo azul deben fusionarse en 1 solo color, dio ' + mergedNoise.length);
    assert(mergedNoise[0].count === 950, 'el color fusionado debe conservar la suma total de píxeles (950), dio ' + mergedNoise[0].count);

    // Dos colores real y perceptualmente distintos (azul vs. rojo de marca)
    // NO deben fusionarse.
    const distinctBuckets = [
        { r: 20, g: 90, b: 200, count: 500 },
        { r: 210, g: 30, b: 40, count: 400 },
    ];
    const mergedDistinct = M.mergePerceptualColors(distinctBuckets, 9);
    assert(mergedDistinct.length === 2, 'azul y rojo de marca deben seguir siendo 2 colores distintos, dio ' + mergedDistinct.length);
}

// ============================================================
// 10. simulateColorblind — casos límite
// ============================================================
{
    const white = { r: 255, g: 255, b: 255 };
    const whiteProt = M.simulateColorblind(white, 'protanopia');
    approx(whiteProt.r, 255, 1, 'blanco puro bajo protanopia debe seguir siendo ~blanco (r)');
    approx(whiteProt.g, 255, 1, 'blanco puro bajo protanopia debe seguir siendo ~blanco (g)');
    approx(whiteProt.b, 255, 1, 'blanco puro bajo protanopia debe seguir siendo ~blanco (b)');

    const black = { r: 0, g: 0, b: 0 };
    const blackDeut = M.simulateColorblind(black, 'deuteranopia');
    assert(blackDeut.r === 0 && blackDeut.g === 0 && blackDeut.b === 0, 'negro puro debe seguir siendo negro bajo cualquier simulación');

    // Un rojo saturado bajo protanopia debe oscurecerse/desaturarse
    // (no puede quedar igual de vívido — esa es la naturaleza de la condición).
    const red = { r: 220, g: 20, b: 20 };
    const redProt = M.simulateColorblind(red, 'protanopia');
    assert(redProt.r < red.r, 'un rojo saturado debe perder intensidad de rojo bajo protanopia');
}

// ============================================================
// 11. Veto de indicadores de piso — el caso real que motivó esto:
// una marca recargada de color y efectos que sacaba ~90% de puntaje
// general pese a tener Reproducibilidad hundida por exceso de color.
// ============================================================
{
    // Caso real: Reproducibilidad hundida (exceso de color), los otros
    // 5 indicadores casi perfectos. Antes del veto, el promedio daba ~90.
    const casoRecargado = {
        calidad_grafica: { score: 95 },
        reproducibilidad: { score: 46 }, // 9 colores detectados
        legibilidad: { score: 95 },
        inteligibilidad: { score: 90 },
        vocatividad: { score: 97 }, // alta saturación — no debe salvar el puntaje
        pregnancia: { score: 94 }
    };
    const overallRecargado = M.calculateOverall(casoRecargado);
    assert(overallRecargado <= 66, 'con Reproducibilidad en 46, el veto debe limitar el general a 46+20=66 como máximo, dio ' + overallRecargado);
    assert(overallRecargado < 70, 'el veto debe impedir que este caso caiga en "No necesita ajustes" (≥70), dio ' + overallRecargado);

    const gate = M.getGateInfo(casoRecargado);
    assert(gate.worstKey === 'reproducibilidad', 'el indicador de piso más bajo debe identificarse como reproducibilidad, dio ' + gate.worstKey);
    assert(!M.gateIndicatorKeys.includes('vocatividad'), 'vocatividad no debe ser indicador de piso (Chaves y Belluccia 2.12: su nivel adecuado es contextual)');

    // Caso control: todos los indicadores parejos y altos — el veto no
    // debe activarse ni bajar el puntaje cuando no hay ningún problema real.
    const casoParejo = {
        calidad_grafica: { score: 88 }, reproducibilidad: { score: 85 }, legibilidad: { score: 90 },
        inteligibilidad: { score: 87 }, vocatividad: { score: 40 }, pregnancia: { score: 89 }
    };
    const overallParejo = M.calculateOverall(casoParejo);
    approx(overallParejo, 80, 1, 'sin ningún indicador de piso bajo, el veto no debe alterar el promedio ponderado, dio ' + overallParejo);
}

// ============================================================
console.log(`\n${pass} pruebas OK, ${fail} fallaron.`);
process.exit(fail > 0 ? 1 : 0);
