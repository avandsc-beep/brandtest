import { useEffect, useRef, useState } from 'react';

// Envoltorio genérico para "aparecer" un bloque cuando entra en pantalla,
// con stagger opcional — reemplaza el IntersectionObserver que legacy
// aplicaba a mano sobre .pricing-card.
export function Reveal({ delay = 0, className = '', children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${visible ? 'reveal-up' : 'opacity-0'} ${className}`} style={visible ? { animationDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
