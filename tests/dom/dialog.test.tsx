import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Button,
  DetailDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogProvider,
  useDialogDismissGuard,
} from '../../packages/react/src/primitives/index.js';
import { OutputDetail, useDetailStack } from '../../packages/react/src/components/index.js';
import { Inventory } from '../../packages/react/src/views/index.js';
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

  it('dismisses on primary-button backdrop mousedown but not on other buttons or clicks inside the panel', () => {
    const onClose = vi.fn();
    render(<DetailDialog title="T" onClose={onClose}><p>Body</p></DetailDialog>);
    const dialog = screen.getByRole('dialog', { hidden: true });
    fireEvent.mouseDown(screen.getByText('Body'));
    fireEvent.mouseDown(dialog, { button: 2 });
    fireEvent.mouseDown(dialog, { button: 1 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialog, { button: 0 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lets Escape exit a full-screen artifact, and only the next Escape closes the dialog', () => {
    const onClose = vi.fn();
    const output = fixtureDocument.analysis.outputs[0] as ResolvedOutput;
    function Host() {
      const [expanded, setExpanded] = useState(true);
      return (
        <DetailDialog title="T" onClose={onClose}>
          <OutputDetail record={output} relations={{ inputs: [], decisions: [] }} expanded={expanded} onExpandedChange={setExpanded} />
        </DetailDialog>
      );
    }
    render(<Host />);
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    const layer = () => document.querySelector('[data-expanded]');
    expect(layer()?.getAttribute('role')).toBe('dialog');
    // Browser order: document keydown listeners run first, then the <dialog>
    // receives cancel. Inside a modal the keydown alone must not release the
    // guard, or the cancel that follows would close the dialog.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(layer()).toBeTruthy();
    const first = new Event('cancel', { cancelable: true });
    fireEvent(dialog, first);
    expect(first.defaultPrevented).toBe(true);
    expect(layer()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('treats the full-screen layer as a modal: focus enters it, the rest is inert, focus returns on exit', () => {
    const output = fixtureDocument.analysis.outputs[0] as ResolvedOutput;
    function Host() {
      const [expanded, setExpanded] = useState(false);
      return (
        <DetailDialog title="T" closeLabel="Close" onClose={() => undefined} actions={<button type="button" onClick={() => { setExpanded(true); }}>Expand</button>}>
          <OutputDetail record={output} relations={{ inputs: [], decisions: [] }} expanded={expanded} onExpandedChange={setExpanded} />
        </DetailDialog>
      );
    }
    render(<Host />);
    const expand = screen.getByRole('button', { name: 'Expand' });
    expand.focus();
    fireEvent.click(expand);
    const layer = document.querySelector('[data-expanded]') as HTMLElement;
    const exit = screen.getByRole('button', { name: 'Exit full screen' });
    expect(document.activeElement).toBe(exit);
    expect(layer.hasAttribute('inert')).toBe(false);
    expect(document.querySelector('.astra-output-detail__provenance-slot')?.hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('button', { name: 'Close', hidden: true }).closest('[inert]')).not.toBeNull();

    fireEvent.click(exit);
    expect(document.querySelector('[data-expanded]')).toBeNull();
    expect(document.querySelector('[inert]')).toBeNull();
    expect(document.activeElement).toBe(expand);
  });

  it('exits a full-screen artifact on Escape when no modal dialog owns the key', () => {
    const onExpandedChange = vi.fn();
    const output = fixtureDocument.analysis.outputs[0] as ResolvedOutput;
    render(<OutputDetail record={output} relations={{ inputs: [], decisions: [] }} expanded onExpandedChange={onExpandedChange} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it('does not report a dismissal for StrictMode\'s simulated unmount', () => {
    const onClose = vi.fn();
    render(
      <StrictMode>
        <DetailDialog title="T" closeLabel="Close" onClose={onClose}><p>Body</p></DetailDialog>
      </StrictMode>,
    );
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves focus where the user put it across unrelated re-renders', () => {
    function Host({ title }: { title: string }) {
      return (
        <>
          <input aria-label="Outside" />
          <DetailDialog title={title} onClose={() => undefined}><p>Body</p></DetailDialog>
        </>
      );
    }
    const { rerender } = render(<Host title="One" />);
    const outside = screen.getByLabelText('Outside');
    outside.focus();
    expect(document.activeElement).toBe(outside);
    rerender(<Host title="Two" />);
    expect(document.activeElement).toBe(outside);
  });

  it('moves focus to the close control only when a body swap removed the focused element', () => {
    function Host({ step }: { step: number }) {
      return (
        <DetailDialog title="T" closeLabel="Close" onClose={() => undefined}>
          {step === 1 ? <button type="button">Inner</button> : <p>Swapped</p>}
        </DetailDialog>
      );
    }
    const { rerender } = render(<Host step={1} />);
    const inner = screen.getByRole('button', { name: 'Inner' });
    inner.focus();
    expect(document.activeElement).toBe(inner);
    rerender(<Host step={2} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('forwards HTML attributes on DetailDialog to the dialog root', () => {
    render(<DetailDialog title="T" onClose={() => undefined} id="host-id" data-testid="host-dialog" style={{ color: 'red' }}><p>Body</p></DetailDialog>);
    const dialog = screen.getByTestId('host-dialog');
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog.id).toBe('host-id');
    expect(dialog.style.color).toBe('red');
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

describe('Inventory detail stack', () => {
  it('opens a record from the list, drills into a dependency, goes back, and closes', () => {
    const onDetailChange = vi.fn();
    render(<Inventory document={fixtureDocument} onDetailChange={onDetailChange} />);
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
      <Inventory document={fixtureDocument} detail={[]} />,
    );
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    rerender(
      <Inventory
        document={fixtureDocument}
        detail={[{ kind: 'record', canonicalPath: 'inputs.catalog', analysisPath: '$' }]}
      />,
    );
    expect(screen.getByRole('dialog', { hidden: true }).getAttribute('data-kind')).toBe('input');
  });
});
