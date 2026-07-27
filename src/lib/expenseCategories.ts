import { Banknote, PartyPopper, ShoppingBasket, Sparkles, UtensilsCrossed, Wallet, type LucideIcon } from 'lucide-react';
import type { ExpenseCategory } from './expenseStats';

/**
 * Presentation for the six expense categories: one icon and one colour each.
 *
 * The colour is a CSS variable rather than a literal so it re-steps per theme (see --cat-* in
 * globals.css). The mapping is fixed on purpose — a category's colour must never depend on its
 * rank in a chart, or a filter that reorders the list would repaint every row.
 */
export const EXPENSE_CATEGORY_ICONS: Record<ExpenseCategory, LucideIcon> = {
  Groceries: ShoppingBasket,
  Bills: Banknote,
  Cleaning: Sparkles,
  Entertainment: PartyPopper,
  Food: UtensilsCrossed,
  Other: Wallet,
};

const CATEGORY_VARS: Record<ExpenseCategory, string> = {
  Groceries: '--cat-groceries',
  Bills: '--cat-bills',
  Cleaning: '--cat-cleaning',
  Entertainment: '--cat-entertainment',
  Food: '--cat-food',
  Other: '--cat-other',
};

/** The category's identity colour, for fills and swatches. */
export function categoryColor(category: ExpenseCategory): string {
  return `var(${CATEGORY_VARS[category]})`;
}

/** A soft wash of the identity colour, for the icon tile behind it. Mixed against --card so it
 *  stays legible in every theme rather than assuming a light background. */
export function categoryWash(category: ExpenseCategory): string {
  return `color-mix(in srgb, var(${CATEGORY_VARS[category]}) 16%, var(--card))`;
}
