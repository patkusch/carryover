import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTmx, parseTsv } from '../src/tm.js';

const TMX = `<?xml version="1.0"?>
<tmx version="1.4"><body>
<tu><tuv xml:lang="en"><seg>Pay 100 EUR &amp; sign</seg></tuv><tuv xml:lang="de-DE"><seg>Zahlen Sie 100 EUR &amp; unterschreiben</seg></tuv></tu>
<tu><tuv xml:lang="en"><seg>Only English here</seg></tuv></tu>
<tu><tuv xml:lang="en"><seg>Use <hi>bold</hi></seg></tuv><tuv xml:lang="de"><seg>Verwenden Sie fett</seg></tuv></tu>
</body></tmx>`;

test('a TMX file gives one pair per unit that has both languages', () => {
  const pairs = parseTmx(TMX, 'en', 'de');
  assert.equal(pairs.length, 2);
  assert.equal(pairs[0].source, 'Pay 100 EUR & sign');
  assert.equal(pairs[0].target, 'Zahlen Sie 100 EUR & unterschreiben');
});

test('the language pair is taken from the file when none is given', () => {
  const pairs = parseTmx(TMX);
  assert.equal(pairs[0].from, 'en');
  assert.equal(pairs[0].to, 'de');
});

test('formatting tags inside a segment are dropped', () => {
  const pairs = parseTmx(TMX, 'en', 'de');
  assert.equal(pairs[1].source, 'Use bold');
});

test('asking for a language the file does not have gives no pairs', () => {
  assert.deepEqual(parseTmx(TMX, 'en', 'fr'), []);
});

test('a TSV file gives source and target from each tab-separated line', () => {
  const pairs = parseTsv('Hello\tHallo\r\nno tab on this line\nPay 5 EUR\tZahlen Sie 5 EUR\n', 'en', 'de');
  assert.equal(pairs.length, 2);
  assert.deepEqual(pairs[0], { source: 'Hello', target: 'Hallo', from: 'en', to: 'de' });
  assert.equal(pairs[1].target, 'Zahlen Sie 5 EUR');
});
