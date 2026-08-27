import type { Story } from '@ladle/react';
import { DialogProvider } from '@lightcone-research/astra-ui/components';
import { dialogStories } from './dialogs';

export default { title: 'Dialogs / Embedded' };

export const OutputFigure: Story = () => (
  <DialogProvider mode="embedded">{dialogStories.OutputFigure()}</DialogProvider>
);
export const OutputTable: Story = () => (
  <DialogProvider mode="embedded">{dialogStories.OutputTable()}</DialogProvider>
);
export const OutputData: Story = () => (
  <DialogProvider mode="embedded">{dialogStories.OutputData()}</DialogProvider>
);
export const Decision: Story = () => (
  <DialogProvider mode="embedded">{dialogStories.Decision()}</DialogProvider>
);
export const Finding: Story = () => (
  <DialogProvider mode="embedded">{dialogStories.Finding()}</DialogProvider>
);
export const Input: Story = () => (
  <DialogProvider mode="embedded">{dialogStories.Input()}</DialogProvider>
);
export const Insight: Story = () => (
  <DialogProvider mode="embedded">{dialogStories.Insight()}</DialogProvider>
);
export const Paper: Story = () => (
  <DialogProvider mode="embedded">{dialogStories.Paper()}</DialogProvider>
);
export const PaperWithoutContent: Story = () => (
  <DialogProvider mode="embedded">{dialogStories.PaperWithoutContent()}</DialogProvider>
);
export const WithBackTrail: Story = () => (
  <DialogProvider mode="embedded">{dialogStories.WithBackTrail()}</DialogProvider>
);
