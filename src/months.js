// Month names in the languages we read, mapped to 1-12. Matching ignores case.
const TABLE = {
  1: ['january', 'jan', 'januar', 'jänner', 'janvier', 'janv', 'enero', 'ene', 'gennaio', 'janeiro', 'januari'],
  2: ['february', 'feb', 'februar', 'février', 'févr', 'febrero', 'febbraio', 'fevereiro', 'februari'],
  3: ['march', 'mar', 'märz', 'mär', 'mars', 'marzo', 'março', 'maart'],
  4: ['april', 'apr', 'avril', 'avr', 'abril', 'aprile'],
  5: ['may', 'mai', 'mayo', 'maggio', 'maio', 'mei'],
  6: ['june', 'jun', 'juni', 'juin', 'junio', 'giugno', 'junho'],
  7: ['july', 'jul', 'juli', 'juillet', 'juil', 'julio', 'luglio', 'julho'],
  8: ['august', 'aug', 'août', 'agosto', 'ago', 'augustus'],
  9: ['september', 'sep', 'sept', 'septembre', 'septiembre', 'setiembre', 'settembre', 'setembro'],
  10: ['october', 'oct', 'oktober', 'okt', 'octobre', 'octubre', 'ottobre', 'outubro'],
  11: ['november', 'nov', 'novembre', 'noviembre', 'novembro'],
  12: ['december', 'dec', 'dezember', 'dez', 'décembre', 'déc', 'diciembre', 'dic', 'dicembre', 'dezembro'],
};

const plain = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
export const MONTH = new Map(); // keys have accents removed
for (const [n, names] of Object.entries(TABLE)) for (const name of names) MONTH.set(plain(name), Number(n));

// Longest names first so "septiembre" is not read as "sep".
export const MONTH_SRC = Object.values(TABLE).flat().sort((a, b) => b.length - a.length).join('|');
