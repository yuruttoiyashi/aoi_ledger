import { buildJournal, expenseBusinessAmount, monthlySummary } from './domain/accounting.js';
import { normalizeTransactions, parseCsv } from './domain/csv.js';
import { deleteReceipt, exportBackup, getReceipt, importBackup, loadState, putReceipt, saveState } from './storage.js';
import { dailyTotals, monthInputStats } from './ui/metrics.js';

let state = loadState();
let route = 'dashboard';
let selectedMonth = new Date().toISOString().slice(0, 7);
let searchQuery = '';
let vehicleMonth = selectedMonth;
const displayName = 'ゆみちゃん';

const categories = ['旅費交通費','車両費','消耗品費','通信費','広告宣伝費','支払手数料','研修費','地代家賃','水道光熱費','雑費'];
const paymentLabels = { cash: '現金', personal_card: '私用カード', business_bank: '事業用口座' };
const money = (value) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(Number(value || 0));
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);

const nav = [
  ['dashboard','dashboard','ダッシュボード'], ['sales','sales','売上'], ['expenses','expenses','経費'],
  ['vehicle','vehicle','車両費'], ['journal','journal','仕訳帳'], ['import','import','カードCSV'],
  ['backup','backup','バックアップ'], ['settings','settings','設定']
];

const iconPaths = {
  dashboard: '<path d="m3 10 6-6 6 6v6H3z"/><path d="M6.5 16v-4h5v4"/>',
  sales: '<path d="M4 5h8.5a2.5 2.5 0 0 1 0 5H6a2.5 2.5 0 0 0 0 5h8"/><path d="M6 7.5h.01M11 12.5h.01"/>',
  expenses: '<rect x="3.5" y="3.5" width="11" height="13" rx="2"/><path d="M6.5 7h5M6.5 10h5M6.5 13h3"/>',
  vehicle: '<path d="m3 11 1.3-4.1A2 2 0 0 1 6.2 5.5h5.6a2 2 0 0 1 1.9 1.4L15 11"/><path d="M3 11h12v3.5H3zM5.5 14.5V16M12.5 14.5V16M5.5 11v.01M12.5 11v.01"/>',
  journal: '<path d="M4 4h8.5A1.5 1.5 0 0 1 14 5.5v9A1.5 1.5 0 0 1 12.5 16H4z"/><path d="M6.5 7h5M6.5 10h5M6.5 13h3"/>',
  import: '<path d="M9 3v8"/><path d="m6 8 3 3 3-3"/><path d="M4 13v2.5A1.5 1.5 0 0 0 5.5 17h7a1.5 1.5 0 0 0 1.5-1.5V13"/>',
  backup: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h5A2.5 2.5 0 0 1 14 5.5v8A2.5 2.5 0 0 1 11.5 16h-5A2.5 2.5 0 0 1 4 13.5z"/><path d="M7 7h4M7 10h4M7 13h2"/>',
  bell: '<path d="M5 13.5h8l-1-1.6V8.5a3 3 0 0 0-6 0v3.4z"/><path d="M7.5 15.5h3"/>',
  leaf: '<path d="M14.5 3.5C9 3.7 5.1 6.2 5.1 10.3c0 2.8 2.2 4.2 4.2 4.2 3.8 0 5.3-4.5 5.2-11z"/><path d="M3.5 15.5c2.1-3.5 4.8-5.2 8.7-6.4"/>',
  settings: '<path d="M9 3.5v2M9 13.5v2M3.5 9h2M12.5 9h2M5.1 5.1l1.4 1.4M11.5 11.5l1.4 1.4M12.9 5.1l-1.4 1.4M6.5 11.5l-1.4 1.4"/><circle cx="9" cy="9" r="2.5"/>'
};

function lineIcon(name) {
  return `<svg viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name] || iconPaths.dashboard}</svg>`;
}

function appShell(content, title, subtitle = '') {
  return `
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">${lineIcon('leaf')}</div><div><h1>青色帳簿</h1><small>やさしい会計で、いい明日をつくる。</small></div></div>
      <nav class="nav" aria-label="メインメニュー">${nav.map(([key, icon, label]) => `<button class="nav-button ${route===key?'active':''}" data-route="${key}" type="button"><span class="nav-icon">${lineIcon(icon)}</span><span>${label}</span></button>`).join('')}</nav>
      <div class="sidebar-note">2026年分から記録<br>画面はかんたん、内部は複式簿記。</div>
    </aside>
    <main class="main">
      <div class="topbar">
        <label class="search-box">
          <span class="sr-only">取引・メモを検索</span>
          <input data-global-search type="search" value="${esc(searchQuery)}" placeholder="取引・メモを検索" autocomplete="off">
        </label>
        <button class="icon-button" data-notification type="button" aria-label="通知">${lineIcon('bell')}${pendingImportCount() ? `<span class="notification-count">${pendingImportCount()}</span>` : ''}</button>
        <div class="profile-chip"><span class="avatar">ゆ</span><span><strong>${displayName}</strong><small>個人事業</small></span></div>
      </div>
      <header class="page-header"><div><h2>${title}</h2><p>${subtitle}</p></div><div class="header-actions">${['dashboard','vehicle'].includes(route)?monthPicker(route==='vehicle'?vehicleMonth:selectedMonth):''}</div></header>
      ${content}
    </main>
  </div><div id="toast" class="toast"></div><div id="modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-card"><div class="modal-header"><button class="btn ghost" data-close-modal type="button">閉じる</button></div><div id="modal-content"><h2 id="modal-title" class="sr-only">レシート画像</h2></div></div></div>`;
}

function monthPicker(month = selectedMonth) {
  return `<input id="month-picker" class="month-picker" type="month" value="${esc(month)}" aria-label="表示する月">`;
}

function render() {
  const views = { dashboard: dashboardView, sales: salesView, expenses: expensesView, vehicle: vehicleView, import: importView, journal: journalView, backup: backupView, settings: settingsView };
  document.querySelector('#app').innerHTML = views[route]();
  bindCommon();
  bindView();
}

function includesSearch(record, query) {
  const needle = String(query || '').trim().toLocaleLowerCase('ja-JP');
  if (!needle) return true;
  return Object.values(record || {}).some((value) => String(value ?? '').toLocaleLowerCase('ja-JP').includes(needle));
}

function pendingImportCount() {
  return state.importedTransactions.filter((record) => record.status === 'pending').length;
}

function dashboardView() {
  const summary = monthlySummary(state.sales, state.expenses, selectedMonth, state.settings.reserveRate);
  const monthSales = state.sales.filter((record) => String(record.date || '').startsWith(selectedMonth));
  const monthExpenses = state.expenses.filter((record) => String(record.date || '').startsWith(selectedMonth));
  const input = monthInputStats(state.sales, state.expenses, selectedMonth);
  const salesDaily = dailyTotals(state.sales, selectedMonth, (record) => Number(record.amount || 0) + Number(record.tip || 0));
  const expenseDaily = dailyTotals(state.expenses, selectedMonth, (record) => expenseBusinessAmount(record));
  const profitDaily = salesDaily.map((value, index) => value - expenseDaily[index]);
  const avgDay = input.saleDays ? Math.round(summary.sales / input.saleDays) : 0;
  const expenseRate = summary.sales > 0 ? Math.min(100, Math.round(summary.expenses / summary.sales * 100)) : 0;
  const recentJournal = [...buildJournal(state.sales, state.expenses)]
    .filter((record) => String(record.date || '').startsWith(selectedMonth))
    .filter((record) => includesSearch(record, searchQuery))
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0, 8);
  const recentExpenses = [...monthExpenses]
    .filter((record) => includesSearch(record, searchQuery))
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0, 4);
  const content = `
    <section class="dashboard-hero">
      <div class="hero-copy"><p class="hero-eyebrow">${selectedMonth.replace('-', '年')}月の記録</p><h3>おかえりなさい、${displayName}さん</h3><p>今日の丁寧な記録が、あしたの安心につながります。</p></div>
      <div class="hero-meta"><strong>${new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric' }).format(new Date())}</strong><small>${input.recordedDays ? '今月もいいペースです' : '最初の1件から始めましょう'}</small></div>
    </section>
    <div class="card-grid">
      ${metric('今月売上', money(summary.sales), `${input.saleDays}日分を登録`, 'sales', sparkline(salesDaily, '今月売上の日別推移'))}
      ${metric('今月経費', money(summary.expenses), `売上比 ${expenseRate}%`, 'expenses', sparkline(expenseDaily, '今月経費の日別推移'))}
      ${metric('概算利益', money(summary.profit), `平均日商 ${money(avgDay)}`, 'journal', sparkline(profitDaily, '概算利益の日別推移'))}
      ${metric('積立目安', money(summary.reserve), `積立率 ${state.settings.reserveRate}%・残り ${money(summary.available)}`, 'backup', sparkline(expenseDaily, '積立の参考となる経費推移'), true)}
    </div>
    <section class="panel journal-panel">
      <div class="panel-title"><div><h3>仕訳帳</h3><p>複式簿記の土台となる仕訳を管理できます。</p></div><div class="panel-actions"><input data-journal-search class="inline-search" type="search" value="${esc(searchQuery)}" placeholder="仕訳検索" aria-label="仕訳検索"><button class="btn ghost small" data-export="journal" type="button">CSV出力</button><button class="btn primary small" data-route="expenses" type="button">新規入力</button></div></div>
      ${journalTable(recentJournal)}
    </section>
    <div class="dashboard-lower">
      <section class="panel"><div class="panel-title"><div><h3>最近の経費</h3><p>${selectedMonth}に入力した経費</p></div><button class="btn ghost small" data-route="expenses" type="button">経費を見る</button></div>${expenseList(recentExpenses)}</section>
      <section class="panel status-card" data-input-donut>
        <div class="panel-title"><div><h3>今月の入力状況</h3><p>記録の進み具合を確認できます。</p></div></div>
        <div class="status-layout">
          <div class="donut-wrap"><svg class="donut" viewBox="0 0 42 42" data-input-donut aria-hidden="true"><circle class="donut-track" cx="21" cy="21" r="15.9155"></circle><circle class="donut-value" cx="21" cy="21" r="15.9155" style="--dash:${input.recordedPercent}"></circle></svg><div class="donut-center"><strong>${input.recordedPercent}%</strong><span>入力日数</span></div></div>
          <div class="status-bars">
            ${statusRow('売上の入力', input.salesPercent, `${input.saleDays}日`)}
            ${statusRow('経費の入力', input.expensePercent, `${input.expenseDays}日・${input.expenseCount}件`)}
            ${statusRow('レシートの整理', input.receiptPercent, `${input.receiptCount}件`)}
          </div>
        </div>
        <p class="status-message">${input.recordedDays ? 'いいペースです。この調子で今月もコツコツ続けましょう。' : '最初の1件から始めましょう。'}</p>
      </section>
    </div>
    <div class="notice">税・社会保険の積立額は設定した割合からの<strong>資金管理用の目安</strong>です。実際の税額・国保額を確定する機能ではありません。</div>`;
  return appShell(content, 'ダッシュボード', '売上・経費・利益をひと目で確認');
}

function metric(label, value, hint, iconName, visual = '', accent = false) {
  return `<section class="metric-card ${accent ? 'accent' : ''}"><div class="metric-label">${esc(label)}</div><div class="metric-icon">${lineIcon(iconName)}</div><div class="metric-value">${value}</div><div class="metric-hint">${hint}</div><div class="metric-visual">${visual}</div></section>`;
}

function statusRow(label, percent, count) {
  return `<div class="status-row"><div class="status-label"><span>${esc(label)}</span><strong>${Number(percent || 0)}%・${esc(count)}</strong></div><div class="status-track"><div style="--progress:${Math.max(0, Math.min(100, Number(percent) || 0))}"></div></div></div>`;
}

function sparkline(values, label) {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  if (max === 0 && min === 0) return '<span class="sparkline-empty">入力すると推移が表示されます</span>';
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 28 - (((value - min) / range) * 24);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return `<svg class="sparkline" viewBox="0 0 100 32" role="img" aria-label="${esc(label)}"><polyline points="${points}" fill="none"></polyline></svg>`;
}

function expenseList(rows) {
  if (!rows.length) return `<div class="empty">${searchQuery ? '検索条件に一致する記録がありません。' : 'まだ経費がありません。'}</div>`;
  return `<div class="expense-list">${rows.map((record) => `<div class="expense-item"><time class="expense-date" datetime="${esc(record.date)}">${esc(record.date)}</time><div class="expense-main"><strong>${esc(record.description)}</strong><small><span class="category-pill">${esc(record.category)}</span></small></div><strong class="expense-amount">${money(expenseBusinessAmount(record))}</strong></div>`).join('')}</div>`;
}

function salesView() {
  const rows = [...state.sales].filter((record) => includesSearch(record, searchQuery)).sort((a,b)=>b.date.localeCompare(a.date));
  const content = `<section class="panel form-section"><div class="panel-title"><div><h3>売上を登録</h3><p>1日分をまとめて入力。チップは別欄で残せます。</p></div></div>
    <form id="sale-form" class="form-grid">
      ${field('日付', `<input id="sale-date" name="date" type="date" required value="${today()}">`, 3, 'sale-date')}
      ${field('売上合計', '<input id="sale-amount" name="amount" type="number" min="0" step="1" required placeholder="26000">', 3, 'sale-amount')}
      ${field('チップ', '<input id="sale-tip" name="tip" type="number" min="0" step="1" value="0">', 2, 'sale-tip')}
      ${field('出勤先', '<input id="sale-location" name="location" placeholder="tan">', 4, 'sale-location')}
      ${field('メモ', '<input id="sale-memo" name="memo" placeholder="延長あり、など">', 8, 'sale-memo')}
      <div class="form-actions"><button class="btn primary" type="submit">売上を保存</button></div>
    </form></section>
    <section class="panel"><div class="panel-title"><div><h3>売上一覧</h3><p>${rows.length}件</p></div><div class="panel-actions"><button class="btn ghost small" data-export="sales" type="button">CSV出力</button></div></div>${salesTable(rows)}</section>`;
  return appShell(content, '売上', 'その日の売上合計を1件として記録');
}

function expensesView() {
  const rows = [...state.expenses].filter((record) => includesSearch(record, searchQuery)).sort((a,b)=>b.date.localeCompare(a.date));
  const categoryOptions = categories.map((x)=>`<option>${x}</option>`).join('');
  const content = `<section class="panel form-section"><div class="panel-title"><div><h3>経費を登録</h3><p>レシート1枚・支出1件ごとに登録します。</p></div></div>
    <form id="expense-form" class="form-grid">
      ${field('日付', `<input id="expense-date" name="date" type="date" required value="${today()}">`, 3, 'expense-date')}
      ${field('内容', '<input id="expense-description" name="description" required placeholder="駐車場代">', 5, 'expense-description')}
      ${field('金額', '<input id="expense-amount" name="amount" type="number" min="0" step="1" required placeholder="2400">', 4, 'expense-amount')}
      ${field('店名・支払先', '<input id="expense-merchant" name="merchant" placeholder="タイムズ">', 4, 'expense-merchant')}
      ${field('勘定科目', `<select id="expense-category" name="category">${categoryOptions}</select>`, 4, 'expense-category')}
      ${field('支払方法', `<select id="expense-payment" name="paymentMethod"><option value="cash">現金</option><option value="personal_card">私用カード</option><option value="business_bank">事業用口座</option></select>`, 4, 'expense-payment')}
      ${field('事業利用割合 %', '<input id="expense-ratio" name="businessRatio" type="number" min="0" max="100" value="100">', 3, 'expense-ratio')}
      ${field('レシート画像', '<input id="expense-receipt" name="receipt" type="file" accept="image/*">', 5, 'expense-receipt')}
      ${field('メモ', '<input id="expense-memo" name="memo" placeholder="仕事日のみ、など">', 4, 'expense-memo')}
      <p class="field-help span-12">私用カードは事業主借として自動仕訳されます。事業利用割合から必要経費額を計算します。</p>
      <div class="form-actions"><button class="btn primary" type="submit">経費を保存</button></div>
    </form></section>
    <section class="panel"><div class="panel-title"><div><h3>経費一覧</h3><p>按分後の経費額も表示</p></div><div class="panel-actions"><button class="btn ghost small" data-export="expenses" type="button">CSV出力</button></div></div>${expensesTable(rows)}</section>`;
  return appShell(content, '経費', '1件ずつ登録して、必要経費額を自動計算');
}

function vehicleView() {
  const rows = state.expenses
    .filter((record) => record.category === '車両費')
    .filter((record) => String(record.date || '').startsWith(vehicleMonth))
    .filter((record) => includesSearch(record, searchQuery))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const total = rows.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const deductible = rows.reduce((sum, record) => sum + expenseBusinessAmount(record), 0);
  const content = `
    <section class="panel">
      <div class="panel-title"><div><h3>車両費の記録</h3><p>車両費として登録した経費を、選択月ごとに確認できます。</p></div><div class="panel-actions"><button class="btn primary" data-route="expenses" type="button">車両費を登録</button></div></div>
      <div class="summary-grid">
        <div class="summary-tile"><span>対象件数</span><strong>${rows.length}件</strong></div>
        <div class="summary-tile"><span>支出合計</span><strong>${money(total)}</strong></div>
        <div class="summary-tile"><span>必要経費合計</span><strong>${money(deductible)}</strong></div>
      </div>
      <p class="field-help">設定中の車の標準事業利用割合は ${Number(state.settings.vehicleDefaultRatio ?? 100)}% です。個々の経費の按分割合は、登録時の値をそのまま使用します。</p>
    </section>
    <section class="panel"><div class="panel-title"><div><h3>車両費一覧</h3><p>${vehicleMonth}の記録</p></div></div>${expensesTable(rows)}</section>`;
  return appShell(content, '車両費', '移動にかかった経費を見やすく整理');
}

function importView() {
  const rows = state.importedTransactions.filter((record) => includesSearch(record, searchQuery));
  const options = categories.map((x)=>`<option>${x}</option>`).join('');
  const table = rows.length ? `<div class="table-wrap"><table><thead><tr><th>日付</th><th>内容</th><th class="money">金額</th><th>扱い</th><th>科目</th><th>按分%</th></tr></thead><tbody>${rows.map((r)=>`<tr data-import-id="${r.id}"><td>${esc(r.date)}</td><td>${esc(r.description)}</td><td class="money">${money(r.amount)}</td><td><select data-import-status><option value="pending" ${r.status==='pending'?'selected':''}>未処理</option><option value="business" ${r.status==='business'?'selected':''}>事業</option><option value="personal" ${r.status==='personal'?'selected':''}>私用</option><option value="allocated" ${r.status==='allocated'?'selected':''}>按分</option></select></td><td><select data-import-category>${options.replace(`>${r.category||''}<`,` selected>${r.category||''}<`)}</select></td><td><input class="import-ratio" data-import-ratio type="number" min="0" max="100" value="${r.businessRatio ?? 100}"></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${searchQuery ? '検索条件に一致する明細がありません。' : 'CSVを取り込むと、ここに明細が表示されます。'}</div>`;
  const content = `<section class="panel"><div class="panel-title"><div><h3>カード明細CSV</h3><p>共用カードの明細から事業分だけ経費にします。</p></div></div>
    <div class="file-box"><label class="btn ghost" for="csv-file">明細CSVを選択</label><input id="csv-file" class="sr-only" type="file" accept=".csv,text/csv"><p class="subtle">利用日・利用先・利用金額などの一般的な列名に対応</p></div></section>
    <section class="panel"><div class="panel-title"><div><h3>取込明細</h3><p>事業・私用・按分を選択してから反映</p></div><div class="panel-actions"><button class="btn ghost small" id="clear-import" type="button">取込を消去</button><button class="btn primary small" id="apply-import" type="button">経費へ反映</button></div></div>${table}</section>`;
  return appShell(content, 'カードCSV', '私用と事業が混ざったカードでも分けて管理');
}

function journalView() {
  const entries = buildJournal(state.sales, state.expenses).filter((record) => includesSearch(record, searchQuery));
  const content = `<section class="panel"><div class="panel-title"><div><h3>仕訳帳</h3><p>通常入力から自動生成。借方・貸方を直接入力する必要はありません。</p></div><div class="panel-actions"><input data-journal-search class="inline-search" type="search" value="${esc(searchQuery)}" placeholder="仕訳検索" aria-label="仕訳検索"><button class="btn ghost small" data-export="journal" type="button">CSV出力</button><button class="btn primary small" data-route="expenses" type="button">新規入力</button></div></div>${journalTable(entries)}</section>`;
  return appShell(content, '仕訳帳', '複式簿記の土台となる仕訳を確認');
}

function backupView() {
  const content = `<section class="panel"><div class="panel-title"><div><h3>完全バックアップ</h3><p>売上・経費・設定・レシート画像を1つのJSONに保存します。</p></div></div>
    <div class="form-actions"><button id="download-backup" class="btn primary" type="button">バックアップを保存</button><label class="btn ghost" for="restore-backup">バックアップを復元<input id="restore-backup" class="sr-only" type="file" accept="application/json,.json"></label></div></section>
    <section class="panel"><div class="panel-title"><div><h3>表計算用CSV</h3><p>Excelなどで確認したい場合はこちら。</p></div></div><div class="form-actions"><button class="btn ghost" data-export="sales" type="button">売上CSV</button><button class="btn ghost" data-export="expenses" type="button">経費CSV</button><button class="btn ghost" data-export="journal" type="button">仕訳CSV</button></div></section>
    <div class="notice">本番版では、普段のデータをCloudflare D1、レシートをR2へ保存し、Cloudflare Accessで本人だけアクセスできる構成へ移行します。このMVPはブラウザ内保存なので、バックアップを定期的に保存してください。</div>`;
  return appShell(content, 'バックアップ', 'クラウド移行前でもデータを失わないための退避');
}

function settingsView() {
  const s = state.settings;
  const content = `<section class="panel"><div class="panel-title"><div><h3>基本設定</h3><p>資金管理の表示に使う値です。</p></div></div>
    <form id="settings-form" class="settings-grid">
      ${field('事業開始日', `<input id="settings-start-date" name="businessStartDate" type="date" value="${esc(s.businessStartDate)}">`, 12, 'settings-start-date')}
      ${field('税・社会保険の積立目安 %', `<input id="settings-reserve-rate" name="reserveRate" type="number" min="0" max="100" value="${esc(s.reserveRate)}">`, 12, 'settings-reserve-rate')}
      ${field('車の標準事業利用割合 %', `<input id="settings-vehicle-ratio" name="vehicleDefaultRatio" type="number" min="0" max="100" value="${esc(s.vehicleDefaultRatio)}">`, 12, 'settings-vehicle-ratio')}
      ${field('屋号（任意）', `<input id="settings-business-name" name="businessName" value="${esc(s.businessName)}" placeholder="未定なら空欄でOK">`, 12, 'settings-business-name')}
      <div class="form-actions"><button class="btn primary" type="submit">設定を保存</button></div>
    </form></section>`;
  return appShell(content, '設定', '自分専用アプリなので必要なものだけ');
}

function field(labelText, control, span = 12, id = '') {
  const forAttribute = id ? ` for="${id}"` : '';
  return `<div class="field span-${span}"><label${forAttribute}>${esc(labelText)}</label>${control}</div>`;
}

function salesTable(rows) {
  if (!rows.length) return `<div class="empty">${searchQuery ? '検索条件に一致する売上がありません。' : 'まだ売上がありません。'}</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>日付</th><th>出勤先</th><th class="money">売上</th><th class="money">チップ</th><th class="money">合計</th><th>メモ</th><th></th></tr></thead><tbody>${rows.map((r)=>`<tr><td>${esc(r.date)}</td><td>${esc(r.location)}</td><td class="money">${money(r.amount)}</td><td class="money">${money(r.tip)}</td><td class="money"><strong>${money(Number(r.amount)+Number(r.tip||0))}</strong></td><td>${esc(r.memo)}</td><td><button class="btn danger small" data-delete-sale="${r.id}">削除</button></td></tr>`).join('')}</tbody></table></div>`;
}

function expensesTable(rows) {
  if (!rows.length) return `<div class="empty">${searchQuery ? '検索条件に一致する経費がありません。' : 'まだ経費がありません。'}</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>日付</th><th>内容</th><th>科目</th><th>支払</th><th>割合</th><th class="money">支出</th><th class="money">必要経費</th><th>証憑</th><th></th></tr></thead><tbody>${rows.map((r)=>`<tr><td>${esc(r.date)}</td><td>${esc(r.description)}</td><td><span class="category-pill">${esc(r.category)}</span></td><td>${esc(paymentLabels[r.paymentMethod]||r.paymentMethod)}</td><td>${r.businessRatio}%</td><td class="money">${money(r.amount)}</td><td class="money"><strong>${money(expenseBusinessAmount(r))}</strong></td><td>${r.receiptId?`<span class="receipt-chip"><button data-view-receipt="${r.receiptId}">画像を見る</button></span>`:'—'}</td><td><button class="btn danger small" data-delete-expense="${r.id}">削除</button></td></tr>`).join('')}</tbody></table></div>`;
}

function journalTable(rows) {
  if (!rows.length) return `<div class="empty">${searchQuery ? '検索条件に一致する仕訳がありません。' : '記録を入れると自動仕訳が表示されます。'}</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>日付</th><th>摘要</th><th>借方</th><th>貸方</th><th class="money">金額</th></tr></thead><tbody>${rows.map((r)=>`<tr><td>${esc(r.date)}</td><td>${esc(r.description)}</td><td>${esc(r.debitAccount)}</td><td>${esc(r.creditAccount)}</td><td class="money">${money(r.amount)}</td></tr>`).join('')}</tbody></table></div>`;
}

function bindCommon() {
  document.querySelectorAll('[data-route]').forEach((el)=>el.addEventListener('click',()=>{ route=el.dataset.route; render(); }));
  document.querySelector('#month-picker')?.addEventListener('change',(e)=>{
    if (route === 'vehicle') vehicleMonth = e.target.value;
    else selectedMonth = e.target.value;
    render();
  });
  document.querySelectorAll('[data-export]').forEach((el)=>el.addEventListener('click',()=>exportCsv(el.dataset.export)));
  document.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
  document.querySelector('#modal')?.addEventListener('click',(e)=>{ if(e.target.id==='modal') closeModal(); });
  document.querySelector('[data-notification]')?.addEventListener('click',()=>{
    if (pendingImportCount()) { route = 'import'; render(); }
    else toast('新しい通知はありません');
  });
  document.querySelectorAll('[data-global-search],[data-journal-search]').forEach((searchInput)=>searchInput.addEventListener('input',(event)=>{
    const input = event.currentTarget;
    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    const selector = input.matches('[data-journal-search]') ? '[data-journal-search]' : '[data-global-search]';
    searchQuery = input.value;
    render();
    const nextInput = document.querySelector(selector);
    nextInput?.focus();
    if (selectionStart !== null && selectionEnd !== null) nextInput?.setSelectionRange(selectionStart, selectionEnd);
  }));
  document.removeEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('keydown', handleGlobalKeydown);
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape') closeModal();
}

function bindView() {
  document.querySelector('#sale-form')?.addEventListener('submit', saveSale);
  document.querySelector('#expense-form')?.addEventListener('submit', saveExpense);
  document.querySelectorAll('[data-delete-sale]').forEach((el)=>el.addEventListener('click',()=>deleteSale(el.dataset.deleteSale)));
  document.querySelectorAll('[data-delete-expense]').forEach((el)=>el.addEventListener('click',()=>deleteExpense(el.dataset.deleteExpense)));
  document.querySelectorAll('[data-view-receipt]').forEach((el)=>el.addEventListener('click',()=>viewReceipt(el.dataset.viewReceipt)));
  document.querySelector('#csv-file')?.addEventListener('change', importCsvFile);
  document.querySelector('#apply-import')?.addEventListener('click', applyImportedTransactions);
  document.querySelector('#clear-import')?.addEventListener('click',()=>{ state.importedTransactions=[]; persist('取込明細を消去しました'); });
  document.querySelectorAll('[data-import-status],[data-import-category],[data-import-ratio]').forEach((el)=>el.addEventListener('change', updateImportedRow));
  document.querySelector('#download-backup')?.addEventListener('click', downloadBackup);
  document.querySelector('#restore-backup')?.addEventListener('change', restoreBackup);
  document.querySelector('#settings-form')?.addEventListener('submit', saveSettings);
}

function saveSale(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  state.sales.push({ id: uid(), date: data.date, amount: Number(data.amount), tip: Number(data.tip||0), location: data.location.trim(), memo: data.memo.trim(), createdAt: new Date().toISOString() });
  persist('売上を保存しました');
}

async function saveExpense(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const file = form.elements.receipt.files?.[0];
  let receiptId = null;
  if (file) receiptId = await putReceipt(file);
  state.expenses.push({ id: uid(), date: data.date, description: data.description.trim(), merchant: data.merchant.trim(), amount: Number(data.amount), category: data.category, paymentMethod: data.paymentMethod, businessRatio: Number(data.businessRatio||100), receiptId, memo: data.memo.trim(), createdAt: new Date().toISOString() });
  persist('経費を保存しました');
}

function deleteSale(id) { if (!confirm('この売上を削除しますか？')) return; state.sales=state.sales.filter((x)=>x.id!==id); persist('売上を削除しました'); }
async function deleteExpense(id) { if (!confirm('この経費を削除しますか？')) return; const item=state.expenses.find((x)=>x.id===id); if(item?.receiptId) await deleteReceipt(item.receiptId); state.expenses=state.expenses.filter((x)=>x.id!==id); persist('経費を削除しました'); }

async function viewReceipt(id) { const receipt=await getReceipt(id); if(!receipt) return toast('画像が見つかりません'); document.querySelector('#modal-content').innerHTML=`<h2 id="modal-title">${esc(receipt.name)}</h2><img src="${receipt.dataUrl}" alt="${esc(receipt.name)}のレシート">`; document.querySelector('#modal').classList.remove('hidden'); }
function closeModal(){ document.querySelector('#modal')?.classList.add('hidden'); }

async function importCsvFile(event) {
  const file=event.target.files?.[0]; if(!file) return;
  try { const text=await file.text(); const normalized=normalizeTransactions(parseCsv(text),file.name); state.importedTransactions=normalized.map((x)=>({id:uid(),...x,category:'旅費交通費',businessRatio:100})); persist(`${normalized.length}件を取り込みました`); }
  catch(error){ toast(`CSV取込エラー: ${error.message}`); }
}

function updateImportedRow(event){ const tr=event.target.closest('[data-import-id]'); const item=state.importedTransactions.find((x)=>x.id===tr.dataset.importId); if(!item)return; item.status=tr.querySelector('[data-import-status]').value; item.category=tr.querySelector('[data-import-category]').value; item.businessRatio=Number(tr.querySelector('[data-import-ratio]').value||100); saveState(state); }

function applyImportedTransactions(){
  document.querySelectorAll('[data-import-id]').forEach((tr)=>{ const item=state.importedTransactions.find((x)=>x.id===tr.dataset.importId); if(!item)return; item.status=tr.querySelector('[data-import-status]').value; item.category=tr.querySelector('[data-import-category]').value; item.businessRatio=Number(tr.querySelector('[data-import-ratio]').value||100); });
  let added=0;
  for(const item of state.importedTransactions){
    if(!['business','allocated'].includes(item.status)) continue;
    if(state.expenses.some((x)=>x.importedId===item.id)) continue;
    state.expenses.push({id:uid(), importedId:item.id, date:item.date, description:item.description||'カード利用', merchant:item.description, amount:item.amount, category:item.category||'雑費', paymentMethod:'personal_card', businessRatio:item.status==='allocated'?item.businessRatio:100, receiptId:null, memo:`CSV: ${item.sourceFile}`, createdAt:new Date().toISOString()});
    added++;
  }
  persist(`${added}件を経費へ反映しました`);
}

async function downloadBackup(){ const payload=await exportBackup(state); downloadBlob(`aoi-ledger-backup-${today()}.json`, JSON.stringify(payload,null,2),'application/json'); toast('バックアップを保存しました'); }
async function restoreBackup(event){ const file=event.target.files?.[0]; if(!file)return; try { state=await importBackup(JSON.parse(await file.text())); toast('バックアップを復元しました'); render(); } catch(error){ toast(error.message); } }

function saveSettings(event){ event.preventDefault(); const data=Object.fromEntries(new FormData(event.currentTarget)); state.settings={...state.settings,businessStartDate:data.businessStartDate,reserveRate:Number(data.reserveRate),vehicleDefaultRatio:Number(data.vehicleDefaultRatio),businessName:data.businessName.trim()}; persist('設定を保存しました'); }

function persist(message){ saveState(state); render(); toast(message); }
function toast(message){ const el=document.querySelector('#toast'); if(!el)return; el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }

function exportCsv(type){
  let headers=[], rows=[];
  if(type==='sales'){ headers=['日付','売上','チップ','出勤先','メモ']; rows=state.sales.map((x)=>[x.date,x.amount,x.tip,x.location,x.memo]); }
  if(type==='expenses'){ headers=['日付','内容','支払先','支出額','事業割合','必要経費額','勘定科目','支払方法','メモ']; rows=state.expenses.map((x)=>[x.date,x.description,x.merchant,x.amount,x.businessRatio,expenseBusinessAmount(x),x.category,paymentLabels[x.paymentMethod]||x.paymentMethod,x.memo]); }
  if(type==='journal'){ headers=['日付','摘要','借方','貸方','金額']; rows=buildJournal(state.sales,state.expenses).map((x)=>[x.date,x.description,x.debitAccount,x.creditAccount,x.amount]); }
  const csv=[headers,...rows].map((row)=>row.map(csvCell).join(',')).join('\r\n'); downloadBlob(`aoi-ledger-${type}-${today()}.csv`,`\uFEFF${csv}`,'text/csv;charset=utf-8');
}
function csvCell(value){ const s=String(value??''); return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s; }
function downloadBlob(name,content,type){ const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }

render();
