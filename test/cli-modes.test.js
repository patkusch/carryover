import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe } from '../src/compare.js';

const run = (args, cwd) => spawnSync('node', [join(process.cwd(), 'bin/carryover.js'), ...args], { cwd, encoding: 'utf8' });

function folder(t) {
  const dir = mkdtempSync(join(tmpdir(), 'carryover-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function put(dir, name, text) {
  writeFileSync(join(dir, name), text);
  return name;
}

const GOOD = 'Pay $5,000 by 1 March 2026.\tZahlen Sie 5.000 $ bis zum 1. März 2026.\n';
const BAD = 'Order 12 units.\tBestellen Sie 21 Einheiten.\n';

test('a translation memory that is all right passes, with the segment count', (t) => {
  const dir = folder(t);
  put(dir, 'm.tsv', GOOD);
  const r = run(['m.tsv', '--from', 'en', '--to', 'de'], dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^PASS  1 segments checked, 0 problems/);
});

test('a memory with one wrong segment fails with its number, the start of the source, and what changed', (t) => {
  const dir = folder(t);
  put(dir, 'm.tsv', GOOD + BAD);
  const r = run(['m.tsv', '--from', 'en', '--to', 'de'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^FAIL  2 segments checked, 1 problem\n/);
  assert.match(r.stdout, /Segment 2: Order 12 units\.\n  Changed number: "12" became "21"/);
  assert.doesNotMatch(r.stdout, /Segment 1/);
});

test('a long source line is cut at 80 characters with an ellipsis in the memory report', (t) => {
  const dir = folder(t);
  const long = `Order 12 units of ${'very '.repeat(30)}fine goods.`;
  put(dir, 'm.tsv', `${long}\tBestellen Sie 21 Einheiten sehr feiner Ware.\n`);
  const r = run(['m.tsv', '--from', 'en', '--to', 'de'], dir);
  const line = r.stdout.split('\n').find((l) => l.startsWith('Segment 1:'));
  assert.ok(line.endsWith('…'), line);
  assert.equal(line.length, 'Segment 1: '.length + 81);
});

test('--json on a memory gives totals and the problem segments with their issues', (t) => {
  const dir = folder(t);
  put(dir, 'm.tsv', GOOD + BAD);
  const r = run(['m.tsv', '--from', 'en', '--to', 'de', '--json'], dir);
  const data = JSON.parse(r.stdout);
  assert.equal(r.status, 1);
  assert.deepEqual([data.ok, data.segments, data.errors, data.warnings], [false, 2, 1, 0]);
  assert.equal(data.problems.length, 1);
  assert.equal(data.problems[0].segment, 2);
  assert.deepEqual(
    { type: data.problems[0].issues[0].type, source: data.problems[0].issues[0].source, target: data.problems[0].issues[0].target },
    { type: 'changed', source: '12', target: '21' },
  );
});

test('a memory with nothing readable in it says how to lay it out, and exits 2', (t) => {
  const dir = folder(t);
  put(dir, 'empty.tsv', '');
  const r = run(['empty.tsv'], dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /No segment pairs found\. For \.tmx say which languages with --from and --to/);
});

test('a missing file is a plain message and exit 2, never a stack trace', (t) => {
  const dir = folder(t);
  const memory = run(['nothere.tsv'], dir);
  assert.equal(memory.status, 2);
  assert.match(memory.stderr, /^Could not read the file: ENOENT/);
  assert.doesNotMatch(memory.stderr, /\n\s+at /);
  put(dir, 'b.txt', 'text');
  const pair = run(['nothere.txt', 'b.txt'], dir);
  assert.equal(pair.status, 2);
  assert.match(pair.stderr, /^Could not read the files: ENOENT/);
});

test('two files: a changed number and a changed company name fail; --names adds warnings about plain names', (t) => {
  const dir = folder(t);
  put(dir, 'a.txt', 'Contact Acme Corp on 12 May.');
  put(dir, 'b.txt', 'Kontaktieren Sie Zeta GmbH am 13. Mai.');
  const plain = run(['a.txt', 'b.txt', '--from', 'en', '--to', 'de'], dir);
  assert.equal(plain.status, 1);
  assert.match(plain.stdout, /^FAIL  2 problems found/);
  assert.match(plain.stdout, /Changed company name: "Contact Acme Corp" became "Kontaktieren Sie Zeta GmbH"/);
  assert.match(plain.stdout, /Changed number: "12" became "13"/);
  assert.doesNotMatch(plain.stdout, /Warning:/, 'plain names are only looked at when asked for');
  const named = run(['a.txt', 'b.txt', '--from', 'en', '--to', 'de', '--names'], dir);
  assert.match(named.stdout, /^FAIL  2 problems found/, 'warnings are not counted as problems');
  assert.match(named.stdout, /Warning: Name not found in the translation \(it may have been translated\): "May"/);
});

test('two files that agree pass and exit 0; --json carries the same verdict', (t) => {
  const dir = folder(t);
  put(dir, 'a.txt', 'Pay $5,000 by 1 March 2026.');
  put(dir, 'b.txt', 'Zahlen Sie 5.000 $ bis zum 1. März 2026.');
  const r = run(['a.txt', 'b.txt', '--from', 'en', '--to', 'de'], dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^PASS  nothing lost or changed/);
  const j = JSON.parse(run(['a.txt', 'b.txt', '--from', 'en', '--to', 'de', '--json'], dir).stdout);
  assert.equal(j.ok, true);
  assert.deepEqual(j.issues, []);
});

test('--html writes the report for the translator while the screen still shows the verdict', (t) => {
  const dir = folder(t);
  put(dir, 'a.txt', 'Order 12 units.');
  put(dir, 'b.txt', 'Bestellen Sie 21 Einheiten.');
  const r = run(['a.txt', 'b.txt', '--from', 'en', '--to', 'de', '--html', 'report.html'], dir);
  assert.equal(r.status, 1);
  assert.ok(existsSync(join(dir, 'report.html')));
  const html = readFileSync(join(dir, 'report.html'), 'utf8');
  assert.match(html, /<html|<!doctype/i);
  assert.match(html, /12/);
  assert.match(html, /21/);
  assert.match(r.stdout, /^FAIL/);
});

test('paragraph numbers appear in the text report when the files have paragraphs', (t) => {
  const dir = folder(t);
  put(dir, 'a.txt', 'First paragraph has 10 items.\n\nSecond paragraph has 20 items.');
  put(dir, 'b.txt', 'Der erste Absatz hat 10 Artikel.\n\nDer zweite Absatz hat 30 Artikel.');
  const r = run(['a.txt', 'b.txt', '--from', 'en', '--to', 'de'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /\nParagraph 2\n  Changed number: "20" became "30"/);
  assert.doesNotMatch(r.stdout, /Paragraph 1/);
});

test('an unknown option, or the wrong number of files, shows the help and exits 2', (t) => {
  const dir = folder(t);
  put(dir, 'a.txt', 'x');
  assert.equal(run(['--nope'], dir).status, 2);
  const one = run(['a.txt'], dir);
  assert.equal(one.status, 2);
  assert.match(one.stdout, /did every number, date, amount and name survive the translation/);
  assert.equal(run(['--help'], dir).status, 0);
});

test('describe() words each kind of problem in plain language', () => {
  assert.equal(describe({ type: 'changed', label: 'amount', source: '$5', target: '$6' }), 'Changed amount: "$5" became "$6"');
  assert.equal(describe({ type: 'missing', label: 'date', source: '1 March' }), 'Missing from the translation, date: "1 March"');
  assert.equal(describe({ type: 'added', label: 'percentage', target: '5%' }), 'Not in the original, percentage: "5%"');
  assert.equal(describe({ type: 'negation', source: 'says not', target: 'does not' }), 'Possible lost or added "not": the original says not, the translation does not. Check the meaning');
  assert.equal(describe({ type: 'name', label: 'name', source: 'Berlin' }), 'Name not found in the translation (it may have been translated): "Berlin"');
});
