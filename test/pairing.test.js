import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../src/compare.js';

// When a text holds several facts of the same kind, a wrong one has to be matched with the value it
// replaced, or the report would say "missing" and "added" for what is really one slip.

const issues = (source, target) => check(source, target, { sourceLang: 'en', targetLang: 'de' }).issues.map((i) => [i.type, i.source ?? null, i.target ?? null]);

test('two numbers that are each one slip off are reported as two changes, each matched to its own original', () => {
  assert.deepEqual(issues('Ship 120 units and 4500 units.', 'Liefern 121 Einheiten und 4501 Einheiten.'), [
    ['changed', '120', '121'],
    ['changed', '4500', '4501'],
  ]);
});

test('the order the numbers come in does not matter, only which value is closest to which', () => {
  assert.deepEqual(issues('Ship 120 units and 4500 units.', 'Liefern 4501 Einheiten und 121 Einheiten.'), [
    ['changed', '120', '121'],
    ['changed', '4500', '4501'],
  ]);
});

test('three slips in one sentence are matched one to one', () => {
  assert.deepEqual(issues('Ship 120, 4500 and 30 units.', 'Liefern 121, 4501 und 31 Einheiten.'), [
    ['changed', '120', '121'],
    ['changed', '4500', '4501'],
    ['changed', '30', '31'],
  ]);
});

test('a wrong value that is the only one missing and the only one added is always paired, however far off', () => {
  assert.deepEqual(issues('Ship 120 units and 4500 units.', 'Liefern 99999 Einheiten und 4500 Einheiten.'), [['changed', '120', '99999']]);
});

test('a number that simply is not there is missing, and one that was invented is added', () => {
  assert.deepEqual(issues('Ship 120 units and 4500 units.', 'Liefern 120 Einheiten.'), [['missing', '4500', null]]);
  assert.deepEqual(issues('Ship 120 units.', 'Liefern 120 Einheiten und 77 Kisten.'), [['added', null, '77']]);
});

test('a value too far from every candidate is not guessed at: it is reported as missing and added, not as a change', () => {
  const found = issues('Ship 12 units and 4500 units.', 'Liefern 987654 Einheiten und 123456 Einheiten.');
  const types = found.map((f) => f[0]).sort();
  assert.ok(types.includes('missing') && types.includes('added'), JSON.stringify(found));
  assert.ok(!types.includes('changed'), JSON.stringify(found));
});

test('different kinds of fact are matched only with their own kind: a changed date does not swallow a changed number', () => {
  const found = issues('Pay 10 on 1 March and 20 on 1 April.', 'Zahlen Sie 11 am 1. März und 20 am 2. April.');
  assert.equal(found.length, 2);
  assert.deepEqual(found[0], ['changed', '10', '11']);
  assert.equal(found[1][0], 'changed');
});

test('everything in the right place gives no issues at all', () => {
  assert.deepEqual(issues('Ship 120 units and 4500 units.', 'Liefern 120 Einheiten und 4.500 Einheiten.'), []);
});
