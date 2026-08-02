import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { formatCurrency, translateKey } from '../../i18n/helpers';
import { categoryColor } from '../../lib/expenseCategories';
import { springSoft } from '../../lib/motion';
import { tapFeedback } from '../../lib/haptics';
import type { CategoryTotal, ExpenseCategory } from '../../lib/expenseStats';
import { CountUp } from '../ui-kit';

/**
 * Where a month's money went, as a segmented ring.
 *
 * This sits *above* CategoryBars rather than replacing it, and the pairing is the point. A ring is
 * the right shape for "how is the month divided" — it shows the whole, so a slice reads as a share
 * without doing arithmetic. It is the wrong shape for "is Groceries bigger than Bills", because
 * comparing arc lengths is the hardest visual judgement there is. The bars underneath answer that
 * second question, and carry the icon, name, amount and percentage as text, so nothing here depends
 * on telling six colours apart.
 *
 * Tapping a segment selects it; the centre then reports that category instead of the month total,
 * and the matching legend row highlights. Selection is owned by the caller so both halves stay in
 * sync.
 */
export default function CategoryDonut({
  categories,
  total,
  selected,
  onSelect,
  size = 188,
  thickness = 26,
  animateIn = true,
}: {
  categories: CategoryTotal[];
  total: number;
  selected: ExpenseCategory | null;
  onSelect: (category: ExpenseCategory | null) => void;
  size?: number;
  thickness?: number;
  /** Set false on a warm re-navigation so the draw-in doesn't replay every time the page (which
   *  fully remounts on every tab switch) is revisited — only a genuine cold load animates. */
  animateIn?: boolean;
}) {
  const { t } = useTranslation();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  // A hairline between segments so two adjacent slices never fuse into one shape. In circumference
  // units, so it stays visually constant if the ring is resized.
  const gap = categories.length > 1 ? circumference * 0.006 : 0;

  const selectedEntry = selected ? categories.find((entry) => entry.category === selected) ?? null : null;

  // Running offset: each segment starts where the previous one ended.
  let cursor = 0;
  const segments = categories.map((entry) => {
    const fraction = total > 0 ? entry.total / total : 0;
    const length = Math.max(0, circumference * fraction - gap);
    const offset = cursor;
    cursor += circumference * fraction;
    return { entry, length, offset };
  });

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        // -90deg so the first (largest) category starts at 12 o'clock and the ring reads clockwise.
        className="-rotate-90"
        role="img"
        aria-label={t('economy.stats.donutLabel', { total: formatCurrency(total) })}
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
        {segments.map(({ entry, length, offset }, index) => {
          const isSelected = entry.category === selected;
          const isDimmed = selected !== null && !isSelected;
          return (
            <motion.circle
              key={entry.category}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={categoryColor(entry.category)}
              // The selected slice thickens outward, which is legible without moving the ring.
              strokeWidth={isSelected ? thickness + 6 : thickness}
              strokeLinecap="butt"
              strokeDasharray={`${length} ${circumference - length}`}
              initial={animateIn ? { strokeDashoffset: 0, opacity: 0 } : false}
              animate={{
                strokeDashoffset: -offset,
                opacity: isDimmed ? 0.35 : 1,
              }}
              transition={{ ...springSoft, delay: animateIn ? 0.05 + index * 0.04 : 0 }}
              className="cursor-pointer"
              onClick={() => {
                void tapFeedback();
                onSelect(isSelected ? null : entry.category);
              }}
            />
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
        {selectedEntry ? (
          <div>
            <p className="truncate text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: categoryColor(selectedEntry.category) }}>
              {translateKey('common.expenseCategories', selectedEntry.category, selectedEntry.category)}
            </p>
            <CountUp value={selectedEntry.total} format={formatCurrency} className="font-display text-2xl font-extrabold leading-tight" />
            <p className="text-[11px] font-semibold text-muted-foreground">
              {Math.round(selectedEntry.percent)}% · {t('economy.stats.expenseCount', { count: selectedEntry.count })}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.1em] text-muted-foreground">
              {t('economy.stats.monthTotal')}
            </p>
            <CountUp value={total} format={formatCurrency} className="font-display text-2xl font-extrabold leading-tight" />
          </div>
        )}
      </div>
    </div>
  );
}
