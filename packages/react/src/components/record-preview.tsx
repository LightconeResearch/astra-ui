import { getSelectedOption } from '@astra-spec/sdk/reports';
import type { AstraRecord } from '../model/records.js';
import { KindGlyph } from '../primitives/kind-glyph.js';
import type {
  ResolvedAnalysisIndex,
  ResolvedAnalysis,
  Analysis,
  Decision,
  Evidence,
  Input,
  Insight,
  Output,
  StatusReport,
} from '@astra-spec/sdk/reports';
import { forwardRef, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { doiHref } from '../model/doi.js';
import { analysisTitle, recordTitle, recordKind, recordId, isInsight, isOutput } from '../model/records.js';
import { decisionInsights, outputResult, outputRelations, findingEvidence } from '../model/relations.js';
import { Prose } from '../primitives/prose.js';
import type { TextRenderer } from '../lib/prose.js';
import { type SurfaceKind } from '../model/kind.js';
import { SurfaceHeader } from '../primitives/surface-header.js';
import type { ArtifactRenderer } from './artifact-preview.js';
import { primaryLiteratureEvidence } from '../model/papers.js';
import type { OpenRecordHandler } from '../lib/detail-stack.js';

export interface RecordPreviewTarget {
  record: AstraRecord;
  analysis: Analysis;
  universeRef?: string | undefined;
}

export interface RecordPreviewReference {
  target: RecordPreviewTarget;
  /** Default record trigger. A host may wrap it in another PreviewPopover. */
  trigger: ReactElement;
}

export type RecordPreviewReferenceRenderer = (reference: RecordPreviewReference) => ReactNode;

export interface RecordPreviewCitationContext {
  evidence: Evidence;
  record: Insight;
}

export type RecordPreviewCitationRenderer = (doi: string, context: RecordPreviewCitationContext) => ReactNode;

export type RecordPreviewEntry =
  | {
      kind: 'record';
      record: AstraRecord;
      analysis: Analysis;
    }
  | {
      kind: 'analysis';
      analysis: Analysis;
      href?: string | undefined;
    }
  | {
      kind: 'value';
      record: Output | Decision;
      analysis: Analysis;
      value: ReactNode;
      unit?: string | undefined;
      column?: string | undefined;
      filter?: string | undefined;
      product?: string | undefined;
      selection?: string | undefined;
    };

export interface RecordPreviewProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  entry: RecordPreviewEntry;
  document: ResolvedAnalysis;
  index: ResolvedAnalysisIndex;
  universeRef?: string | undefined;
  statusReport?: StatusReport | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
  renderText?: TextRenderer | undefined;
  renderCitation?: RecordPreviewCitationRenderer | undefined;
  /** Opens the full record surface when a related-record trigger is activated. */
  onOpenRecord?: OpenRecordHandler | undefined;
  /** Optional navigation for an analysis preview. The callback receives only a safe HTTP(S) or relative href. */
  onOpenAnalysis?: ((analysis: Analysis, href?: string) => void) | undefined;
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

function relationTitle(record: AstraRecord): string {
  if (isInsight(record) && !record.label) {
    return claimExcerpt(record.claim) || recordId(record);
  }
  return recordTitle(record);
}

function KindEyebrow({ kind, label }: { kind: SurfaceKind; label: ReactNode }) {
  return (
    <span className="astra-record-preview__kind">
      <KindGlyph kind={kind} />
      {label}
    </span>
  );
}

function PreviewHeader({
  kind,
  kindLabel,
  title,
}: {
  kind?: SurfaceKind | undefined;
  kindLabel: ReactNode;
  title?: ReactNode | undefined;
}) {
  return (
    <SurfaceHeader
      density="compact"
      kind={kind}
      titleAs="h3"
      eyebrow={kind ? <KindEyebrow kind={kind} label={kindLabel} /> : kindLabel}
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
  evidence: Evidence;
  record: Insight;
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
  universeRef,
  detail,
}: {
  record: AstraRecord;
  index: ResolvedAnalysisIndex;
  universeRef?: string | undefined;
  statusReport?: StatusReport | undefined;
  onOpenRecord?: OpenRecordHandler | undefined;
  renderRecordReference?: RecordPreviewReferenceRenderer | undefined;
  detail?: ReactNode | undefined;
}) {
  const labels = useLabels();
  const analysis = index.elementByRef.get(record.ref)?.analysis;
  const label = relationTitle(record);
  const copy = (
    <>
      <KindGlyph className="astra-record-preview__relation-glyph" kind={recordKind(record)} />
      <span className="astra-record-preview__relation-label">{label}</span>
      {detail != null ? <small className="astra-record-preview__relation-detail">{detail}</small> : null}
    </>
  );
  const trigger =
    analysis && onOpenRecord ? (
      <button
        type="button"
        className="astra-record-preview__relation-trigger"
        data-kind={recordKind(record)}
        aria-label={labels.preview.openRecord(labels.kinds[recordKind(record)], label)}
        onClick={() => {
          onOpenRecord(record, analysis, universeRef);
        }}
      >
        {copy}
      </button>
    ) : (
      <span className="astra-record-preview__relation-trigger" data-kind={recordKind(record)}>
        {copy}
      </span>
    );
  if (!analysis || !renderRecordReference) return trigger;
  return renderRecordReference({ target: { record, analysis, universeRef }, trigger });
}

interface SharedPreviewProps {
  document: ResolvedAnalysis;
  index: ResolvedAnalysisIndex;
  universeRef?: string | undefined;
  statusReport?: StatusReport | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
  renderText?: TextRenderer | undefined;
  renderCitation?: RecordPreviewCitationRenderer | undefined;
  onOpenRecord?: OpenRecordHandler | undefined;
  renderRecordReference?: RecordPreviewReferenceRenderer | undefined;
}

function DecisionPreview({
  record,
  index,
  universeRef,
  renderText,
  onOpenRecord,
  renderRecordReference,
  maxSupportingInsights,
}: SharedPreviewProps & {
  record: Decision;
  maxSupportingInsights: number;
}) {
  const labels = useLabels();
  const supporting = decisionInsights(index, record, universeRef);
  const shown = supporting.slice(0, maxSupportingInsights);
  const remaining = supporting.length - shown.length;
  return (
    <>
      <PreviewHeader kind="decision" kindLabel={labels.kinds.decision} title={recordTitle(record)} />
      <div className="astra-record-preview__body">
        {record.rationale ? (
          <div className="astra-record-preview__description">
            <Prose text={record.rationale} field="rationale" renderText={renderText} />
          </div>
        ) : null}
        {record.options.length ? (
          <section className="astra-record-preview__section">
            <h4>{labels.preview.optionDetail}</h4>
            <ul className="astra-record-preview__options">
              {record.options.map((option) => {
                const selected =
                  option.id === (universeRef ? getSelectedOption(index, universeRef, record.ref)?.id : undefined);
                return (
                  <li
                    key={option.id}
                    data-selected={selected ? '' : undefined}
                    data-unselected={selected ? undefined : ''}
                    data-excluded={option.excluded ? '' : undefined}
                  >
                    <span aria-hidden="true">{selected ? '●' : '○'}</span>
                    <span className="astra-record-preview__option-status">
                      {labels.preview.optionStatus(selected, Boolean(option.excluded))}
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
            <h4>{labels.preview.supportedBy}</h4>
            <ul className="astra-record-preview__relations">
              {shown.map((insight) => (
                <li key={insight.ref} data-kind={insight.kind}>
                  <RelatedRecord
                    record={insight}
                    universeRef={universeRef}
                    index={index}
                    onOpenRecord={onOpenRecord}
                    renderRecordReference={renderRecordReference}
                  />
                </li>
              ))}
              {remaining > 0 ? (
                <li className="astra-record-preview__remaining">
                  {labels.preview.remainingDecisionDetails(remaining)}
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
  universeRef,
  statusReport,
  renderArtifact,
  renderText,
  renderCitation,
  onOpenRecord,
  renderRecordReference,
}: SharedPreviewProps & { record: Insight }) {
  const labels = useLabels();
  const links = findingEvidence(index, record, universeRef);
  return (
    <>
      <PreviewHeader kind="finding" kindLabel={labels.kinds.finding} title={recordTitle(record)} />
      <div className="astra-record-preview__body">
        <div className="astra-record-preview__claim">
          <Prose text={record.claim} field="claim" renderText={renderText} />
        </div>
        {record.scope ? (
          <span className="astra-record-preview__scope">
            <Prose text={record.scope} renderText={renderText} />
          </span>
        ) : null}
        {record.description ? (
          <div className="astra-record-preview__description">
            <Prose text={record.description} field="description" renderText={renderText} />
          </div>
        ) : null}
        {record.evidence.length ? (
          <section className="astra-record-preview__section">
            <h4>{labels.preview.evidence}</h4>
            <ul className="astra-record-preview__evidence">
              {record.evidence.flatMap((evidence, indexInRecord) => {
                const matched = links.filter((link) => link.evidence === evidence);
                if (!matched.length && evidence.bindings !== undefined && !evidence.quote && !evidence.doi) return [];
                if (!matched.length) matched.push({ evidence });
                return matched.map(({ output, result: cited, universeRef: targetUniverse }, citationIndex) => {
                  const artifact =
                    output && renderArtifact
                      ? renderArtifact(output, {
                          compact: true,
                          result: cited,
                          universeRef: targetUniverse,
                          status: cited ? statusReport?.statuses[cited.id] : undefined,
                        })
                      : null;
                  return (
                    <li key={`${indexInRecord}-${citationIndex}`}>
                      {artifact != null ? <div className="astra-record-preview__artifact">{artifact}</div> : null}
                      {output ? (
                        <RelatedRecord
                          record={output}
                          universeRef={targetUniverse}
                          index={index}
                          detail={output.type}
                          onOpenRecord={onOpenRecord}
                          renderRecordReference={renderRecordReference}
                        />
                      ) : evidence.artifact ? (
                        <span className="astra-record-preview__relation-trigger" data-kind="output">
                          <KindGlyph className="astra-record-preview__relation-glyph" kind="output" />
                          <span className="astra-record-preview__relation-label">{evidence.artifact}</span>
                        </span>
                      ) : null}
                      {evidence.quote ? (
                        <blockquote className="astra-record-preview__quote">
                          <Prose text={evidence.quote.exact} field="quote" renderText={renderText} />
                        </blockquote>
                      ) : null}
                      <Citation evidence={evidence} record={record} renderCitation={renderCitation} />
                    </li>
                  );
                });
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

function InsightPreview({ record, renderText, renderCitation }: SharedPreviewProps & { record: Insight }) {
  const labels = useLabels();
  const source = primaryLiteratureEvidence(record);
  return (
    <>
      <PreviewHeader kind="prior_insight" kindLabel={labels.kinds.prior_insight} />
      <div className="astra-record-preview__body">
        <div className="astra-record-preview__description">
          <Prose text={record.claim} field="claim" renderText={renderText} />
        </div>
        {source?.quote ? (
          <blockquote className="astra-record-preview__quote">
            <Prose text={source.quote.exact} field="quote" renderText={renderText} />
          </blockquote>
        ) : null}
        {source ? <Citation evidence={source} record={record} renderCitation={renderCitation} /> : null}
      </div>
    </>
  );
}

function OutputRecordPreview({
  record,
  index,
  universeRef,
  statusReport,
  renderArtifact,
  renderText,
}: SharedPreviewProps & { record: Output }) {
  const labels = useLabels();
  const result = outputResult(index, record, universeRef);
  const inputNames = outputRelations(index, record, universeRef).inputs.map((link) =>
    link.record ? recordTitle(link.record) : link.canonicalPath,
  );
  const recipe = result?.command;
  const flow = [inputNames.length ? inputNames.join(', ') : undefined, recipe, record.ref].filter(
    (value): value is string => Boolean(value),
  );
  const artifact = renderArtifact
    ? renderArtifact(record, {
        compact: true,
        result,
        universeRef,
        status: result ? statusReport?.statuses[result.id] : undefined,
      })
    : null;
  return (
    <>
      <PreviewHeader kind="output" kindLabel={labels.kinds.output} title={recordTitle(record)} />
      <div className="astra-record-preview__body">
        {record.description ? (
          <div className="astra-record-preview__description">
            <Prose text={record.description} field="description" renderText={renderText} />
          </div>
        ) : null}
        {artifact != null ? <div className="astra-record-preview__artifact">{artifact}</div> : null}
        {flow.length > 1 ? (
          <section className="astra-record-preview__section">
            <h4>{labels.preview.provenance}</h4>
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

function InputPreview({ record, renderText }: SharedPreviewProps & { record: Input }) {
  const labels = useLabels();
  const source = record.path;
  return (
    <>
      <PreviewHeader kind="input" kindLabel={labels.kinds.input} title={recordTitle(record)} />
      <div className="astra-record-preview__body">
        {record.description ? (
          <div className="astra-record-preview__description">
            <Prose text={record.description} field="description" renderText={renderText} />
          </div>
        ) : null}
        {source ? (
          <section className="astra-record-preview__section">
            <h4>{labels.preview.source}</h4>
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
  record: AstraRecord;
  maxSupportingInsights: number;
}) {
  switch (recordKind(record)) {
    case 'decision':
      return <DecisionPreview {...shared} record={record as Decision} maxSupportingInsights={maxSupportingInsights} />;
    case 'finding':
      return <FindingPreview {...shared} record={record as Insight} />;
    case 'prior_insight':
      return <InsightPreview {...shared} record={record as Insight} />;
    case 'output':
      return <OutputRecordPreview {...shared} record={record as Output} />;
    case 'input':
      return <InputPreview {...shared} record={record as Input} />;
  }
}

function AnalysisPreview({
  analysis,
  href,
  renderText,
  onOpenAnalysis,
}: {
  analysis: Analysis;
  href?: string | undefined;
  renderText?: TextRenderer | undefined;
  onOpenAnalysis?: ((analysis: Analysis, href?: string) => void) | undefined;
}) {
  const labels = useLabels();
  const title = analysisTitle(analysis);
  const safeHref = (() => {
    if (!href) return undefined;
    try {
      const parsed = new URL(href, 'https://astra-ui.invalid/');
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? href : undefined;
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
      <PreviewHeader kind="analysis" kindLabel={labels.kinds.analysis} title={titleNode} />
      <div className="astra-record-preview__body">
        {analysis.description ? (
          <div className="astra-record-preview__description">
            <Prose text={analysis.description} field="description" renderText={renderText} />
          </div>
        ) : null}
        <p className="astra-record-preview__counts">
          {labels.sectionCount('decisions', analysis.decisions.length)}
          {' · '}
          {labels.sectionCount('outputs', analysis.outputs.length)}
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
  const kindLabel = isOutput(record) ? labels.kinds.output : labels.kinds.decision;
  const description = isOutput(record) ? record.description : record.rationale;
  return (
    <>
      <PreviewHeader
        kindLabel={kindLabel}
        title={
          <span className="astra-record-preview__value">
            {entry.value}
            {entry.unit ? <small className="astra-record-preview__unit"> {entry.unit}</small> : null}
          </span>
        }
      />
      <div className="astra-record-preview__body">
        {entry.column || entry.filter || entry.product || entry.selection ? (
          <div className="astra-record-preview__selection">
            {entry.column ? <code>{entry.column}</code> : null}
            {entry.filter ? <span>{entry.filter}</span> : null}
            {entry.selection ? <code>{entry.selection}</code> : null}
            {entry.product ? <span>{labels.preview.valueSource(entry.product)}</span> : null}
          </div>
        ) : null}
        {description ? (
          <div className="astra-record-preview__description">
            <Prose text={description} field={isOutput(record) ? 'description' : 'rationale'} renderText={renderText} />
          </div>
        ) : null}
      </div>
    </>
  );
}

function previewKind(entry: RecordPreviewEntry): SurfaceKind {
  if (entry.kind === 'analysis') return 'analysis';
  return recordKind(entry.record);
}

/**
 * Compact, positioning-agnostic preview content for resolved records,
 * analyses, and inline values. Pair it with PreviewPopover or render it inline.
 */
export const RecordPreview = forwardRef<HTMLElement, RecordPreviewProps>(function RecordPreview(
  {
    entry,
    document,
    index,
    universeRef,
    statusReport,
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
    universeRef,
    statusReport,
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
      data-value-product={entry.kind === 'value' && entry.product ? '' : undefined}
      data-kind={previewKind(entry)}
      {...props}
      ref={ref}
      className={cn('astra-record-preview', className)}
    >
      {entry.kind === 'record' ? (
        <RecordEntryPreview {...shared} record={entry.record} maxSupportingInsights={maximum} />
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
});
