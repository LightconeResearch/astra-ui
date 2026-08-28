import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/dom/**/*.test.tsx'],
    setupFiles: ['tests/dom/setup.ts'],
  },
  esbuild: { jsx: 'automatic' },
});
