#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { check, describe } from '../src/compare.js';
import { parseTmx, parseTsv } from '../src/tm.js';

const args = process.argv.slice(2);
const opt = { files: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--help' || a === '-h') opt.help = true;
  else if (a === '--names') opt.names = true;
  else if (a === '--whole') opt.whole = true;
  else if (a === '--json') opt.json = true;
  else if (a === '--from') opt.from = args[++i];
  else if (a === '--to') opt.to = args[++i];
  else if (a.startsWith('--')) { console.error(`Unknown option ${a}. Try --help.`); process.exit(2); }
  else opt.files.push(a);
}
const memory = opt.files.length === 1 && /\.(tmx|tsv)$/i.test(opt.files[0]);
if (opt.help || (opt.files.length !== 2 && !memory)) {
  console.log(`carryover: did every number, date, amount and name survive the translation?

  carryover memory.tmx|memory.tsv [--from en] [--to de]   check every segment pair of a translation memory
  carryover original.txt translation.txt [--from en] [--to de] [--names] [--whole] [--json]

  --from, --to   languages, so 1,234 is read the right way round (en, de, fr, es, it, pt ...)
  --names        also look for people and place names (a warning, not an error)
  --whole        compare the two texts as one block, not paragraph by paragraph
  --json         machine-readable result

Exit code 0 if nothing was lost or changed, 1 if something was, 2 if it could not run.`);
  process.exit(opt.help ? 0 : 2);
}
let result;
if (memory) {
  let pairs;
  try {
    const raw = readFileSync(opt.files[0], 'utf8');
    pairs = /\.tmx$/i.test(opt.files[0]) ? parseTmx(raw, opt.from, opt.to) : parseTsv(raw, opt.from, opt.to);
  } catch (e) { console.error(`Could not read the file: ${e.message}`); process.exit(2); }
  if (!pairs.length) { console.error('No segment pairs found. For .tmx say which languages with --from and --to; for .tsv put the source and the translation on each line, separated by a tab.'); process.exit(2); }
  const bad = [];
  pairs.forEach((p, n) => {
    const r = check(p.source, p.target, { sourceLang: p.from, targetLang: p.to, names: opt.names, whole: true });
    if (r.issues.length) bad.push({ segment: n + 1, source: p.source, ...r });
  });
  const errors = bad.reduce((n, b) => n + b.errors, 0), warnings = bad.reduce((n, b) => n + b.warnings, 0);
  if (opt.json) console.log(JSON.stringify({ ok: errors === 0, segments: pairs.length, errors, warnings, problems: bad }, null, 2));
  else {
    console.log(`${errors ? 'FAIL' : 'PASS'}  ${pairs.length} segments checked, ${errors} problem${errors === 1 ? '' : 's'}${warnings ? `, ${warnings} warning(s)` : ''}`);
    for (const b of bad) {
      console.log(`\nSegment ${b.segment}: ${b.source.slice(0, 80)}${b.source.length > 80 ? '…' : ''}`);
      for (const i of b.issues) console.log(`  ${i.severity === 'warning' ? 'Warning: ' : ''}${describe(i)}`);
    }
  }
  process.exit(errors ? 1 : 0);
}
try {
  const [s, t] = opt.files.map((f) => readFileSync(f, 'utf8'));
  result = check(s, t, { sourceLang: opt.from, targetLang: opt.to, names: opt.names, whole: opt.whole });
} catch (e) {
  console.error(`Could not read the files: ${e.message}`);
  process.exit(2);
}
if (opt.json) console.log(JSON.stringify(result, null, 2));
else {
  console.log(result.ok ? `PASS  nothing lost or changed${result.warnings ? `, ${result.warnings} warning(s)` : ''}` : `FAIL  ${result.errors} problem${result.errors === 1 ? '' : 's'} found`);
  if (result.note) console.log(`Note: ${result.note}`);
  let current;
  for (const i of result.issues) {
    if (i.paragraph !== current) { current = i.paragraph; if (current) console.log(`\nParagraph ${current}`); }
    console.log(`  ${i.severity === 'warning' ? 'Warning: ' : ''}${describe(i)}`);
  }
}
process.exit(result.ok ? 0 : 1);
