import { useState } from 'react';
import { X } from 'lucide-react';
import { TypologyGrid } from '../upload/TypologyGrid.jsx';

export function TypologyCorrectionModal({ isOpen, currentType, onClose, onAccept }) {
  const [selected, setSelected] = useState(currentType);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bx-card relative w-full max-w-2xl max-h-[85vh] overflow-y-auto text-on-surface">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-on-surface-variant hover:text-on-surface">
          <X className="w-5 h-5" />
        </button>
        <div className="bx-card-title">Seleccione el tipo correcto</div>
        <TypologyGrid value={selected} onChange={setSelected} showAutoOption={false} />
        <button disabled={!selected} onClick={() => onAccept(selected)} className="bx-btn bx-btn-primary w-full mt-4 disabled:opacity-40">
          Aceptar
        </button>
      </div>
    </div>
  );
}
