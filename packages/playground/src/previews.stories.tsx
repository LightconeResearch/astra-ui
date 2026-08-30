import type { Story } from '@ladle/react';
import {
  indexAnalysis,
  type ResolvedDecision,
  type ResolvedOutput,
} from '@astra-spec/sdk';
import {
  RecordPreview,
  type RecordPreviewReferenceRenderer,
} from '@astra-spec/ui/components';
import { Button, PreviewPopover } from '@astra-spec/ui/primitives';
import { useEffect, useState } from 'react';
import { byPath } from './derive';
import { analysisDocument, renderArtifact } from './host';

export default { title: 'Previews' };

const index = indexAnalysis(analysisDocument);

function ownerAnalysis(canonicalPath: string) {
  const analysis = index.analysisByRecordPath.get(canonicalPath);
  if (!analysis) throw new Error(`No owning analysis for ${canonicalPath}`);
  return analysis;
}

function usePortalScope() {
  const [scope, setScope] = useState({ brand: false, scheme: 'light' as 'light' | 'dark' });
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.playground-root');
    if (!root) return undefined;
    const update = () => {
      setScope({
        brand: root.classList.contains('lightcone-brand'),
        scheme: root.dataset.astraColorScheme === 'dark' ? 'dark' : 'light',
      });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'data-astra-color-scheme'] });
    return () => { observer.disconnect(); };
  }, []);
  return {
    className: scope.brand ? 'lightcone-brand' : undefined,
    'data-astra-color-scheme': scope.scheme,
    'data-lightcone-color-scheme': scope.brand ? scope.scheme : undefined,
  };
}

export const RichRecordPopover: Story = () => {
  const portalProps = usePortalScope();
  const decision = byPath<ResolvedDecision>(analysisDocument, 'decisions.smoothing_radius');
  const analysis = ownerAnalysis(decision.canonicalPath);

  const nestedReference: RecordPreviewReferenceRenderer = ({ target, trigger }) => (
    <PreviewPopover
      label={`${target.record.kind.replace(/_/g, ' ')} preview: ${target.record.label ?? target.record.id}`}
      kind={target.record.kind}
      trigger={trigger}
      portalProps={portalProps}
    >
      <RecordPreview
        entry={{ kind: 'record', ...target }}
        document={analysisDocument}
        index={index}
        renderArtifact={renderArtifact}
        renderCitation={(doi) => <span>{doi}</span>}
        renderRecordReference={nestedReference}
      />
    </PreviewPopover>
  );

  return (
    <div className="playground-stack playground-frame">
      <p>Hover the reference, focus it with Tab, or inspect its nested insight links.</p>
      <PreviewPopover
        label={`Decision preview: ${decision.label}`}
        kind="decision"
        defaultOpen
        trigger={<Button variant="quiet">◇ {decision.label}</Button>}
        portalProps={portalProps}
      >
        <RecordPreview
          entry={{ kind: 'record', record: decision, analysis }}
          document={analysisDocument}
          index={index}
          renderArtifact={renderArtifact}
          renderCitation={(doi) => <span>{doi}</span>}
          renderRecordReference={nestedReference}
        />
      </PreviewPopover>
    </div>
  );
};

export const InlineValuePopover: Story = () => {
  const portalProps = usePortalScope();
  const output = byPath<ResolvedOutput>(analysisDocument, 'outputs.bao_fit_plot');
  const analysis = ownerAnalysis(output.canonicalPath);
  return (
    <p>
      The fitted scale is{' '}
      <PreviewPopover
        label="Value preview: fitted scale"
        kind="output"
        trigger={<button type="button">1.0021 ± 0.012</button>}
        portalProps={portalProps}
      >
        <RecordPreview
          entry={{
            kind: 'value',
            record: output,
            analysis,
            value: '1.0021 ± 0.012',
            unit: 'αiso',
            column: 'alpha_iso',
            filter: 'tracer=lrg',
            product: output.label ?? output.id,
          }}
          document={analysisDocument}
          index={index}
        />
      </PreviewPopover>
      .
    </p>
  );
};
