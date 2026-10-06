// Pull the facts out of a text: numbers, amounts, dates, references, contacts, company names.
// Each fact has a kind and one or more canonical keys. Two facts match when their kinds
// are equal and any key is shared, so "1.250" and "1,250" are the same fact once
// the language is known, and an ambiguous date like 03/04/2026 matches either reading.
import { MONTH, MONTH_SRC } from './months.js';

const DECIMAL_COMMA = new Set(['de', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'pl', 'cs', 'sv', 'da', 'fi', 'tr', 'id', 'ro', 'hu', 'nb', 'no', 'uk', 'el', 'bg', 'sk', 'sl', 'hr']);
const DECIMAL_DOT = new Set(['en', 'ja', 'zh', 'ko', 'he', 'th', 'hi']);

// A number as written: optional minus, thousands groups, optional decimals.
const NUM = String.raw`(?:[-−](?=\d))?(?:\d{1,3}(?:[  ',. ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)`;
const BEFORE = String.raw`(?<![\p{L}\d.,])`;
const CUR = String.raw`(?:US\$|R\$|\$|€|£|¥|₹|₦|USD|EUR|GBP|CHF|JPY|CAD|AUD|CNY|INR|BRL|MXN|NGN|ZAR|SEK|NOK|DKK|PLN|euros?|dollars?|dólar(?:es)?)`;
const CODE = { 'us$': 'USD', 'r$': 'BRL', $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR', '₦': 'NGN', euro: 'EUR', euros: 'EUR', dollar: 'USD', dollars: 'USD', dólar: 'USD', dólares: 'USD' };
const currencyCode = (c) => CODE[c.toLowerCase()] || c.toUpperCase();

// "5 million" and "5 Mio." must be the same amount, and "5 billion" must not be.
const SCALE = String.raw`(?:millions?|Millionen?|millón|millones|milhão|milhões|milione|milioni|Mio\.?|Mill\.?|milliards?|Milliarden?|Mrd\.?|billions?|bilhão|bilhões|thousand|mil millones)`;
const SCALE_VALUE = (w) => { const x = w.toLowerCase().replace(/\.$/, ''); return /^(mil millones|milliards?|milliarden?|mrd|billions?|bilh)/.test(x) ? 1e9 : /^thousand/.test(x) ? 1e3 : 1e6; };

const SUFFIXES = ['GmbH', 'AG', 'KG', 'UG', 'e\\.K\\.', 'Ltd\\.?', 'Limited', 'LLC', 'LLP', 'Inc\\.?', 'Corp\\.?', 'PLC', 'S\\.A\\.S\\.', 'S\\.A\\.', 'S\\.L\\.', 'SARL', 'S\\.r\\.l\\.', 'SRL', 'B\\.V\\.', 'N\\.V\\.', 'Pty', 'Ltda\\.?', 'SpA', 'S\\.p\\.A\\.', 'A\\/S']
  .sort((a, b) => b.length - a.length);
const DETERMINERS = new Set(['der', 'die', 'das', 'den', 'dem', 'the', 'le', 'la', 'les', 'el', 'los', 'las', 'il', 'lo', 'de', 'het', 'o', 'a', 'os', 'as']);

const strip = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Turn "12.450,50", "12,450.50", "12 450,50" into "12450.5". Returns the canonical string.
export function canonicalNumber(raw, lang) {
  let s = raw.replace(/[−]/g, '-');
  const sign = s.startsWith('-') ? '-' : '';
  s = s.replace(/^-/, '').replace(/[  ' ]/g, '');
  const hasDot = s.includes('.'), hasComma = s.includes(',');
  const l = (lang || '').slice(0, 2).toLowerCase();
  const decimalChar = DECIMAL_COMMA.has(l) ? ',' : DECIMAL_DOT.has(l) ? '.' : null;
  if (hasDot && hasComma) {
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    s = s.split(dec === '.' ? ',' : '.').join('').replace(dec, '.');
  } else if (hasDot || hasComma) {
    const c = hasDot ? '.' : ',';
    const parts = s.split(c);
    const last = parts[parts.length - 1];
    let decimal;
    if (parts.length > 2) decimal = false; // 1.000.000 is thousands
    else if (last.length !== 3) decimal = true; // 12,5 is a decimal
    else decimal = decimalChar ? c === decimalChar : false; // 1,234: the language decides, else thousands
    s = decimal ? parts.join('.') : parts.join('');
  }
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  s = s.replace(/^0+(?=\d)/, '');
  return sign + s;
}

const isoOf = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const validDay = (m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31;

export function extract(text, { lang, names = false } = {}) {
  let work = text;
  const facts = [];
  const take = (re, make) => {
    work = work.replace(re, (...m) => {
      const f = make(m);
      if (!f) return m[0];
      facts.push({ ...f, raw: m[0].trim() });
      return ' '.repeat(m[0].length);
    });
  };

  take(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (m) => ({ kind: 'email', keys: [m[0].toLowerCase()] }));
  take(/(?:https?:\/\/|www\.)[^\s<>"')\]]*[^\s<>"')\].,;:!?]/gi, (m) => ({ kind: 'url', keys: [m[0].toLowerCase().replace(/\/$/, '')] }));
  take(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g, (m) => ({ kind: 'iban', keys: [m[0].replace(/ /g, '')] }));
  take(/(?<![\d\p{L}])\+\d[\d  ()-]{6,}\d/gu, (m) => ({ kind: 'phone', keys: ['+' + m[0].replace(/\D/g, '')] }));
  take(/(?<![\p{L}\d])(?!(?:USD|EUR|GBP|CHF|JPY|CAD|AUD)\d)\p{Lu}{1,6}[-/]?\d[\p{L}\d\-/]*(?![\p{L}\d])/gu, (m) => ({ kind: 'id', keys: [m[0]] }));

  // Dates, most specific first. Each one is read into year-month-day keys.
  take(/(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?!\d)/g, (m) => (validDay(+m[2], +m[3]) ? { kind: 'date', keys: [isoOf(m[1], m[2], m[3])] } : null));
  take(/(?<![\d.,/-])(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?!\d)/g, (m) => {
    const [a, b, y] = [+m[1], +m[2], m[3]];
    if (a > 12 && validDay(b, a)) return { kind: 'date', keys: [isoOf(y, b, a)] };
    if (b > 12 && validDay(a, b)) return { kind: 'date', keys: [isoOf(y, a, b)] };
    if (!validDay(b, a) && !validDay(a, b)) return null;
    return { kind: 'date', keys: [...new Set([isoOf(y, b, a), isoOf(y, a, b)])] }; // day-first or month-first: cannot tell
  });
  const month = (name) => MONTH.get(strip(name).replace(/\.$/, ''));
  take(new RegExp(String.raw`(?<![\d\p{L}])(\d{1,2})(?:st|nd|rd|th|er|º|\.)?\s+(?:de\s+|of\s+|d')?(${MONTH_SRC})\.?,?\s+(?:de\s+)?(\d{4})(?!\d)`, 'giu'),
    (m) => { const mo = month(m[2]); return mo && validDay(mo, +m[1]) ? { kind: 'date', keys: [isoOf(m[3], mo, m[1])] } : null; });
  take(new RegExp(String.raw`(?<![\p{L}])(${MONTH_SRC})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?!\d)`, 'giu'),
    (m) => { const mo = month(m[1]); return mo && validDay(mo, +m[2]) ? { kind: 'date', keys: [isoOf(m[3], mo, m[2])] } : null; });
  take(new RegExp(String.raw`(?<![\p{L}])(${MONTH_SRC})\.?\s+(?:de\s+)?(\d{4})(?!\d)`, 'giu'),
    (m) => { const mo = month(m[1]); return mo ? { kind: 'date', keys: [`${m[2]}-${String(mo).padStart(2, '0')}`] } : null; });

  // Company names: capitalised words in front of a legal ending such as GmbH or Ltd.
  take(new RegExp(String.raw`((?:(?:\p{Lu}[\p{L}'’-]*|&)\s+){1,4})(${SUFFIXES.join('|')})(?![\p{L}])`, 'gu'), (m) => {
    const words = m[1].trim().split(/\s+/);
    while (words.length > 1 && DETERMINERS.has(strip(words[0]))) words.shift();
    return { kind: 'entity', keys: [strip(words.join(' ')) + ' ' + strip(m[2]).replace(/[.\s/]/g, '')] };
  });

  const scaled = (n, w) => String(Number(canonicalNumber(n, lang)) * SCALE_VALUE(w));
  take(new RegExp(`(${CUR})\\s?(${NUM})\\s?(${SCALE})(?![\\p{L}])`, 'giu'), (m) => ({ kind: 'money', keys: [`${currencyCode(m[1])}:${scaled(m[2], m[3])}`] }));
  take(new RegExp(`${BEFORE}(${NUM})\\s?(${SCALE})\\s?(${CUR})(?![\\p{L}])`, 'giu'), (m) => ({ kind: 'money', keys: [`${currencyCode(m[3])}:${scaled(m[1], m[2])}`] }));
  take(new RegExp(`${BEFORE}(${NUM})\\s?(${SCALE})(?![\\p{L}])`, 'giu'), (m) => ({ kind: 'number', keys: [scaled(m[1], m[2])] }));
  take(new RegExp(`(${CUR})\\s?(${NUM})(?!\\d)`, 'giu'), (m) => ({ kind: 'money', keys: [`${currencyCode(m[1])}:${canonicalNumber(m[2], lang)}`] }));
  take(new RegExp(`${BEFORE}(${NUM})\\s?(${CUR})(?![\\p{L}])`, 'giu'), (m) => ({ kind: 'money', keys: [`${currencyCode(m[2])}:${canonicalNumber(m[1], lang)}`] }));
  take(new RegExp(`${BEFORE}(${NUM})\\s?(?:%|percent|per cent|por ciento|por cento|per cento|pour cent|Prozent|procent)`, 'giu'), (m) => ({ kind: 'percent', keys: [canonicalNumber(m[1], lang)] }));
  take(new RegExp(`${BEFORE}(${NUM})\\s?(km/h|mph|km²|m²|m³|°C|°F|kWh|kHz|km|cm|mm|kg|mg|ml|cl|kW|MW|MB|GB|TB|Hz|m|g|l)(?![\\p{L}\\d])`, 'gu'), (m) => ({ kind: 'quantity', keys: [canonicalNumber(m[1], lang) + ' ' + m[2]] }));
  take(new RegExp(`${BEFORE}(${NUM})`, 'gu'), (m) => ({ kind: 'number', keys: [canonicalNumber(m[1], lang)] }));

  if (names) {
    for (const m of work.matchAll(/\p{Lu}[\p{L}'’-]+(?:[ \u00a0]\p{Lu}[\p{L}'’-]+)*/gu)) {
      const before = work.slice(0, m.index).trimEnd();
      if (!before || /[.!?:¿¡]$/.test(before) || /\n\s*$/.test(work.slice(0, m.index))) continue; // a capital at the start of a sentence proves nothing
      if (/^\p{Lu}{1,4}$/u.test(m[0])) continue; // short acronyms (VAT, US) are translated, not carried over
      facts.push({ kind: 'name', keys: [strip(m[0])], raw: m[0] });
    }
  }
  return facts;
}

export { strip };
