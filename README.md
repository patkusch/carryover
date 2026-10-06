# Carryover

Did every number, date, amount and name survive the translation?

A translation can read perfectly and still turn $500,000 into $50,000. Carryover finds the facts in the original, finds the facts in the translation, and tells you which ones were lost, changed or invented. It does not translate and it does not judge style.

```bash
node bin/carryover.js contract-en.txt contract-de.txt --from en --to de
```

```
FAIL  2 problems found

Paragraph 1
  Changed amount: "$500,000" became "50.000 $"
Paragraph 3
  Missing from the translation, date: "31 December 2027"
```

It needs Node 20 or newer. No install, no account, no key, no model. Nothing leaves your computer. Exit code 0 means nothing was lost or changed, 1 means something was.

## What it checks

| Fact | Notes |
|---|---|
| Numbers and percentages | `12,450.50` and `12.450,50` are the same number; `1,234` is read by the language you give it |
| Amounts | the value and the currency: `$`, `€`, `£`, `R$`, `USD`, `euros`... |
| Dates | `6 October 2026`, `6. Oktober 2026`, `06.10.2026`, `10 de mayo de 2026` and more, in English, German, French, Spanish, Italian, Portuguese and Dutch |
| Ambiguous dates | `03/04/2026` matches either reading, but not a date that neither reading allows |
| Emails, web addresses, phone numbers, bank accounts (IBAN), references like `INV-2026-0042` | must match exactly |
| Company names | the words before GmbH, Ltd, S.L., SARL, B.V. and similar |
| People and place names | only with `--names`, and only as a warning, because names are often translated |

When the two texts have the same number of paragraphs, each paragraph is compared with its partner. That catches two amounts being swapped. If the paragraph counts differ, the texts are compared as a whole and Carryover says so.

## How well does it work?

`npm run bench` takes six correct translations (English↔German, French, Spanish, Portuguese), breaks them one fact at a time, either by deleting it or by changing one digit, and counts what the checker catches. Today that is **89 of 89**.

That number is a floor on honesty, not a promise. The six texts were written for this tool, the errors are planted by a script, and real mistranslations are stranger. Treat it as proof that the basic checks work, not as an accuracy rating.

## What it cannot see

These are pinned in the tests so this list stays true:

- **A lost "not".** "The seller is not liable" and "The seller is liable" have the same facts.
- **Numbers written as words.** "five hundred" against "fifty" passes.
- **Units.** "5 km" against "5 m" passes. Only currencies and percent signs are read.
- **Meaning.** A wrong word that contains no number, date or name is invisible to it.
- **Facts moved to another paragraph** when the paragraphs line up, which shows up as a false alarm.
- **Languages beyond the ones listed** for month names. Numbers, amounts and references work in any language written with the same digits.
- **Number format guesses without `--from` and `--to`.** `1,234` is read as 1234 unless the language says otherwise.

Use it as a safety net next to a human reviewer, not instead of one.

## Options

| Option | What it does |
|---|---|
| `--from en --to de` | the two languages, so number formats are read the right way round |
| `--names` | also compare people and place names (skipped for German source text, which capitalises every noun) |
| `--whole` | compare as one block even if the paragraphs line up |
| `--json` | machine-readable result, for use in a pipeline |

## Tests

```bash
npm test
```

CI runs them on Node 20, 22 and 24.

## Licence

MIT
