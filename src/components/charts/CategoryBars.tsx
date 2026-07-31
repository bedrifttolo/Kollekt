import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { formatCurrency, translateKey } from '../../i18n/helpers';
import { categoryColor, categoryWash, EXPENSE_CATEGORY_ICONS } from '../../lib/expenseCategories';
import { listContainer, listItem, springSoft } from '../../lib/motion';
import { tapFeedback } from '../../lib/haptics';
import type { CategoryTotal, ExpenseCategory } from '../../lib/expenseStats';

/**
 * Where a month's money went, as ranked horizontal bars — and the legend for CategoryDonut above it.
 *
 * The two halves answer different questions on purpose. The ring shows the month as a whole, so a
 * slice reads as a share. These bars answer "is Groceries actually bigger than Bills", which arc
 * lengths cannot: length along a common baseline is the easiest encoding to compare, and every row
 * is direct-labelled with its icon, name, amount and share, so identity never rests on colour alone.
 * That labelling is also what covers colour-vision deficiency, which a six-slice ring could not do
 * by itself.
 *
 * Rows are tappable and share `selected` with the donut, so highlighting a category in either place
 * highlights it in both.
 */
export default function CategoryBars({
  categories,
  total,
  selected,
  onSelect,
  animateIn = true,
}: {
  categories: CategoryTotal[];
  total: number;
  selected?: ExpenseCategory | null;
  onSelect?: (category: ExpenseCategory | null) => void;
  /** Set false on a warm re-navigation so the stagger-in doesn't replay every time the page
   *  (which fully remounts on every tab switch) is revisited — only a genuine cold load animates. */
  animateIn?: boolean;
}) {
  const { t } = useTranslation();

  if (categories.length === 0) return null;

  // Scaled against the largest category, not the month total, so the smallest bar is still
  // visible when one category dominates.
  const largest = categories[0]?.total || 1;
  const interactive = Boolean(onSelect);

  return (
    <motion.ul variants={listContainer} initial={animateIn ? "hidden" : false} animate="show" className="space-y-1">
      {categories.map((entry) => {
        const Icon = EXPENSE_CATEGORY_ICONS[entry.category];
        const isSelected = selected === entry.category;
        const isDimmed = Boolean(selected) && !isSelected;
        return (
          <motion.li key={entry.category} variants={listItem}>
            <button
              type="button"
              disabled={!interactive}
              aria-pressed={interactive ? isSelected : undefined}
              onClick={() => {
                if (!onSelect) return;
                void tapFeedback();
                onSelect(isSelected ? null : entry.category);
              }}
              className={`flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-opacity disabled:opacity-100 ${
                isSelected ? 'bg-surface-3' : ''
              } ${isDimmed ? 'opacity-55' : ''}`}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                style={{ background: categoryWash(entry.category), color: categoryColor(entry.category) }}
              >
                <Icon className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-bold">
                    {translateKey('common.expenseCategories', entry.category, entry.category)}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{formatCurrency(entry.total)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: categoryColor(entry.category) }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(2, (entry.total / largest) * 100)}%` }}
                      transition={springSoft}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {Math.round(entry.percent)}%
                  </span>
                </div>
              </div>
            </button>
          </motion.li>
        );
      })}
      <li className="flex items-baseline justify-between border-t border-border px-1.5 pt-2.5 text-sm">
        <span className="font-bold">{t('economy.stats.monthTotal')}</span>
        <span className="font-display text-base font-extrabold tabular-nums">{formatCurrency(total)}</span>
      </li>
    </motion.ul>
  );
}
