import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check } from '../src/compare.js';
import { canonicalNumber, extract } from '../src/extract.js';

const fixtures = readdirSync('fixtures').filter((f) => f.endsWith('.json')).map((f) => [f, JSON.parse(readFileSync(join('fixtures', f), 'utf8'))]);
const run = (s, t, o = {}) => check(s, t, o);
const kinds = (r) => r.issues.map((i) => `${i.type}:${i.kind}`);

for (const [name, p] of fixtures) {
  test(`${name}: a correct translation passes, with or without language hints`, () => {
    assert.deepEqual(run(p.source, p.target, { sourceLang: p.from, targetLang: p.to }).issues, []);
    assert.deepEqual(run(p.source, p.target).issues, []);
  });
}

test('number formats from different countries are the same number', () => {
  const same = [['12,450.50', 'en', '12.450,50', 'de'], ['1,234', 'en', '1.234', 'de'], ['2.5', 'en', '2,5', 'de'], ['1,000,000', 'en', '1.000.000', 'es'], ['12 450,50', 'fr', '12,450.50', 'en'], ["1'250", 'de', '1,250', 'en'], ['5.0', 'en', '5', 'de']];
  for (const [a, la, b, lb] of same) assert.equal(canonicalNumber(a, la), canonicalNumber(b, lb), `${a} vs ${b}`);
  assert.notEqual(canonicalNumber('1,234', 'de'), canonicalNumber('1,234', 'en')); // 1.234 against 1234
});

test('a dropped zero in an amount is caught as a change', () => {
  const r = run('The fee is $500,000 in total.\n\nPay by 5 May 2026.', 'Die Gebühr beträgt insgesamt 50.000 $.\n\nZahlung bis 5. Mai 2026.');
  assert.deepEqual(kinds(r), ['changed:money']);
  assert.equal(r.issues[0].paragraph, 1);
  assert.match(r.issues[0].source, /500,000/);
});

test('a changed date is caught, including a one-digit slip', () => {
  assert.deepEqual(kinds(run('Due on 6 October 2026.', 'Fällig am 16. Oktober 2026.')), ['changed:date']);
  assert.deepEqual(kinds(run('Due on 6 October 2026.', 'Fällig am 6. November 2026.')), ['changed:date']);
});

test('a missing number, a missing name and an invented number are each reported', () => {
  assert.deepEqual(kinds(run('Pay 3 instalments of 400 EUR.', 'Zahlen Sie Raten von 400 EUR.')), ['missing:number']);
  assert.deepEqual(kinds(run('Contract with Acme Industries GmbH.', 'Vertrag mit der Firma.')), ['missing:entity']);
  assert.deepEqual(kinds(run('Pay in March.', 'Zahlen Sie 30 Tage im März.')), ['added:number']);
});

test('swapped amounts between paragraphs are caught only when paragraphs line up', () => {
  const src = 'Anna owes $100.\n\nBen owes $200.';
  const swapped = 'Anna schuldet 200 $.\n\nBen schuldet 100 $.';
  assert.equal(run(src, swapped).ok, false);
  const squashed = run(src, 'Anna schuldet 200 $. Ben schuldet 100 $.');
  assert.equal(squashed.ok, true); // honest limit: nothing to compare against
  assert.match(squashed.note || 'whole', /whole|paragraph/i);
  assert.equal(squashed.mode, 'whole');
});

test('a changed email, web address, phone number, bank account and reference are caught', () => {
  assert.deepEqual(kinds(run('Write to a.b@acme.com', 'Schreiben Sie an a.b@acme.org')), ['changed:email']);
  assert.deepEqual(kinds(run('See https://acme.com/a', 'Siehe https://acme.com/b')), ['changed:url']);
  assert.deepEqual(kinds(run('Call +49 30 1234567', 'Rufen Sie +49 30 1234568 an')), ['changed:phone']);
  assert.deepEqual(kinds(run('IBAN DE89 3704 0044 0532 0130 00', 'IBAN DE89 3704 0044 0532 0130 01')), ['changed:iban']);
  assert.deepEqual(kinds(run('Order ORD-77-A', 'Bestellung ORD-77-B')), ['changed:id']);
});

test('an ambiguous date matches either reading and still catches a wrong one', () => {
  assert.equal(run('Due 03/04/2026.', 'Fällig am 4. März 2026.').ok, true);
  assert.equal(run('Due 03/04/2026.', 'Fällig am 3. April 2026.').ok, true);
  assert.equal(run('Due 03/04/2026.', 'Fällig am 5. April 2026.').ok, false);
  assert.equal(run('Due 25/12/2026.', 'Due December 12, 2026.').ok, false); // 25 cannot be a month
});

test('an amount in the wrong currency is caught', () => {
  assert.deepEqual(kinds(run('The price is 4,800 euros.', 'Der Preis beträgt 4.800 $.')), ['changed:money']);
});

test('percentages must keep their value', () => {
  assert.deepEqual(kinds(run('A rate of 2.5% applies.', 'Es gilt ein Satz von 25 %.')), ['changed:percent']);
});

test('names are only a warning, and only when asked for', () => {
  const s = 'Signed by Elena Ruiz in Madrid.', t = 'Unterschrieben von Elena Ruis in Madrid.';
  assert.equal(run(s, t).issues.length, 0);
  const r = run(s, t, { names: true });
  assert.equal(r.ok, true);
  assert.equal(r.warnings, 1);
});

test('German source text does not produce name warnings', () => {
  const r = run('Der Vertrag endet. Die Miete steigt.', 'The contract ends. The rent rises.', { names: true, sourceLang: 'de' });
  assert.equal(r.warnings, 0);
});

test('a text with no facts passes, and so does an empty one', () => {
  assert.equal(run('Hello there.', 'Hallo.').ok, true);
  assert.equal(run('', '').ok, true);
});

test('facts are read from the text, with the right kinds', () => {
  const f = extract('Pay €1,250 by 1 March 2026 (3%), ref A-12, mail a@b.co, +49 30 123456, Acme GmbH.', { lang: 'en' });
  assert.deepEqual(f.map((x) => x.kind).sort(), ['date', 'email', 'entity', 'id', 'money', 'percent', 'phone']);
});

test('the command line exits 1 on a problem and 0 on a clean pair', () => {
  const dir = mkdtempSync(join(tmpdir(), 'carryover-'));
  const w = (n, c) => { const p = join(dir, n); writeFileSync(p, c); return p; };
  const ok = spawnSync('node', ['bin/carryover.js', w('a', 'Pay $5,000.'), w('b', 'Zahlen Sie 5.000 $.'), '--from', 'en', '--to', 'de']);
  assert.equal(ok.status, 0);
  const bad = spawnSync('node', ['bin/carryover.js', w('c', 'Pay $5,000.'), w('d', 'Zahlen Sie 500 $.')]);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout.toString(), /Changed amount/);
  assert.equal(spawnSync('node', ['bin/carryover.js', 'nope', 'nada']).status, 2);
});

test('every planted error in every fixture is caught', async () => {
  const { bench } = await import('./bench.js');
  const r = bench();
  assert.ok(r.planted > 60, `only ${r.planted} errors were planted`);
  assert.deepEqual(r.missed, []);
});

// Known limits, pinned so the README stays honest. If one of these starts failing
// because the checker got better, move it into the "caught" tests above.
test('limits: it cannot see a number written as words', () => {
  assert.equal(run('The seller is not liable for 5 days.', 'Der Verkäufer haftet für 5 Tage.').ok, true); // no languages given, so no negation check
  assert.equal(run('Pay five hundred euros.', 'Zahlen Sie fünfzig Euro.').ok, true);
});

test('measurements keep their unit, whatever the number format', () => {
  assert.deepEqual(kinds(run('The pipe is 5 km long.', 'Das Rohr ist 5 m lang.')), ['changed:quantity']);
  assert.equal(run('Speed limit 2.5 kg per box.', 'Höchstmenge 2,5 kg pro Karton.', { sourceLang: 'en', targetLang: 'de' }).ok, true);
  assert.equal(run('Water at 20 °C.', 'Wasser bei 20 °C.').ok, true);
  assert.deepEqual(kinds(run('Water at 20 °C.', 'Wasser bei 20 °F.')), ['changed:quantity']);
});

test('"million" and "Mio." agree, and a wrong scale is caught', () => {
  assert.equal(run('The deal is worth $5 million.', 'Das Geschäft ist 5 Mio. $ wert.', { sourceLang: 'en', targetLang: 'de' }).ok, true);
  assert.equal(run('About 2.5 million users.', 'Etwa 2,5 Millionen Nutzer.', { sourceLang: 'en', targetLang: 'de' }).ok, true);
  assert.deepEqual(kinds(run('The deal is worth $5 billion.', 'Das Geschäft ist 5 Mio. $ wert.')), ['changed:money']);
});

test('a lost "not" is flagged as a warning when the languages are known', () => {
  const r = run('The seller is not liable for 5 days.', 'Der Verkäufer haftet für 5 Tage.', { sourceLang: 'en', targetLang: 'de' });
  assert.equal(r.ok, true);
  assert.deepEqual(kinds(r), ['negation:negation']);
  assert.equal(run('The seller is not liable.', 'Der Verkäufer haftet nicht.', { sourceLang: 'en', targetLang: 'de' }).issues.length, 0);
  assert.deepEqual(kinds(run('Der Verkäufer haftet.', 'The seller is not liable.', { sourceLang: 'de', targetLang: 'en' })), ['negation:negation']);
  assert.equal(run('No refunds after 30 days.', 'No hay reembolsos después de 30 días.', { sourceLang: 'en', targetLang: 'es' }).issues.length, 0);
});

test('a translation memory file is checked segment by segment', () => {
  const dir = mkdtempSync(join(tmpdir(), 'carryover-'));
  const tmx = `<?xml version="1.0"?><tmx version="1.4"><body>
<tu><tuv xml:lang="en"><seg>Pay <b>$500,000</b> by 5 May 2026.</seg></tuv><tuv xml:lang="de-DE"><seg>Zahlen Sie 500.000 $ bis zum 5. Mai 2026.</seg></tuv></tu>
<tu><tuv xml:lang="en"><seg>Smith &amp; Sons Ltd pays 40%.</seg></tuv><tuv xml:lang="de"><seg>Smith &amp; Sons Ltd zahlt 4 %.</seg></tuv></tu>
</body></tmx>`;
  const f = join(dir, 'm.tmx');
  writeFileSync(f, tmx);
  const r = spawnSync('node', ['bin/carryover.js', f, '--from', 'en', '--to', 'de']);
  assert.equal(r.status, 1);
  const out = r.stdout.toString();
  assert.match(out, /2 segments checked, 1 problem/);
  assert.match(out, /Segment 2/);
  assert.doesNotMatch(out, /Segment 1/);
  const t = join(dir, 'm.tsv');
  writeFileSync(t, 'Pay 5 days.\tZahlen Sie 5 Tage.\nPay 5 days.\tZahlen Sie 6 Tage.\n');
  assert.equal(spawnSync('node', ['bin/carryover.js', t, '--from', 'en', '--to', 'de']).status, 1);
});

test('the HTML report lists problems and escapes text', () => {
  const dir = mkdtempSync(join(tmpdir(), 'carryover-'));
  const a = join(dir, 'a.txt'), b = join(dir, 'b.txt'), out = join(dir, 'r.html');
  writeFileSync(a, 'Pay $500 to <b>ACME</b>.');
  writeFileSync(b, 'Zahlen Sie 50 $ an <b>ACME</b>.');
  spawnSync('node', ['bin/carryover.js', a, b, '--html', out]);
  const html = readFileSync(out, 'utf8');
  assert.match(html, /Fail/);
  assert.match(html, /Changed amount/);
  assert.ok(!html.includes('<b>'));
});
