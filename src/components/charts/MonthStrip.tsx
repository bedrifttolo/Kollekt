import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../i18n/helpers';
import { parseMonthKey, type MonthTotal } from '../../lib/expenseStats';

/**
 * Household spend for the last few months, as a row of bars.
 *
 * One series, so no legend and no categorical palette — a single hue is the whole encoding, with
 * the selected month picked out. Months with no spending stay in as zero-height bars: the gap is
 * itself information, and dropping them would make the spacing lie about time.
 */
export default function MonthStrip({
  months,
  selectedKey,
  onSelect,
}: {
  months: MonthTotal[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation();
  const max = Math.max(...months.map((month) => month.total), 1);

  return (
    <div className="flex items-end justify-between gap-1.5" role="group" aria-label={t('economy.stats.monthsLabel')}>
      {months.map((month) => {
        const { year, monthIndex } = parseMonthKey(month.key);
        const isSelected = month.key === selectedKey;
        // Short month initial: enough to orient without crowding six labels onto a phone.
        const label = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(year, monthIndex, 1));
        return (
          <button
            key={month.key}
            type="button"
            onClick={() => onSelect(month.key)}
            aria-pressed={isSelected}
            aria-label={`${label} ${year}: ${formatCurrency(month.total)}`}
            className="group flex min-h-11 flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span className={`text-[10px] font-bold tabular-nums ${isSelected ? 'text-foreground' : 'text-muted-foreground/0'}`}>
              {month.total > 0 ? formatCurrency(month.total) : ''}
            </span>
            <span
              className={`w-full rounded-t-[4px] transition-colors ${isSelected ? 'bg-primary' : 'bg-muted group-hover:bg-primary/30'}`}
              // Floor of 3px so an empty month still shows a baseline tick rather than vanishing.
              style={{ height: `${Math.max(3, (month.total / max) * 64)}px` }}
            />
            <span className={`text-[10px] font-semibold ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
