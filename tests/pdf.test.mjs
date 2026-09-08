import assert from 'node:assert/strict';
import test from 'node:test';
import { findQuoteMatch, locateQuote, pageText } from '../packages/react/dist/lib/pdf-quote.js';
import { pdfJsWithWorker } from '../packages/react/dist/lib/pdf-runtime.js';

const signal = new AbortController().signal;

test('quote matching retains raw offsets across ligatures, hyphenation, smart quotes and text runs', () => {
  const strings = ['The “ofﬁce” repro-', 'ducibility result.'];
  const match = findQuoteMatch(strings, 'The "office" reproducibility result.');
  assert.equal(match.complete, true);
  assert.equal(match.origin[match.start].rawStart, 0);
  assert.equal(match.origin.at(-1).rawEnd, strings[1].length);
  // Folding a single code point can expand into several code units.
  const unicode = findQuoteMatch(['İ and a result'], 'İ and a result');
  assert.equal(unicode.origin.length, unicode.length);
});

test('quote matching ignores how a PDF encoded or dropped accents', () => {
  const quote = 'Poincaré’s conjecture';
  for (const strings of [['Poincaré’s conjecture'], ['Poincar', 'é’s conjecture'], ["Poincare's conjecture"]]) {
    assert.equal(findQuoteMatch(strings, quote)?.complete, true, JSON.stringify(strings));
  }
  const decomposed = findQuoteMatch(['Poincar', 'e\u0301\u2019s conjecture'], 'Poincare\u2019s conjecture');
  const accented = decomposed.origin[decomposed.start + 'poincar'.length];
  assert.deepEqual([accented.rawStart, accented.rawEnd], [0, 2], 'a decomposed accent stays with its base in the highlight');
  assert.equal(decomposed.origin[decomposed.start + 'poincare'.length].rawStart, 2, 'the combining mark contributes no characters');
});

test('quote matching ignores invisible format characters on either side', () => {
  for (const invisible of ['\u200b', '\u200d', '\u2060', '\u2062', '\u00ad']) {
    assert.equal(findQuoteMatch(['reproducibility result'], `reproduci${invisible}bility result`)?.complete, true, invisible);
    assert.equal(findQuoteMatch([`reproduci${invisible}bility result`], 'reproducibility result')?.complete, true, invisible);
  }
});

test('quote matching distinguishes a shortened prefix and never matches an empty selector', () => {
  assert.equal(findQuoteMatch(['A reproducible result appears'], 'A reproducible result appears elsewhere').complete, false);
  assert.equal(findQuoteMatch(['Other text'], 'A reproducible result'), undefined);
  assert.equal(findQuoteMatch(['Other text'], ' \n—'), undefined);
});

test('search caches page text across requests, tolerates errors, and prioritizes complete matches', async () => {
  const calls = [];
  const quote = 'A reproducible result appears on the final page.';
  const pdf = { numPages: 3, async getPage(page) {
    calls.push(page);
    if (page === 2) throw new Error('Unreadable');
    return { async getTextContent() { return { items: [{ str: page === 1 ? 'A reproducible result appears' : quote }] }; } };
  } };
  const cache = new Map();
  const result = await locateQuote(pdf, { quote, page: 1 }, cache, signal);
  assert.equal(result.page, 3);
  assert.equal(result.match.complete, true);
  await locateQuote(pdf, { quote, page: 3 }, cache, signal);
  assert.deepEqual(calls, [1, 2, 3]);
});

test('page fallback accepts only valid physical page numbers', async () => {
  const pdf = { numPages: 2, async getPage() { return { async getTextContent() { return { items: [] }; } }; } };
  for (const page of [-1, 0, 3, 1.5, NaN]) {
    assert.equal(await locateQuote(pdf, { quote: 'Absent', page }, new Map(), signal), undefined);
  }
  assert.deepEqual(await locateQuote(pdf, { page: 2 }, new Map(), signal), { page: 2 });
});

test('a failed extraction is forgotten so a later request retries it', async () => {
  let calls = 0;
  const pdf = { async getPage() {
    calls += 1;
    if (calls === 1) throw new Error('Unreadable');
    return { async getTextContent() { return { items: [{ str: 'Retry succeeded' }] }; } };
  } };
  const cache = new Map();
  const first = pageText(pdf, 1, cache);
  assert.equal(cache.get(1), first);
  await assert.rejects(first, /Unreadable/);
  assert.equal(cache.has(1), false);
  const second = pageText(pdf, 1, cache);
  assert.deepEqual(await second, { items: [{ str: 'Retry succeeded' }] });
  assert.equal(cache.get(1), second);
});

function fakeWorkerHost() {
  const events = new Map();
  const port = {
    terminated: false,
    addEventListener(name, listener) { events.set(name, listener); },
    terminate() { this.terminated = true; },
  };
  const documents = [];
  const pdfjs = {
    TextLayer: class { cancel() {} },
    PDFWorker: { fromPort: ({ port: given }) => ({ port: given, destroyed: false, destroy() { this.destroyed = true; } }) },
    getDocument(options) {
      const task = { options, promise: new Promise(() => {}), destroy: async () => { task.destroyed = true; } };
      documents.push(task);
      return task;
    },
  };
  return { port, events, pdfjs, documents };
}

test('pdfJsWithWorker gives each document its own worker, fails loading when it cannot start, and releases it', async () => {
  const host = fakeWorkerHost();
  const runtime = pdfJsWithWorker(host.pdfjs, () => host.port);
  assert.equal(runtime.TextLayer, host.pdfjs.TextLayer);
  const task = runtime.getDocument({ url: '/paper.pdf' });
  const [opened] = host.documents;
  assert.equal(opened.options.url, '/paper.pdf');
  assert.equal(opened.options.worker.port, host.port, 'the document uses a pdf.js worker over the created port');
  host.events.get('error')(new Event('error'));
  await assert.rejects(task.promise, /worker could not start/);
  await task.destroy();
  assert.equal(opened.destroyed, true);
  assert.equal(opened.options.worker.destroyed, true);
  assert.equal(host.port.terminated, true);
});

test('pdfJsWithWorker releases the worker when pdf.js rejects the options synchronously', () => {
  const host = fakeWorkerHost();
  host.pdfjs.getDocument = () => { throw new Error('Invalid PDF url'); };
  assert.throws(() => pdfJsWithWorker(host.pdfjs, () => host.port).getDocument({ url: 'http://host:99999/paper.pdf' }), /Invalid PDF url/);
  assert.equal(host.port.terminated, true);
});

test('pdfJsWithWorker terminates the worker even when the document cannot be released cleanly', async () => {
  const host = fakeWorkerHost();
  host.pdfjs.getDocument = () => ({ promise: Promise.resolve({}), destroy: async () => { throw new Error('Already gone'); } });
  const task = pdfJsWithWorker(host.pdfjs, () => host.port).getDocument({ url: '/paper.pdf' });
  await assert.rejects(task.destroy(), /Already gone/);
  assert.equal(host.port.terminated, true);
});
