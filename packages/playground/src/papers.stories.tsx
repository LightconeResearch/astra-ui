import { PaperDialog } from '@astra-spec/ui/components';
import type { InventoryPaper } from '@astra-spec/ui/model';
import { useState } from 'react';
import { loadPdfJs } from './pdf-runtime';

const paper: InventoryPaper = {
  doi: '10.1234/example',
  title: 'Passage navigation (synthetic fixture)',
  pdfUrl: '/papers/navigation.pdf',
  insights: [{
    id: 'result', created_at: '2026-01-01T00:00:00Z', kind: 'prior_insight', canonicalPath: 'prior_insights.result',
    claim: 'A reproducible result appears on the final page.',
    evidence: [{ id: 'source', doi: '10.1234/example', quote: { exact: 'A reproducible result appears on the final page.' } }],
  }],
  decisions: [],
};

function Example({ focused = false, rotation = 0 }: { focused?: boolean; rotation?: number }) {
  const [open, setOpen] = useState(true);
  return open
    ? <PaperDialog record={rotation ? { ...paper, pdfUrl: `/papers/rotation-${rotation}.pdf` } : paper} loadPdfJs={loadPdfJs} focusInsight={focused ? paper.insights[0] : undefined} onClose={() => { setOpen(false); }} />
    : <button type="button" onClick={() => { setOpen(true); }}>Open reader</button>;
}

export const Reader = () => <Example />;
export const FocusedPassage = () => <Example focused />;

export const Rotated90 = () => <Example focused rotation={90} />;
export const Rotated180 = () => <Example focused rotation={180} />;
export const Rotated270 = () => <Example focused rotation={270} />;
