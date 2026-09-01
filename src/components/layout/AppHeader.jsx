import { useState } from 'react';
import { User, ChevronDown, ShieldCheck, LogOut, Plus } from 'lucide-react';
import { BrandWordmark } from './BrandLogo.jsx';
import { getInitials } from '../../lib/textUtils.js';

// Header calcado del .header real del colaborador: barra FIJA (no sticky)
// con degradado azul, siempre blanca sin importar el tema ("el header
// siempre es azul, sin importar el tema" — su comentario). El contenido de
// abajo compensa el espacio con padding-top (ver PostAuthApp.jsx).
export function AppHeader({ user, isGuest, view, onNavigate, onLogout, onOpenAdmin }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bx-header fixed top-0 left-0 right-0 z-40 px-4 sm:px-6 py-3 print:hidden">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-6">
          <button onClick={() => onNavigate('upload')} className="flex items-center gap-2 text-white">
            <BrandWordmark className="h-6 w-auto" />
          </button>
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onNavigate('upload')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${view === 'upload' ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white'}`}
            >
              Diagnóstico
            </button>
            {!isGuest && (
              <button
                onClick={() => onNavigate('dashboard')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${view === 'dashboard' ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white'}`}
              >
                Mi cuenta
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={() => onNavigate('upload')} className="bx-btn hidden sm:flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nuevo diagnóstico
          </button>

          {user?.is_admin && (
            <button onClick={onOpenAdmin} className="bx-btn hidden sm:flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Admin
            </button>
          )}

          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center">
                  {isGuest ? <User className="w-3.5 h-3.5" /> : getInitials(user?.name)}
                </div>
              )}
              <span className="hidden sm:block text-sm">{user?.name?.split(' ')[0]}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-outline-variant rounded-2xl p-2 z-50 text-on-surface shadow-xl">
                <div className="px-3 py-2 text-xs text-on-surface-variant border-b border-outline-variant mb-1">
                  {isGuest ? 'Invitado — sin cuenta' : `${user?.credits ?? 0} créditos · Plan ${user?.plan}`}
                </div>
                {!isGuest && (
                  <button onClick={() => { setMenuOpen(false); onNavigate('dashboard'); }} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-surface-container-highest">
                    Mi cuenta
                  </button>
                )}
                <button onClick={() => { setMenuOpen(false); onLogout(); }} className="w-full text-left px-3 py-2 rounded-xl text-sm text-process-magenta hover:bg-surface-container-highest flex items-center gap-1.5">
                  <LogOut className="w-3.5 h-3.5" /> {isGuest ? 'Salir del modo invitado' : 'Cerrar sesión'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
