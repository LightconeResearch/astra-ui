import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
import { InventoryExplorer } from '../../packages/react/src/views.js';
import { fixtureDocument } from '../fixture.mjs';

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
