import { useState } from 'react';
import { X } from 'lucide-react';
import { BrandMark } from '../layout/BrandLogo.jsx';

// Calcado de .login-card real del colaborador: tarjeta redondeada
// centrada, ícono con glow pulsante (.login-stage), sin sombra dura ni
// miras de registro — ver ResultsView.jsx para la nota completa sobre por
// qué se abandonó ese lenguaje visual en el rebrand BRANDEX.
export function LoginModal({ isOpen, onClose, onGoogleLogin, onGuestEntry, guestError }) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setLoading(true);
    await onGoogleLogin();
    // No hace falta setLoading(false): la página redirige a Google.
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bx-login-card relative text-on-surface">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-on-surface-variant hover:text-on-surface transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="bx-login-stage">
          <div className="bx-login-icon-wrap">
            <BrandMark className="w-full h-full text-process-cyan" />
          </div>
        </div>

        <p className="font-mono text-xs text-on-surface-variant uppercase tracking-widest mb-2">Acceso</p>
        <h2 className="font-display text-3xl font-bold mb-2">Bienvenido a BRANDEX</h2>
        <p className="text-sm text-on-surface-variant mb-8">
          Accedé para analizar marcas y guardar tu historial de diagnósticos.
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="bx-btn w-full py-3.5 flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
          </svg>
          <span>{loading ? 'Redirigiendo…' : 'Continuar con Google'}</span>
        </button>

        <p className="mt-3 text-xs text-on-surface-variant">
          Al registrarte recibís <strong className="text-process-cyan">10 créditos gratuitos</strong>
        </p>

        <div className="mt-6 pt-5 border-t border-outline-variant">
          <button onClick={onGuestEntry} className="text-sm text-process-cyan hover:underline font-medium">
            Probar sin registrarme &rarr;
          </button>
          <p className="text-xs text-on-surface-variant mt-1.5">1 análisis gratis cada 48 horas, sin guardar historial.</p>
          {guestError && <p className="text-xs text-process-magenta mt-3">{guestError}</p>}
        </div>

        <div className="mt-6 pt-5 border-t border-outline-variant">
          <p className="text-xs text-on-surface-variant">Autor: <strong className="text-on-surface">Marco Antonio Ramírez</strong></p>
          <p className="text-xs text-on-surface-variant">Gestión de Marca Gráfica</p>
        </div>
      </div>
    </div>
  );
}
