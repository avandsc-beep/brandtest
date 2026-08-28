import React from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import './legacy/legacy.css';
import App from './App.jsx';

window.supabase = { createClient };
window.Cropper = Cropper;

createRoot(document.getElementById('root')).render(<App />);
