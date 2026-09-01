import { useState } from 'react';
import { useSupabaseAuth } from './hooks/useSupabaseAuth.js';
import { Navbar } from './components/layout/Navbar.jsx';
import { Footer } from './components/layout/Footer.jsx';
import { HomeView } from './components/home/HomeView.jsx';
import { LoginModal } from './components/modals/LoginModal.jsx';
import { MethodologyModal } from './components/modals/MethodologyModal.jsx';
import { PostAuthApp } from './PostAuthApp.jsx';

// Punto de entrada real de React (ya no dangerouslySetInnerHTML — ver
// plan de migración: src/legacy/legacyMarkup.js y legacyApp.js quedan
// solo como referencia funcional hasta borrarse en la limpieza final).
export default function App() {
  const { status, user, isGuest, loginWithGoogle, enterAsGuest, logout, patchUser } = useSupabaseAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
  const [guestError, setGuestError] = useState(null);

  const handleGuestEntry = () => {
    const result = enterAsGuest();
    if (!result.allowed) {
      setGuestError(result.message);
      return;
    }
    setGuestError(null);
    setIsLoginOpen(false);
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="font-mono text-xs text-outline uppercase tracking-widest">Cargando…</span>
      </div>
    );
  }

  if (status === 'authed' || status === 'guest') {
    return <PostAuthApp user={user} isGuest={isGuest} patchUser={patchUser} onLogout={logout} />;
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col selection:bg-process-cyan selection:text-ink-black">
      <Navbar onOpenLogin={() => setIsLoginOpen(true)} onOpenMethodology={() => setIsMethodologyOpen(true)} />
      <main className="flex-1 pt-16">
        <HomeView onRequireAuth={() => setIsLoginOpen(true)} onOpenMethodology={() => setIsMethodologyOpen(true)} />
      </main>
      <Footer />
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => { setIsLoginOpen(false); setGuestError(null); }}
        onGoogleLogin={loginWithGoogle}
        onGuestEntry={handleGuestEntry}
        guestError={guestError}
      />
      <MethodologyModal isOpen={isMethodologyOpen} onClose={() => setIsMethodologyOpen(false)} />
    </div>
  );
}
