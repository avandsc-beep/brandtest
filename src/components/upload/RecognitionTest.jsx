import { useState } from 'react';
import { supabaseClient } from '../../lib/supabaseClient.js';
import { typologies } from '../../lib/typology.js';
import { TypologyGrid } from './TypologyGrid.jsx';

// Mini-juego "adivina la tipología" contra el banco de calibración — no
// tiene nada que ver con el checkbox "+1 crédito" inventado en el
// maquetado de Stitch (eso implicaba algo distinto: un extra sobre el
// análisis actual). Este es el juego real: +1 crédito por respuesta,
// contra una muestra al azar del banco de calibración.
export function RecognitionTest({ patchUser }) {
  const [state, setState] = useState('idle'); // idle | loading | guessing | result | done | error
  const [sample, setSample] = useState(null);
  const [guessType, setGuessType] = useState(null);
  const [brandGuess, setBrandGuess] = useState('');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const start = async () => {
    setState('loading');
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { setErrorMsg('Tu sesión expiró — vuelve a entrar'); setState('error'); return; }
    try {
      const res = await fetch('/api/get-recognition-sample', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token } });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || 'No se pudo cargar una muestra.'); setState('error'); return; }
      if (data.done) { setErrorMsg(data.message); setState('done'); return; }
      setSample(data);
      setGuessType(null);
      setBrandGuess('');
      setState('guessing');
    } catch (e) {
      setErrorMsg('Error de conexión: ' + e.message);
      setState('error');
    }
  };

  const submit = async () => {
    if (!guessType) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { setErrorMsg('Tu sesión expiró — vuelve a entrar'); setState('error'); return; }
    try {
      const res = await fetch('/api/submit-recognition', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ sampleId: sample.sampleId, answeredType: guessType, answeredBrandName: brandGuess.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || 'No se pudo enviar la respuesta'); setState('error'); return; }
      patchUser({ credits: data.remainingCredits });
      setResult(data);
      setState('result');
    } catch (e) {
      setErrorMsg('Error de conexión: ' + e.message);
      setState('error');
    }
  };

  return (
    <div className="bx-card">
      <div className="bx-card-title">
        Test de reconocimiento
        <span className="bx-eyebrow">+1 crédito</span>
      </div>
      <p className="text-sm text-on-surface-variant mb-4">Adivina la tipología de una marca real del banco de calibración. Cada muestra solo se puede responder una vez.</p>

      {state === 'idle' && <button onClick={start} className="bx-btn bx-btn-accent">Comenzar</button>}
      {state === 'loading' && <p className="text-sm text-on-surface-variant">Cargando…</p>}
      {(state === 'error' || state === 'done') && <p className="text-sm text-on-surface-variant">{errorMsg}</p>}

      {state === 'guessing' && sample && (
        <div className="space-y-3">
          <img src={sample.imageUrl} alt="Marca a identificar" className="max-w-[220px] max-h-[220px] rounded-lg border border-outline-variant" />
          <input
            value={brandGuess} onChange={(e) => setBrandGuess(e.target.value)} placeholder="¿Reconoces la marca? (opcional)"
            className="bx-form-input"
          />
          <p className="text-sm text-on-surface-variant">¿Qué tipología es esta marca?</p>
          <TypologyGrid value={guessType} onChange={setGuessType} showAutoOption={false} />
          <button onClick={submit} disabled={!guessType} className="bx-btn bx-btn-primary w-full disabled:opacity-40">
            Enviar respuesta
          </button>
        </div>
      )}

      {state === 'result' && result && (
        <div className="space-y-2 text-sm">
          <p className={result.correct ? 'text-process-cyan font-semibold' : 'text-process-magenta font-semibold'}>{result.correct ? '¡Correcto!' : 'No exactamente'}</p>
          <div className="bx-indicator-item">
            <strong className="text-on-surface">{typologies[result.correctType]?.name}:</strong> {typologies[result.correctType]?.description}
          </div>
          {!result.correct && guessType && (
            <div className="bx-indicator-item">
              <strong className="text-on-surface">Tu respuesta ({typologies[guessType]?.name}):</strong> {typologies[guessType]?.description}
            </div>
          )}
          {result.notes && <div className="bx-indicator-item"><strong className="text-on-surface">Nota del evaluador:</strong> {result.notes}</div>}
          {result.correctBrandName && (
            <p className="text-on-surface-variant">Marca real: <strong className="text-on-surface">{result.correctBrandName}</strong></p>
          )}
          <p className="text-on-surface-variant">+1 crédito — saldo: {result.remainingCredits}</p>
          <button onClick={start} className="bx-btn bx-btn-accent">Otra marca</button>
        </div>
      )}
    </div>
  );
}
