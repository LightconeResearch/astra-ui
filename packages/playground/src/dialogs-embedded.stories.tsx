import type { Story } from '@ladle/react';
import { InventoryDetailPresentation } from '@lightcone-research/astra-ui/components';
import { dialogStories } from './dialogs';

export default { title: 'Dialogs / Embedded' };

export const OutputFigure: Story = () => (
  <InventoryDetailPresentation mode="embedded">{dialogStories.OutputFigure()}</InventoryDetailPresentation>
);
export const OutputTable: Story = () => (
  <InventoryDetailPresentation mode="embedded">{dialogStories.OutputTable()}</InventoryDetailPresentation>
);
export const OutputData: Story = () => (
  <InventoryDetailPresentation mode="embedded">{dialogStories.OutputData()}</InventoryDetailPresentation>
);
export const Decision: Story = () => (
  <InventoryDetailPresentation mode="embedded">{dialogStories.Decision()}</InventoryDetailPresentation>
);
export const Finding: Story = () => (
  <InventoryDetailPresentation mode="embedded">{dialogStories.Finding()}</InventoryDetailPresentation>
);
export const Input: Story = () => (
  <InventoryDetailPresentation mode="embedded">{dialogStories.Input()}</InventoryDetailPresentation>
);
export const Insight: Story = () => (
  <InventoryDetailPresentation mode="embedded">{dialogStories.Insight()}</InventoryDetailPresentation>
);
export const Paper: Story = () => (
  <InventoryDetailPresentation mode="embedded">{dialogStories.Paper()}</InventoryDetailPresentation>
);
export const PaperWithoutContent: Story = () => (
  <InventoryDetailPresentation mode="embedded">{dialogStories.PaperWithoutContent()}</InventoryDetailPresentation>
);
export const WithBackTrail: Story = () => (
  <InventoryDetailPresentation mode="embedded">{dialogStories.WithBackTrail()}</InventoryDetailPresentation>
);
