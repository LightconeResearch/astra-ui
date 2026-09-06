import assert from 'node:assert/strict';
import test from 'node:test';
import { findQuoteMatch } from '../packages/react/dist/components/pdf-quote.js';
import { locateQuote, pageStrings } from '../packages/react/dist/components/pdf-search.js';

test('quote matching retains raw offsets across ligatures, hyphenation, smart quotes and text runs', () => {
  const strings = ['The “ofﬁce” repro-', 'ducibility result.'];
  const match = findQuoteMatch(strings, 'The "office" reproducibility result.');
  assert.equal(match.complete, true);
  assert.equal(match.origin[match.start].rawStart, 0);
  assert.equal(match.origin.at(-1).rawEnd, strings[1].length);
  // Lower-casing a single code point can expand into multiple code units.
  const unicode = findQuoteMatch(['İ and a result'], 'İ and a result');
  assert.equal(unicode.origin.length, unicode.length);
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
  const signal = new AbortController().signal;
  const result = await locateQuote(pdf, quote, 1, cache, signal);
  assert.equal(result.page, 3);
  assert.equal(result.match.complete, true);
  await locateQuote(pdf, quote, 3, cache, signal);
  assert.deepEqual(calls, [1, 2, 3]);
});

test('page fallback accepts only valid physical page numbers', async () => {
  const pdf = { numPages: 2, async getPage() { return { async getTextContent() { return { items: [] }; } }; } };
  const signal = new AbortController().signal;
  for (const page of [-1, 0, 3, 1.5, NaN]) {
    assert.equal(await locateQuote(pdf, 'Absent', page, new Map(), signal), undefined);
  }
  assert.deepEqual(await locateQuote(pdf, undefined, 2, new Map(), signal), { page: 2 });
});

test('timed-out extraction is evicted and a late failure cannot evict a newer request', async () => {
  let rejectOld;
  let calls = 0;
  const pdf = { async getPage() {
    calls++;
    if (calls === 1) return new Promise((_, reject) => { rejectOld = reject; });
    return { async getTextContent() { return { items: [{ str: 'Retry succeeded' }] }; } };
  } };
  const cache = new Map();
  await assert.rejects(pageStrings(pdf, 1, cache, 5), /timed out/);
  assert.equal(cache.has(1), false);
  assert.deepEqual(await pageStrings(pdf, 1, cache), ['Retry succeeded']);
  rejectOld(new Error('Late failure'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cache.has(1), true);
});
