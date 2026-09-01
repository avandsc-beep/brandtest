import { useCallback, useState } from 'react';
import { renderAdjustedImage } from '../lib/imageAdjustments.js';

const DEFAULT_ADJUSTMENTS = { brightness: 0, contrast: 0, saturation: 0, rotation: 0, whiteBalance: 'none' };

/**
 * Estado de la imagen que se va a analizar: origen (upload/cámara),
 * imagen original, imagen ajustada (brillo/contraste/saturación/
 * rotación/balance de blancos, horneados de verdad en píxeles vía
 * canvas — ver src/lib/imageAdjustments.js), y si hay controles de
 * edición visibles (solo para fotos de cámara, igual que en legacy).
 */
export function useImagePipeline() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageFileName, setImageFileName] = useState(null);
  const [imageSource, setImageSource] = useState('upload'); // 'upload' | 'camera'
  const [adjustedImage, setAdjustedImage] = useState(null);
  const [adjustments, setAdjustments] = useState(DEFAULT_ADJUSTMENTS);
  const [showEditControls, setShowEditControls] = useState(false);

  const reset = useCallback(() => {
    setSelectedImage(null);
    setImageFileName(null);
    setImageSource('upload');
    setAdjustedImage(null);
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setShowEditControls(false);
  }, []);

  const setFromFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target.result);
      setImageFileName(file.name);
      setImageSource('upload');
      setAdjustedImage(null);
      setAdjustments(DEFAULT_ADJUSTMENTS);
      setShowEditControls(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const setFromCamera = useCallback((dataUrl) => {
    setSelectedImage(dataUrl);
    setImageFileName(null);
    setImageSource('camera');
    setAdjustedImage(null);
    setAdjustments(DEFAULT_ADJUSTMENTS);
    // Una foto de cámara típicamente necesita corrección; un archivo
    // subido (logo exportado) normalmente no — mismo criterio que legacy.
    setShowEditControls(true);
  }, []);

  const setFromCrop = useCallback((dataUrl) => {
    setSelectedImage(dataUrl);
    setAdjustedImage(null);
    // Si había ajustes cargados, se re-aplican sobre la imagen recién
    // recortada en vez de perderse (mismo comportamiento que confirmCrop()).
  }, []);

  const updateAdjustment = useCallback((patch) => {
    setAdjustments((prev) => ({ ...prev, ...patch }));
  }, []);

  // Debe llamarse después de setAdjustments/setFromCrop para hornear los
  // nuevos valores en píxeles reales (misma imagen que se va a analizar).
  // Acepta un `sourceOverride` explícito para el caso de recorte: el
  // estado de React (selectedImage) todavía no se actualizó en este mismo
  // tick, así que confiar en el closure daría la imagen vieja.
  const applyAdjustments = useCallback(async (nextAdjustments, sourceOverride) => {
    const source = sourceOverride ?? selectedImage;
    if (!source) return null;
    const result = await renderAdjustedImage(source, nextAdjustments ?? adjustments);
    setAdjustedImage(result);
    return result;
  }, [selectedImage, adjustments]);

  return {
    selectedImage, imageFileName, imageSource,
    adjustedImage, adjustments, showEditControls,
    finalImage: adjustedImage || selectedImage,
    setFromFile, setFromCamera, setFromCrop,
    updateAdjustment, applyAdjustments, reset,
  };
}
