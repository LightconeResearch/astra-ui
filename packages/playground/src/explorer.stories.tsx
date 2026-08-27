import type { Story } from '@ladle/react';
import { AnalysisTree } from '@lightcone-research/astra-ui/blocks';
import { Inventory } from '@lightcone-research/astra-ui/views';
import { useState } from 'react';
import { analysisDocument, paperMetadata, renderArtifact, renderPaper } from './host';

export default { title: 'Explorer' };

const noop = () => undefined;

export const Root: Story = () => (
  <Inventory
    document={analysisDocument}
    renderArtifact={renderArtifact}
    renderPaper={renderPaper}
    paperMetadata={paperMetadata}
    onFetchPaper={noop}
  />
);

export const Clustering: Story = () => (
  <Inventory document={analysisDocument} analysisPath="clustering" renderArtifact={renderArtifact} />
);

export const Reconstruction: Story = () => (
  <Inventory document={analysisDocument} analysisPath="reconstruction" renderArtifact={renderArtifact} />
);

export const EmbeddedDetail: Story = () => (
  <Inventory
    document={analysisDocument}
    detailMode="embedded"
    renderArtifact={renderArtifact}
    paperMetadata={paperMetadata}
  />
);

export const Tree: Story = () => {
  const [path, setPath] = useState('clustering');
  return (
    <div className="playground-frame">
      <AnalysisTree document={analysisDocument} analysisPath={path} onSelectAnalysis={setPath} />
    </div>
  );
};
