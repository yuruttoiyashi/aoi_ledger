# 青色帳簿 UI/UX リデザイン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の保存形式・会計計算・CSV処理を維持したまま、青色帳簿をアイボリー × セージのPC向け会計ダッシュボードへリデザインする。

**Architecture:** 現行の依存関係なしのブラウザSPA、`appShell`から各ルートを文字列レンダリングする構成、既存のlocalStorage/IndexedDB/ドメインモジュールを維持する。表示専用の月次入力状況・日別推移だけを純粋関数へ切り出し、`src/app.js` はシェル、画面、イベント接続の責務に集中させる。会計ドメイン・CSV・保存モジュールへ新しい保存契約を持ち込まない。

**Tech Stack:** Vanilla JavaScript ES modules、HTML template strings、CSS、Node.js built-in test runner、既存のNode-only build/dev server。

**Spec:** `docs/superpowers/specs/2026-09-14-aoi-ledger-ui-redesign-design.md`

## Global Constraints

- localStorageキーは `aoi-ledger-state-v1` のままにする。
- レシート用IndexedDBのDB名は `aoi-ledger-receipts`、object store名は `receipts` のままにする。
- バックアップJSONは `version: 1`、`state`、`receipts` 構造のままにする。
- `src/domain/accounting.js`、`src/domain/csv.js`、`src/storage.js` はUI変更に不要な限り編集しない。
- `buildJournal`、`expenseBusinessAmount`、`monthlySummary` の会計計算と仕訳ルールを変更しない。
- 既存CSVのヘッダー、列の意味、BOM付き出力、インポートの解釈を変更しない。
- 画面の主役は `#F6F5EF` 前後のアイボリーと `#7E9F84` 前後のセージにする。
- 1440×900を基準にし、1024px前後ではKPIを2列、下段を1列にして崩れを防ぐ。
- 実データがない箇所にサンプル金額、乱数、ダミー会計データを表示しない。
- 文字フォントは `Yasashisa Gothic`, `Noto Sans JP`, `Yu Gothic`, `Hiragino Sans`, `sans-serif` の順にする。
- 変更は小さなコミット単位で進め、各タスクのテストまたはチェック結果を確認してから次へ進む。

## File Map

- Modify: `tests/ui.test.js` — 新しいビジュアルトークン、シェル、主要導線を検査するUIソーステスト。
- Create: `tests/ui-metrics.test.js` — 実データからの入力状況と日別推移の純粋関数テスト。
- Create: `src/ui/metrics.js` — 月の日数、入力日数、レシート数、日別合計を算出する表示専用関数。
- Modify: `styles.css` — アイボリー × セージのトークン、固定サイドバー、トップバー、パネル、フォーム、表、進捗表示、1024px対応。
- Modify: `src/app.js` — 共通シェル、ナビゲーション、検索、車両費ビュー、ダッシュボード構成、フォームと表のHTMLを更新。既存保存・会計・CSVハンドラの意味は維持。
- Modify: `index.html` — アプリの説明メタデータとタイトルを確認し、既存のmodule読み込みを維持。
- Generated: `dist/` — `npm run build` で `src/`、`styles.css`、`index.html` を反映。
- Unchanged by design: `src/domain/accounting.js`、`src/domain/csv.js`、`src/storage.js`、`tests/accounting.test.js`、`tests/csv.test.js`、`tests/tooling.test.js`、`package.json` の既存スクリプト。

---

### Task 1: 実データ表示ヘルパーをTDDで追加する

**Files:**
- Create: `tests/ui-metrics.test.js`
- Create: `src/ui/metrics.js`

**Interfaces:**
- Produces `monthInputStats(sales, expenses, month)` returning `{ daysInMonth, recordedDays, saleDays, expenseDays, expenseCount, receiptCount, recordedPercent, salesPercent, expensePercent, receiptPercent }`.
- Produces `dailyTotals(records, month, amountOf)` returning a number array whose length is the number of days in `month`.

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyTotals, monthInputStats } from '../src/ui/metrics.js';

test('monthInputStats counts real dates, expenses, and receipts', () => {
  const sales = [
    { date: '2026-09-02', amount: 26000, tip: 0 },
    { date: '2026-09-02', amount: 12000, tip: 500 },
  ];
  const expenses = [
    { date: '2026-09-02', amount: 2400, receiptId: 'receipt-1' },
    { date: '2026-09-10', amount: 980, receiptId: null },
  ];

  assert.deepEqual(monthInputStats(sales, expenses, '2026-09'), {
    daysInMonth: 30,
    recordedDays: 2,
    saleDays: 1,
    expenseDays: 2,
    expenseCount: 2,
    receiptCount: 1,
    recordedPercent: 7,
    salesPercent: 3,
    expensePercent: 7,
    receiptPercent: 50,
  });
});

test('monthInputStats returns zero progress for an empty month', () => {
  assert.deepEqual(monthInputStats([], [], '2026-02'), {
    daysInMonth: 28,
    recordedDays: 0,
    saleDays: 0,
    expenseDays: 0,
    expenseCount: 0,
    receiptCount: 0,
    recordedPercent: 0,
    salesPercent: 0,
    expensePercent: 0,
    receiptPercent: 0,
  });
});

test('dailyTotals sums only records in the selected month', () => {
  const totals = dailyTotals(
    [
      { date: '2026-09-02', amount: 1000, tip: 0 },
      { date: '2026-09-02', amount: 1500, tip: 200 },
      { date: '2026-10-02', amount: 9000, tip: 0 },
    ],
    '2026-09',
    (record) => Number(record.amount) + Number(record.tip || 0),
  );

  assert.equal(totals.length, 30);
  assert.deepEqual(totals.slice(0, 3), [0, 2700, 0]);
  assert.equal(totals.reduce((sum, value) => sum + value, 0), 2700);
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node --test tests/ui-metrics.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because `src/ui/metrics.js` does not exist yet.

- [ ] **Step 3: Implement the minimal pure functions**

```js
const daysIn = (month) => {
  const [year, monthNumber] = String(month).split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
};

const inMonth = (record, month) => String(record?.date || '').startsWith(`${month}-`);
const roundedPercent = (value, total) => total > 0 ? Math.round((value / total) * 100) : 0;

export function monthInputStats(sales, expenses, month) {
  const monthSales = sales.filter((record) => inMonth(record, month));
  const monthExpenses = expenses.filter((record) => inMonth(record, month));
  const saleDays = new Set(monthSales.map((record) => record.date)).size;
  const expenseDays = new Set(monthExpenses.map((record) => record.date)).size;
  const recordedDays = new Set([...monthSales, ...monthExpenses].map((record) => record.date)).size;
  const daysInMonth = daysIn(month);
  const receiptCount = monthExpenses.filter((record) => Boolean(record.receiptId)).length;

  return {
    daysInMonth,
    recordedDays,
    saleDays,
    expenseDays,
    expenseCount: monthExpenses.length,
    receiptCount,
    recordedPercent: roundedPercent(recordedDays, daysInMonth),
    salesPercent: roundedPercent(saleDays, daysInMonth),
    expensePercent: roundedPercent(expenseDays, daysInMonth),
    receiptPercent: roundedPercent(receiptCount, monthExpenses.length),
  };
}

export function dailyTotals(records, month, amountOf = (record) => Number(record.amount || 0)) {
  const totals = Array.from({ length: daysIn(month) }, () => 0);
  records.filter((record) => inMonth(record, month)).forEach((record) => {
    const day = Number(String(record.date).slice(-2));
    if (day >= 1 && day <= totals.length) totals[day - 1] += Number(amountOf(record) || 0);
  });
  return totals;
}
```

- [ ] **Step 4: Run the focused and complete tests**

Run: `node --test tests/ui-metrics.test.js`

Expected: 3 tests pass.

Run: `npm test`

Expected: existing 9 tests plus the 3 new display tests pass.

- [ ] **Step 5: Commit the isolated helper**

```bash
git add src/ui/metrics.js tests/ui-metrics.test.js
git commit -m "test: add real data metrics for dashboard"
```

### Task 2: UI契約テストを新しい方向へ先に更新する

**Files:**
- Modify: `tests/ui.test.js`

**Interfaces:**
- Consumes the existing `styles.css` and `src/app.js` source text.
- Produces failing assertions that describe the ivory/sage theme and the new shell/dashboard hooks before production UI changes.

- [ ] **Step 1: Replace the obsolete rose assertions with failing ivory/sage assertions**

Replace the first test with:

```js
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
```

Add this structural test:

```js
test('app shell exposes the redesign navigation and dashboard hooks', async () => {
  const app = await readFile(new URL('src/app.js', projectRoot), 'utf8');
  assert.match(app, /data-route="vehicle"/);
  assert.match(app, /class="topbar"/);
  assert.match(app, /data-global-search/);
  assert.match(app, /今月売上/);
  assert.match(app, /概算利益/);
  assert.match(app, /積立目安/);
  assert.match(app, /最近の経費/);
  assert.match(app, /今月の入力状況/);
  assert.match(app, /data-input-donut/);
});
```

Keep the existing month picker test and update its class assertion only if the class is moved; the picker must remain `class="month-picker"` and be styled by `styles.css`.

- [ ] **Step 2: Run the UI tests to verify the new contract fails**

Run: `node --test tests/ui.test.js`

Expected: the new theme and shell tests fail against the current rose CSS and old `appShell`; the month picker test remains passing.

- [ ] **Step 3: Commit the red UI contract tests**

```bash
git add tests/ui.test.js
git commit -m "test: define ivory sage dashboard ui contract"
```

### Task 3: CSSデザイントークンとPCシェルを実装する

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Consumes the existing class names plus the new `.topbar`, `.dashboard-hero`, `.metric-card`, `.status-card`, `.expense-list`, `.search-box`, `.icon-button`, `.donut` hooks introduced in Task 4 and Task 5.
- Produces a fixed 220px sidebar, an ivory canvas, reusable panels/buttons/fields/tables, and a 1024px fallback layout without changing data or JavaScript behavior.

- [ ] **Step 1: Replace the rose token block with the agreed tokens**

Use this exact base block at the top of `styles.css`:

```css
:root {
  --bg: #f6f5ef;
  --surface: #fffdf9;
  --surface-strong: #ffffff;
  --text: #303732;
  --text-soft: #737a74;
  --border: #e5e2d9;
  --sage: #7e9f84;
  --sage-dark: #66856d;
  --sage-soft: #dde9df;
  --sage-pale: #eff5ef;
  --beige-soft: #f2ece2;
  --blue-soft: #e8eef0;
  --pink-soft: #efe2e5;
  --danger: #a76368;
  --radius-md: 16px;
  --radius-lg: 22px;
  --radius-xl: 28px;
  --shadow-sm: 0 5px 18px rgba(40, 50, 43, 0.04);
  --shadow-md: 0 12px 30px rgba(40, 50, 43, 0.06);
}
```

- [ ] **Step 2: Implement the fixed shell and base typography**

Set `body` to the font fallback in the spec, `background: var(--bg)`, `color: var(--text)`, and `min-width: 1024px`. Set `.app-shell` to `min-height: 100vh`; set `.sidebar` to `position: fixed`, `inset: 0 auto 0 0`, `width: 220px`, `padding: 28px 16px`, and `background: rgba(255, 253, 249, .82)` with a thin right border. Set `.main` to `margin-left: 220px`, `padding: 26px clamp(24px, 4vw, 64px) 56px`, and `max-width: 1500px`.

- [ ] **Step 3: Implement reusable panels, actions, forms, and tables**

Use `background: var(--surface)`, `border: 1px solid rgba(229, 226, 217, .82)`, `border-radius: var(--radius-lg)`, and `box-shadow: var(--shadow-sm)` for `.panel`, `.metric-card`, and common card shells. Set `.btn.primary` to `var(--sage)` with white text, `.btn.ghost` to white with `var(--border)`, and `:focus-visible` to a `var(--sage)` outline plus a translucent ring. Use `border-collapse: separate`, generous row padding, no dark row rules, `.money { text-align: right; font-variant-numeric: tabular-nums; }`, and a very light sage row hover.

- [ ] **Step 4: Implement dashboard visuals and responsive rules**

Add the classes for the hero, four KPI cards, sparklines, progress tracks, SVG donut, expense pills, empty states, topbar search, notification/profile controls, and modal. Progress widths must read the `--progress` custom property; no hard-coded sample percentages may be in CSS. Add:

```css
@media (max-width: 1120px) {
  .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .two-col, .dashboard-lower { grid-template-columns: 1fr; }
  .main { padding-inline: 24px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
}
```

- [ ] **Step 5: Run the CSS-focused test and inspect the diff**

Run: `node --test --test-name-pattern="visual theme" tests/ui.test.js`

Expected: the ivory/sage token test passes. The app-shell test can remain failing until Task 4 because its hooks belong to `src/app.js`.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 6: Commit the CSS foundation**

```bash
git add styles.css
git commit -m "feat: establish ivory sage ui system"
```

### Task 4: 共通シェル、検索、車両費ナビを実装する

**Files:**
- Modify: `src/app.js`
- Modify: `tests/ui.test.js` if a selector assertion needs an exact class update

**Interfaces:**
- Consumes `state`, `route`, `selectedMonth`, `monthInputStats`, and the existing storage/accounting functions.
- Produces `vehicleView()`, `includesSearch(record, query)`, `pendingImportCount()`, and an `appShell()` with `.topbar`, `data-global-search`, vehicle navigation, notification count, and profile copy.
- Preserves `saveSale`, `saveExpense`, `applyImportedTransactions`, `downloadBackup`, `restoreBackup`, `exportCsv`, and all existing field `name` attributes.

- [ ] **Step 1: Add display-only route state and the metrics import**

At the top of `src/app.js`, import `dailyTotals` and `monthInputStats` from `./ui/metrics.js`, then add only transient variables:

```js
let searchQuery = '';
let vehicleMonth = selectedMonth;
const displayName = 'ゆみちゃん';
```

Do not add any of these values to `state`, `saveState`, backup payloads, or CSV rows.

- [ ] **Step 2: Replace text glyph navigation with the requested route list and line icons**

Keep the route keys `dashboard`, `sales`, `expenses`, `import`, `journal`, `backup`, and `settings`; add `vehicle`. Set the labels to `ダッシュボード`, `売上`, `経費`, `車両費`, `仕訳帳`, `カードCSV`, `バックアップ`, `設定`. Add a small `lineIcon(name)` helper returning an inline SVG with `aria-hidden="true"` for each menu item, using the same 1.7px stroke and no fills.

- [ ] **Step 3: Replace `appShell` header markup with the dashboard shell**

Keep the existing `#toast` and `#modal` IDs. Change the brand copy to `青色帳簿` and `やさしい会計で、いい明日をつくる。`. Add a `.topbar` containing:

```html
<label class="search-box">
  <span class="sr-only">取引・メモを検索</span>
  <input data-global-search type="search" value="${esc(searchQuery)}" placeholder="取引・メモを検索" autocomplete="off">
</label>
<button class="icon-button" data-notification type="button" aria-label="通知">
  ${lineIcon('bell')}${pendingImportCount() ? `<span class="notification-count">${pendingImportCount()}</span>` : ''}
</button>
<div class="profile-chip"><span class="avatar">ゆ</span><span><strong>${displayName}</strong><small>個人事業</small></span></div>
```

Place the existing month picker in a `.page-tools` wrapper on dashboard and vehicle views. Avoid inline `style` attributes for layout spacing.

- [ ] **Step 4: Add global filtering and notification bindings**

Implement:

```js
function includesSearch(record, query) {
  const needle = String(query || '').trim().toLocaleLowerCase('ja-JP');
  if (!needle) return true;
  return Object.values(record || {}).some((value) => String(value ?? '').toLocaleLowerCase('ja-JP').includes(needle));
}

function pendingImportCount() {
  return state.importedTransactions.filter((record) => record.status === 'pending').length;
}
```

Apply `includesSearch` to sales, expenses, journal, recent expense, and imported transaction rows. In `bindCommon`, bind `data-global-search` input while preserving focus and selection after rerender; bind the notification button to the card CSV route when pending rows exist. Escape the query before inserting it into the input value.

- [ ] **Step 5: Add `vehicleView()` without introducing a new data shape**

Filter `state.expenses` by `category === '車両費'`, by `vehicleMonth`, and by `searchQuery`. Show counts and the totals of `amount` and `expenseBusinessAmount(record)`. Reuse `expensesTable(rows)` for the list and add a primary `data-route="expenses"` button labelled `車両費を登録`. The view may show `state.settings.vehicleDefaultRatio` as explanatory text but must not change how an expense is saved.

- [ ] **Step 6: Extend the route map and run shell tests**

Add `vehicle: vehicleView` to `views` in `render()`. Run:

```bash
npm test
npm run check
```

Expected: all tests pass, including the app-shell contract, and no syntax errors are reported.

- [ ] **Step 7: Commit the shell and navigation**

```bash
git add src/app.js tests/ui.test.js
git commit -m "feat: add dashboard shell search and vehicle view"
```

### Task 5: ダッシュボードを実データ中心に組み替える

**Files:**
- Modify: `src/app.js`
- Modify: `tests/ui.test.js` only when assertions need to cover a concrete hook added here

**Interfaces:**
- Consumes `monthlySummary`, `buildJournal`, `expenseBusinessAmount`, `monthInputStats`, `dailyTotals`, `selectedMonth`, and the transient `searchQuery`.
- Produces `dashboardView()` with four KPI cards, real daily sparkline values, an automatic journal card, recent expenses, and a real-data input-status donut/progress panel.

- [ ] **Step 1: Add the dashboard display helpers**

Add functions with no persistence side effects:

```js
function shortCount(value, unit) {
  return `${Number(value || 0).toLocaleString('ja-JP')}${unit}`;
}

function progressStyle(percent) {
  return `--progress: ${Math.max(0, Math.min(100, Number(percent) || 0))}`;
}

function sparkline(values, label) {
  const max = Math.max(...values, 0);
  if (!max) return `<span class="sparkline-empty">入力すると推移が表示されます</span>`;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 30 - ((value / max) * 24);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return `<svg class="sparkline" viewBox="0 0 100 32" role="img" aria-label="${esc(label)}"><polyline points="${points}" fill="none" /></svg>`;
}
```

The only inline custom property is the computed width for an actual progress bar; all colors, transitions, and spacing remain in `styles.css`.

- [ ] **Step 2: Replace the old dashboard heading and KPI values**

Use these exact labels and existing accounting values:

```js
const summary = monthlySummary(state.sales, state.expenses, selectedMonth, state.settings.reserveRate);
const input = monthInputStats(state.sales, state.expenses, selectedMonth);
const salesDaily = dailyTotals(state.sales, selectedMonth, (record) => Number(record.amount || 0) + Number(record.tip || 0));
const expenseDaily = dailyTotals(state.expenses, selectedMonth, (record) => expenseBusinessAmount(record));
```

Render `今月売上` from `summary.sales`, `今月経費` from `summary.expenses`, `概算利益` from `summary.profit`, and `積立目安` from `summary.reserve`. Keep `summary.available` only as a small explanatory value such as `積立後の目安 ${money(summary.available)}`. Pair each card with a real count or real sparkline; when the corresponding values are zero, show the empty state.

- [ ] **Step 3: Add the hero and journal card actions**

Render `おかえりなさい、ゆみちゃん` and `今日の丁寧な記録が、あしたの安心につながります。` in `.dashboard-hero`. Put the selected month and current date on the right. Render the journal card title `仕訳帳`, the copy `複式簿記の土台となる仕訳を管理できます。`, a `仕訳検索` input bound to the same transient query, `CSV出力`, and a sage primary `新規入力` button routed to `expenses`.

- [ ] **Step 4: Add recent expenses and the real input-status panel**

Create `recentExpenses` from the selected-month expense rows, sorted by date descending and limited to 4. Show date, description, category pill, and `expenseBusinessAmount(record)`. For the status panel, draw a background SVG ring and a sage foreground ring whose dash value comes from `input.recordedPercent`; include `input.recordedDays / input.daysInMonth` as text. Add bars for `input.salesPercent`, `input.expensePercent`, and `input.receiptPercent`, each with its count. Empty state copy must be `最初の1件から始めましょう。`; non-empty copy must be `いいペースです。この調子で今月もコツコツ続けましょう。`.

- [ ] **Step 5: Update `journalTable`, `expensesTable`, and empty states for the new hierarchy**

Keep table data sourced from existing objects and keep the journal columns `日付`, `摘要`, `借方`, `貸方`, `金額`. Add a `.table-title`/`.table-subtitle` hierarchy, right-align every `.money`, and use category pills with only the existing category text. If `searchQuery` removes every row, return `検索条件に一致する記録がありません。` with a clear-search button that sets `searchQuery = ''` and rerenders.

- [ ] **Step 6: Run dashboard and regression tests**

Run:

```bash
node --test tests/ui-metrics.test.js
node --test tests/ui.test.js
npm test
```

Expected: all display, UI contract, accounting, CSV, and tooling tests pass; the dashboard source contains no fixed sample KPI amounts or sample percentages.

- [ ] **Step 7: Commit the dashboard redesign**

```bash
git add src/app.js tests/ui.test.js
git commit -m "feat: redesign dashboard around real ledger data"
```

### Task 6: 各ページのフォーム・表・モーダルを共通UIへ移行する

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css` — add any shared state class named in the page-level markup, including `.field-help` and `.form-actions`.

**Interfaces:**
- Consumes the unchanged form field names and existing event handlers.
- Produces accessible labels, consistent panels, readable tables, receipt modal controls, and existing sales/expense/import/journal/backup/settings actions with no accounting behavior change.

- [ ] **Step 1: Preserve and explicitly test all existing form names before markup edits**

Run:

```bash
rg -n "name=\"(date|amount|tip|location|memo|description|merchant|category|paymentMethod|businessRatio|receipt|businessStartDate|reserveRate|vehicleDefaultRatio|businessName)\"" src/app.js
```

Expected: every listed name is present in the current forms. Keep these exact names when moving controls into the new layout.

- [ ] **Step 2: Make the `field` helper associate labels with controls**

Change the helper signature to:

```js
function field(labelText, control, span = 12, id = '') {
  const forAttribute = id ? ` for="${id}"` : '';
  return `<div class="field span-${span}"><label${forAttribute}>${esc(labelText)}</label>${control}</div>`;
}
```

Give every generated control a stable page-specific `id` and pass that ID as the fourth argument. Keep the `name` attributes untouched so `FormData` and handlers still receive the same keys.

- [ ] **Step 3: Recompose sales and expense forms without changing submit handlers**

Use `.form-section`, `.field-help`, and `.form-actions` classes. Keep sales fields as date, amount, tip, location, memo. Keep expense fields as date, description, amount, merchant, category, paymentMethod, businessRatio, receipt, memo. Add visible helper copy for `私用カードは事業主借として自動仕訳されます。` and `事業利用割合から必要経費額を計算します。` without writing either message to state.

- [ ] **Step 4: Recompose import, journal, backup, and settings panels**

Keep IDs `csv-file`, `apply-import`, `clear-import`, `download-backup`, `restore-backup`, `settings-form`, and all `data-*` selectors used by `bindView`. Replace inline layout styles with `.form-actions` and `.panel-actions`. Keep CSV output buttons on the same `data-export` values `sales`, `expenses`, and `journal`.

- [ ] **Step 5: Make the receipt modal keyboard-friendly**

Set `role="dialog"`, `aria-modal="true"`, and an accessible label on `#modal`. Bind a document-level Escape listener in `bindCommon` that calls `closeModal()`. Keep `getReceipt`, the `data-view-receipt` selector, the image data URL, and the existing missing-image toast unchanged. Move the close button spacing from inline CSS to `.modal-header`.

- [ ] **Step 6: Verify form and event contracts**

Run:

```bash
node --check src/app.js
rg -n "data-(delete-sale|delete-expense|view-receipt|import-status|import-category|import-ratio|export)|id=\"(sale-form|expense-form|csv-file|apply-import|clear-import|download-backup|restore-backup|settings-form)\"" src/app.js
npm test
```

Expected: the required selectors remain present, `node --check` succeeds, and all tests pass.

- [ ] **Step 7: Commit the page-level UI migration**

```bash
git add src/app.js styles.css
git commit -m "feat: unify ledger forms tables and modal ui"
```

### Task 7: ビルド、起動、機能回帰、画面確認を行う

**Files:**
- Modify: `index.html` — add the app description metadata while preserving the title and module script.
- Generated: `dist/` via `npm run build`.

**Interfaces:**
- Consumes the complete UI implementation and all unchanged accounting/storage/CSV modules.
- Produces a deployable `dist/` and evidence for the completion criteria.

- [ ] **Step 1: Add the application description metadata**

Add `<meta name="description" content="売上と経費をやさしく整える、自分専用の青色申告向け会計帳簿" />` inside the existing `<head>`. Keep `<title>青色帳簿</title>`, `color-scheme`, stylesheet path, and module script path unchanged.

- [ ] **Step 2: Run the full automated verification**

Run:

```bash
npm test
npm run check
npm run build
git diff --check
```

Expected: all tests pass, all JavaScript checks pass, build prints `Build complete`, and `git diff --check` prints nothing.

- [ ] **Step 3: Smoke-test the dev server**

Run in one terminal: `npm run dev`

Run in another terminal: `curl --fail http://127.0.0.1:4173/`

Expected: HTTP 200 and an HTML response containing `青色帳簿` and the module script path. Stop the server with Ctrl+C after the check.

- [ ] **Step 4: Exercise the browser-level flow with a temporary known state**

Open the dev server at 1440×900 and confirm, in order: dashboard loads; month picker changes the KPI month; the sales form saves one row; the expense form saves a cash row and a private-card row; journal rows show `現金 / 売上高`, selected category / `現金`, and selected category / `事業主借`; a 50% expense displays a rounded deductible amount; a receipt can be opened; vehicle view filters `車両費`; global search filters a known memo; card CSV can be imported and applied; sales/expense/journal CSV buttons download; backup download and restore work.

- [ ] **Step 5: Confirm persistence and contract stability**

Before and after the browser flow, inspect the browser storage keys. Confirm `aoi-ledger-state-v1` still contains the original top-level arrays and settings keys, and the receipt database remains `aoi-ledger-receipts` / `receipts`. Confirm that `buildJournal` and all existing domain/csv tests remain unchanged and passing.

- [ ] **Step 6: Check 1024px layout and reduced motion**

Resize to 1024px wide. Confirm sidebar remains usable, KPI cards become 2 columns, lower dashboard cards become one column, and only wide tables scroll horizontally. Enable reduced motion in the browser and confirm no large animated transition is required to operate the app.

- [ ] **Step 7: Commit the generated build after verification**

```bash
git add index.html dist/
git commit -m "chore: build redesigned aoi ledger"
```

- [ ] **Step 8: Review the final diff against the spec**

Run:

```bash
git diff HEAD~1 --stat
git status --short
git log --oneline -8
```

Confirm that changes are limited to UI/display files, the new display helper/tests, the generated build, and the design/plan documents; confirm no changes were made to localStorage/IndexedDB constants, accounting rules, or CSV headers.
