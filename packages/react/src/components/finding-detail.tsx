import type { ResolvedAnalysisNode, ResolvedInsight, ResolvedOutput } from '@astra-spec/sdk';
import { Fragment, forwardRef, useId, type HTMLAttributes, type ReactNode } from 'react';
import { doiHref } from '../model/doi.js';
import { recordTitle } from '../model/records.js';
import {
  findingLiterature,
  groupFindingEvidence,
  type FindingEvidenceGroup,
  type FindingEvidenceLink,
} from '../model/relations.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { CountHeading, DetailLayout, DetailMain, DetailSection } from '../primitives/detail-layout.js';
import { DetailDialog, type DetailDialogProps } from '../primitives/dialog.js';
import { Prose } from '../primitives/prose.js';
import type { TextRenderer } from '../lib/prose.js';
import type { ArtifactRenderer } from './artifact-preview.js';
import { OutputCard } from './output-card.js';
import { OutputEntry } from './output-entry.js';
import type { OpenRecordHandler } from '../lib/detail-stack.js';

export interface FindingDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  record: ResolvedInsight;
  /** Artifact-backed evidence resolved to outputs; see `findingEvidence()`. */
  evidence: FindingEvidenceLink[];
  renderText?: TextRenderer | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
  onOpenRecord?: OpenRecordHandler | undefined;
}

/** A resolved group, narrowed to the ones a result renderer can draw. */
type ResolvedGroup = FindingEvidenceGroup & { output: ResolvedOutput; analysis: ResolvedAnalysisNode };

const isResolved = (group: FindingEvidenceGroup): group is ResolvedGroup =>
  Boolean(group.output && group.analysis);

/**
 * One run of results of a kind. The label only earns its space when a finding
 * rests on more than one kind: with a single run, what they are is evident.
 */
function ResultRun({ label, labelled, children }: { label: string; labelled: boolean; children: ReactNode }) {
  const id = useId();
  if (!labelled) return <>{children}</>;
  return (
    <section aria-labelledby={id}>
      <h5 id={id} className="astra-finding-detail__group-heading">{label}</h5>
      {children}
    </section>
  );
}

/** The claim, the results it rests on, and the literature it cites. */
export const FindingDetail = forwardRef<HTMLDivElement, FindingDetailProps>(function FindingDetail({
  record,
  evidence,
  renderText,
  renderArtifact,
  onOpenRecord,
  className,
  ...props
}, ref) {
  const literature = findingLiterature(record);
  const results = groupFindingEvidence(evidence);
  // Grouped the way the inventory groups an analysis's outputs, so a result
  // looks the same wherever it is met. Unresolved artifacts have no record to
  // draw, so they keep their name and nothing more.
  const resolved = results.filter(isResolved);
  const ofType = (type: ResolvedOutput['type']) => resolved.filter(({ output }) => output.type === type);
  const figures = ofType('figure');
  const tables = ofType('table');
  const metrics = ofType('metric');
  const files = resolved.filter(({ output }) => !['figure', 'table', 'metric'].includes(output.type));
  const unresolved = results.filter((group) => !isResolved(group));
  // Labels only appear once a finding rests on more than one kind of result.
  const runs = [figures.length, tables.length, metrics.length, files.length + unresolved.length];
  const labelled = runs.filter(Boolean).length > 1;
  const open = (group: ResolvedGroup) => () => { onOpenRecord?.(group.output, group.analysis); };
  // Say what the result is to this finding; the card's own name would only
  // say what kind of artifact it is.
  const resultLabel = (group: ResolvedGroup) => `View supporting result: ${recordTitle(group.output)}`;
  return (
    <DetailLayout data-slot="finding-detail" {...props} ref={ref} layout="single" className={cn('astra-finding-detail', className)}>
      <DetailMain>
        <DetailSection label="Claim" heading="section">
          <Prose text={record.claim} field="claim" renderText={renderText} />
        </DetailSection>
        {record.notes ? (
          <section className="astra-finding-detail__notes">
            <h4>Notes</h4>
            <div><Prose text={record.notes} field="notes" renderText={renderText} /></div>
          </section>
        ) : null}
        <section className="astra-finding-detail__results">
          <CountHeading title="Supporting results" count={results.length} />
          {results.length ? (
            <>
              {([['Figures', figures], ['Tables', tables]] as const).map(([label, groups]) => (
                groups.length ? (
                  <ResultRun key={label} label={label} labelled={labelled}>
                    <div className="astra-finding-detail__gallery">
                      {groups.map((group) => (
                        <OutputCard key={group.key} output={group.output} renderArtifact={renderArtifact} aria-label={resultLabel(group)} onOpen={open(group)} />
                      ))}
                    </div>
                  </ResultRun>
                ) : null
              ))}
              {metrics.length ? (
                <ResultRun label="Metrics" labelled={labelled}>
                  <ul className="astra-finding-detail__tiles">
                    {metrics.map((group) => (
                      <li key={group.key}>
                        <OutputEntry output={group.output} renderArtifact={renderArtifact} aria-label={resultLabel(group)} onOpen={open(group)} />
                      </li>
                    ))}
                  </ul>
                </ResultRun>
              ) : null}
              {files.length || unresolved.length ? (
                <ResultRun label="Output files" labelled={labelled}>
                  <ul className="astra-finding-detail__files">
                    {files.map((group) => (
                      <li key={group.key}>
                        <OutputEntry output={group.output} aria-label={resultLabel(group)} onOpen={open(group)} />
                      </li>
                    ))}
                    {unresolved.map((group) => (
                      <li key={group.key} className="astra-finding-detail__unresolved">
                        {group.artifact ?? group.key}
                      </li>
                    ))}
                  </ul>
                </ResultRun>
              ) : null}
            </>
          ) : <p>No supporting results are linked to this finding.</p>}
        </section>
        {literature.map((source, index) => {
          const doi = source.doi ?? '';
          const location = source.location?.page ? ` · page ${source.location.page}` : '';
          return (
            <Fragment key={`${doi}-${index}`}>
              <section className="astra-insight-detail__paper astra-paper-doi">
                <h4>Source paper</h4>
                <a href={doiHref(doi)} target="_blank" rel="noreferrer">{doi}{location} ↗</a>
              </section>
              {source.quote ? (
                <section className="astra-insight-detail__source-quote">
                  <h4>Source passage</h4>
                  <blockquote><Prose text={source.quote.exact} field="quote" renderText={renderText} /></blockquote>
                </section>
              ) : null}
            </Fragment>
          );
        })}
      </DetailMain>
    </DetailLayout>
  );
});

export interface FindingDialogProps extends Pick<DetailDialogProps, 'mode' | 'backText' | 'className' | 'onBack' | 'onClose'>, Omit<FindingDetailProps, 'className'> {}

export function FindingDialog({ record, evidence, renderText, renderArtifact, onOpenRecord, ...dialog }: FindingDialogProps) {
  const labels = useLabels();
  return (
    <DetailDialog
      {...dialog}
      kind="finding"
      kindLabel={labels.kinds.finding}
      title={recordTitle(record)}
      closeLabel={labels.closeRecord(labels.kinds.finding)}
    >
      <FindingDetail record={record} evidence={evidence} renderText={renderText} renderArtifact={renderArtifact} onOpenRecord={onOpenRecord} />
    </DetailDialog>
  );
}
