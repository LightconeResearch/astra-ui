import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Button,
  DetailDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogProvider,
  useDialogDismissGuard,
} from '../../packages/react/src/components.js';
import { OutputDetail, useDetailStack } from '../../packages/react/src/components.js';
import { InventoryExplorer } from '../../packages/react/src/views.js';
import { renderHook, act } from '@testing-library/react';
import type { ResolvedAnalysisDocument, ResolvedOutput } from '@astra-spec/sdk';
import { fixtureDocument as untypedFixture } from '../fixture.mjs';

const fixtureDocument = untypedFixture as unknown as ResolvedAnalysisDocument;

afterEach(cleanup);

describe('Dialog', () => {
  it('opens as a native modal, focuses the close control, and closes on the close button', () => {
    const onClose = vi.fn();
    render(
      <DetailDialog kind="decision" kindLabel="Decision" title="Method choice" closeLabel="Close it" onClose={onClose}>
        <p>Body</p>
      </DetailDialog>,
    );
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.hasAttribute('open')).toBe(true);
    const close = screen.getByRole('button', { name: 'Close it' });
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the opener when the dialog closes', () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => { setOpen(true); }}>Open</button>
          {open ? (
            <DetailDialog title="T" closeLabel="Close" onClose={() => { setOpen(false); }}>
              <p>Body</p>
            </DetailDialog>
          ) : null}
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog', { hidden: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('dismisses on backdrop mousedown but not on clicks inside the panel', () => {
    const onClose = vi.fn();
    render(<DetailDialog title="T" onClose={onClose}><p>Body</p></DetailDialog>);
    const dialog = screen.getByRole('dialog', { hidden: true });
    fireEvent.mouseDown(screen.getByText('Body'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps an expanded artifact from closing the dialog on Escape', () => {
    const onClose = vi.fn();
    const onExpandedChange = vi.fn();
    const output = fixtureDocument.analysis.outputs[0] as ResolvedOutput;
    render(
      <DetailDialog title="T" onClose={onClose}>
        <OutputDetail record={output} relations={{ inputs: [], decisions: [] }} expanded onExpandedChange={onExpandedChange} />
      </DetailDialog>,
    );
    const dialog = screen.getByRole('dialog', { hidden: true });
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it('treats Escape (cancel) as a dismissal unless a guard is active', () => {
    const onOpenChange = vi.fn();
    function Guarded({ active }: { active: boolean }) {
      useDialogDismissGuard(active);
      return null;
    }
    const { rerender } = render(
      <Dialog onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader title="T" />
          <Guarded active />
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { hidden: true });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onOpenChange).not.toHaveBeenCalled();

    rerender(
      <Dialog onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader title="T" />
          <Guarded active={false} />
        </DialogContent>
      </Dialog>,
    );
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders embedded when the provider says so, and props win over the provider', () => {
    render(
      <DialogProvider mode="embedded" backText="From provider">
        <DetailDialog title="T" backText="From props" onBack={() => undefined} onClose={() => undefined}>
          <p>Body</p>
        </DetailDialog>
      </DialogProvider>,
    );
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    expect(screen.getByText('From props')).toBeTruthy();
  });

  it('merges className, forwards refs, and spreads attributes on primitives', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref} className="host" data-testid="b" variant="primary">Go</Button>);
    const button = screen.getByTestId('b');
    expect(ref.current).toBe(button);
    expect(button.className).toBe('astra-button host');
    expect(button.dataset.variant).toBe('primary');
  });

  it('renders a link through asChild', () => {
    render(<Button asChild><a href="/x">Link</a></Button>);
    const link = screen.getByRole('link', { name: 'Link' });
    expect(link.className).toBe('astra-button');
    expect(link.getAttribute('type')).toBeNull();
  });
});

describe('InventoryExplorer detail stack', () => {
  it('opens a record from the list, drills into a dependency, goes back, and closes', () => {
    const onDetailChange = vi.fn();
    render(<InventoryExplorer document={fixtureDocument} onDetailChange={onDetailChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Headline result/ }));
    expect(onDetailChange).toHaveBeenLastCalledWith([{ kind: 'record', canonicalPath: 'outputs.headline', analysisPath: '$' }]);
    expect(screen.getByRole('dialog', { hidden: true }).getAttribute('data-kind')).toBe('output');

    fireEvent.click(screen.getByRole('button', { name: 'View decision: Method choice' }));
    expect(onDetailChange).toHaveBeenLastCalledWith([
      { kind: 'record', canonicalPath: 'outputs.headline', analysisPath: '$' },
      { kind: 'record', canonicalPath: 'decisions.method', analysisPath: '$' },
    ]);
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.getAttribute('data-kind')).toBe('decision');
    expect(screen.getByText('headline', { selector: '.astra-dialog__crumb' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Back to previous record' }));
    expect(screen.getByRole('dialog', { hidden: true })).toBe(dialog);
    expect(dialog.getAttribute('data-kind')).toBe('output');

    fireEvent.click(screen.getByRole('button', { name: 'Close output details' }));
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });

  it('composes two updates in one tick and notifies once per change', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDetailStack({ onChange }));
    act(() => {
      result.current.open({ kind: 'record', canonicalPath: 'a', analysisPath: '$' });
      result.current.push({ kind: 'record', canonicalPath: 'b', analysisPath: '$' });
    });
    expect(result.current.stack.map((entry) => entry.kind === 'record' && entry.canonicalPath)).toEqual(['a', 'b']);
    expect(onChange).toHaveBeenCalledTimes(2);
    act(() => { result.current.back(); });
    expect(result.current.active).toEqual({ kind: 'record', canonicalPath: 'a', analysisPath: '$' });
  });

  it('is controllable from the host', () => {
    const { rerender } = render(
      <InventoryExplorer document={fixtureDocument} detail={[]} />,
    );
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    rerender(
      <InventoryExplorer
        document={fixtureDocument}
        detail={[{ kind: 'record', canonicalPath: 'inputs.catalog', analysisPath: '$' }]}
      />,
    );
    expect(screen.getByRole('dialog', { hidden: true }).getAttribute('data-kind')).toBe('input');
  });
});
