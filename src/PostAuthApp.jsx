import { useState } from 'react';
import { AppHeader } from './components/layout/AppHeader.jsx';
import { Footer } from './components/layout/Footer.jsx';
import { UploadView } from './components/upload/UploadView.jsx';
import { RecognitionTest } from './components/upload/RecognitionTest.jsx';
import { ScanningView } from './components/scanning/ScanningView.jsx';
import { ResultsView } from './components/results/ResultsView.jsx';
import { DashboardView } from './components/dashboard/DashboardView.jsx';
import { AdminPanel } from './components/admin/AdminPanel.jsx';
import { useDiagnosisHistory } from './hooks/useDiagnosisHistory.js';
import { useCredits } from './hooks/useCredits.js';
import { useUserProfile } from './hooks/useUserProfile.js';

// Todo lo que pasa después de login/invitado. Reemplaza por completo el
// árbol legacy (src/legacy/legacyMarkup.js + legacyApp.js) para las
// pantallas ya migradas — ver el plan de migración para el detalle de qué
// se portó de dónde.
export function PostAuthApp({ user, isGuest, patchUser, onLogout }) {
  const [view, setView] = useState('upload'); // 'upload' | 'scanning' | 'results' | 'dashboard' | 'admin'
  const [pendingAnalysis, setPendingAnalysis] = useState(null);
  const [currentResult, setCurrentResult] = useState(null);
  const [scanError, setScanError] = useState(null);

  const { saveToHistory } = useDiagnosisHistory({ user, isGuest });
  const { checkAndConsume, markGuestUsed } = useCredits({ user, isGuest, patchUser });
  const { profile, setProfile } = useUserProfile({ user, isGuest, patchUser });

  const handleStartAnalysis = async (payload) => {
    setScanError(null);
    // El permiso y el descuento de créditos se deciden en el servidor para
    // cuentas reales (ver useCredits.js) — nunca localmente, salvo el
    // límite de 48h de invitado, que no tiene fila de DB que proteger.
    const check = await checkAndConsume(payload.formData.plan);
    if (!check.allowed) {
      setScanError(check.message);
      return;
    }
    setPendingAnalysis(payload);
    setView('scanning');
  };

  const handleScanComplete = (results) => {
    // Igual que legacy: la ventana de 48h del invitado solo se sella
    // después de un análisis EXITOSO, no en el chequeo de permiso previo
    // — un intento fallido no debe quemarle el turno.
    markGuestUsed();
    setCurrentResult(results);
    setPendingAnalysis(null);
    setView('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScanError = (err) => {
    setScanError(err.message || 'No se pudo completar el análisis');
    setPendingAnalysis(null);
    setView('upload');
  };

  const handleSaveToHistory = async (results) => {
    const { error } = await saveToHistory(results);
    if (error) alert('No se pudo guardar: ' + error);
  };

  const handleViewHistoryResult = (results) => {
    setCurrentResult(results);
    setView('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col selection:bg-process-cyan selection:text-ink-black">
      <AppHeader
        user={user} isGuest={isGuest} view={view}
        onNavigate={(v) => setView(v)} onLogout={onLogout}
        onOpenAdmin={() => setView('admin')}
      />
      <main className="flex-1 pt-16">
        {scanError && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
            <div className="p-3 bg-red-950/30 border border-red-400 text-red-300 font-mono text-xs">{scanError}</div>
          </div>
        )}

        {view === 'upload' && (
          <>
            {!isGuest && <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8"><RecognitionTest patchUser={patchUser} /></div>}
            <UploadView user={user} isGuest={isGuest} onStartAnalysis={handleStartAnalysis} />
          </>
        )}

        {view === 'scanning' && pendingAnalysis && (
          <ScanningView
            payload={pendingAnalysis} isGuest={isGuest}
            brandNameHint={pendingAnalysis.formData.brandName}
            onComplete={handleScanComplete} onError={handleScanError}
          />
        )}

        {view === 'results' && currentResult && (
          <ResultsView
            result={currentResult} user={user} isGuest={isGuest}
            profile={profile} onChangeProfile={setProfile}
            onSaveToHistory={handleSaveToHistory}
            onNewAnalysis={() => setView('upload')}
          />
        )}

        {view === 'dashboard' && !isGuest && (
          <DashboardView user={user} patchUser={patchUser} onViewHistoryResult={handleViewHistoryResult} />
        )}

        {view === 'admin' && user?.is_admin && (
          <AdminPanel user={user} onClose={() => setView('upload')} />
        )}
      </main>
      <Footer />
    </div>
  );
}
