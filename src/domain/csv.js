function parseLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (!lines.length) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

const DATE_KEYS = ['利用日', '日付', '取引日', 'date', 'Date'];
const DESC_KEYS = ['利用先', '内容', '摘要', '加盟店名', 'description', 'Description'];
const AMOUNT_KEYS = ['利用金額', '金額', '支払金額', 'amount', 'Amount'];

function pick(row, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== '') return row[key];
  }
  return '';
}

function normalizeDate(value) {
  const raw = String(value || '').trim().replace(/[.]/g, '/');
  const match = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (!match) return raw;
  const [, y, m, d] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function normalizeTransactions(rows, sourceFile = '') {
  return rows.map((row) => ({
    date: normalizeDate(pick(row, DATE_KEYS)),
    description: String(pick(row, DESC_KEYS)).trim(),
    amount: Math.abs(Number(String(pick(row, AMOUNT_KEYS)).replace(/[¥￥,\s]/g, '')) || 0),
    sourceFile,
    status: 'pending',
  })).filter((row) => row.date || row.description || row.amount);
}
