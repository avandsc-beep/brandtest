import { useRef, useState } from 'react';
import { Upload, Camera, Trash2, AlertCircle, ArrowRight, Crop as CropIcon } from 'lucide-react';
import { SECTORS } from '../../lib/constants.js';
import { TypologyGrid } from './TypologyGrid.jsx';
import { ImageAdjustmentPanel } from './ImageAdjustmentPanel.jsx';
import { CameraModal } from './CameraModal.jsx';
import { CropModal } from './CropModal.jsx';
import { useImagePipeline } from '../../hooks/useImagePipeline.js';
import { Reveal } from '../common/Reveal.jsx';

const PLANS = [
  { id: 'libre', name: 'Libre', cost: '0', desc: '1 análisis cada 12 horas · Informe básico' },
  { id: 'estandar', name: 'Estándar', cost: '10', desc: 'Informe detallado y exportación completa' },
  { id: 'pro', name: 'Pro', cost: '20', desc: 'Máxima precisión y análisis avanzado' },
];

export function UploadView({ user, isGuest, onStartAnalysis }) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const pipeline = useImagePipeline();

  const [brandName, setBrandName] = useState('');
  const [sector, setSector] = useState(SECTORS[0]);
  const [competitors, setCompetitors] = useState('');
  const [brandAttributes, setBrandAttributes] = useState('');
  const [manualTypologyKey, setManualTypologyKey] = useState(null);
  const [plan, setPlan] = useState(isGuest ? 'libre' : 'estandar');

  const handleFiles = (files) => {
    if (files && files[0]) pipeline.setFromFile(files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleAdjustmentChange = async (patch) => {
    const next = { ...pipeline.adjustments, ...patch };
    pipeline.updateAdjustment(patch);
    await pipeline.applyAdjustments(next);
  };

  const handleCropConfirm = async (dataUrl) => {
    pipeline.setFromCrop(dataUrl);
    setIsCropOpen(false);
    // sourceOverride=dataUrl: el estado de React (selectedImage) todavía no
    // se actualizó en este mismo tick — ver useImagePipeline.js.
    if (pipeline.showEditControls) await pipeline.applyAdjustments(undefined, dataUrl);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pipeline.selectedImage) {
      setValidationError('Selecciona una imagen de la marca primero.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!brandName.trim()) {
      setValidationError('Por favor ingresa el nombre de la marca a evaluar.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setValidationError(null);
    onStartAnalysis({
      imageSrc: pipeline.finalImage,
      imageSource: pipeline.imageSource,
      formData: { brandName, sector, competitors, brandAttributes, plan },
      manualTypologyKey,
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Reveal>
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-on-surface">Analizar marca</h1>
          <p className="text-sm text-on-surface-variant mt-1">Nuevo diagnóstico técnico</p>
        </div>
      </Reveal>

      {validationError && (
        <div className="mb-6 p-3.5 rounded-xl bg-process-magenta/10 border border-process-magenta text-process-magenta text-sm flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Reveal delay={80}>
        <div className="bx-card">
          <div className="bx-card-title">Imagen de la marca</div>

          <input
            ref={fileInputRef} type="file" accept="image/svg+xml, image/png, image/jpeg, image/webp"
            onChange={(e) => handleFiles(e.target.files)} className="hidden"
          />

          {!pipeline.selectedImage ? (
            <div
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`bx-upload-area ${dragActive ? 'dragover' : ''}`}
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-process-cyan" />
              <p className="text-sm font-semibold text-on-surface">Arrastra y suelta el archivo del identificador</p>
              <p className="text-xs text-on-surface-variant mt-1">Para máxima fidelidad se recomienda un vector exportado en fondo transparente</p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="bx-btn bx-btn-primary flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" /> Seleccionar archivo
                </button>
                <button type="button" onClick={() => setIsCameraOpen(true)} className="bx-btn flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5" /> Capturar con cámara
                </button>
              </div>
            </div>
          ) : (
            <div className="bx-indicator-item">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <img src={pipeline.finalImage} alt="Vista previa de la marca" className="w-20 h-20 rounded-lg border border-outline-variant object-contain bg-surface p-1" />
                  <div>
                    <div className="text-xs font-semibold text-process-cyan">Identificador cargado</div>
                    <div className="text-sm text-on-surface truncate max-w-[200px] mt-0.5">
                      {pipeline.imageFileName || 'captura de cámara'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-sm">
                  <button type="button" onClick={() => setIsCropOpen(true)} className="bx-btn flex items-center gap-1.5 py-1.5 px-3">
                    <CropIcon className="w-3.5 h-3.5" /> Recortar
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="bx-btn py-1.5 px-3">
                    Reemplazar
                  </button>
                  <button
                    type="button"
                    onClick={() => { pipeline.reset(); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="p-2 rounded-full text-process-magenta hover:bg-process-magenta/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {pipeline.showEditControls && (
                <ImageAdjustmentPanel adjustments={pipeline.adjustments} onChange={handleAdjustmentChange} />
              )}
            </div>
          )}
        </div>
        </Reveal>

        <Reveal delay={140}>
        <div className="bx-card">
          <div className="bx-card-title">Contexto de la marca</div>
          <p className="text-xs text-on-surface-variant mb-4">
            Estos datos identifican la marca en el informe. Los 6 indicadores automáticos se calculan solo sobre la
            imagen — sector, competencia y atributos todavía no alimentan el puntaje.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <div className="bx-form-group">
              <label>Nombre de la marca *</label>
              <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Ej. Acme Corp" className="bx-form-input" />
            </div>
            <div className="bx-form-group">
              <label>Rubro o sector</label>
              <select value={sector} onChange={(e) => setSector(e.target.value)} className="bx-form-input">
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 bx-form-group">
              <label>Competencia directa</label>
              <input value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder="Nombres de competidores principales" className="bx-form-input" />
            </div>
            <div className="sm:col-span-2 bx-form-group">
              <label>Atributos de identidad</label>
              <textarea rows={3} value={brandAttributes} onChange={(e) => setBrandAttributes(e.target.value)} placeholder="Qué expresa la marca" className="bx-form-input" />
            </div>
          </div>
        </div>
        </Reveal>

        <Reveal delay={200}>
        <div className="bx-card">
          <div className="bx-card-title">Tipología marcaria</div>
          <p className="text-xs text-on-surface-variant mb-4">
            El diagnóstico se construye sobre la tipología que elijas. Si no estás seguro, dejá "Detectar automáticamente".
          </p>
          <TypologyGrid value={manualTypologyKey} onChange={setManualTypologyKey} />
        </div>
        </Reveal>

        <Reveal delay={260}>
        <div className="bx-card">
          <div className="bx-card-title">
            Plan de análisis
            {!isGuest && <span className="bx-eyebrow">Saldo: {user?.credits?.toLocaleString() ?? 0} créditos</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLANS.map((p) => {
              const disabled = isGuest && p.id !== 'libre';
              const selected = plan === p.id;
              return (
                <button
                  key={p.id} type="button" disabled={disabled}
                  onClick={() => setPlan(p.id)}
                  className="bx-plan-card text-left disabled:opacity-40 disabled:cursor-not-allowed"
                  style={selected ? { borderColor: 'var(--color-process-cyan)', borderWidth: 2 } : undefined}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="bx-plan-name">{p.name}</span>
                    <span className="bx-plan-price">{p.cost}</span>
                  </div>
                  <p className="bx-plan-desc text-left">{p.desc}</p>
                </button>
              );
            })}
          </div>
          {isGuest && (
            <p className="mt-3 text-xs text-on-surface-variant">
              Como invitado solo tienes el plan Libre — crea una cuenta gratis para acceder a Estándar y Pro.
            </p>
          )}
        </div>
        </Reveal>

        <Reveal delay={320}>
        <button type="submit" className="bx-btn bx-btn-primary w-full py-4 flex items-center justify-center gap-2 text-base">
          <span>Analizar marca</span>
          <ArrowRight className="w-5 h-5" />
        </button>
        </Reveal>
      </form>

      <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={(url) => { pipeline.setFromCamera(url); setIsCameraOpen(false); }} />
      <CropModal isOpen={isCropOpen} imageSrc={pipeline.selectedImage} onCancel={() => setIsCropOpen(false)} onConfirm={handleCropConfirm} />
    </div>
  );
}
