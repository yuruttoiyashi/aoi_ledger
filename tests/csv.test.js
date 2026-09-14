import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, normalizeTransactions } from '../src/domain/csv.js';

test('parseCsv handles quoted commas', () => {
  const rows = parseCsv('日付,内容,金額\n2026/09/11,"ガソリン,ENEOS",5000');
  assert.deepEqual(rows, [{ 日付: '2026/09/11', 内容: 'ガソリン,ENEOS', 金額: '5000' }]);
});

test('normalizeTransactions understands common Japanese headers', () => {
  const rows = [{ 利用日: '2026/09/12', 利用先: 'タイムズ', 利用金額: '2,400' }];
  assert.deepEqual(normalizeTransactions(rows, 'card.csv'), [{
    date: '2026-09-12', description: 'タイムズ', amount: 2400, sourceFile: 'card.csv', status: 'pending'
  }]);
});
