import React from 'react';
import { createRoot } from 'react-dom/client';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import './styles/app-theme.css';
import App from './App.jsx';

// legacy.css YA NO SE IMPORTA ACÁ: nada del árbol legacy se monta en la
// app real (ver PostAuthApp.jsx), y su reset global `* { margin: 0;
// padding: 0; }` vive FUERA de cualquier @layer — en CSS moderno, un
// estilo sin capa siempre gana sobre un estilo en capa sin importar
// especificidad, así que anulaba silenciosamente mx-auto/px-*/py-* y
// prácticamente todo el espaciado de Tailwind (que sí vive en @layer
// utilities) en TODA la app. Esto es lo que causaba que las pantallas se
// vieran pegadas a la izquierda en vez de centradas. legacy.css se
// mantiene en el repo solo como referencia funcional del motor viejo.

// src/legacy/legacyApp.js sigue usando el Cropper global (se ordena a
// componentes reales en la Fase 2). El cliente de Supabase ya no pasa por
// window.supabase — ver src/lib/supabaseClient.js.
window.Cropper = Cropper;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(<App />);
