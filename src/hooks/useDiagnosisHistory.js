import { useCallback } from 'react';
import { supabaseClient } from '../lib/supabaseClient.js';

// Deja afuera datos pesados que no hacen falta para volver a mostrar el
// informe (la lista completa de componentes detectados), conservando lo
// mínimo de rawData que sí se usa (recalcular la paleta, mostrar
// métricas). A diferencia de legacy, no persiste `diagnostic` como HTML
// — DiagnosticText.jsx lo reconstruye en el momento a partir de estos
// mismos campos.
function buildSerializableResults(results) {
  return {
    typology: results.typology,
    colors: results.colors,
    indicators: results.indicators,
    overallScore: results.overallScore,
    aiSummary: results.aiSummary || null,
    plan: results.plan,
    brandNameUsed: results.brandNameUsed,
    sectorUsed: results.sectorUsed,
    analyzedAt: results.analyzedAt,
    rawData: {
      contrast: results.rawData.contrast,
      symmetryScore: results.rawData.symmetryScore,
      edgeComplexity: results.rawData.edgeComplexity,
      componentCount: results.rawData.componentCount,
      effectiveComponentCount: results.rawData.effectiveComponentCount,
      colorCount: results.rawData.colorCount,
      inkRatio: results.rawData.inkRatio,
      W: results.rawData.W, H: results.rawData.H,
    },
  };
}

export function useDiagnosisHistory({ user, isGuest }) {
  const fetchHistory = useCallback(async () => {
    if (isGuest || !user?.id) return [];
    const { data, error } = await supabaseClient
      .from('diagnosis_history')
      .select('id, brand_name, typology, overall_score, plan, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  }, [user, isGuest]);

  // Requiere la migración PARTE 12 de api/supabase_schema.sql (policy de
  // delete) — sin correrla, esto falla silenciosamente por RLS.
  const deleteHistoryEntry = useCallback(async (id) => {
    const { error } = await supabaseClient.from('diagnosis_history').delete().eq('id', id);
    return { error: error?.message || null };
  }, []);

  const saveToHistory = useCallback(
    async (results) => {
      if (isGuest) return { error: 'Crea una cuenta gratis para guardar diagnósticos en tu historial' };
      let imagePath = null;
      try {
        const imgSrc = results.imageUsed;
        const match = imgSrc && imgSrc.match(/^data:([^;]+);base64,/);
        if (match) {
          const mediaType = match[1];
          const ext = mediaType.split('/')[1] || 'png';
          const fileName = user.id + '/' + Date.now() + '.' + ext;
          const blob = await (await fetch(imgSrc)).blob();
          const { error: uploadError } = await supabaseClient.storage.from('diagnosis-images').upload(fileName, blob, { contentType: mediaType });
          if (!uploadError) imagePath = fileName;
        }
      } catch {
        // si falla subir la imagen, igual se guarda el resto del diagnóstico
      }

      const { error } = await supabaseClient.from('diagnosis_history').insert({
        user_id: user.id,
        brand_name: results.brandNameUsed || null,
        typology: results.typology.type,
        overall_score: results.overallScore,
        plan: results.plan,
        results_json: buildSerializableResults(results),
        image_path: imagePath,
      });
      if (error) return { error: error.message };
      return { error: null };
    },
    [user, isGuest]
  );

  // Reconstruye un resultado guardado, con URL firmada para la imagen
  // privada (300s de validez, igual que legacy).
  const loadHistoryEntry = useCallback(async (id) => {
    const { data, error } = await supabaseClient.from('diagnosis_history').select('*').eq('id', id).single();
    if (error || !data || !data.results_json) throw new Error('No se pudo cargar este diagnóstico');
    const results = { ...data.results_json };
    if (data.image_path) {
      const { data: signed } = await supabaseClient.storage.from('diagnosis-images').createSignedUrl(data.image_path, 300);
      results.imageUsed = signed ? signed.signedUrl : null;
    }
    return results;
  }, []);

  return { fetchHistory, saveToHistory, loadHistoryEntry, deleteHistoryEntry };
}
