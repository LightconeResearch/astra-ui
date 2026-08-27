// happy-dom exposes HTMLDialogElement but not the native modal methods.
const proto = globalThis.HTMLDialogElement?.prototype as (HTMLDialogElement & { showModal?: () => void; close?: () => void }) | undefined;
if (proto && typeof proto.showModal !== 'function') {
  Object.defineProperty(proto, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) { this.setAttribute('open', ''); },
  });
  Object.defineProperty(proto, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
}
