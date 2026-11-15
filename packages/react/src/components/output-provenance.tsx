import { forwardRef, useState, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import type { OutputProvenanceData } from '../model/output-provenance.js';
import { DetailDialog } from '../primitives/dialog.js';
import { OutputStatusGlyph } from '../primitives/output-status-glyph.js';
export type OutputProvenanceProps = HTMLAttributes<HTMLDivElement> & OutputProvenanceData;
/** Provenance and byte availability are independent facts in the SDK status report. */
export const OutputProvenance = forwardRef<HTMLDivElement, OutputProvenanceProps>(function OutputProvenance(
  { status, record: suppliedRecord, error, className, ...props },
  ref,
) {
  const labels = useLabels(),
    copy = labels.provenance;
  const record = suppliedRecord === undefined ? status?.record : suppliedRecord;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const generated = record?.generated_by,
    finished = generated?.finished;
  return (
    <div data-slot="output-provenance" {...props} ref={ref} className={cn('astra-output-provenance', className)}>
      <div className="astra-output-provenance__heading">
        <h4>{copy.title}</h4>
        {record ? (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setDetailsOpen(true);
            }}
          >
            {copy.details}
          </button>
        ) : null}
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
              {status ? labels.status[status.state] : copy.unknown}
            </span>
            {status?.why.map((why, index) => (
              <p key={index} className="astra-output-provenance__reason">
                {why.message}
              </p>
            ))}
          </dd>
        </div>
        {status?.bytes ? (
          <div>
            <dt>Recorded bytes</dt>
            <dd>
              {status.bytes.state === 'present' ? 'Available' : 'Unavailable'}
              {status.bytes.kept_by ? ` (${status.bytes.kept_by})` : ''}
            </dd>
          </div>
        ) : null}
        {finished ? (
          <div>
            <dt>{copy.lastRun}</dt>
            <dd>
              <time dateTime={finished}>{new Date(finished).toLocaleString()}</time>
            </dd>
          </div>
        ) : null}
        {generated ? (
          <div>
            <dt>{copy.revision}</dt>
            <dd>
              <code title={generated.commit}>{generated.commit.slice(0, 8)}</code>
            </dd>
          </div>
        ) : null}
      </dl>
      {error ? <p role="alert">{error}</p> : !record ? <p>{copy.noRun}</p> : null}
      {detailsOpen && record && generated ? (
        <DetailDialog
          mode="modal"
          title={copy.runDetails}
          closeLabel={copy.closeDetails}
          onClose={() => {
            setDetailsOpen(false);
          }}
          panelClassName="astra-output-provenance__dialog-panel"
        >
          <div className="astra-output-provenance__details">
            <section>
              <h4>Recorded content</h4>
              <p>
                <code>{record.content_hash}</code> · {record.size} bytes
              </p>
            </section>
            <section>
              <h4>{copy.inputs}</h4>
              {generated.inputs.length ? (
                <dl>
                  {generated.inputs.map((input) => (
                    <div key={input.entry}>
                      <dt>{input.entry}</dt>
                      <dd>
                        <code>{input.content_hash}</code> · {input.size} bytes
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>{copy.noInputs}</p>
              )}
            </section>
            <section>
              <h4>{copy.environment}</h4>
              <p>
                <code>{generated.environment.iri}</code>
              </p>
            </section>
            <section>
              <h4>{copy.cliVersion}</h4>
              <p>
                {generated.runner.id} {generated.runner.version}
              </p>
            </section>
          </div>
        </DetailDialog>
      ) : null}
    </div>
  );
});
