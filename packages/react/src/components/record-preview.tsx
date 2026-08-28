import type {
  AnalysisIndex,
  ResolvedAnalysisDocument,
  ResolvedAnalysisNode,
  ResolvedDecision,
  ResolvedEvidence,
  ResolvedInput,
  ResolvedInsight,
  ResolvedOutput,
  ResolvedRecord,
} from '@astra-spec/sdk';
import {
  forwardRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { doiHref } from '../model/doi.js';
import { analysisTitle, recordTitle } from '../model/records.js';
import { decisionInsights } from '../model/relations.js';
import { Prose, type TextRenderer } from '../primitives/prose.js';
import { surfaceGlyph, type SurfaceKind } from '../primitives/kind.js';
import { SurfaceHeader } from '../primitives/surface-header.js';
import { OutputPreview } from './output-detail.js';
import type { ArtifactRenderer } from './artifact-preview.js';
import { primaryLiteratureEvidence } from './insight-detail.js';
import type { OpenRecordHandler } from './relation-items.js';

export interface RecordPreviewTarget {
  record: ResolvedRecord;
  analysis: ResolvedAnalysisNode;
}

export interface RecordPreviewReference {
  target: RecordPreviewTarget;
  /** Default record trigger. A host may wrap it in another PreviewPopover. */
  trigger: ReactElement;
}

export type RecordPreviewReferenceRenderer = (
  reference: RecordPreviewReference,
) => ReactNode;

export interface RecordPreviewCitationContext {
  evidence: ResolvedEvidence;
  record: ResolvedInsight;
}

export type RecordPreviewCitationRenderer = (
  doi: string,
  context: RecordPreviewCitationContext,
) => ReactNode;

export type RecordPreviewEntry =
  | {
      kind: 'record';
      record: ResolvedRecord;
      analysis: ResolvedAnalysisNode;
    }
  | {
      kind: 'analysis';
      analysis: ResolvedAnalysisNode;
      href?: string | undefined;
    }
  | {
      kind: 'value';
      record: ResolvedOutput | ResolvedDecision;
      analysis: ResolvedAnalysisNode;
      value: ReactNode;
      unit?: string | undefined;
      column?: string | undefined;
      filter?: string | undefined;
      product?: string | undefined;
      selection?: string | undefined;
    };

export interface RecordPreviewProps
  extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  entry: RecordPreviewEntry;
  document: ResolvedAnalysisDocument;
  index: AnalysisIndex;
  renderArtifact?: ArtifactRenderer | undefined;
  renderText?: TextRenderer | undefined;
  renderCitation?: RecordPreviewCitationRenderer | undefined;
  /** Opens the full record surface when a related-record trigger is activated. */
  onOpenRecord?: OpenRecordHandler | undefined;
  /** Optional navigation for an analysis preview. The callback receives only a safe HTTP(S) or relative href. */
  onOpenAnalysis?: ((analysis: ResolvedAnalysisNode, href?: string) => void) | undefined;
  /** Wraps related-record triggers, for example in a nested PreviewPopover. */
  renderRecordReference?: RecordPreviewReferenceRenderer | undefined;
  /** Compact decision previews show this many supporting insights before a remaining count. */
  maxSupportingInsights?: number | undefined;
}

function claimExcerpt(claim: string): string {
  const text = claim.trim().replace(/\s+/g, ' ');
  const sentence = /^.{10,90}?[.!?](?=\s|$)/.exec(text)?.[0];
  if (sentence) return sentence;
  if (text.length <= 90) return text;
  return `${text.slice(0, 80).replace(/\s+\S*$/, '')}…`;
}

function relationTitle(record: ResolvedRecord): string {
  if (
    (record.kind === 'finding' || record.kind === 'prior_insight') &&
    !record.label
  ) {
    return claimExcerpt(record.claim) || record.id;
  }
  return recordTitle(record);
}

function KindEyebrow({ kind, label }: { kind: SurfaceKind; label: ReactNode }) {
  return (
    <span className="astra-record-preview__kind">
      <span aria-hidden="true">{surfaceGlyph(kind)}</span>
      {label}
    </span>
  );
}

function PreviewHeader({
  kind,
  kindLabel,
  title,
}: {
  kind: SurfaceKind;
  kindLabel: ReactNode;
  title?: ReactNode | undefined;
}) {
  return (
    <SurfaceHeader
      density="compact"
      kind={kind}
      titleAs="h3"
      eyebrow={<KindEyebrow kind={kind} label={kindLabel} />}
      title={title}
      className="astra-record-preview__header"
    />
  );
}

function Citation({
  evidence,
  record,
  renderCitation,
}: {
  evidence: ResolvedEvidence;
  record: ResolvedInsight;
  renderCitation?: RecordPreviewCitationRenderer | undefined;
}) {
  const doi = evidence.doi;
  if (!doi) return null;
  return (
    <div className="astra-record-preview__citation">
      {renderCitation ? (
        renderCitation(doi, { evidence, record })
      ) : (
        <a href={doiHref(doi)} target="_blank" rel="noreferrer">
          {doi} <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  );
}

function RelatedRecord({
  record,
  index,
  onOpenRecord,
  renderRecordReference,
  detail,
}: {
  record: ResolvedRecord;
  index: AnalysisIndex;
  onOpenRecord?: OpenRecordHandler | undefined;
  renderRecordReference?: RecordPreviewReferenceRenderer | undefined;
  detail?: ReactNode | undefined;
}) {
  const analysis = index.analysisByRecordPath.get(record.canonicalPath);
  const label = relationTitle(record);
  const copy = (
    <>
      <span className="astra-record-preview__relation-glyph" aria-hidden="true">
        {surfaceGlyph(record.kind)}
      </span>
      <span className="astra-record-preview__relation-label">{label}</span>
      {detail != null ? (
        <small className="astra-record-preview__relation-detail">{detail}</small>
      ) : null}
    </>
  );
  const trigger = analysis && onOpenRecord ? (
    <button
      type="button"
      className="astra-record-preview__relation-trigger"
      data-kind={record.kind}
      aria-label={`Open ${record.kind.replace(/_/g, ' ')} details: ${label}`}
      onClick={() => {
        onOpenRecord(record, analysis);
      }}
    >
      {copy}
    </button>
  ) : (
    <span className="astra-record-preview__relation-trigger" data-kind={record.kind}>
      {copy}
    </span>
  );
  if (!analysis || !renderRecordReference) return trigger;
  return renderRecordReference({ target: { record, analysis }, trigger });
}

interface SharedPreviewProps {
  document: ResolvedAnalysisDocument;
  index: AnalysisIndex;
  renderArtifact?: ArtifactRenderer | undefined;
  renderText?: TextRenderer | undefined;
  renderCitation?: RecordPreviewCitationRenderer | undefined;
  onOpenRecord?: OpenRecordHandler | undefined;
  renderRecordReference?: RecordPreviewReferenceRenderer | undefined;
}

function DecisionPreview({
  record,
  index,
  renderText,
  onOpenRecord,
  renderRecordReference,
  maxSupportingInsights,
}: SharedPreviewProps & {
  record: ResolvedDecision;
  maxSupportingInsights: number;
}) {
  const labels = useLabels();
  const supporting = decisionInsights(index, record);
  const shown = supporting.slice(0, maxSupportingInsights);
  const remaining = supporting.length - shown.length;
  return (
    <>
      <PreviewHeader
        kind="decision"
        kindLabel={labels.kinds.decision}
        title={recordTitle(record)}
      />
      <div className="astra-record-preview__body">
        {record.rationale ? (
          <div className="astra-record-preview__description">
            <Prose
              text={record.rationale}
              field="rationale"
              renderText={renderText}
            />
          </div>
        ) : null}
        {record.options.length ? (
          <section className="astra-record-preview__section">
            <h4>Option detail</h4>
            <ul className="astra-record-preview__options">
              {record.options.map((option) => {
                const selected = option.id === record.selectedOptionId;
                return (
                  <li
                    key={option.id}
                    data-selected={selected ? '' : undefined}
                    data-unselected={selected ? undefined : ''}
                    data-excluded={option.excluded ? '' : undefined}
                  >
                    <span aria-hidden="true">{selected ? '●' : '○'}</span>
                    <span className="astra-record-preview__option-status">
                      {selected ? 'Selected. ' : 'Not selected. '}
                      {option.excluded ? 'Excluded. ' : ''}
                    </span>
                    <strong>{option.label}</strong>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
        {supporting.length ? (
          <section className="astra-record-preview__section">
            <h4>Supported by</h4>
            <ul className="astra-record-preview__relations">
              {shown.map((insight) => (
                <li key={insight.canonicalPath} data-kind={insight.kind}>
                  <RelatedRecord
                    record={insight}
                    index={index}
                    onOpenRecord={onOpenRecord}
                    renderRecordReference={renderRecordReference}
                  />
                </li>
              ))}
              {remaining > 0 ? (
                <li className="astra-record-preview__remaining">
                  + {remaining} more in the decision details
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

function FindingPreview({
  record,
  index,
  renderArtifact,
  renderText,
  renderCitation,
  onOpenRecord,
  renderRecordReference,
}: SharedPreviewProps & { record: ResolvedInsight }) {
  const labels = useLabels();
  return (
    <>
      <PreviewHeader
        kind="finding"
        kindLabel={labels.kinds.finding}
        title={recordTitle(record)}
      />
      <div className="astra-record-preview__body">
        <div className="astra-record-preview__claim">
          <Prose text={record.claim} field="claim" renderText={renderText} />
        </div>
        {record.scope ? (
          <span className="astra-record-preview__scope">
            <Prose text={record.scope} renderText={renderText} />
          </span>
        ) : null}
        {record.notes ? (
          <div className="astra-record-preview__description">
            <Prose text={record.notes} field="notes" renderText={renderText} />
          </div>
        ) : null}
        {record.evidence.length ? (
          <section className="astra-record-preview__section">
            <h4>Evidence</h4>
            <ul className="astra-record-preview__evidence">
              {record.evidence.map((evidence, indexInRecord) => {
                const candidate = evidence.resolvedOutputPath
                  ? index.recordByPath.get(evidence.resolvedOutputPath)
                  : undefined;
                const output = candidate?.kind === 'output' ? candidate : undefined;
                return (
                  <li key={`${evidence.id}-${indexInRecord}`}>
                    {output && renderArtifact ? (
                      <div className="astra-record-preview__artifact">
                        <OutputPreview
                          output={output}
                          compact
                          renderArtifact={renderArtifact}
                        />
                      </div>
                    ) : null}
                    {output ? (
                      <RelatedRecord
                        record={output}
                        index={index}
                        detail={output.type}
                        onOpenRecord={onOpenRecord}
                        renderRecordReference={renderRecordReference}
                      />
                    ) : evidence.artifact ? (
                      <span
                        className="astra-record-preview__relation-trigger"
                        data-kind="output"
                      >
                        <span
                          className="astra-record-preview__relation-glyph"
                          aria-hidden="true"
                        >
                          {surfaceGlyph('output')}
                        </span>
                        <span className="astra-record-preview__relation-label">
                          {evidence.artifact}
                        </span>
                      </span>
                    ) : null}
                    {evidence.quote ? (
                      <blockquote className="astra-record-preview__quote">
                        <Prose
                          text={evidence.quote.exact}
                          field="quote"
                          renderText={renderText}
                        />
                      </blockquote>
                    ) : null}
                    <Citation
                      evidence={evidence}
                      record={record}
                      renderCitation={renderCitation}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

function InsightPreview({
  record,
  renderText,
  renderCitation,
}: SharedPreviewProps & { record: ResolvedInsight }) {
  const labels = useLabels();
  const source = primaryLiteratureEvidence(record);
  return (
    <>
      <PreviewHeader
        kind="prior_insight"
        kindLabel={labels.kinds.prior_insight}
      />
      <div className="astra-record-preview__body">
        <div className="astra-record-preview__description">
          <Prose text={record.claim} field="claim" renderText={renderText} />
        </div>
        {source?.quote ? (
          <blockquote className="astra-record-preview__quote">
            <Prose
              text={source.quote.exact}
              field="quote"
              renderText={renderText}
            />
          </blockquote>
        ) : null}
        {source ? (
          <Citation
            evidence={source}
            record={record}
            renderCitation={renderCitation}
          />
        ) : null}
      </div>
    </>
  );
}

function OutputRecordPreview({
  record,
  index,
  renderArtifact,
  renderText,
}: SharedPreviewProps & { record: ResolvedOutput }) {
  const labels = useLabels();
  const inputNames = record.provenance.inputPaths.map((path) => {
    const input = index.recordByPath.get(path);
    return input ? recordTitle(input) : path;
  });
  const recipe = record.recipe?.command ?? record.recipe?.container;
  const flow = [
    inputNames.length ? inputNames.join(', ') : undefined,
    recipe,
    record.canonicalPath,
  ].filter((value): value is string => Boolean(value));
  return (
    <>
      <PreviewHeader
        kind="output"
        kindLabel={labels.kinds.output}
        title={recordTitle(record)}
      />
      <div className="astra-record-preview__body">
        {record.description ? (
          <div className="astra-record-preview__description">
            <Prose
              text={record.description}
              field="description"
              renderText={renderText}
            />
          </div>
        ) : null}
        {renderArtifact ? (
          <div className="astra-record-preview__artifact">
            <OutputPreview
              output={record}
              compact
              renderArtifact={renderArtifact}
            />
          </div>
        ) : null}
        {flow.length > 1 ? (
          <section className="astra-record-preview__section">
            <h4>Provenance</h4>
            <ol className="astra-record-preview__flow">
              {flow.map((node, indexInFlow) => (
                <li key={`${node}-${indexInFlow}`}>
                  <code>{node}</code>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </>
  );
}

function InputPreview({
  record,
  renderText,
}: SharedPreviewProps & { record: ResolvedInput }) {
  const labels = useLabels();
  const source =
    record.source ?? record.ref ?? record.resolvedFrom ?? record.from;
  return (
    <>
      <PreviewHeader
        kind="input"
        kindLabel={labels.kinds.input}
        title={recordTitle(record)}
      />
      <div className="astra-record-preview__body">
        {record.description ? (
          <div className="astra-record-preview__description">
            <Prose
              text={record.description}
              field="description"
              renderText={renderText}
            />
          </div>
        ) : null}
        {source ? (
          <section className="astra-record-preview__section">
            <h4>Source</h4>
            <code className="astra-record-preview__source">{source}</code>
          </section>
        ) : null}
      </div>
    </>
  );
}

function RecordEntryPreview({
  record,
  maxSupportingInsights,
  ...shared
}: SharedPreviewProps & {
  record: ResolvedRecord;
  maxSupportingInsights: number;
}) {
  switch (record.kind) {
    case 'decision':
      return (
        <DecisionPreview
          {...shared}
          record={record}
          maxSupportingInsights={maxSupportingInsights}
        />
      );
    case 'finding':
      return <FindingPreview {...shared} record={record} />;
    case 'prior_insight':
      return <InsightPreview {...shared} record={record} />;
    case 'output':
      return <OutputRecordPreview {...shared} record={record} />;
    case 'input':
      return <InputPreview {...shared} record={record} />;
  }
}

function AnalysisPreview({
  analysis,
  href,
  renderText,
  onOpenAnalysis,
}: {
  analysis: ResolvedAnalysisNode;
  href?: string | undefined;
  renderText?: TextRenderer | undefined;
  onOpenAnalysis?: ((analysis: ResolvedAnalysisNode, href?: string) => void) | undefined;
}) {
  const labels = useLabels();
  const title = analysisTitle(analysis);
  const safeHref = (() => {
    if (!href) return undefined;
    try {
      const parsed = new URL(href, 'https://astra-ui.invalid/');
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        ? href
        : undefined;
    } catch {
      return undefined;
    }
  })();
  let titleNode: ReactNode = title;
  if (onOpenAnalysis) {
    titleNode = (
      <button
        type="button"
        className="astra-record-preview__analysis-link"
        onClick={() => {
          onOpenAnalysis(analysis, safeHref);
        }}
      >
        {title}
      </button>
    );
  } else if (safeHref) {
    titleNode = (
      <a className="astra-record-preview__analysis-link" href={safeHref}>
        {title}
      </a>
    );
  }
  return (
    <>
      <PreviewHeader
        kind="analysis"
        kindLabel={labels.kinds.analysis}
        title={titleNode}
      />
      <div className="astra-record-preview__body">
        {analysis.description ? (
          <div className="astra-record-preview__description">
            <Prose
              text={analysis.description}
              field="description"
              renderText={renderText}
            />
          </div>
        ) : null}
        <p className="astra-record-preview__counts">
          {analysis.decisions.length}{' '}
          {analysis.decisions.length === 1 ? 'decision' : 'decisions'}
          {' · '}
          {analysis.outputs.length}{' '}
          {analysis.outputs.length === 1 ? 'output' : 'outputs'}
        </p>
      </div>
    </>
  );
}

function ValuePreview({
  entry,
  renderText,
}: {
  entry: Extract<RecordPreviewEntry, { kind: 'value' }>;
  renderText?: TextRenderer | undefined;
}) {
  const labels = useLabels();
  const { record } = entry;
  const kindLabel =
    record.kind === 'output' ? labels.kinds.output : labels.kinds.decision;
  const description =
    record.kind === 'output' ? record.description : record.rationale;
  return (
    <>
      <PreviewHeader
        kind={record.kind}
        kindLabel={kindLabel}
        title={
          <span className="astra-record-preview__value">
            {entry.value}
            {entry.unit ? (
              <small className="astra-record-preview__unit"> {entry.unit}</small>
            ) : null}
          </span>
        }
      />
      <div className="astra-record-preview__body">
        {entry.column ||
        entry.filter ||
        entry.product ||
        entry.selection ? (
          <div className="astra-record-preview__selection">
            {entry.column ? <code>{entry.column}</code> : null}
            {entry.filter ? <span>{entry.filter}</span> : null}
            {entry.selection ? <code>{entry.selection}</code> : null}
            {entry.product ? <span>from {entry.product}</span> : null}
          </div>
        ) : null}
        {description ? (
          <div className="astra-record-preview__description">
            <Prose
              text={description}
              field={record.kind === 'output' ? 'description' : 'rationale'}
              renderText={renderText}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

function previewKind(entry: RecordPreviewEntry): SurfaceKind {
  if (entry.kind === 'analysis') return 'analysis';
  return entry.record.kind;
}

/**
 * Compact, positioning-agnostic preview content for resolved records,
 * analyses, and inline values. Pair it with PreviewPopover or render it inline.
 */
export const RecordPreview = forwardRef<HTMLElement, RecordPreviewProps>(
  function RecordPreview(
    {
      entry,
      document,
      index,
      renderArtifact,
      renderText,
      renderCitation,
      onOpenRecord,
      onOpenAnalysis,
      renderRecordReference,
      maxSupportingInsights = 3,
      className,
      ...props
    },
    ref,
  ) {
    const maximum = Number.isFinite(maxSupportingInsights)
      ? Math.max(0, Math.floor(maxSupportingInsights))
      : Number.MAX_SAFE_INTEGER;
    const shared: SharedPreviewProps = {
      document,
      index,
      renderArtifact,
      renderText,
      renderCitation,
      onOpenRecord,
      renderRecordReference,
    };
    return (
      <article
        data-slot="record-preview"
        data-entry-kind={entry.kind}
        data-kind={previewKind(entry)}
        {...props}
        ref={ref}
        className={cn('astra-record-preview', className)}
      >
        {entry.kind === 'record' ? (
          <RecordEntryPreview
            {...shared}
            record={entry.record}
            maxSupportingInsights={maximum}
          />
        ) : entry.kind === 'analysis' ? (
          <AnalysisPreview
            analysis={entry.analysis}
            href={entry.href}
            renderText={renderText}
            onOpenAnalysis={onOpenAnalysis}
          />
        ) : (
          <ValuePreview entry={entry} renderText={renderText} />
        )}
      </article>
    );
  },
);
