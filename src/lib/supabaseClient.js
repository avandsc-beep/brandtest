import { createClient } from '@supabase/supabase-js';

// Instancia única y compartida — tanto los componentes/hooks nuevos como
// src/legacy/legacyApp.js importan este mismo cliente (en vez de cada uno
// crear el suyo) para que ambos vean la misma sesión real de Supabase y no
// se disparen dos listeners de auth por separado.
const SUPABASE_URL = 'https://pybgughzjqzgbbsfklwi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mpRmXAFo-DEIMSMloI_OOg_-RzelkR-';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
