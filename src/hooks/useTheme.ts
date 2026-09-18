import { useEffect, useState } from 'react';

// Hook para alternar tema claro/oscuro y persistir la preferencia.
export function useTheme() {
  const [dark, setDarkState] = useState(
    () => (localStorage.getItem('petcare_theme') || 'light') === 'dark',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('petcare_theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = () => setDarkState((v) => !v);

  return { dark, toggle, setDark: setDarkState };
}
