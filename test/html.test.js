import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../src/compare.js';
import { toHtml } from '../src/html.js';

test('a report with a lost amount says Fail and names the problem', () => {
  const html = toHtml(check('Pay 100 EUR on time', 'Zahlen Sie 200 EUR rechtzeitig', { sourceLang: 'en', targetLang: 'de' }));
  assert.match(html, /<strong>Fail<\/strong>/);
  assert.match(html, /<table>/);
  assert.ok(html.includes('100 EUR'));
});

test('a clean report says Pass and that nothing was lost', () => {
  const html = toHtml(check('Pay 100 EUR on time', 'Zahlen Sie 100 EUR rechtzeitig', { sourceLang: 'en', targetLang: 'de' }));
  assert.match(html, /<strong>Pass<\/strong>/);
  assert.match(html, /Nothing was lost or changed/);
  assert.ok(!html.includes('<table>'));
});

test('a title containing markup is escaped, not run', () => {
  const html = toHtml(check('a', 'a'), { title: '<script>alert(1)</script> & "co"' });
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;co&quot;'));
});

test('the page is a complete document', () => {
  const html = toHtml(check('a', 'a'));
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('</html>'));
});
