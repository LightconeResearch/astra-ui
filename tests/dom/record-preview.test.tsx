import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  indexAnalysis,
  type ResolvedAnalysisDocument,
  type ResolvedDecision,
  type ResolvedInput,
  type ResolvedInsight,
  type ResolvedOutput,
} from '@astra-spec/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RecordPreview,
  type RecordPreviewReferenceRenderer,
} from '../../packages/react/src/components/index.js';
import {
  LabelsProvider,
  type AstraLabelOverrides,
} from '../../packages/react/src/primitives/index.js';
import { fixtureDocument as untypedFixture } from '../fixture.mjs';

const fixtureDocument = untypedFixture as unknown as ResolvedAnalysisDocument;
const index = indexAnalysis(fixtureDocument);
const record = <T,>(path: string) => index.recordByPath.get(path) as T;

afterEach(cleanup);

const shared = { document: fixtureDocument, index };

describe('RecordPreview', () => {
  it('renders a compact decision with options and bounded nested insight references', () => {
    const decision = record<ResolvedDecision>('decisions.method');
    const onOpenRecord = vi.fn();
    const renderRecordReference = vi.fn<RecordPreviewReferenceRenderer>(
      ({ target, trigger }) => (
        <span data-testid={`nested-${target.record.id}`}>{trigger}</span>
      ),
    );
    render(
      <RecordPreview
        {...shared}
        entry={{ kind: 'record', record: decision, analysis: fixtureDocument.analysis }}
        maxSupportingInsights={0}
        onOpenRecord={onOpenRecord}
        renderRecordReference={renderRecordReference}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Method choice' })).toBeTruthy();
    expect(screen.getByText('Use the established method.')).toBeTruthy();
    expect(screen.getByText('Fiducial').closest('li')?.hasAttribute('data-selected')).toBe(true);
    expect(screen.getByText('Alternate').closest('li')?.hasAttribute('data-unselected')).toBe(true);
    expect(screen.getByText('Fiducial').closest('li')?.textContent).toContain('Selected.');
    expect(screen.getByText('Alternate').closest('li')?.textContent).toContain('Not selected.');
    expect(screen.getByText('+ 1 more in the decision details')).toBeTruthy();
    expect(renderRecordReference).not.toHaveBeenCalled();
  });

  it('renders all finding evidence content through host artifact, citation, text, and nested-record slots', () => {
    const base = record<ResolvedInsight>('findings.headline_finding');
    const finding: ResolvedInsight = {
      ...base,
      scope: 'baseline universe',
      notes: 'A cautious interpretation.',
      evidence: [
        {
          id: 'combined',
          artifact: 'headline',
          resolvedOutputPath: 'outputs.headline',
          doi: '10.9999/finding',
          quote: { exact: 'The measured signal is significant.' },
        },
      ],
    };
    const renderArtifact = vi.fn(() => <img alt="Compact result" src="/safe.png" />);
    const renderCitation = vi.fn((doi: string) => <cite>Author 2026 · {doi}</cite>);
    const renderText = vi.fn((text: string) => <em>{text}</em>);
    const renderRecordReference: RecordPreviewReferenceRenderer = ({ trigger }) => (
      <span data-testid="nested-output">{trigger}</span>
    );
    render(
      <RecordPreview
        {...shared}
        entry={{ kind: 'record', record: finding, analysis: fixtureDocument.analysis }}
        renderArtifact={renderArtifact}
        renderCitation={renderCitation}
        renderText={renderText}
        renderRecordReference={renderRecordReference}
        onOpenRecord={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Headline finding' })).toBeTruthy();
    expect(screen.getByText('The headline result is significant.')).toBeTruthy();
    expect(screen.getByText('baseline universe')).toBeTruthy();
    expect(screen.getByText('A cautious interpretation.')).toBeTruthy();
    expect(screen.getByAltText('Compact result')).toBeTruthy();
    expect(screen.getByText('The measured signal is significant.')).toBeTruthy();
    expect(screen.getByText(/Author 2026/)).toBeTruthy();
    expect(screen.getByTestId('nested-output')).toBeTruthy();
    expect(renderArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalPath: 'outputs.headline' }),
      { compact: true },
    );
    expect(renderCitation).toHaveBeenCalledWith(
      '10.9999/finding',
      expect.objectContaining({ evidence: finding.evidence[0], record: finding }),
    );
    expect(renderText).toHaveBeenCalledWith(
      'The measured signal is significant.',
      { field: 'quote' },
    );
  });

  it('renders the full prior-insight claim, exact quote, and citation fallback or callback', () => {
    const base = record<ResolvedInsight>('prior_insights.published_method');
    const insight: ResolvedInsight = {
      ...base,
      evidence: [
        { id: 'orphan-quote', quote: { exact: 'This quote has no paper.' } },
        {
          id: 'primary-paper',
          doi: '10.9999/primary',
          quote: { exact: 'The fiducial method performs well.' },
        },
        {
          id: 'secondary-paper',
          doi: '10.9999/secondary',
          quote: { exact: 'A passage from a different paper.' },
        },
      ],
    };
    const renderCitation = vi.fn(() => <cite>Smith et al. (2026)</cite>);
    render(
      <RecordPreview
        {...shared}
        entry={{ kind: 'record', record: insight, analysis: fixtureDocument.analysis }}
        renderCitation={renderCitation}
      />,
    );
    expect(screen.getByText('The fiducial method is established.')).toBeTruthy();
    expect(screen.getByText('The fiducial method performs well.')).toBeTruthy();
    expect(screen.queryByText('This quote has no paper.')).toBeNull();
    expect(screen.queryByText('A passage from a different paper.')).toBeNull();
    expect(screen.getByText('Smith et al. (2026)')).toBeTruthy();
    expect(renderCitation).toHaveBeenCalledWith(
      '10.9999/primary',
      expect.objectContaining({ evidence: insight.evidence[1], record: insight }),
    );
  });

  it('renders output description, compact artifact, container-only recipe, inputs, and endpoint', () => {
    const base = record<ResolvedOutput>('outputs.headline');
    const output: ResolvedOutput = {
      ...base,
      recipe: { container: 'ghcr.io/example/research:1' },
    };
    const renderArtifact = vi.fn(() => <div>Figure thumbnail</div>);
    render(
      <RecordPreview
        {...shared}
        entry={{ kind: 'record', record: output, analysis: fixtureDocument.analysis }}
        renderArtifact={renderArtifact}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Headline result' })).toBeTruthy();
    expect(screen.getByText('The primary result.')).toBeTruthy();
    expect(screen.getByText('Figure thumbnail')).toBeTruthy();
    expect(screen.getByText('Input catalogue')).toBeTruthy();
    expect(screen.getByText('ghcr.io/example/research:1')).toBeTruthy();
    expect(screen.getByText('outputs.headline')).toBeTruthy();
  });

  it('omits artifact frames when the host renderer opts out', () => {
    const output = record<ResolvedOutput>('outputs.headline');
    const finding = record<ResolvedInsight>('findings.headline_finding');
    const renderArtifact = vi.fn(() => null);
    const { container, rerender } = render(
      <RecordPreview
        {...shared}
        entry={{ kind: 'record', record: output, analysis: fixtureDocument.analysis }}
        renderArtifact={renderArtifact}
      />,
    );

    expect(container.querySelector('.astra-record-preview__artifact')).toBeNull();
    expect(renderArtifact).toHaveBeenCalledWith(output, { compact: true });

    renderArtifact.mockClear();
    rerender(
      <RecordPreview
        {...shared}
        entry={{ kind: 'record', record: finding, analysis: fixtureDocument.analysis }}
        renderArtifact={renderArtifact}
      />,
    );

    expect(container.querySelector('.astra-record-preview__artifact')).toBeNull();
    expect(renderArtifact).toHaveBeenCalledTimes(1);
    expect(renderArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalPath: 'outputs.headline' }),
      { compact: true },
    );
  });

  it('renders input source and tolerates absent optional copy', () => {
    const input = record<ResolvedInput>('inputs.catalog');
    const bareInput: ResolvedInput = { ...input };
    delete bareInput.source;
    delete bareInput.label;
    const { rerender } = render(
      <RecordPreview
        {...shared}
        entry={{ kind: 'record', record: input, analysis: fixtureDocument.analysis }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Input catalogue' })).toBeTruthy();
    expect(screen.getByText('data/catalog.fits')).toBeTruthy();

    rerender(
      <RecordPreview
        {...shared}
        entry={{
          kind: 'record',
          record: bareInput,
          analysis: fixtureDocument.analysis,
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'catalog' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Source' })).toBeNull();
  });

  it('renders an analysis description, counts, and explicit navigation only', () => {
    const child = fixtureDocument.analysis.analyses[0];
    if (!child) throw new Error('fixture child analysis missing');
    const onOpenAnalysis = vi.fn();
    const { rerender } = render(
      <RecordPreview
        {...shared}
        entry={{ kind: 'analysis', analysis: child, href: '/publication/clustering' }}
        onOpenAnalysis={onOpenAnalysis}
      />,
    );
    expect(screen.getByText('Clustering')).toBeTruthy();
    expect(screen.getByText('0 decisions · 1 output')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clustering' }));
    expect(onOpenAnalysis).toHaveBeenCalledWith(child, '/publication/clustering');

    rerender(
      <RecordPreview
        {...shared}
        entry={{ kind: 'analysis', analysis: child, href: 'javascript:alert(1)' }}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Clustering' })).toBeNull();

    onOpenAnalysis.mockClear();
    rerender(
      <RecordPreview
        {...shared}
        entry={{ kind: 'analysis', analysis: child, href: 'javascript:alert(1)' }}
        onOpenAnalysis={onOpenAnalysis}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clustering' }));
    expect(onOpenAnalysis).toHaveBeenCalledWith(child, undefined);
  });

  it('renders value context, unit, and source-record description', () => {
    const output = record<ResolvedOutput>('outputs.headline');
    render(
      <RecordPreview
        {...shared}
        entry={{
          kind: 'value',
          record: output,
          analysis: fixtureDocument.analysis,
          value: '19.88 ± 0.17',
          unit: 'Mpc',
          column: 'alpha_iso',
          filter: 'tracer=lrg',
          product: 'Headline result',
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: /19.88 ± 0.17 Mpc/ })).toBeTruthy();
    expect(screen.getByText('alpha_iso')).toBeTruthy();
    expect(screen.getByText('tracer=lrg')).toBeTruthy();
    expect(screen.getByText('from Headline result')).toBeTruthy();
    expect(screen.getByText('The primary result.')).toBeTruthy();
  });

  it('forwards root attributes/ref and honors label overrides', () => {
    const insight = record<ResolvedInsight>('prior_insights.published_method');
    const ref = { current: null as HTMLElement | null };
    render(
      <LabelsProvider labels={{ kinds: { prior_insight: 'Literature insight' } }}>
        <RecordPreview
          {...shared}
          ref={ref}
          id="preview-id"
          className="host-preview"
          data-testid="preview"
          entry={{ kind: 'record', record: insight, analysis: fixtureDocument.analysis }}
        />
      </LabelsProvider>,
    );
    const preview = screen.getByTestId('preview');
    expect(ref.current).toBe(preview);
    expect(preview.id).toBe('preview-id');
    expect(preview.classList.contains('host-preview')).toBe(true);
    expect(preview.dataset.slot).toBe('record-preview');
    expect(preview.dataset.kind).toBe('prior_insight');
    expect(screen.getByText('Literature insight')).toBeTruthy();
  });

  it('routes all preview interface copy through label overrides', () => {
    const decision = record<ResolvedDecision>('decisions.method');
    const localizedDecision: ResolvedDecision = {
      ...decision,
      options: decision.options.map((option) =>
        option.id === 'alternate' ? { ...option, excluded: true } : option,
      ),
    };
    const finding = record<ResolvedInsight>('findings.headline_finding');
    const output = record<ResolvedOutput>('outputs.headline');
    const input = record<ResolvedInput>('inputs.catalog');
    const child = fixtureDocument.analysis.analyses[0];
    if (!child) throw new Error('fixture child analysis missing');
    const labels: AstraLabelOverrides = {
      kinds: { prior_insight: 'Référence' },
      sectionCount: (section, count) => `${section}:${count}`,
      preview: {
        optionDetail: 'Détail des options',
        supportedBy: 'Justifié par',
        evidence: 'Éléments probants',
        provenance: 'Traçabilité',
        source: 'Origine',
        openRecord: (kindLabel, recordLabel) =>
          `Ouvrir ${kindLabel} : ${recordLabel}`,
        optionStatus: (selected, excluded) =>
          `${selected ? 'Retenue.' : 'Non retenue.'}${excluded ? ' Exclue.' : ''}`,
        remainingDecisionDetails: (count) =>
          `+ ${count} dans les détails du choix`,
        valueSource: (product) => `issu de ${product}`,
      },
    };
    const { rerender } = render(
      <LabelsProvider labels={labels}>
        <RecordPreview
          {...shared}
          entry={{
            kind: 'record',
            record: localizedDecision,
            analysis: fixtureDocument.analysis,
          }}
          maxSupportingInsights={0}
        />
      </LabelsProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Détail des options' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Justifié par' })).toBeTruthy();
    expect(screen.getByText('Fiducial').closest('li')?.textContent).toContain('Retenue.');
    expect(screen.getByText('Alternate').closest('li')?.textContent).toContain(
      'Non retenue. Exclue.',
    );
    expect(screen.getByText('+ 1 dans les détails du choix')).toBeTruthy();

    rerender(
      <LabelsProvider labels={labels}>
        <RecordPreview
          {...shared}
          entry={{ kind: 'record', record: decision, analysis: fixtureDocument.analysis }}
          maxSupportingInsights={1}
          onOpenRecord={() => undefined}
        />
      </LabelsProvider>,
    );
    expect(screen.getByRole('button', {
      name: 'Ouvrir Référence : Published method',
    })).toBeTruthy();

    rerender(
      <LabelsProvider labels={labels}>
        <RecordPreview
          {...shared}
          entry={{ kind: 'record', record: finding, analysis: fixtureDocument.analysis }}
        />
      </LabelsProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Éléments probants' })).toBeTruthy();

    rerender(
      <LabelsProvider labels={labels}>
        <RecordPreview
          {...shared}
          entry={{ kind: 'record', record: output, analysis: fixtureDocument.analysis }}
        />
      </LabelsProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Traçabilité' })).toBeTruthy();

    rerender(
      <LabelsProvider labels={labels}>
        <RecordPreview
          {...shared}
          entry={{ kind: 'record', record: input, analysis: fixtureDocument.analysis }}
        />
      </LabelsProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Origine' })).toBeTruthy();

    rerender(
      <LabelsProvider labels={labels}>
        <RecordPreview
          {...shared}
          entry={{ kind: 'analysis', analysis: child }}
        />
      </LabelsProvider>,
    );
    expect(screen.getByText('decisions:0 · outputs:1')).toBeTruthy();

    rerender(
      <LabelsProvider labels={labels}>
        <RecordPreview
          {...shared}
          entry={{
            kind: 'value',
            record: output,
            analysis: fixtureDocument.analysis,
            value: '19.88',
            product: 'Résultat principal',
          }}
        />
      </LabelsProvider>,
    );
    expect(screen.getByText('issu de Résultat principal')).toBeTruthy();
  });
});
