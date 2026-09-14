const paymentCreditAccount = {
  cash: '現金',
  personal_card: '事業主借',
  business_bank: '普通預金',
};

export function expenseBusinessAmount(expense) {
  const ratio = Number.isFinite(Number(expense.businessRatio)) ? Number(expense.businessRatio) : 100;
  return Math.round(Number(expense.amount || 0) * Math.min(100, Math.max(0, ratio)) / 100);
}

export function buildJournal(sales, expenses) {
  const saleEntries = sales.map((sale) => ({
    id: `sale-${sale.id}`,
    date: sale.date,
    description: `売上${sale.location ? ` ${sale.location}` : ''}`,
    debitAccount: '現金',
    creditAccount: '売上高',
    amount: Number(sale.amount || 0) + Number(sale.tip || 0),
    sourceType: 'sale',
    sourceId: sale.id,
  }));

  const expenseEntries = expenses
    .map((expense) => ({
      id: `expense-${expense.id}`,
      date: expense.date,
      description: expense.description || expense.merchant || '経費',
      debitAccount: expense.category || '雑費',
      creditAccount: paymentCreditAccount[expense.paymentMethod] || '事業主借',
      amount: expenseBusinessAmount(expense),
      sourceType: 'expense',
      sourceId: expense.id,
    }))
    .filter((entry) => entry.amount > 0);

  return [...saleEntries, ...expenseEntries].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate) return byDate;
    if (a.sourceType !== b.sourceType) return a.sourceType === 'sale' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function monthlySummary(sales, expenses, month, reserveRate = 25) {
  const inMonth = (item) => String(item.date || '').startsWith(month);
  const salesTotal = sales.filter(inMonth).reduce((sum, sale) => sum + Number(sale.amount || 0) + Number(sale.tip || 0), 0);
  const expenseTotal = expenses.filter(inMonth).reduce((sum, expense) => sum + expenseBusinessAmount(expense), 0);
  const profit = salesTotal - expenseTotal;
  const reserve = Math.max(0, Math.round(profit * Number(reserveRate || 0) / 100));
  return {
    sales: salesTotal,
    expenses: expenseTotal,
    profit,
    reserve,
    available: profit - reserve,
  };
}
