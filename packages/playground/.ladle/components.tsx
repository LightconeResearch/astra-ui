/// <reference types="vite/client" />
import type { GlobalProvider } from '@ladle/react';
import { useEffect, useState } from 'react';
import '@astra-spec/ui/styles.css';
import './playground.css';

// The playground explicitly opts into the external Lightcone theme unless it
// runs with VITE_ASTRA_THEME=none, which shows the package's neutral defaults.
// Loading the unlayered adapter after styles.css is equivalent to importing it
// before the UI's layered styles.
const brand = import.meta.env.VITE_ASTRA_THEME !== 'none';
const brandLoaded: Promise<unknown> = brand
  ? import('@lightcone-research/brand/adapters/astra.css')
  : Promise.resolve();

export const Provider: GlobalProvider = ({ children, globalState }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void brandLoaded.then(() => { setReady(true); });
  }, []);
  if (!ready) return null;
  const scheme = globalState.theme === 'dark' ? 'dark' : 'light';
  return (
    <div
      className={brand
        ? 'astra-ui lightcone-brand playground-root'
        : 'astra-ui playground-root'}
      data-astra-color-scheme={scheme}
      data-lightcone-color-scheme={brand ? scheme : undefined}
    >
      {children}
    </div>
  );
};
