import { useCallback } from 'react';
import { supabaseClient } from '../lib/supabaseClient.js';

// Reemplaza db.typologyFeedback / db.diagnosticFeedback (localStorage,
// solo visible en el navegador de cada admin) por una tabla real
// (brand_feedback, ver api/supabase_schema.sql PARTE 11). Requiere haber
// corrido esa migración en Supabase — si la tabla no existe todavía, el
// insert simplemente falla silenciosamente (no rompe el flujo principal).
export function useFeedback({ user, isGuest }) {
  const reportTypologyCorrection = useCallback(
    async (predictedType, correctedType) => {
      if (isGuest || !user?.id || predictedType === correctedType) return;
      await supabaseClient.from('brand_feedback').insert({
        user_id: user.id, kind: 'typology_correction',
        predicted_typology: predictedType, corrected_typology: correctedType,
      }).then(({ error }) => { if (error) console.warn('No se pudo registrar la corrección de tipología:', error.message); });
    },
    [user, isGuest]
  );

  const reportDiagnosticFeedback = useCallback(
    async ({ positive, typology, overallScore, plan }) => {
      if (isGuest || !user?.id) return;
      await supabaseClient.from('brand_feedback').insert({
        user_id: user.id, kind: 'diagnostic_feedback',
        positive, predicted_typology: typology, overall_score: overallScore, plan,
      }).then(({ error }) => { if (error) console.warn('No se pudo registrar el feedback del diagnóstico:', error.message); });
    },
    [user, isGuest]
  );

  return { reportTypologyCorrection, reportDiagnosticFeedback };
}
