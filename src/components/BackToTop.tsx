import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';

// Botón fijo para volver arriba tras hacer scroll.
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollUp = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <button
      type="button"
      className={`back-to-top${visible ? ' visible' : ''}`}
      onClick={scrollUp}
      aria-label="Volver arriba"
      title="Volver arriba"
    >
      <ArrowUp size={20} />
    </button>
  );
}
