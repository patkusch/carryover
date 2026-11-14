import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('--version prints the name and the number from package.json, then stops', () => {
  const want = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const r = spawnSync('node', ['bin/carryover.js', '--version'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), `carryover ${want}`);
});

test('an unknown option is refused with a hint, not ignored', () => {
  const r = spawnSync('node', ['bin/carryover.js', '--nope', 'a.txt', 'b.txt'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown option --nope\. Try --help\./);
});

test('--help explains what the tool does and exits cleanly', () => {
  const r = spawnSync('node', ['bin/carryover.js', '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /did every number, date, amount and name survive the translation/);
});
