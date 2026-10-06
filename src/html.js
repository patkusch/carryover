import { describe } from './compare.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A single page you can send to a translator or a client.
export function toHtml(result, { title = 'Carryover report' } = {}) {
  const rows = result.issues.map((i) => `<tr class="${i.severity}"><td>${i.paragraph ? `Paragraph ${i.paragraph}` : ''}</td><td>${i.severity}</td><td>${esc(describe(i))}</td></tr>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem}h1{font-size:1.4rem}
.pass{color:#1a7f37}.fail{color:#b3261e}table{border-collapse:collapse;width:100%}td{border-top:1px solid #ccc;padding:.5rem;vertical-align:top}
tr.warning td:nth-child(2){color:#9a6700}tr.error td:nth-child(2){color:#b3261e}@media(prefers-color-scheme:dark){body{background:#1c1a18;color:#ece7df}td{border-color:#444}}</style></head>
<body><h1>${esc(title)}</h1>
<p class="${result.ok ? 'pass' : 'fail'}"><strong>${result.ok ? 'Pass' : 'Fail'}</strong>: ${result.errors} problem(s), ${result.warnings} warning(s), compared ${result.mode === 'paragraphs' ? `${result.units} paragraphs one by one` : 'as one block'}.</p>
${result.note ? `<p>${esc(result.note)}</p>` : ''}
${rows ? `<table>${rows}</table>` : '<p>Nothing was lost or changed.</p>'}
<p><small>Checked with Carryover. It finds lost or changed numbers, dates, amounts and names. It cannot judge meaning or style.</small></p></body></html>
`;
}
