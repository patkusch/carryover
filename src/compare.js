import { extract, strip } from './extract.js';
import { hasNegation } from './negation.js';

const LABEL = { number: 'number', money: 'amount', percent: 'percentage', quantity: 'measurement', date: 'date', email: 'email address', url: 'web address', iban: 'bank account number (IBAN)', phone: 'phone number', id: 'reference', entity: 'company name', name: 'name' };

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

const same = (a, b) => a.kind === b.kind && a.keys.some((k) => b.keys.includes(k));

// Compare the facts of one piece of source with its translation.
// Returns issues: changed (one value turned into another), missing, added, or a name that was not found.
export function compareFacts(source, target, targetText) {
  const issues = [];
  const left = target.filter((f) => f.kind !== 'name');
  const missing = [];
  for (const f of source.filter((x) => x.kind !== 'name')) {
    const i = left.findIndex((t) => same(f, t));
    if (i >= 0) left.splice(i, 1);
    else missing.push(f);
  }
  let added = left;
  // Pair what is missing with what was added when they look like the same fact gone wrong.
  for (const kind of new Set(missing.map((f) => f.kind))) {
    const ms = missing.filter((f) => f.kind === kind);
    const as = added.filter((f) => f.kind === kind);
    const pairs = [];
    if (ms.length === 1 && as.length === 1) pairs.push([ms[0], as[0]]);
    else {
      for (const m of ms) {
        let best = null;
        for (const a of as) {
          if (pairs.some(([, pa]) => pa === a)) continue;
          const d = distance(m.keys[0], a.keys[0]);
          if (d <= Math.max(2, Math.floor(m.keys[0].length / 3)) && (!best || d < best.d)) best = { a, d };
        }
        if (best) pairs.push([m, best.a]);
      }
    }
    for (const [m, a] of pairs) {
      issues.push({ type: 'changed', kind, severity: 'error', source: m.raw, target: a.raw });
      missing.splice(missing.indexOf(m), 1);
      added = added.filter((x) => x !== a);
    }
  }
  for (const f of missing) issues.push({ type: 'missing', kind: f.kind, severity: 'error', source: f.raw });
  for (const f of added) issues.push({ type: 'added', kind: f.kind, severity: 'error', target: f.raw });
  const hay = strip(targetText);
  for (const f of source.filter((x) => x.kind === 'name')) {
    if (!hay.includes(f.keys[0])) issues.push({ type: 'name', kind: 'name', severity: 'warning', source: f.raw });
  }
  return issues;
}

const paragraphs = (t) => t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export function check(sourceText, targetText, { sourceLang, targetLang, names = false, whole = false } = {}) {
  const sp = paragraphs(sourceText), tp = paragraphs(targetText);
  const aligned = !whole && sp.length === tp.length && sp.length > 1;
  const units = aligned ? sp.map((s, i) => [s, tp[i]]) : [[sourceText, targetText]];
  const skipNames = names && /^de/i.test(sourceLang || ''); // German capitalises every noun, so capitals say nothing about names
  if (skipNames) names = false;
  const result = { mode: aligned ? 'paragraphs' : 'whole', units: units.length, issues: [], note: null };
  if (!aligned && !whole && sp.length !== tp.length) {
    result.note = `The two texts have ${sp.length} and ${tp.length} paragraphs, so they were compared as a whole. A swap between paragraphs cannot be caught that way.`;
  }
  if (skipNames) result.note = [result.note, 'Name checking is skipped for German, which capitalises every noun.'].filter(Boolean).join(' ');
  units.forEach(([s, t], i) => {
    const sf = extract(s, { lang: sourceLang, names });
    const tf = extract(t, { lang: targetLang });
    const ns = hasNegation(s, sourceLang), nt = hasNegation(t, targetLang);
    if (ns !== null && nt !== null && ns !== nt) {
      result.issues.push({ type: 'negation', kind: 'negation', severity: 'warning', label: 'negation', paragraph: aligned ? i + 1 : null, source: ns ? 'has a negation' : 'has none', target: nt ? 'has a negation' : 'has none' });
    }
    for (const issue of compareFacts(sf, tf, t)) result.issues.push({ ...issue, label: LABEL[issue.kind], paragraph: aligned ? i + 1 : null });
  });
  result.errors = result.issues.filter((i) => i.severity === 'error').length;
  result.warnings = result.issues.length - result.errors;
  result.ok = result.errors === 0;
  return result;
}

export function describe(issue) {
  const what = issue.label;
  if (issue.type === 'changed') return `Changed ${what}: "${issue.source}" became "${issue.target}"`;
  if (issue.type === 'missing') return `Missing from the translation, ${what}: "${issue.source}"`;
  if (issue.type === 'added') return `Not in the original, ${what}: "${issue.target}"`;
  if (issue.type === 'negation') return `Possible lost or added "not": the original ${issue.source}, the translation ${issue.target}. Check the meaning`;
  return `Name not found in the translation (it may have been translated): "${issue.source}"`;
}
