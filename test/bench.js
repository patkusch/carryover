// Plant errors in correct translations and count how many the checker catches.
// Each fixture is broken one fact at a time: the fact is deleted, or one digit is changed.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check } from '../src/compare.js';
import { extract } from '../src/extract.js';

export function bench() {
  let planted = 0, caught = 0;
  const missed = [];
  for (const f of readdirSync('fixtures').filter((x) => x.endsWith('.json'))) {
    const p = JSON.parse(readFileSync(join('fixtures', f), 'utf8'));
    const facts = extract(p.target, { lang: p.to }).filter((x) => x.kind !== 'name');
    for (const fact of facts) {
      const mutants = [['deleted', p.target.replace(fact.raw, '')]];
      const digit = [...fact.raw].map((c, i) => [c, i]).filter(([c]) => /\d/.test(c)).pop();
      if (digit) {
        const [c, i] = digit;
        mutants.push(['one digit changed', fact.raw.slice(0, i) + String((Number(c) + 1) % 10) + fact.raw.slice(i + 1)].map((v, k) => (k ? p.target.replace(fact.raw, v) : v)));
      }
      for (const [how, text] of mutants) {
        planted++;
        if (!check(p.source, text, { sourceLang: p.from, targetLang: p.to }).ok) caught++;
        else missed.push(`${f}: ${how} ${fact.kind} "${fact.raw}"`);
      }
    }
  }
  return { planted, caught, missed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = bench();
  console.log(`Planted ${r.planted} errors in correct translations; caught ${r.caught}.`);
  for (const m of r.missed) console.log(`  missed: ${m}`);
  process.exit(r.caught === r.planted ? 0 : 1);
}
