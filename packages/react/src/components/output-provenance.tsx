import { forwardRef, useState, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import type { OutputProvenanceData } from '../model/output-provenance.js';
import { DetailDialog } from '../primitives/dialog.js';
import { OutputStatusGlyph } from '../primitives/output-status-glyph.js';

export type OutputProvenanceProps = HTMLAttributes<HTMLDivElement> & OutputProvenanceData;

/** Compact run summary with the full execution metadata in a detail dialog. */
export const OutputProvenance = forwardRef<HTMLDivElement, OutputProvenanceProps>(function OutputProvenance({
  status, run, error, className, ...props
}, ref) {
  const labels = useLabels();
  const copy = labels.provenance;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const stateLabel = status ? labels.status[status.state] : copy.unknown;
  const finished = run ? new Date(run.finishedAt) : null;
  return (
    <div data-slot="output-provenance" {...props} ref={ref} className={cn('astra-output-provenance', className)}>
      <div className="astra-output-provenance__heading">
        <h4>{copy.title}</h4>
        {run ? <button type="button" aria-haspopup="dialog" onClick={() => { setDetailsOpen(true); }}>{copy.details}</button> : null}
      </div>
      <dl className="astra-output-provenance__summary">
        <div>
          <dt>{copy.status}</dt>
          <dd>
            <span className="astra-output-provenance__status">
              {status ? (
                <span className="astra-output-provenance__icon" data-state={status.state} aria-hidden="true">
                  <OutputStatusGlyph state={status.state} />
                </span>
              ) : null}
              {stateLabel}
            </span>
            {status?.detail ? <p className="astra-output-provenance__reason">{status.detail}</p> : null}
          </dd>
        </div>
        {run ? <>
          <div>
            <dt>{copy.lastRun}</dt>
            <dd><time dateTime={run.finishedAt}>{finished && !Number.isNaN(finished.getTime()) ? finished.toLocaleString() : run.finishedAt}</time></dd>
          </div>
          <div>
            <dt>{copy.revision}</dt>
            <dd><code title={run.gitRevision}>{run.gitRevision.slice(0, 8)}</code></dd>
          </div>
        </> : null}
      </dl>
      {error ? <p role="alert">{error}</p> : run === undefined ? <p role="status">{copy.loading}</p> : run === null ? <p>{copy.noRun}</p> : null}
      {detailsOpen && run ? (
        <DetailDialog
          mode="modal"
          title={copy.runDetails}
          closeLabel={copy.closeDetails}
          onClose={() => { setDetailsOpen(false); }}
          panelClassName="astra-output-provenance__dialog-panel"
        >
          <div className="astra-output-provenance__details">
            <section>
              <h4>{copy.recipe}</h4>
              <pre><code>{run.recipe}</code></pre>
            </section>
            <section>
              <h4>{copy.inputs}</h4>
              {Object.keys(run.inputVersions).length ? (
                <dl>{Object.entries(run.inputVersions).map(([name, version]) => (
                  <div key={name}><dt>{name}</dt><dd><code>{version}</code></dd></div>
                ))}</dl>
              ) : <p>{copy.noInputs}</p>}
            </section>
            <section>
              <h4>{copy.environment}</h4>
              <p><code>{run.environment}</code></p>
            </section>
            <section>
              <h4>{copy.cliVersion}</h4>
              <p>{run.cliVersion}</p>
            </section>
          </div>
        </DetailDialog>
      ) : null}
    </div>
  );
});
