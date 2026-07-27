import type { Expense } from './types';

/**
 * Monthly spending aggregation, computed on the client.
 *
 * `GET /economy/summary` already returns the collective's entire expense history with category,
 * date, payer and participants, so nothing here needs a new endpoint. Everything is a pure
 * function of that array, which also keeps it trivially testable and re-derivable when a realtime
 * event lands.
 *
 * Money is whole NOK end to end (the backend stores `amount` as an Int), so shares are computed as
 * doubles and rounded only at the end — matching EconomyOperations.calculateBalances, which does
 * the same. Rounding per-expense instead would drift from the balances shown elsewhere.
 */

export const EXPENSE_CATEGORIES = ['Groceries', 'Bills', 'Cleaning', 'Entertainment', 'Food', 'Other'] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Maps any stored category onto the canonical set. The column is constrained as of V60, but old
 *  clients and cached payloads can still surface something unexpected. */
export function normalizeCategory(raw: string): ExpenseCategory {
  const match = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === raw.trim().toLowerCase());
  return match ?? 'Other';
}

/** `YYYY-MM` for an expense, taken from the date string directly to avoid a timezone shift moving
 *  an expense into the neighbouring month. */
export function monthKey(expense: Expense): string {
  return expense.date.slice(0, 7);
}

export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Parses `YYYY-MM` into its year and zero-based month, for formatMonthYear. */
export function parseMonthKey(key: string): { year: number; monthIndex: number } {
  const [year, month] = key.split('-').map(Number);
  return { year, monthIndex: (month ?? 1) - 1 };
}

/** Steps a `YYYY-MM` key by whole months, handling year boundaries. */
export function shiftMonthKey(key: string, delta: number): string {
  const { year, monthIndex } = parseMonthKey(key);
  return monthKeyOf(new Date(year, monthIndex + delta, 1));
}

/** One member's share of an expense, unrounded. Participants can be empty on malformed data;
 *  treat that as "nobody owes a share" rather than dividing by zero. */
export function shareOf(expense: Expense): number {
  const count = expense.participantNames.length;
  return count > 0 ? expense.amount / count : 0;
}

export interface CategoryTotal {
  category: ExpenseCategory;
  /** Total spent by the household in this category, in whole NOK. */
  total: number;
  /** Share of the month's household spend, 0–100. */
  percent: number;
  count: number;
}

export interface MonthTotal {
  key: string;
  /** Household total for the month. */
  total: number;
  /** The current member's share of that month. */
  yourShare: number;
}

export interface MonthBreakdown {
  key: string;
  /** Household total spent in the month. */
  total: number;
  /** What the signed-in member is on the hook for. */
  yourShare: number;
  /** What the signed-in member actually paid out. */
  youPaid: number;
  categories: CategoryTotal[];
  expenses: Expense[];
}

export function expensesForMonth(expenses: Expense[], key: string): Expense[] {
  return expenses.filter((expense) => monthKey(expense) === key);
}

/** Aggregates a single month for the given member. Categories come back sorted by spend, largest
 *  first, with empty categories omitted so the chart has no zero-width slices. */
export function breakdownForMonth(expenses: Expense[], key: string, memberName: string): MonthBreakdown {
  const inMonth = expensesForMonth(expenses, key);
  const total = inMonth.reduce((sum, expense) => sum + expense.amount, 0);

  const byCategory = new Map<ExpenseCategory, { total: number; count: number }>();
  for (const expense of inMonth) {
    const category = normalizeCategory(expense.category);
    const entry = byCategory.get(category) ?? { total: 0, count: 0 };
    entry.total += expense.amount;
    entry.count += 1;
    byCategory.set(category, entry);
  }

  const categories: CategoryTotal[] = [...byCategory.entries()]
    .map(([category, entry]) => ({
      category,
      total: entry.total,
      count: entry.count,
      percent: total > 0 ? (entry.total / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const yourShare = inMonth
    .filter((expense) => expense.participantNames.includes(memberName))
    .reduce((sum, expense) => sum + shareOf(expense), 0);

  const youPaid = inMonth
    .filter((expense) => expense.paidBy === memberName)
    .reduce((sum, expense) => sum + expense.amount, 0);

  return {
    key,
    total,
    yourShare: Math.round(yourShare),
    youPaid,
    categories,
    expenses: inMonth,
  };
}

/**
 * Totals for the `count` months ending at `endKey`, oldest first.
 *
 * Months with no expenses are included as zeroes on purpose: a gap in the bar strip is itself
 * information, and dropping empty months would make the axis lie about the spacing.
 */
export function monthlyTotals(
  expenses: Expense[],
  endKey: string,
  count: number,
  memberName: string,
): MonthTotal[] {
  return Array.from({ length: count }, (_, index) => {
    const key = shiftMonthKey(endKey, index - (count - 1));
    const inMonth = expensesForMonth(expenses, key);
    const yourShare = inMonth
      .filter((expense) => expense.participantNames.includes(memberName))
      .reduce((sum, expense) => sum + shareOf(expense), 0);
    return {
      key,
      total: inMonth.reduce((sum, expense) => sum + expense.amount, 0),
      yourShare: Math.round(yourShare),
    };
  });
}

/** The newest month that has any expense, or the current month when there are none — so the page
 *  opens on data rather than on an empty "this month" for a household that logs sporadically. */
export function latestMonthKey(expenses: Expense[]): string {
  const current = monthKeyOf(new Date());
  if (expenses.length === 0) return current;
  return expenses.reduce((latest, expense) => {
    const key = monthKey(expense);
    return key > latest ? key : latest;
  }, current);
}
