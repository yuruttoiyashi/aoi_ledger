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
