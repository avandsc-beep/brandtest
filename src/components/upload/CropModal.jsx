import { useEffect, useRef } from 'react';
import { RotateCw, RotateCcw as ResetIcon, X, Check } from 'lucide-react';

// Cropper.js sigue cargándose como global (window.Cropper, ver
// src/main.jsx) — es la misma librería e integración que ya funcionaba en
// legacy, solo con un ciclo de vida de React alrededor.
export function CropModal({ isOpen, imageSrc, onCancel, onConfirm }) {
  const imgRef = useRef(null);
  const cropperRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !imageSrc || !imgRef.current) return;
    imgRef.current.src = imageSrc;
    cropperRef.current = new window.Cropper(imgRef.current, {
      viewMode: 1, dragMode: 'move', autoCropArea: 0.9, guides: true, center: true, background: false,
    });
    return () => {
      cropperRef.current?.destroy();
      cropperRef.current = null;
    };
  }, [isOpen, imageSrc]);

  if (!isOpen) return null;

  const handleRotate = () => cropperRef.current?.rotate(90);
  const handleReset = () => cropperRef.current?.reset();
  const handleConfirm = () => {
    if (!cropperRef.current) return;
    const canvas = cropperRef.current.getCroppedCanvas({ imageSmoothingQuality: 'high' });
    onConfirm(canvas.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bx-card w-full max-w-2xl text-on-surface">
        <div className="bx-card-title">Recortar imagen</div>

        <div className="h-96 rounded-xl bg-background border border-outline-variant overflow-hidden">
          <img ref={imgRef} alt="Imagen a recortar" className="max-w-full block" />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4 text-sm">
          <button onClick={handleRotate} className="bx-btn py-1.5 px-3 flex items-center gap-1.5">
            <RotateCw className="w-3.5 h-3.5" /> Rotar 90°
          </button>
          <button onClick={handleReset} className="bx-btn py-1.5 px-3 flex items-center gap-1.5">
            <ResetIcon className="w-3.5 h-3.5" /> Restablecer
          </button>
          <button onClick={onCancel} className="bx-btn py-1.5 px-3 flex items-center gap-1.5">
            <X className="w-3.5 h-3.5" /> Cancelar
          </button>
          <button onClick={handleConfirm} className="bx-btn bx-btn-primary ml-auto py-1.5 px-3 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> Aplicar recorte
          </button>
        </div>
      </div>
    </div>
  );
}
