import type { Story } from '@ladle/react';
import { InventoryExplorer, OverviewInventory } from '@lightcone-research/astra-ui/views';
import { useState } from 'react';
import { analysisDocument, paperMetadata, renderArtifact, renderPaper } from './host';

export default { title: 'Explorer' };

const noop = () => undefined;

export const Root: Story = () => (
  <InventoryExplorer
    document={analysisDocument}
    renderArtifact={renderArtifact}
    renderPaper={renderPaper}
    paperMetadata={paperMetadata}
    onFetchPaper={noop}
  />
);

export const Clustering: Story = () => (
  <InventoryExplorer document={analysisDocument} analysisPath="clustering" renderArtifact={renderArtifact} />
);

export const Reconstruction: Story = () => (
  <InventoryExplorer document={analysisDocument} analysisPath="reconstruction" renderArtifact={renderArtifact} />
);

export const EmbeddedDetail: Story = () => (
  <InventoryExplorer
    document={analysisDocument}
    detailMode="embedded"
    renderArtifact={renderArtifact}
    paperMetadata={paperMetadata}
  />
);

export const AnalysisTree: Story = () => {
  const [path, setPath] = useState('clustering');
  return (
    <div className="playground-frame">
      <OverviewInventory document={analysisDocument} analysisPath={path} onSelectAnalysis={setPath} />
    </div>
  );
};
