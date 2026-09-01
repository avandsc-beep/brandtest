import { useCallback } from 'react';
import { supabaseClient } from '../lib/supabaseClient.js';
import { analyzeImage, classifyColors } from '../lib/imageAnalysis.js';
import { typologies, detectTypologyReal } from '../lib/typology.js';
import { evaluateIndicatorsReal, calculateOverall } from '../lib/scoring.js';

// Ported de legacyApp.js callClaudeAnalysis()/buildScoresFromAI(). Llama al
// endpoint REAL de Vercel (api/analyze-brand.js, Claude vision) con el
// contrato real — no el que usaba el mock del maquetado de Stitch. Si algo
// falla (sin ANTHROPIC_API_KEY configurada, red caída, etc.) devuelve
// null y quien llama cae al motor de reglas local.
async function callClaudeAnalysis({ imageSrc, d, isGuest, context }) {
  const match = imageSrc.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mediaType = match[1];
  const base64 = match[2];
  const metrics = {
    contrast: d.contrast, symmetryScore: d.symmetryScore, edgeComplexity: d.edgeComplexity,
    componentCount: d.componentCount, effectiveComponentCount: d.effectiveComponentCount,
    colorCount: d.colorCount, inkRatio: d.inkRatio,
  };
  const headers = { 'Content-Type': 'application/json' };
  if (!isGuest) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) headers.Authorization = 'Bearer ' + session.access_token;
  }
  const res = await fetch('/api/analyze-brand', {
    method: 'POST', headers,
    body: JSON.stringify({ imageBase64: base64, mediaType, metrics, context }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de análisis con IA');
  return data.analysis;
}

function buildScoresFromAI(ai) {
  const keys = ['calidad_grafica', 'reproducibilidad', 'legibilidad', 'inteligibilidad', 'vocatividad', 'pregnancia'];
  const scores = {};
  keys.forEach((k) => {
    scores[k] = { score: ai[k], justification: ai[k + '_justification'] };
  });
  return scores;
}

/**
 * Orquesta un análisis completo: imagen real → motor de reglas y/o Claude
 * → tipología (manual > IA > reglas) → puntajes con el veto de piso.
 * Ported de legacyApp.js analyzeBrand(), sin la parte de créditos (eso es
 * useCredits) ni la de DOM (eso es UploadView/ScanningView).
 *
 * @returns el mismo shape de `results` que usaba displayResults() en
 *   legacy, para que ResultsView pueda consumirlo directamente.
 */
export function useBrandAnalysis() {
  const runAnalysis = useCallback(async ({ imageSrc, imageSource, isGuest, formData, manualTypologyKey, onStage }) => {
    const stage = (s) => onStage && onStage(s);
    stage('decoding');
    const d = await analyzeImage(imageSrc, imageSource);
    stage('scoring');

    const manualTypology = manualTypologyKey
      ? {
          type: manualTypologyKey,
          name: typologies[manualTypologyKey].name,
          confidence: 100,
          justification: 'Tipología confirmada por el usuario antes del análisis — el diagnóstico se construye sobre esta elección.',
        }
      : null;

    let typology = manualTypology;
    let scores = null;
    let aiSummary = null;
    stage('ai');
    try {
      const ai = await callClaudeAnalysis({
        imageSrc, d, isGuest,
        context: {
          brandName: formData.brandName.trim(),
          sector: formData.sector.trim(),
          competitors: formData.competitors.trim(),
          attributes: formData.brandAttributes.trim(),
        },
      });
      if (ai) {
        if (!manualTypology) {
          typology = { type: ai.typology, name: typologies[ai.typology].name, confidence: ai.typology_confidence, justification: ai.typology_justification };
        }
        scores = buildScoresFromAI(ai);
        aiSummary = ai.diagnostic_summary;
      }
    } catch (e) {
      console.warn('Análisis con IA no disponible, se usa el motor de reglas:', e.message);
    }
    if (!scores) scores = evaluateIndicatorsReal(d);
    if (!typology) typology = detectTypologyReal(d);

    stage('finishing');
    const overallScore = calculateOverall(scores);

    return {
      typology,
      colors: { count: d.colorCount, palette: d.palette, classification: classifyColors(d.colorCount) },
      indicators: scores,
      overallScore,
      aiSummary,
      plan: formData.plan,
      rawData: d,
      imageUsed: imageSrc,
      brandNameUsed: formData.brandName.trim(),
      sectorUsed: formData.sector.trim(),
      analyzedAt: new Date().toISOString(),
    };
  }, []);

  return { runAnalysis };
}
