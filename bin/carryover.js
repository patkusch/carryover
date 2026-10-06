#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { check, describe } from '../src/compare.js';

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
if (opt.help || opt.files.length !== 2) {
  console.log(`carryover: did every number, date, amount and name survive the translation?

  carryover original.txt translation.txt [--from en] [--to de] [--names] [--whole] [--json]

  --from, --to   languages, so 1,234 is read the right way round (en, de, fr, es, it, pt ...)
  --names        also look for people and place names (a warning, not an error)
  --whole        compare the two texts as one block, not paragraph by paragraph
  --json         machine-readable result

Exit code 0 if nothing was lost or changed, 1 if something was, 2 if it could not run.`);
  process.exit(opt.help ? 0 : 2);
}
let result;
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
