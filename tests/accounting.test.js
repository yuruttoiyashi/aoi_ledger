import test from 'node:test';
import assert from 'node:assert/strict';
import { expenseBusinessAmount, buildJournal, monthlySummary } from '../src/domain/accounting.js';

test('expenseBusinessAmount rounds the deductible share to whole yen', () => {
  const expense = { amount: 3333, businessRatio: 60 };
  assert.equal(expenseBusinessAmount(expense), 2000);
});

test('buildJournal creates cash sales and personal-card expense entries', () => {
  const sales = [{ id: 's1', date: '2026-09-11', amount: 26000, tip: 1000, location: 'tan' }];
  const expenses = [{
    id: 'e1', date: '2026-09-11', description: 'ガソリン', amount: 5000,
    category: '車両費', paymentMethod: 'personal_card', businessRatio: 60,
  }];

  const journal = buildJournal(sales, expenses);
  assert.deepEqual(journal, [
    {
      id: 'sale-s1', date: '2026-09-11', description: '売上 tan',
      debitAccount: '現金', creditAccount: '売上高', amount: 27000, sourceType: 'sale', sourceId: 's1',
    },
    {
      id: 'expense-e1', date: '2026-09-11', description: 'ガソリン',
      debitAccount: '車両費', creditAccount: '事業主借', amount: 3000, sourceType: 'expense', sourceId: 'e1',
    },
  ]);
});

test('monthlySummary totals only the selected month and applies reserve rate to profit', () => {
  const sales = [
    { id: 's1', date: '2026-09-11', amount: 26000, tip: 1000 },
    { id: 's2', date: '2026-10-01', amount: 13000, tip: 0 },
  ];
  const expenses = [
    { id: 'e1', date: '2026-09-11', amount: 2400, businessRatio: 100 },
    { id: 'e2', date: '2026-09-11', amount: 5000, businessRatio: 60 },
  ];
  const summary = monthlySummary(sales, expenses, '2026-09', 25);
  assert.deepEqual(summary, {
    sales: 27000,
    expenses: 5400,
    profit: 21600,
    reserve: 5400,
    available: 16200,
  });
});
