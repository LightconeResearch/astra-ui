import type { Story } from '@ladle/react';
import { dialogStories } from './dialogs';

export default { title: 'Dialogs / Modal' };

export const OutputFigure: Story = () => <>{dialogStories.OutputFigure()}</>;
export const OutputTable: Story = () => <>{dialogStories.OutputTable()}</>;
export const OutputData: Story = () => <>{dialogStories.OutputData()}</>;
export const Decision: Story = () => <>{dialogStories.Decision()}</>;
export const Finding: Story = () => <>{dialogStories.Finding()}</>;
export const Input: Story = () => <>{dialogStories.Input()}</>;
export const Insight: Story = () => <>{dialogStories.Insight()}</>;
export const Paper: Story = () => <>{dialogStories.Paper()}</>;
export const PaperWithoutContent: Story = () => <>{dialogStories.PaperWithoutContent()}</>;
export const WithBackTrail: Story = () => <>{dialogStories.WithBackTrail()}</>;
