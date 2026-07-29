import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { CheckSquare, Zap, CalendarPlus, Receipt, MessageCircleHeart, Wallet, X, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../i18n/helpers';
import { VibeRing } from './ui-kit';
import { springSoft } from '../lib/motion';
import type { VibeBreakdown } from '../lib/types';
import type { Tone } from '../lib/tones';

/** One input to the vibe score: a label, a current/cap bar (when it has one), and a tip for what
 *  to do next. `delta` is signed so a penalty renders in the destructive colour without a
 *  separate boolean the caller has to remember to pass. */
function FactorRow({
  icon,
  tone,
  label,
  subtitle,
  delta,
  current,
  cap,
  tip,
}: {
  icon: React.ReactNode;
  tone: Tone;
  label: string;
  subtitle: string;
  delta: number;
  current?: number;
  cap?: number;
  tip?: string;
}) {
  const isPenalty = delta < 0;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5">
      <span className={`tone-tile tone-${tone} grid h-10 w-10 shrink-0 place-items-center rounded-[--r-sm]`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold">{label}</span>
          <span className={`shrink-0 font-display text-sm font-extrabold ${isPenalty ? 'text-destructive' : 'text-primary'}`}>
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        {cap !== undefined && current !== undefined && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={`h-full rounded-full ${isPenalty ? 'bg-destructive' : 'bg-primary'}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (current / cap) * 100)}%` }}
              transition={springSoft}
            />
          </div>
        )}
        {tip && <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">{tip}</p>}
      </div>
    </div>
  );
}

export default function VibeSheet({
  score,
  breakdown,
  onClose,
}: {
  score: number;
  breakdown: VibeBreakdown;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const b = breakdown;

  const activityRemaining = Math.max(0, b.activityBonusCap - b.tasksCompletedThisWeek);
  const planningRemaining = Math.max(0, b.planningBonusCap - b.eventsThisWeek);
  const togethernessRemaining = Math.max(0, b.togethernessBonusCap - b.expensesLoggedThisWeek);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="glass max-h-[85vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:rounded-3xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <VibeRing score={score} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-extrabold">{t('dashboard.vibeSheet.title')}</p>
            <p className="text-xs text-muted-foreground">{t('dashboard.vibeSheet.subtitle', { score })}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.cancel')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-muted-foreground">
          {t('dashboard.vibeSheet.base', { base: b.base })}
        </p>

        <div className="space-y-2.5">
          <FactorRow
            icon={<CheckSquare className="h-4 w-4" />}
            tone="mint"
            label={t('dashboard.vibeSheet.taskCompletionLabel')}
            subtitle={t('dashboard.vibeSheet.taskCompletionSubtitle', {
              done: b.completedDueTasksThisWeek,
              due: b.dueTasksThisWeek,
            })}
            delta={b.taskCompletionPoints}
            current={b.taskCompletionRate}
            cap={100}
            tip={
              b.dueTasksThisWeek === 0 || b.completedDueTasksThisWeek === b.dueTasksThisWeek
                ? t('dashboard.vibeSheet.taskCompletionTipDone')
                : t('dashboard.vibeSheet.taskCompletionTip')
            }
          />

          <FactorRow
            icon={<Zap className="h-4 w-4" />}
            tone="butter"
            label={t('dashboard.vibeSheet.activityLabel')}
            subtitle={t('dashboard.vibeSheet.activitySubtitle', { count: b.tasksCompletedThisWeek })}
            delta={b.activityBonus}
            current={b.tasksCompletedThisWeek}
            cap={b.activityBonusCap}
            tip={
              activityRemaining === 0
                ? t('dashboard.vibeSheet.activityTipCapped')
                : t('dashboard.vibeSheet.activityTip', { remaining: activityRemaining })
            }
          />

          <FactorRow
            icon={<CalendarPlus className="h-4 w-4" />}
            tone="peri"
            label={t('dashboard.vibeSheet.planningLabel')}
            subtitle={t('dashboard.vibeSheet.planningSubtitle', { count: b.eventsThisWeek })}
            delta={b.planningBonus}
            current={b.eventsThisWeek}
            cap={b.planningBonusCap}
            tip={
              planningRemaining === 0
                ? t('dashboard.vibeSheet.planningTipCapped')
                : t('dashboard.vibeSheet.planningTip', { remaining: planningRemaining })
            }
          />

          <FactorRow
            icon={<Receipt className="h-4 w-4" />}
            tone="lilac"
            label={t('dashboard.vibeSheet.togethernessLabel')}
            subtitle={t('dashboard.vibeSheet.togethernessSubtitle', { count: b.expensesLoggedThisWeek })}
            delta={b.togethernessBonus}
            current={b.expensesLoggedThisWeek}
            cap={b.togethernessBonusCap}
            tip={
              togethernessRemaining === 0
                ? t('dashboard.vibeSheet.togethernessTipCapped')
                : t('dashboard.vibeSheet.togethernessTip', { remaining: togethernessRemaining })
            }
          />

          <FactorRow
            icon={<MessageCircleHeart className="h-4 w-4" />}
            tone="sage"
            label={t('dashboard.vibeSheet.moodLabel')}
            subtitle={
              b.weeklyAverageMood != null
                ? t('dashboard.vibeSheet.moodSubtitleKnown', { mood: b.weeklyAverageMood.toFixed(1) })
                : t('dashboard.vibeSheet.moodSubtitleUnknown')
            }
            delta={b.moodAdjustment}
            tip={t('dashboard.vibeSheet.moodTip')}
          />

          {b.balancePenalty > 0 ? (
            <button onClick={() => navigate('/economy')} className="block w-full text-left">
              <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3.5">
                <span className="tone-tile tone-blush grid h-10 w-10 shrink-0 place-items-center rounded-[--r-sm]">
                  <Wallet className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold">{t('dashboard.vibeSheet.balanceLabel')}</span>
                    <span className="shrink-0 font-display text-sm font-extrabold text-destructive">-{b.balancePenalty}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('dashboard.vibeSheet.balanceSubtitleUneven', { amount: formatCurrency(b.balanceSpread) })}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-primary">
                    {t('dashboard.vibeSheet.balanceTip')}
                    <ChevronRight className="h-3 w-3" />
                  </p>
                </div>
              </div>
            </button>
          ) : (
            <FactorRow
              icon={<Wallet className="h-4 w-4" />}
              tone="blush"
              label={t('dashboard.vibeSheet.balanceLabel')}
              subtitle={t('dashboard.vibeSheet.balanceSubtitleEven')}
              delta={0}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function VibeSheetPortal({
  open,
  score,
  breakdown,
  onClose,
}: {
  open: boolean;
  score: number;
  breakdown: VibeBreakdown;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && <VibeSheet score={score} breakdown={breakdown} onClose={onClose} />}
    </AnimatePresence>
  );
}
