export function getCurrentMonthKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function deriveMonthKeyFromDate(date: string): string {
  if (!date || date.length < 7) {
    return getCurrentMonthKey();
  }
  return date.slice(0, 7);
}

export function previousMonthKey(monthKey: string): string {
  const [yearString, monthString] = monthKey.split("-");
  const year = Number(yearString);
  const month = Number(monthString);

  const current = new Date(year, month - 1, 1);
  current.setMonth(current.getMonth() - 1);

  return getCurrentMonthKey(current);
}

export function formatPkr(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `₨ ${new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 0,
  }).format(safeAmount)}`;
}
