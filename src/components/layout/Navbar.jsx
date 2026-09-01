import { BookOpen } from 'lucide-react';
import { BrandWordmark } from './BrandLogo.jsx';

// Header calcado del .header real del colaborador: barra fija con
// degradado azul, siempre blanca sin importar el tema — la misma barra
// que usa el resto de la app (ver AppHeader.jsx), aplicada acá a la
// landing pre-login.
export function Navbar({ onOpenLogin, onOpenMethodology }) {
  return (
    <header className="bx-header fixed top-0 left-0 right-0 z-40 px-4 sm:px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <BrandWordmark className="h-6 w-auto" />

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenMethodology}
            className="hidden sm:flex px-3.5 py-1.5 rounded-full text-sm font-medium text-white/85 hover:text-white hover:bg-white/10 transition-colors items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Metodología
          </button>

          <button onClick={onOpenLogin} className="bx-btn">
            Acceder
          </button>
        </div>
      </div>
    </header>
  );
}
