import { useTranslation } from 'react-i18next';
import { formatCurrency, translateKey } from '../../i18n/helpers';
import { categoryColor, categoryWash, EXPENSE_CATEGORY_ICONS } from '../../lib/expenseCategories';
import type { CategoryTotal } from '../../lib/expenseStats';

/**
 * Where a month's money went, as ranked horizontal bars.
 *
 * Bars rather than a donut: the job here is comparing amounts so a household can budget, and arc
 * lengths are the hardest encoding to compare. Every row is direct-labelled with its icon, name,
 * amount and share, so identity never rests on colour alone — which also covers the colour-vision
 * case that a six-slice pie could not.
 */
export default function CategoryBars({ categories, total }: { categories: CategoryTotal[]; total: number }) {
  const { t } = useTranslation();

  if (categories.length === 0) {
    return (
      <p className="rounded-[--r-lg] border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        {t('economy.stats.emptyMonth')}
      </p>
    );
  }

  // Scaled against the largest category, not the month total, so the smallest bar is still
  // visible when one category dominates.
  const largest = categories[0]?.total || 1;

  return (
    <ul className="space-y-2.5">
      {categories.map((entry) => {
        const Icon = EXPENSE_CATEGORY_ICONS[entry.category];
        return (
          <li key={entry.category} className="flex items-center gap-3">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[--r-sm]"
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
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (entry.total / largest) * 100)}%`,
                      background: categoryColor(entry.category),
                    }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {Math.round(entry.percent)}%
                </span>
              </div>
            </div>
          </li>
        );
      })}
      <li className="flex items-baseline justify-between border-t border-border pt-2.5 text-sm">
        <span className="font-bold">{t('economy.stats.monthTotal')}</span>
        <span className="font-display text-base font-extrabold tabular-nums">{formatCurrency(total)}</span>
      </li>
    </ul>
  );
}
