import { useEffect, useRef, useState } from 'react';
import { supabaseClient } from '../../lib/supabaseClient.js';
import { typologies } from '../../lib/typology.js';
import { TypologyGrid } from '../upload/TypologyGrid.jsx';
import { CameraModal } from '../upload/CameraModal.jsx';

const SLIDER_FIELDS = [
  ['color_count_manual', 'Cantidad de colores percibidos', 1, 10],
  ['calidad_grafica_manual', 'Calidad gráfica', 1, 10],
  ['reproducibilidad_manual', 'Reproducibilidad', 1, 10],
  ['legibilidad_manual', 'Legibilidad', 1, 10],
  ['inteligibilidad_manual', 'Inteligibilidad', 1, 10],
  ['vocatividad_manual', 'Vocatividad', 1, 10],
  ['pregnancia_manual', 'Pregnancia', 1, 10],
  ['overall_manual', 'Puntaje general (holístico)', 1, 10],
];
const DEFAULTS = Object.fromEntries(SLIDER_FIELDS.map(([k]) => [k, 5]));

export function ValoracionTab({ user }) {
  const fileInputRef = useRef(null);
  const [imageData, setImageData] = useState(null);
  const [typologyKey, setTypologyKey] = useState(null);
  const [brandName, setBrandName] = useState('');
  const [notes, setNotes] = useState('');
  const [sliders, setSliders] = useState(DEFAULTS);
  const [confidence, setConfidence] = useState(3);
  const [message, setMessage] = useState(null);
  const [samples, setSamples] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const loadSamples = async () => {
    const { data } = await supabaseClient.from('calibration_samples').select('*').order('created_at', { ascending: false }).limit(50);
    setSamples(data || []);
  };
  const loadFeedback = async () => {
    const { data, error } = await supabaseClient.from('brand_feedback').select('*').order('created_at', { ascending: false }).limit(80);
    setFeedback(error ? [] : data || []);
  };

  useEffect(() => { loadSamples(); loadFeedback(); }, []);

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setImageData(e.target.result);
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setImageData(null); setTypologyKey(null); setBrandName(''); setNotes('');
    setSliders(DEFAULTS); setConfidence(3);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const save = async () => {
    if (!imageData) { setMessage('Sube o toma una foto primero'); return; }
    if (!typologyKey) { setMessage('Selecciona cuál es la tipología correcta'); return; }
    const match = imageData.match(/^data:([^;]+);base64,/);
    const mediaType = match ? match[1] : 'image/png';
    const ext = mediaType.split('/')[1] || 'png';
    const fileName = user.id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
    const blob = await (await fetch(imageData)).blob();

    const { error: uploadError } = await supabaseClient.storage.from('calibration-images').upload(fileName, blob, { contentType: mediaType });
    if (uploadError) { setMessage('No se pudo subir la imagen: ' + uploadError.message); return; }

    const { error: insertError } = await supabaseClient.from('calibration_samples').insert({
      admin_id: user.id, image_path: fileName, typology: typologyKey,
      brand_name: brandName.trim() || null, notes: notes.trim() || null,
      confidence_manual: confidence, ...sliders,
    });
    if (insertError) { setMessage('No se pudo guardar la muestra: ' + insertError.message); return; }

    setMessage('Muestra guardada en el banco de calibración');
    resetForm();
    loadSamples();
  };

  return (
    <div className="space-y-8 text-sm">
      <div>
        <h3 className="text-on-surface font-semibold mb-2">Correcciones de tipología</h3>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {feedback === null && <p className="text-on-surface-variant">Cargando…</p>}
          {feedback && feedback.filter((f) => f.kind === 'typology_correction').length === 0 && <p className="text-on-surface-variant">Sin correcciones registradas todavía.</p>}
          {feedback?.filter((f) => f.kind === 'typology_correction').map((f) => (
            <div key={f.id} className="text-on-surface-variant">
              {typologies[f.predicted_typology]?.name || f.predicted_typology} → <strong className="text-on-surface">{typologies[f.corrected_typology]?.name || f.corrected_typology}</strong> — {new Date(f.created_at).toLocaleDateString('es-BO')}
            </div>
          ))}
        </div>

        <h3 className="text-on-surface font-semibold mt-4 mb-2">Opinión sobre el diagnóstico</h3>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {feedback && feedback.filter((f) => f.kind === 'diagnostic_feedback').length === 0 && <p className="text-on-surface-variant">Sin feedback registrado todavía.</p>}
          {feedback?.filter((f) => f.kind === 'diagnostic_feedback').map((f) => (
            <div key={f.id} className={f.positive ? 'text-emerald-400' : 'text-process-magenta'}>
              {f.positive ? 'Acertado' : 'No acertado'} — {typologies[f.predicted_typology]?.name} — {f.overall_score}% ({f.plan})
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-on-surface font-semibold mb-1">Banco de calibración</h3>
        <p className="text-on-surface-variant mb-3">Sube o fotografía marcas reales y decide tú mismo la tipología correcta y los puntajes — esto es la verdad de referencia con la que se afina el motor.</p>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        <div className="flex gap-2 mb-3">
          <button onClick={() => setIsCameraOpen(true)} className="bx-btn bx-btn-primary">Usar cámara</button>
          <button onClick={() => fileInputRef.current?.click()} className="bx-btn">Subir archivo</button>
        </div>
        {imageData && <img src={imageData} alt="Vista previa" className="max-w-[150px] max-h-[150px] rounded-lg border border-outline-variant mb-3" />}
        <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={setImageData} />

        <div className="bx-form-group">
          <label>Nombre de marca (opcional)</label>
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className="bx-form-input" />
        </div>

        <label className="text-on-surface-variant block mb-1.5">Tipología correcta</label>
        <TypologyGrid value={typologyKey} onChange={setTypologyKey} showAutoOption={false} />

        <h4 className="text-on-surface font-semibold mt-4 mb-2">Tu evaluación experta (1–10)</h4>
        {SLIDER_FIELDS.map(([key, label, min, max]) => (
          <div key={key} className="bx-control-row">
            <label className="w-56">{label}</label>
            <input type="range" min={min} max={max} value={sliders[key]} onChange={(e) => setSliders((s) => ({ ...s, [key]: Number(e.target.value) }))} />
            <span>{sliders[key]}</span>
          </div>
        ))}
        <div className="bx-control-row mb-3">
          <label className="w-56">Tu confianza en este juicio</label>
          <input type="range" min={1} max={5} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
          <span>{confidence}</span>
        </div>

        <div className="bx-form-group">
          <label>Notas (opcional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bx-form-input" />
        </div>

        <button onClick={save} className="bx-btn bx-btn-primary w-full">Guardar muestra</button>
        {message && <p className="mt-2 text-on-surface-variant">{message}</p>}

        <div className="mt-4 space-y-1 max-h-56 overflow-y-auto">
          {samples === null && <p className="text-on-surface-variant">Cargando…</p>}
          {samples && <p className="text-on-surface">{samples.length} muestra(s) guardada(s)</p>}
          {samples?.map((s) => (
            <div key={s.id} className="text-on-surface-variant">{s.brand_name || 'Sin nombre'} — {typologies[s.typology]?.name || s.typology} — {new Date(s.created_at).toLocaleDateString('es-BO')}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
