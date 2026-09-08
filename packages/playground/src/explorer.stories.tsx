import type { Story } from '@ladle/react';
import { AnalysisSelector, AnalysisTree } from '@astra-spec/ui/blocks';
import { Inventory } from '@astra-spec/ui/views';
import { useState } from 'react';
import { analysisDocument, paperMetadata, renderArtifact, loadPdfJs } from './host';

export default { title: 'Explorer' };

const noop = () => undefined;

export const Root: Story = () => (
  <Inventory
    document={analysisDocument}
    renderArtifact={renderArtifact}
    loadPdfJs={loadPdfJs}
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

export const Selector: Story = () => {
  const [path, setPath] = useState('$');
  return (
    <div className="playground-frame">
      <header style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <AnalysisSelector document={analysisDocument} analysisPath={path} onSelectAnalysis={setPath} />
      </header>
      <Inventory document={analysisDocument} analysisPath={path} renderArtifact={renderArtifact}
        loadPdfJs={loadPdfJs} paperMetadata={paperMetadata} />
    </div>
  );
};
