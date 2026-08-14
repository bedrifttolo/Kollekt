import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../i18n/helpers';
import { springSoft } from '../../lib/motion';
import { selectionFeedback } from '../../lib/haptics';
import { parseMonthKey, type MonthTotal } from '../../lib/expenseStats';

/** Tallest a bar may draw, in px. The strip's own height is fixed to this so the row does not
 *  reflow as bars grow in — a shifting baseline makes the whole card look unstable. */
const MAX_BAR = 72;

/**
 * Household spend for the last few months, as a row of bars.
 *
 * One series, so no legend and no categorical palette — a single hue is the whole encoding, with
 * the selected month picked out. Months with no spending stay in as floor-height bars: the gap is
 * itself information, and dropping them would make the spacing lie about time.
 *
 * Bars grow from the baseline on mount and spring when the selection moves, so paging through
 * months reads as the same bars changing rather than a new picture each time.
 */
export default function MonthStrip({
  months,
  selectedKey,
  onSelect,
  animateIn = true,
}: {
  months: MonthTotal[];
  selectedKey: string;
  onSelect: (key: string) => void;
  /** Set false on a warm re-navigation so the grow-in doesn't replay every time the page (which
   *  fully remounts on every tab switch) is revisited — only a genuine cold load animates. */
  animateIn?: boolean;
}) {
  const { t } = useTranslation();
  const max = Math.max(...months.map((month) => month.total), 1);

  return (
    <div className="flex items-end justify-between gap-1.5" role="group" aria-label={t('economy.stats.monthsLabel')}>
      {months.map((month, index) => {
        const { year, monthIndex } = parseMonthKey(month.key);
        const isSelected = month.key === selectedKey;
        // Short month initial: enough to orient without crowding six labels onto a phone.
        const label = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(year, monthIndex, 1));
        // Floor of 6px so an empty month is still a visible, aimable target rather than a hairline.
        const height = Math.max(6, (month.total / max) * MAX_BAR);
        return (
          <button
            key={month.key}
            type="button"
            onClick={() => {
              if (isSelected) return;
              void selectionFeedback();
              onSelect(month.key);
            }}
            aria-pressed={isSelected}
            aria-label={`${label} ${year}: ${formatCurrency(month.total)}`}
            className="group flex flex-1 flex-col items-center justify-end gap-1.5"
            style={{ minHeight: 'var(--ctl-md)' }}
          >
            <span className={`text-[11px] font-bold tabular-nums ${isSelected ? 'text-foreground' : 'text-transparent'}`}>
              {month.total > 0 ? formatCurrency(month.total) : ''}
            </span>
            <span className="flex w-full items-end" style={{ height: MAX_BAR }}>
              <motion.span
                className={`w-full rounded-t-md ${isSelected ? 'bg-primary' : 'bg-muted group-hover:bg-primary/30'}`}
                initial={animateIn ? { height: 0 } : false}
                animate={{ height, scaleX: isSelected ? 1 : 0.72 }}
                transition={{ ...springSoft, delay: animateIn ? index * 0.04 : 0 }}
                style={{ originY: 1 }}
              />
            </span>
            <span className={`text-xs font-semibold ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
