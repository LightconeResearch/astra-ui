/// <reference types="vite/client" />
import type { GlobalProvider } from '@ladle/react';
import { useEffect, useState } from 'react';
import '@lightcone-research/astra-ui/styles.css';
import './playground.css';

// The Lightcone brand is applied over the package defaults unless the
// playground runs with VITE_ASTRA_THEME=none, which shows the unthemed
// rendering. theme.css only sets tokens and @font-face rules, so loading it
// after styles.css is equivalent to the static import it replaces.
const brand = import.meta.env.VITE_ASTRA_THEME !== 'none';
const brandLoaded: Promise<unknown> = brand
  ? import('@lightcone-research/lightcone-brand/theme.css')
  : Promise.resolve();

export const Provider: GlobalProvider = ({ children, globalState }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void brandLoaded.then(() => { setReady(true); });
  }, []);
  if (!ready) return null;
  // Both attributes: data-astra-color-scheme is the package contract (it
  // selects tokens.css's dark palette); data-astra-theme is the brand's.
  const scheme = globalState.theme === 'dark' ? 'dark' : 'light';
  return (
    <div
      className="astra-ui playground-root"
      data-astra-color-scheme={scheme}
      {...(brand ? { 'data-astra-theme': `brand-${scheme}` } : {})}
    >
      {children}
    </div>
  );
};
