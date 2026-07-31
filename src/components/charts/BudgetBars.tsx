import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check, Pencil } from 'lucide-react';
import { formatCurrency, translateKey } from '../../i18n/helpers';
import { categoryColor, categoryWash, EXPENSE_CATEGORY_ICONS } from '../../lib/expenseCategories';
import { listContainer, listItem, springSoft } from '../../lib/motion';
import { tapFeedback } from '../../lib/haptics';
import type { ExpenseCategory } from '../../lib/expenseStats';
import type { Budget } from '../../lib/types';

/**
 * Self-set monthly spending caps, one bar per category — the household's own limit rather than a
 * comparison against other months. `spent` comes from the same client-side breakdown CategoryBars
 * uses; only the limit itself is persisted server-side (see EconomyOperations.getBudgets/upsertBudget).
 *
 * A category with no limit set (monthlyLimit === 0) renders as a "set a budget" affordance instead
 * of a 0-width bar, since a real 0 kr cap and "never configured" would otherwise look identical.
 */
export default function BudgetBars({
  budgets,
  spentByCategory,
  onSave,
}: {
  budgets: Budget[];
  spentByCategory: Record<string, number>;
  onSave: (category: ExpenseCategory, monthlyLimit: number) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = (category: ExpenseCategory, current: number) => {
    void tapFeedback();
    setEditing(category);
    setDraft(current > 0 ? String(current) : '');
  };

  const save = async (category: ExpenseCategory) => {
    const value = Math.max(0, Math.round(Number(draft) || 0));
    setSaving(true);
    try {
      await onSave(category, value);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.ul variants={listContainer} initial="hidden" animate="show" className="space-y-1">
      {budgets.map((budget) => {
        const category = budget.category as ExpenseCategory;
        const Icon = EXPENSE_CATEGORY_ICONS[category];
        const spent = spentByCategory[category] ?? 0;
        const hasLimit = budget.monthlyLimit > 0;
        const percent = hasLimit ? (spent / budget.monthlyLimit) * 100 : 0;
        const isOver = hasLimit && spent > budget.monthlyLimit;
        const isNear = hasLimit && !isOver && percent >= 80;
        const barColor = isOver ? 'var(--destructive)' : isNear ? 'var(--tone-butter)' : categoryColor(category);
        const isEditing = editing === category;

        return (
          <li key={category}>
            <button
              type="button"
              onClick={() => (isEditing ? setEditing(null) : startEdit(category, budget.monthlyLimit))}
              className={`flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors ${isEditing ? 'bg-surface-3' : ''}`}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                style={{ background: categoryWash(category), color: categoryColor(category) }}
              >
                <Icon className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-bold">
                    {translateKey('common.expenseCategories', category, category)}
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {hasLimit
                      ? t('economy.budgets.spentOfLimit', {
                        spent: formatCurrency(spent),
                        limit: formatCurrency(budget.monthlyLimit),
                      })
                      : t('economy.budgets.setBudget')}
                  </span>
                </div>
                {hasLimit ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: barColor }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(spent > 0 ? 2 : 0, percent))}%` }}
                        transition={springSoft}
                      />
                    </div>
                    {isOver && (
                      <span className="shrink-0 text-[11px] font-bold text-destructive">
                        {t('economy.budgets.over', { amount: formatCurrency(spent - budget.monthlyLimit) })}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted" />
                )}
              </div>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>

            <AnimatePresence>
              {isEditing && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex items-center gap-2 px-1.5 pb-1.5 pt-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="decimal"
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void save(category)}
                      placeholder={t('economy.budgets.limitPlaceholder')}
                      className="w-full flex-1 rounded-lg bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={() => void save(category)}
                      disabled={saving}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg gradient-primary text-ink-foreground disabled:opacity-60"
                      aria-label={t('economy.saveChanges')}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </motion.ul>
  );
}
