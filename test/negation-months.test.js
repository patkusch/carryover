import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasNegation } from '../src/negation.js';
import { MONTH, MONTH_SRC } from '../src/months.js';

test('a negation is found in each language we read', () => {
  const cases = {
    en: 'The fee is not refundable',
    de: 'Die Gebühr ist nicht erstattungsfähig',
    fr: 'Les frais ne sont pas remboursables',
    es: 'La tarifa no es reembolsable',
    it: 'La tassa non è rimborsabile',
    pt: 'A taxa não é reembolsável',
    nl: 'De vergoeding is niet terugbetaalbaar',
  };
  for (const [lang, text] of Object.entries(cases)) assert.equal(hasNegation(text, lang), true, lang);
});

test('a sentence with no negation is reported as having none', () => {
  assert.equal(hasNegation('The fee is refundable', 'en'), false);
  assert.equal(hasNegation('Die Gebühr ist erstattungsfähig', 'de'), false);
});

test('an unknown or missing language gives null, meaning "cannot say"', () => {
  assert.equal(hasNegation('The fee is not refundable', 'xx'), null);
  assert.equal(hasNegation('The fee is not refundable', ''), null);
  assert.equal(hasNegation('The fee is not refundable'), null);
});

test('a region code such as de-AT or EN is read as its language', () => {
  assert.equal(hasNegation('Das ist nicht erlaubt', 'de-AT'), true);
  assert.equal(hasNegation('This is not allowed', 'EN'), true);
});

test('month names in several languages map to the same number', () => {
  assert.equal(MONTH.get('march'), 3);
  assert.equal(MONTH.get('marz'), 3, 'märz, with its accent removed');
  assert.equal(MONTH.get('mars'), 3);
  assert.equal(MONTH.get('marzo'), 3);
  assert.equal(MONTH.get('decembre'), 12, 'décembre, with its accent removed');
  assert.equal(MONTH.get('dezember'), 12);
  assert.equal(MONTH.get('maggio'), 5);
});

test('a longer month name is tried before its short form', () => {
  const names = MONTH_SRC.split('|');
  assert.ok(names.indexOf('septiembre') < names.indexOf('sep'));
  assert.ok(names.indexOf('january') < names.indexOf('jan'));
});
