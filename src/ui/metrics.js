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
