# 青色帳簿 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable PC-first bookkeeping MVP for daily sales, itemized expenses, receipts, CSV import, automatic journal entries, monthly dashboard, and backups.

**Architecture:** Dependency-free browser SPA for the first runnable build, with domain logic isolated in ES modules so it can be moved into React/Cloudflare later. Structured data uses localStorage and receipt blobs use IndexedDB. Accounting and CSV parsing are pure functions covered by Node's built-in test runner.

**Tech Stack:** HTML5, CSS, modern JavaScript ES modules, IndexedDB, localStorage, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-14-aoi-ledger-design.md`

## Global Constraints
- PC-first UI.
- Daily aggregate sales; itemized expenses.
- Money is integer JPY.
- User never needs to enter debit/credit manually for normal operations.
- Shared personal card expenses post the credit side to `事業主借`.
- Business ratio applies only to the deductible expense amount.
- No multi-user or billing features.

---

### Task 1: Accounting engine
**Files:** Create `src/domain/accounting.js`; Create `tests/accounting.test.js`
**Produces:** `expenseBusinessAmount(expense)`, `buildJournal(sales, expenses)`, `monthlySummary(sales, expenses, month, reserveRate)`.
- [ ] Write failing tests for rounding, journal entries, and monthly totals.
- [ ] Run `node --test tests/accounting.test.js` and confirm expected failures.
- [ ] Implement the minimum pure functions.
- [ ] Re-run tests and confirm all pass.

### Task 2: CSV parser
**Files:** Create `src/domain/csv.js`; Create `tests/csv.test.js`
**Produces:** `parseCsv(text)`, `normalizeTransactions(rows, sourceFile)`.
- [ ] Write failing tests for Japanese and English common headers and quoted commas.
- [ ] Run `node --test tests/csv.test.js` and confirm expected failures.
- [ ] Implement parser and normalization.
- [ ] Re-run tests and confirm all pass.

### Task 3: Persistence and receipt storage
**Files:** Create `src/storage.js`
**Produces:** CRUD helpers for app state plus IndexedDB receipt put/get/delete/list.
- [ ] Implement schema-safe localStorage state initialization.
- [ ] Implement IndexedDB receipt CRUD.
- [ ] Implement full backup export/import helpers.

### Task 4: PC-first UI
**Files:** Create `index.html`; Create `styles.css`; Create `src/app.js`
**Produces:** Dashboard, Sales, Expenses, CSV Import, Journal, Backup/Settings views.
- [ ] Build navigation and dashboard cards.
- [ ] Build daily sales form/list/edit-delete workflow.
- [ ] Build expense form/list with category, payment method, business ratio and receipt attachment.
- [ ] Build CSV import preview and transaction classification.
- [ ] Build journal table from domain engine.
- [ ] Build JSON backup/restore and CSV exports.

### Task 5: Verification and packaging
**Files:** Create `README.md`; Create `package.json`
- [ ] Run all Node tests.
- [ ] Serve with `python3 -m http.server` and use headless Chromium to confirm the page renders without console-blocking errors.
- [ ] Check responsive layout at desktop width.
- [ ] Zip the project for handoff.
