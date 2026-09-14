import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const projectRoot = new URL('../', import.meta.url);

test('visual theme uses the ivory and sage palette', async () => {
  const css = await readFile(new URL('styles.css', projectRoot), 'utf8');
  assert.match(css, /--bg:\s*#f6f5ef;/i);
  assert.match(css, /--surface:\s*#fffdf9;/i);
  assert.match(css, /--sage:\s*#7e9f84;/i);
  assert.match(css, /--sage-soft:\s*#dde9df;/i);
  assert.match(css, /font-family:\s*['"]?Yasashisa Gothic['"]?/i);
  assert.match(css, /\.sidebar\s*\{[^}]*position:\s*fixed/s);
  assert.doesNotMatch(css, /--rose:\s*#b97886;/i);
});

test('app shell exposes the redesign navigation and dashboard hooks', async () => {
  const app = await readFile(new URL('src/app.js', projectRoot), 'utf8');
  assert.match(app, /\['vehicle','vehicle','車両費'\]/);
  assert.match(app, /vehicle: vehicleView/);
  assert.match(app, /class="brand-mark">\$\{lineIcon\('leaf'\)\}/);
  assert.match(app, /class="topbar"/);
  assert.match(app, /data-global-search/);
  assert.match(app, /今月売上/);
  assert.match(app, /概算利益/);
  assert.match(app, /積立目安/);
  assert.match(app, /最近の経費/);
  assert.match(app, /今月の入力状況/);
  assert.match(app, /data-input-donut/);
});

test('month picker is styled through the shared UI stylesheet instead of inline styles', async () => {
  const app = await readFile(new URL('src/app.js', projectRoot), 'utf8');
  const css = await readFile(new URL('styles.css', projectRoot), 'utf8');
  assert.match(app, /class="month-picker"/);
  assert.match(css, /\.month-picker\s*\{/);
});

test('forms keep stable data names and use shared layout classes', async () => {
  const app = await readFile(new URL('src/app.js', projectRoot), 'utf8');
  for (const name of ['date', 'amount', 'tip', 'location', 'memo', 'description', 'merchant', 'category', 'paymentMethod', 'businessRatio', 'receipt', 'businessStartDate', 'reserveRate', 'vehicleDefaultRatio', 'businessName']) {
    assert.match(app, new RegExp(`name="${name}"`));
  }
  for (const id of ['sale-form', 'expense-form', 'csv-file', 'apply-import', 'clear-import', 'download-backup', 'restore-backup', 'settings-form']) {
    assert.match(app, new RegExp(`id="${id}"`));
  }
  assert.match(app, /id="sale-date"/);
  assert.match(app, /id="expense-date"/);
  assert.match(app, /const forAttribute = id \? ` for="\$\{id\}"`/);
  assert.match(app, /class="field-help"/);
  assert.match(app, /class="form-actions"/);
  assert.doesNotMatch(app, /style="(?:justify-content|grid-column|width:72px|margin-bottom)/);
});
