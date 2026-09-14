# 青色帳簿（仮） Design Spec

## Goal
PC中心で使う自分専用の個人事業向け帳簿アプリ。日々の入力を簡単にしつつ、内部では複式簿記の仕訳データを生成し、青色申告へつなげられるデータを蓄積する。

## Scope: Phase 1 MVP
- 売上は1日合計で登録する。
- 経費は1件ずつ登録する。
- 経費にはレシート画像を添付できる。
- 経費は勘定科目、支払方法、事業利用割合を保持する。
- 売上・経費から仕訳帳を自動生成する。
- 共用クレジットカード明細はCSV取込し、事業/私用/按分の判断前の候補として確認できる。
- 月別の売上、経費、利益、税・社会保険積立目安、残額をダッシュボード表示する。
- 会計データをJSONで完全バックアップできる。CSV出力も可能にする。
- 2026年分から入力できる。

## UX
- PC中心の2カラム構成。左に固定サイドバー、右に作業領域。
- 日常操作では借方/貸方を意識させない。
- 金額は円で扱い、小数は使わない。
- 入力フォームは可能な限り1画面内で完結させる。

## Accounting rules for MVP
- 現金売上: 借方「現金」 / 貸方「売上高」。
- 現金払い経費: 借方「選択した経費科目」 / 貸方「現金」。
- 私用カード払い経費: 借方「選択した経費科目」 / 貸方「事業主借」。
- 事業用口座払い経費: 借方「選択した経費科目」 / 貸方「普通預金」。
- 家事按分がある経費は、登録金額 × 事業利用割合（%）を必要経費額として仕訳する。
- 端数は円未満四捨五入する。

## Data model
### Sale
- id
- date
- amount
- tip
- location
- memo
- createdAt

### Expense
- id
- date
- description
- merchant
- amount
- category
- paymentMethod: cash | personal_card | business_bank
- businessRatio: 0-100
- receiptId nullable
- memo
- createdAt

### Receipt
- id
- name
- mimeType
- image blob/data

### ImportedTransaction
- id
- date
- description
- amount
- sourceFile
- status: pending | business | personal | allocated

### Settings
- businessStartDate default 2026-09-11
- reserveRate default 25
- businessName default empty
- vehicleDefaultRatio default 100

## Persistence
Phase 1 runnable prototype stores structured data in browser localStorage and receipt images in IndexedDB. Backup export includes structured data and receipts. Production migration target is Cloudflare D1 for structured data and R2 for receipts, protected by Cloudflare Access.

## Future phases
- Cloudflare D1/R2 persistence and Cloudflare Access.
- Receipt OCR: date, total, merchant extraction and account suggestion.
- Bank/card automatic API integration after CSV import stabilizes.
- Fixed asset ledger and depreciation.
- Full blue-return reports (trial balance, general ledger, balance sheet, P&L) and e-Tax export support.

## Non-goals for MVP
- Direct electronic filing to e-Tax.
- Automatic tax calculation that substitutes for official tax software or professional advice.
- Multi-user support, billing, subscriptions, or public signup.
