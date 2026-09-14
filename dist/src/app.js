import { buildJournal, expenseBusinessAmount, monthlySummary } from './domain/accounting.js';
import { normalizeTransactions, parseCsv } from './domain/csv.js';
import { deleteReceipt, exportBackup, getReceipt, importBackup, loadState, putReceipt, saveState } from './storage.js';

let state = loadState();
let route = 'dashboard';
let selectedMonth = new Date().toISOString().slice(0, 7);

const categories = ['旅費交通費','車両費','消耗品費','通信費','広告宣伝費','支払手数料','研修費','地代家賃','水道光熱費','雑費'];
const paymentLabels = { cash: '現金', personal_card: '私用カード', business_bank: '事業用口座' };
const money = (value) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(Number(value || 0));
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);

const nav = [
  ['dashboard','⌂','ダッシュボード'], ['sales','¥','売上'], ['expenses','▣','経費'],
  ['import','⇩','カードCSV'], ['journal','⇄','仕訳帳'], ['backup','⤓','バックアップ'], ['settings','⚙','設定']
];

function appShell(content, title, subtitle = '') {
  return `
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">青</div><div><h1>青色帳簿</h1><small>自分専用 会計ノート</small></div></div>
      <nav class="nav">${nav.map(([key, icon, label]) => `<button class="nav-button ${route===key?'active':''}" data-route="${key}"><span class="nav-icon">${icon}</span>${label}</button>`).join('')}</nav>
      <div class="sidebar-note">2026年分から記録<br>画面はかんたん、内部は複式簿記。</div>
    </aside>
    <main class="main">
      <header class="page-header"><div><h2>${title}</h2><p>${subtitle}</p></div><div class="header-actions">${route==='dashboard'?monthPicker():''}</div></header>
      ${content}
    </main>
  </div><div id="toast" class="toast"></div><div id="modal" class="modal hidden"><div class="modal-card"><div class="actions" style="margin-bottom:10px"><button class="btn ghost" data-close-modal>閉じる</button></div><div id="modal-content"></div></div></div>`;
}

function monthPicker() {
  return `<input id="month-picker" class="month-picker" type="month" value="${selectedMonth}">`;
}

function render() {
  const views = { dashboard: dashboardView, sales: salesView, expenses: expensesView, import: importView, journal: journalView, backup: backupView, settings: settingsView };
  document.querySelector('#app').innerHTML = views[route]();
  bindCommon();
  bindView();
}

function dashboardView() {
  const s = monthlySummary(state.sales, state.expenses, selectedMonth, state.settings.reserveRate);
  const monthSales = state.sales.filter((x)=>x.date.startsWith(selectedMonth));
  const monthExpenses = state.expenses.filter((x)=>x.date.startsWith(selectedMonth));
  const avgDay = monthSales.length ? Math.round(s.sales / monthSales.length) : 0;
  const expenseRate = s.sales > 0 ? Math.min(100, Math.round(s.expenses / s.sales * 100)) : 0;
  const recent = [...buildJournal(state.sales, state.expenses)].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  const content = `
    <div class="card-grid">
      ${metric('今月の売上', money(s.sales), `${monthSales.length}日分を登録`)}
      ${metric('必要経費', money(s.expenses), `売上比 ${expenseRate}%`)}
      ${metric('事業利益', money(s.profit), `平均日商 ${money(avgDay)}`)}
      ${metric('使える目安', money(s.available), `積立 ${state.settings.reserveRate}%：${money(s.reserve)}`, true)}
    </div>
    <div class="two-col">
      <section class="panel"><div class="panel-title"><div><h3>最近の記録</h3><p>売上と経費から自動生成した仕訳</p></div><button class="btn ghost small" data-route="journal">仕訳帳を見る</button></div>${journalTable(recent)}</section>
      <div>
        <section class="panel"><div class="panel-title"><div><h3>今月のバランス</h3><p>売上に対する必要経費の割合</p></div></div>
          <div class="kpi-row"><div class="kpi"><span class="subtle">経費率</span><strong>${expenseRate}%</strong><div class="progress"><div style="width:${expenseRate}%"></div></div></div><div class="kpi"><span class="subtle">経費件数</span><strong>${monthExpenses.length}件</strong></div></div>
        </section>
        <div class="notice">税・社会保険の積立額は設定した割合からの<strong>資金管理用の目安</strong>です。実際の税額・国保額を確定する機能ではありません。</div>
      </div>
    </div>`;
  return appShell(content, 'ダッシュボード', '売上・経費・利益をひと目で確認');
}

function metric(label, value, hint, accent=false) { return `<section class="metric-card ${accent?'accent':''}"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-hint">${hint}</div></section>`; }

function salesView() {
  const rows = [...state.sales].sort((a,b)=>b.date.localeCompare(a.date));
  const content = `<section class="panel"><div class="panel-title"><div><h3>売上を登録</h3><p>1日分をまとめて入力。チップは別欄で残せます。</p></div></div>
    <form id="sale-form" class="form-grid">
      ${field('日付', `<input name="date" type="date" required value="${today()}">`, 3)}
      ${field('売上合計', '<input name="amount" type="number" min="0" step="1" required placeholder="26000">', 3)}
      ${field('チップ', '<input name="tip" type="number" min="0" step="1" value="0">', 2)}
      ${field('出勤先', '<input name="location" placeholder="tan">', 4)}
      ${field('メモ', '<input name="memo" placeholder="延長あり、など">', 8)}
      <div class="span-4 actions"><button class="btn primary" type="submit">売上を保存</button></div>
    </form></section>
    <section class="panel"><div class="panel-title"><div><h3>売上一覧</h3><p>${rows.length}件</p></div><button class="btn ghost small" data-export="sales">CSV出力</button></div>${salesTable(rows)}</section>`;
  return appShell(content, '売上', 'その日の売上合計を1件として記録');
}

function expensesView() {
  const rows = [...state.expenses].sort((a,b)=>b.date.localeCompare(a.date));
  const categoryOptions = categories.map((x)=>`<option>${x}</option>`).join('');
  const content = `<section class="panel"><div class="panel-title"><div><h3>経費を登録</h3><p>レシート1枚・支出1件ごとに登録します。</p></div></div>
    <form id="expense-form" class="form-grid">
      ${field('日付', `<input name="date" type="date" required value="${today()}">`, 3)}
      ${field('内容', '<input name="description" required placeholder="駐車場代">', 5)}
      ${field('金額', '<input name="amount" type="number" min="0" step="1" required placeholder="2400">', 4)}
      ${field('店名・支払先', '<input name="merchant" placeholder="タイムズ">', 4)}
      ${field('勘定科目', `<select name="category">${categoryOptions}</select>`, 4)}
      ${field('支払方法', `<select name="paymentMethod"><option value="cash">現金</option><option value="personal_card">私用カード</option><option value="business_bank">事業用口座</option></select>`, 4)}
      ${field('事業利用割合 %', '<input name="businessRatio" type="number" min="0" max="100" value="100">', 3)}
      ${field('レシート画像', '<input name="receipt" type="file" accept="image/*">', 5)}
      ${field('メモ', '<input name="memo" placeholder="仕事日のみ、など">', 4)}
      <div class="span-12 actions"><button class="btn primary" type="submit">経費を保存</button></div>
    </form></section>
    <section class="panel"><div class="panel-title"><div><h3>経費一覧</h3><p>按分後の経費額も表示</p></div><button class="btn ghost small" data-export="expenses">CSV出力</button></div>${expensesTable(rows)}</section>`;
  return appShell(content, '経費', '1件ずつ登録して、必要経費額を自動計算');
}

function importView() {
  const rows = state.importedTransactions;
  const options = categories.map((x)=>`<option>${x}</option>`).join('');
  const table = rows.length ? `<div class="table-wrap"><table><thead><tr><th>日付</th><th>内容</th><th class="money">金額</th><th>扱い</th><th>科目</th><th>按分%</th></tr></thead><tbody>${rows.map((r)=>`<tr data-import-id="${r.id}"><td>${esc(r.date)}</td><td>${esc(r.description)}</td><td class="money">${money(r.amount)}</td><td><select data-import-status><option value="pending" ${r.status==='pending'?'selected':''}>未処理</option><option value="business" ${r.status==='business'?'selected':''}>事業</option><option value="personal" ${r.status==='personal'?'selected':''}>私用</option><option value="allocated" ${r.status==='allocated'?'selected':''}>按分</option></select></td><td><select data-import-category>${options.replace(`>${r.category||''}<`,` selected>${r.category||''}<`)}</select></td><td><input data-import-ratio type="number" min="0" max="100" value="${r.businessRatio ?? 100}" style="width:72px"></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">CSVを取り込むと、ここに明細が表示されます。</div>';
  const content = `<section class="panel"><div class="panel-title"><div><h3>カード明細CSV</h3><p>共用カードの明細から事業分だけ経費にします。</p></div></div>
    <div class="file-box"><input id="csv-file" type="file" accept=".csv,text/csv"><p class="subtle">利用日・利用先・利用金額などの一般的な列名に対応</p></div></section>
    <section class="panel"><div class="panel-title"><div><h3>取込明細</h3><p>事業・私用・按分を選択してから反映</p></div><div class="actions"><button class="btn ghost small" id="clear-import">取込を消去</button><button class="btn primary small" id="apply-import">経費へ反映</button></div></div>${table}</section>`;
  return appShell(content, 'カードCSV', '私用と事業が混ざったカードでも分けて管理');
}

function journalView() {
  const entries = buildJournal(state.sales, state.expenses);
  const content = `<section class="panel"><div class="panel-title"><div><h3>自動仕訳</h3><p>通常入力から自動生成。借方・貸方を直接入力する必要はありません。</p></div><button class="btn ghost small" data-export="journal">CSV出力</button></div>${journalTable(entries)}</section>`;
  return appShell(content, '仕訳帳', '複式簿記の土台となる仕訳を確認');
}

function backupView() {
  const content = `<section class="panel"><div class="panel-title"><div><h3>完全バックアップ</h3><p>売上・経費・設定・レシート画像を1つのJSONに保存します。</p></div></div>
    <div class="actions" style="justify-content:flex-start"><button id="download-backup" class="btn primary">バックアップを保存</button><label class="btn ghost">バックアップを復元<input id="restore-backup" class="hidden" type="file" accept="application/json,.json"></label></div></section>
    <section class="panel"><div class="panel-title"><div><h3>表計算用CSV</h3><p>Excelなどで確認したい場合はこちら。</p></div></div><div class="actions" style="justify-content:flex-start"><button class="btn ghost" data-export="sales">売上CSV</button><button class="btn ghost" data-export="expenses">経費CSV</button><button class="btn ghost" data-export="journal">仕訳CSV</button></div></section>
    <div class="notice">本番版では、普段のデータをCloudflare D1、レシートをR2へ保存し、Cloudflare Accessで本人だけアクセスできる構成へ移行します。このMVPはブラウザ内保存なので、バックアップを定期的に保存してください。</div>`;
  return appShell(content, 'バックアップ', 'クラウド移行前でもデータを失わないための退避');
}

function settingsView() {
  const s = state.settings;
  const content = `<section class="panel"><div class="panel-title"><div><h3>基本設定</h3><p>資金管理の表示に使う値です。</p></div></div>
    <form id="settings-form" class="settings-grid">
      ${field('事業開始日', `<input name="businessStartDate" type="date" value="${esc(s.businessStartDate)}">`, 12)}
      ${field('税・社会保険の積立目安 %', `<input name="reserveRate" type="number" min="0" max="100" value="${esc(s.reserveRate)}">`, 12)}
      ${field('車の標準事業利用割合 %', `<input name="vehicleDefaultRatio" type="number" min="0" max="100" value="${esc(s.vehicleDefaultRatio)}">`, 12)}
      ${field('屋号（任意）', `<input name="businessName" value="${esc(s.businessName)}" placeholder="未定なら空欄でOK">`, 12)}
      <div class="actions" style="grid-column:1/-1"><button class="btn primary" type="submit">設定を保存</button></div>
    </form></section>`;
  return appShell(content, '設定', '自分専用アプリなので必要なものだけ');
}

function field(label, control, span=12) { return `<div class="field span-${span}"><label>${label}</label>${control}</div>`; }

function salesTable(rows) {
  if (!rows.length) return '<div class="empty">まだ売上がありません。</div>';
  return `<div class="table-wrap"><table><thead><tr><th>日付</th><th>出勤先</th><th class="money">売上</th><th class="money">チップ</th><th class="money">合計</th><th>メモ</th><th></th></tr></thead><tbody>${rows.map((r)=>`<tr><td>${esc(r.date)}</td><td>${esc(r.location)}</td><td class="money">${money(r.amount)}</td><td class="money">${money(r.tip)}</td><td class="money"><strong>${money(Number(r.amount)+Number(r.tip||0))}</strong></td><td>${esc(r.memo)}</td><td><button class="btn danger small" data-delete-sale="${r.id}">削除</button></td></tr>`).join('')}</tbody></table></div>`;
}

function expensesTable(rows) {
  if (!rows.length) return '<div class="empty">まだ経費がありません。</div>';
  return `<div class="table-wrap"><table><thead><tr><th>日付</th><th>内容</th><th>科目</th><th>支払</th><th>割合</th><th class="money">支出</th><th class="money">必要経費</th><th>証憑</th><th></th></tr></thead><tbody>${rows.map((r)=>`<tr><td>${esc(r.date)}</td><td>${esc(r.description)}</td><td><span class="badge">${esc(r.category)}</span></td><td>${esc(paymentLabels[r.paymentMethod]||r.paymentMethod)}</td><td>${r.businessRatio}%</td><td class="money">${money(r.amount)}</td><td class="money"><strong>${money(expenseBusinessAmount(r))}</strong></td><td>${r.receiptId?`<span class="receipt-chip"><button data-view-receipt="${r.receiptId}">画像を見る</button></span>`:'—'}</td><td><button class="btn danger small" data-delete-expense="${r.id}">削除</button></td></tr>`).join('')}</tbody></table></div>`;
}

function journalTable(rows) {
  if (!rows.length) return '<div class="empty">記録を入れると自動仕訳が表示されます。</div>';
  return `<div class="table-wrap"><table><thead><tr><th>日付</th><th>摘要</th><th>借方</th><th>貸方</th><th class="money">金額</th></tr></thead><tbody>${rows.map((r)=>`<tr><td>${esc(r.date)}</td><td>${esc(r.description)}</td><td>${esc(r.debitAccount)}</td><td>${esc(r.creditAccount)}</td><td class="money">${money(r.amount)}</td></tr>`).join('')}</tbody></table></div>`;
}

function bindCommon() {
  document.querySelectorAll('[data-route]').forEach((el)=>el.addEventListener('click',()=>{ route=el.dataset.route; render(); }));
  document.querySelector('#month-picker')?.addEventListener('change',(e)=>{ selectedMonth=e.target.value; render(); });
  document.querySelectorAll('[data-export]').forEach((el)=>el.addEventListener('click',()=>exportCsv(el.dataset.export)));
  document.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
  document.querySelector('#modal')?.addEventListener('click',(e)=>{ if(e.target.id==='modal') closeModal(); });
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

async function viewReceipt(id) { const receipt=await getReceipt(id); if(!receipt) return toast('画像が見つかりません'); document.querySelector('#modal-content').innerHTML=`<p><strong>${esc(receipt.name)}</strong></p><img src="${receipt.dataUrl}" alt="レシート">`; document.querySelector('#modal').classList.remove('hidden'); }
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
