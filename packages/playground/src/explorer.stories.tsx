import type { Story } from '@ladle/react';
import { AnalysisTree } from '@astra-spec/ui/blocks';
import { Inventory } from '@astra-spec/ui/views';
import { useState } from 'react';
import { analysisDocument, paperMetadata, renderArtifact, renderProvenance, getOutputStatus, loadPdfJs } from './host';

export default { title: 'Explorer' };

const noop = () => undefined;

export const Root: Story = () => (
  <Inventory
    document={analysisDocument}
    renderArtifact={renderArtifact}
    renderProvenance={renderProvenance}
    getOutputStatus={getOutputStatus}
    loadPdfJs={loadPdfJs}
    paperMetadata={paperMetadata}
    onFetchPaper={noop}
  />
);

/** A host that owns the selected analysis, as the theme and the editors do. */
function ControlledInventory({ initialPath }: { initialPath: string }) {
  const [path, setPath] = useState(initialPath);
  return (
    <Inventory document={analysisDocument} analysisPath={path} onSelectAnalysis={setPath} renderArtifact={renderArtifact} />
  );
}

export const Clustering: Story = () => <ControlledInventory initialPath="clustering" />;

export const Reconstruction: Story = () => <ControlledInventory initialPath="reconstruction" />;

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
