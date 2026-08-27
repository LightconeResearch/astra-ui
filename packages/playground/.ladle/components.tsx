import type { GlobalProvider } from '@ladle/react';
import '@lightcone-research/lightcone-brand/theme.css';
import '@lightcone-research/astra-ui/styles.css';
import './playground.css';

export const Provider: GlobalProvider = ({ children, globalState }) => (
  <div
    className="astra-ui playground-root"
    data-astra-theme={globalState.theme === 'dark' ? 'brand-dark' : 'brand-light'}
  >
    {children}
  </div>
);
