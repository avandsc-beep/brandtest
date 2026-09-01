import { useEffect, useRef, useState } from 'react';
import { X, Camera, RefreshCw, Check } from 'lucide-react';

// La lógica de cámara del maquetado de Stitch ya era real (getUserMedia
// genuino, sin mocks) — se porta casi textual, solo con los tokens de
// color nuevos.
export function CameraModal({ isOpen, onClose, onCapture }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  useEffect(() => {
    if (isOpen && !capturedPhoto) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, capturedPhoto]);

  async function startCamera() {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch {
      setError('No se pudo acceder a la cámara. Verifica los permisos de tu dispositivo.');
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }

  function takePhoto() {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    setCapturedPhoto(canvas.toDataURL('image/jpeg'));
    stopCamera();
  }

  function handleConfirm() {
    if (!capturedPhoto) return;
    onCapture(capturedPhoto);
    setCapturedPhoto(null);
    onClose();
  }

  function handleRetake() {
    setCapturedPhoto(null);
    startCamera();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bx-card relative w-full max-w-lg text-on-surface">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 text-on-surface-variant hover:text-on-surface">
          <X className="w-5 h-5" />
        </button>

        <div className="bx-card-title">Captura óptica de marca</div>

        {error ? (
          <div className="p-5 rounded-xl bg-background border border-process-magenta text-process-magenta text-sm text-center space-y-3">
            <p>{error}</p>
            <button onClick={startCamera} className="bx-btn">Reintentar permisos</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative w-full h-72 rounded-xl bg-black border border-outline-variant overflow-hidden flex items-center justify-center">
              {!capturedPhoto ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute inset-8 border border-dashed border-process-cyan/60 rounded-xl pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] text-process-cyan bg-black/50 px-2 py-0.5 rounded">Alinea el signo aquí</span>
                  </div>
                </>
              ) : (
                <img src={capturedPhoto} alt="Marca capturada" className="w-full h-full object-contain" />
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              {!capturedPhoto ? (
                <button type="button" onClick={takePhoto} className="bx-btn bx-btn-primary w-full py-3 flex items-center justify-center gap-2">
                  <Camera className="w-4 h-4" />
                  <span>Capturar fotografía</span>
                </button>
              ) : (
                <>
                  <button type="button" onClick={handleRetake} className="bx-btn w-1/2 py-3 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    <span>Repetir</span>
                  </button>
                  <button type="button" onClick={handleConfirm} className="bx-btn bx-btn-primary w-1/2 py-3 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>Usar imagen</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
