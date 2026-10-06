// Read segment pairs from a translation memory export: .tmx (the standard) or .tsv (source<TAB>target).
const decode = (s) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&').trim();

export function parseTmx(xml, from, to) {
  const pairs = [];
  for (const tu of xml.matchAll(/<tu\b[\s\S]*?<\/tu>/g)) {
    const segs = new Map();
    for (const tuv of tu[0].matchAll(/<tuv\b[^>]*?(?:xml:)?lang="([^"]+)"[^>]*>[\s\S]*?<seg>([\s\S]*?)<\/seg>/g)) {
      segs.set(tuv[1].slice(0, 2).toLowerCase(), decode(tuv[2]));
    }
    const langs = [...segs.keys()];
    const a = (from || langs[0] || '').slice(0, 2).toLowerCase(), b = (to || langs[1] || '').slice(0, 2).toLowerCase();
    if (segs.has(a) && segs.has(b)) pairs.push({ source: segs.get(a), target: segs.get(b), from: a, to: b });
  }
  return pairs;
}

export function parseTsv(text, from, to) {
  return text.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.includes('\t'))
    .map((l) => { const [source, target] = l.split('\t'); return { source, target, from, to }; });
}
