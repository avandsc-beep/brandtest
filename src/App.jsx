import { useEffect, useRef } from 'react';
import { legacyMarkup } from './legacy/legacyMarkup.js';
import { initLegacyApp } from './legacy/legacyApp.js';

export default function App() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initLegacyApp();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: legacyMarkup }} />;
}
