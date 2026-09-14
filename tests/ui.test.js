import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const projectRoot = new URL('../', import.meta.url);

test('visual theme uses the warm rose palette for the personal ledger UI', async () => {
  const css = await readFile(new URL('styles.css', projectRoot), 'utf8');
  assert.match(css, /--rose:\s*#b97886;/);
  assert.match(css, /--paper:\s*#fffdfc;/);
  assert.match(css, /--canvas:\s*#f8f3f1;/);
  assert.match(css, /\.sidebar\s*\{[^}]*background:\s*linear-gradient\(180deg,\s*#f3e8e5/s);
});

test('month picker is styled through the shared UI stylesheet instead of inline styles', async () => {
  const app = await readFile(new URL('src/app.js', projectRoot), 'utf8');
  const css = await readFile(new URL('styles.css', projectRoot), 'utf8');
  assert.match(app, /class="month-picker"/);
  assert.match(css, /\.month-picker\s*\{/);
});
