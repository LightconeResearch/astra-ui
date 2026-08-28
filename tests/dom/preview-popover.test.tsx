import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DetailDialog, PreviewPopover } from '../../packages/react/src/primitives/index.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function advance(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

describe('PreviewPopover', () => {
  it('opens after the hover delay, remains hoverable, and dismisses with Escape', () => {
    vi.useFakeTimers();
    render(
      <PreviewPopover
        label="Decision preview"
        trigger={<span className="host-trigger">Method</span>}
      >
        <button type="button">Nested action</button>
      </PreviewPopover>,
    );

    const trigger = screen.getByText('Method');
    expect(trigger.tabIndex).toBe(0);
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.mouseEnter(trigger, { clientX: 120 });
    advance(119);
    expect(screen.queryByRole('dialog')).toBeNull();
    advance(1);

    const preview = screen.getByRole('dialog', { name: 'Decision preview' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(preview.id);
    expect(preview.dataset.placement).toMatch(/^(top|bottom)/);
    fireEvent.mouseEnter(preview);
    advance(100);
    expect(screen.getByRole('dialog', { name: 'Decision preview' })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    advance(100);
    expect(screen.queryByRole('dialog', { name: 'Decision preview' })).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens on keyboard focus without moving focus and closes after focus leaves', async () => {
    render(
      <>
        <PreviewPopover
          label="Output preview"
          trigger={<button type="button">Result</button>}
        >
          <a href="/artifact">Artifact</a>
        </PreviewPopover>
        <button type="button">After</button>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Result' });
    trigger.focus();
    fireEvent.focus(trigger);
    expect(screen.getByRole('dialog', { name: 'Output preview' })).toBeTruthy();
    expect(document.activeElement).toBe(trigger);

    const artifact = screen.getByRole('link', { name: 'Artifact' });
    artifact.focus();
    fireEvent.focusOut(trigger, { relatedTarget: artifact });
    expect(screen.getByRole('dialog', { name: 'Output preview' })).toBeTruthy();

    const after = screen.getByRole('button', { name: 'After' });
    after.focus();
    fireEvent.focusOut(artifact, { relatedTarget: after });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Output preview' })).toBeNull();
    });
  });

  it('returns focus to the trigger when Escape dismisses interactive content', async () => {
    render(
      <PreviewPopover
        label="Interactive preview"
        trigger={<button type="button">Reference</button>}
      >
        <button type="button">Inner control</button>
      </PreviewPopover>,
    );
    const trigger = screen.getByRole('button', { name: 'Reference' });
    trigger.focus();
    fireEvent.focus(trigger);
    const inner = screen.getByRole('button', { name: 'Inner control' });
    inner.focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Interactive preview' })).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it('preserves trigger props and mounts a host-scoped portal', () => {
    const onClick = vi.fn();
    const triggerRef = { current: null as HTMLButtonElement | null };
    render(
      <PreviewPopover
        label="Finding preview"
        defaultOpen
        kind="finding"
        portalProps={{
          className: 'lightcone-brand host-scope',
          'data-astra-color-scheme': 'dark',
          'data-lightcone-color-scheme': 'dark',
        }}
        trigger={
          <button ref={triggerRef} type="button" className="child-class" onClick={onClick}>
            Finding
          </button>
        }
      >
        Claim
      </PreviewPopover>,
    );
    const trigger = screen.getByRole('button', { name: 'Finding' });
    fireEvent.click(trigger);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(triggerRef.current).toBe(trigger);
    expect(trigger.className).toContain('child-class');

    const portal = document.querySelector('[data-slot="preview-popover-portal"]');
    expect(portal?.classList.contains('astra-ui')).toBe(true);
    expect(portal?.classList.contains('lightcone-brand')).toBe(true);
    expect(portal?.getAttribute('data-astra-color-scheme')).toBe('dark');
    expect(portal?.getAttribute('data-lightcone-color-scheme')).toBe('dark');
    expect(screen.getByRole('dialog').dataset.kind).toBe('finding');
  });

  it('supports controlled state and nested floating trees', () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <PreviewPopover
        label="Outer preview"
        open
        onOpenChange={onOpenChange}
        trigger={<button type="button">Outer</button>}
      >
        <PreviewPopover
          label="Inner preview"
          defaultOpen
          trigger={<button type="button">Inner</button>}
        >
          Nested content
        </PreviewPopover>
      </PreviewPopover>,
    );
    expect(screen.getByRole('dialog', { name: 'Outer preview' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Inner preview' })).toBeTruthy();

    rerender(
      <PreviewPopover
        label="Outer preview"
        open={false}
        onOpenChange={onOpenChange}
        trigger={<button type="button">Outer</button>}
      >
        Hidden
      </PreviewPopover>,
    );
    advance(100);
    expect(screen.queryByRole('dialog', { name: 'Outer preview' })).toBeNull();
  });

  it('dismisses only the innermost nested preview for each Escape', () => {
    vi.useFakeTimers();
    render(
      <PreviewPopover
        label="Outer preview"
        defaultOpen
        trigger={<button type="button">Outer</button>}
      >
        <PreviewPopover
          label="Inner preview"
          defaultOpen
          trigger={<button type="button">Inner</button>}
        >
          Nested content
        </PreviewPopover>
      </PreviewPopover>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    advance(100);
    expect(screen.queryByRole('dialog', { name: 'Inner preview' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Outer preview' })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    advance(100);
    expect(screen.queryByRole('dialog', { name: 'Outer preview' })).toBeNull();
  });

  it('does not add preview semantics when disabled', () => {
    const { rerender } = render(
      <PreviewPopover
        label="Disabled preview"
        disabled
        defaultOpen
        trigger={<span>Plain text</span>}
      >
        Hidden
      </PreviewPopover>,
    );
    const trigger = screen.getByText('Plain text');
    expect(trigger.getAttribute('aria-haspopup')).toBeNull();
    expect(trigger.getAttribute('tabindex')).toBeNull();
    fireEvent.focus(trigger);
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(
      <PreviewPopover
        label="Disabled preview"
        disabled
        open
        trigger={<span>Plain text</span>}
      >
        Hidden
      </PreviewPopover>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lets the first native-dialog Escape close the preview and only the next close the dialog', async () => {
    const onClose = vi.fn();
    render(
      <DetailDialog title="Record" onClose={onClose}>
        <PreviewPopover
          label="Nested preview"
          defaultOpen
          trigger={<button type="button">Nested reference</button>}
        >
          Preview body
        </PreviewPopover>
      </DetailDialog>,
    );
    const dialog = document.querySelector('dialog');
    if (!dialog) throw new Error('native dialog missing');
    const preview = screen.getByRole('dialog', { name: 'Nested preview' });
    expect(preview.closest('dialog')).toBe(dialog);

    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Nested preview' })).toBeNull();
    });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
