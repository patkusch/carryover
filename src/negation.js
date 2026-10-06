// A dropped "not" changes the meaning and leaves every number intact, so look for it separately.
// Only a warning: it says "check this", never "this is wrong". Needs the language to be known.
const WORDS = {
  en: /\b(?:not|no|never|none|neither|nor|without|cannot|\w+n't)\b/i,
  de: /\b(?:nicht|kein\w*|nie|niemals|ohne|nichts|weder)\b/i,
  fr: /\b(?:pas|jamais|sans|aucun\w*|rien|non)\b/i,
  es: /\b(?:no|nunca|jamás|sin|ningún|ninguna?o?|nada|ni)\b/i,
  it: /\b(?:non|mai|senza|nessun\w*|niente)\b/i,
  pt: /\b(?:não|nunca|jamais|sem|nenhum\w*|nada)\b/i,
  nl: /\b(?:niet|geen|nooit|zonder)\b/i,
};

export const hasNegation = (text, lang) => {
  const re = WORDS[(lang || '').slice(0, 2).toLowerCase()];
  return re ? re.test(text) : null; // null: language unknown, cannot say
};
