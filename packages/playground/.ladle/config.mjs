/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'src/**/*.stories.tsx',
  port: 61000,
  previewPort: 61001,
  addons: {
    theme: { enabled: true, defaultState: 'light' },
    width: { enabled: true, options: { wide: 1280, tablet: 768, phone: 414 }, defaultState: 0 },
  },
};
