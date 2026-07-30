import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Flame, Star, Pencil, X, SlidersHorizontal, Plus, Trash2, Check, StarHalf, Home, Trophy, Zap, Award, Sparkles, Heart, Crown, Medal, Target, Rocket, Leaf, Sun, Gift, Scale, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useUser, useRealtimeEvent } from '../../context/UserContext';
import { translateKey } from '../../i18n/helpers';
import { Avatar, CountUp, LoadingDot, OverflowMenu, ProgressRing, StatTile } from '../../components/ui-kit';
import { listContainer, listItem, springSoft } from '../../lib/motion';
import { toneByKey } from '../../lib/tones';
import type {
  LeaderboardResponse,
  Achievement,
  AchievementCatalogItem,
  LeaderboardPeriod,
  MemberStats,
  Fairness,
  CustomAchievementMetric,
  TaskCategory,
} from '../../lib/types';

const PERIODS: LeaderboardPeriod[] = ['OVERALL', 'YEAR', 'MONTH'];
const CUSTOM_METRICS: CustomAchievementMetric[] = ['TASKS_COMPLETED', 'XP_EARNED', 'STREAK_DAYS', 'EARLY_COMPLETIONS', 'ON_TIME_COMPLETIONS', 'RECURRING_COMPLETIONS', 'CATEGORY_COMPLETIONS'];
const TASK_CATEGORIES: TaskCategory[] = ['CLEANING', 'VACUUMING', 'MOPPING', 'BATHROOM', 'KITCHEN', 'LAUNDRY', 'DISHES', 'TRASH', 'DUSTING', 'WINDOWS', 'SHOPPING', 'OTHER'];

// Maps the icon key stored on an achievement (built-in or custom) to its lucide component.
const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  check: Check, star: Star, 'star-half': StarHalf, home: Home, trophy: Trophy,
  flame: Flame, zap: Zap, award: Award, sparkles: Sparkles, heart: Heart,
  crown: Crown, medal: Medal, target: Target, rocket: Rocket, leaf: Leaf, sun: Sun,
};
// Icons a member can pick for their own house goal. Must match CUSTOM_ACHIEVEMENT_ICONS in StatsService.kt.
const CUSTOM_ICON_CHOICES = ['sparkles', 'trophy', 'star', 'flame', 'zap', 'heart', 'crown', 'medal', 'target', 'rocket', 'leaf', 'sun'];
const iconFor = (key: string): LucideIcon => ACHIEVEMENT_ICONS[key] ?? Sparkles;

// Podium presentation per finishing place (1st, 2nd, 3rd).
const barHeight: Record<number, string> = { 1: 'h-48', 2: 'h-36', 3: 'h-28' };
// Podium colour comes from the tone ramp rather than tints of primary/accent/destructive, so the
// three places read as a set instead of three unrelated states. Fixed by rank, which is the whole
// point of a podium — here rank *is* the entity.
const barTone: Record<number, string> = {
  1: 'tone-tile tone-butter',
  2: 'tone-tile tone-peri',
  3: 'tone-tile tone-blush',
};
const avatarTone: Record<number, string> = {
  1: 'bg-primary text-primary-foreground',
  2: 'bg-destructive text-destructive-foreground',
  3: 'bg-accent text-accent-foreground',
};
const badgeTone: Record<number, string> = {
  1: 'tone-tile tone-sage',
  2: 'tone-tile tone-mint',
  3: 'tone-tile tone-lilac',
};

function daysToMonthEnd(): number {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

export default function RanksPanel() {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const [period, setPeriod] = useState<LeaderboardPeriod>('OVERALL');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showPrize, setShowPrize] = useState(false);
  const [prize, setPrize] = useState('');

  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStats | null>(null);
  const [memberStatsLoading, setMemberStatsLoading] = useState(false);

  const [showAchievementConfig, setShowAchievementConfig] = useState(false);
  const [catalog, setCatalog] = useState<AchievementCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customMetric, setCustomMetric] = useState<CustomAchievementMetric>('TASKS_COMPLETED');
  const [customTarget, setCustomTarget] = useState('5');
  const [customIcon, setCustomIcon] = useState('sparkles');
  const [customCategory, setCustomCategory] = useState<TaskCategory>('CLEANING');
  const [savingAchievement, setSavingAchievement] = useState(false);

  const name = currentUser?.name ?? '';
  const queryClient = useQueryClient();

  // Cached leaderboard + achievements, keyed by period. Switching back to a period you've
  // already viewed renders from cache instantly and refreshes in the background.
  const ranksQuery = useQuery({
    queryKey: ['ranks', name, period],
    enabled: !!name,
    queryFn: async () => {
      const [lb, ach] = await Promise.all([
        api.get<LeaderboardResponse>(`/leaderboard?memberName=${encodeURIComponent(name)}&period=${period}`),
        api.get<Achievement[]>(`/achievements?memberName=${encodeURIComponent(name)}`),
      ]);
      return { lb, ach };
    },
  });

  // Fairness is period-independent (the backend windows it itself), so it is its own query rather
  // than another leg of the ranks fetch — switching OVERALL/YEAR/MONTH should not refetch it.
  const { data: fairness } = useQuery({
    queryKey: ['fairness', name],
    enabled: !!name,
    queryFn: () => api.get<Fairness>(`/fairness?memberName=${encodeURIComponent(name)}`),
  });

  useEffect(() => {
    if (!ranksQuery.data) return;
    setAchievements(ranksQuery.data.ach);
    setPrize(ranksQuery.data.lb.monthlyPrize ?? '');
  }, [ranksQuery.data]);

  // Read straight off the query rather than mirroring into local state, so a warm cache
  // (switching back to an already-viewed period, or a prefetched first visit) renders
  // instantly on the very first paint instead of flashing the skeleton for one frame.
  const data = ranksQuery.data?.lb ?? null;
  const loading = ranksQuery.isPending;
  // Tracks whether this render followed a real loading state, so the content fade-in below only
  // plays right after a genuine cold load — a warm revisit (loading never true) renders instantly.
  const wasLoadingRef = useRef(loading);

  const fetchData = async (_p: LeaderboardPeriod) => {
    await queryClient.invalidateQueries({ queryKey: ['ranks', name] });
  };

  useRealtimeEvent(
    (event) => {
      if (['TASK_UPDATED', 'TASK_CREATED', 'TASK_DELETED', 'EXPENSE_CREATED', 'BALANCES_SETTLED', 'ACHIEVEMENT_CONFIG_UPDATED'].includes(event.type)) {
        void fetchData(period);
      }
    },
    () => void fetchData(period),
  );

  const handleSetPrize = async () => {
    if (!name) return;
    await api.post(`/monthly-prize?memberName=${encodeURIComponent(name)}`, { prize });
    setShowPrize(false);
    fetchData(period);
  };

  const handleOpenMemberStats = async (memberName: string) => {
    setSelectedMember(memberName);
    setMemberStats(null);
    setMemberStatsLoading(true);
    try {
      const stats = await api.get<MemberStats>(
        `/members/stats?viewerName=${encodeURIComponent(name)}&targetName=${encodeURIComponent(memberName)}`,
      );
      setMemberStats(stats);
    } finally {
      setMemberStatsLoading(false);
    }
  };

  const handleOpenAchievementConfig = async () => {
    setShowAchievementConfig(true);
    if (catalog.length > 0) return;
    setCatalogLoading(true);
    try {
      const items = await api.get<AchievementCatalogItem[]>(`/achievements/catalog?memberName=${encodeURIComponent(name)}`);
      setCatalog(items);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleToggleAchievement = async (key: string, enabled: boolean) => {
    const updated = catalog.map((item) => (item.key === key ? { ...item, enabled } : item));
    setCatalog(updated);
    const enabledKeys = updated.filter((item) => item.enabled).map((item) => item.key);
    await api.patch(`/achievements/config?memberName=${encodeURIComponent(name)}`, { enabledKeys });
  };

  const handleCreateAchievement = async () => {
    const target = Number.parseInt(customTarget, 10);
    if (!customTitle.trim() || !customDescription.trim() || !Number.isInteger(target) || target < 1) return;
    const body = {
      title: customTitle.trim(),
      description: customDescription.trim(),
      metric: customMetric,
      target,
      taskCategory: customMetric === 'CATEGORY_COMPLETIONS' ? customCategory : null,
      icon: customIcon,
    };
    const draft = { customTitle, customDescription, customTarget, customIcon };
    // Optimistic: show the achievement and clear the form immediately, then reconcile.
    const tempId = -Date.now();
    const optimistic: Achievement = {
      id: tempId, key: `custom-${tempId}`, title: body.title, description: body.description,
      icon: customIcon, unlocked: false, progress: 0, total: target, custom: true, createdBy: name,
    };
    setAchievements((current) => [...current, optimistic]);
    setCustomTitle('');
    setCustomDescription('');
    setCustomTarget('5');
    setCustomIcon('sparkles');
    setSavingAchievement(true);
    try {
      const created = await api.post<Achievement>(`/achievements/custom?memberName=${encodeURIComponent(name)}`, body);
      setAchievements((current) => current.map((a) => (a.id === tempId ? created : a)));
    } catch {
      setAchievements((current) => current.filter((a) => a.id !== tempId));
      setCustomTitle(draft.customTitle);
      setCustomDescription(draft.customDescription);
      setCustomTarget(draft.customTarget);
      setCustomIcon(draft.customIcon);
    } finally {
      setSavingAchievement(false);
    }
  };

  const handleDeleteAchievement = async (achievement: Achievement) => {
    await api.delete(`/achievements/custom/${Math.abs(achievement.id)}?memberName=${encodeURIComponent(name)}`);
    setAchievements((current) => current.filter((item) => item.id !== achievement.id));
  };

  if (loading || !data) {
    wasLoadingRef.current = true;
    return (
      <div className="flex items-center justify-center pt-16">
        <LoadingDot />
      </div>
    );
  }
  const justFinishedLoading = wasLoadingRef.current;
  wasLoadingRef.current = false;

  const top3 = data.players.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const ps = data.periodStats;

  return (
    <motion.div initial={justFinishedLoading ? { opacity: 0 } : false} animate={{ opacity: 1 }} className="space-y-5">
      {/* Podium */}
      {podiumOrder.length >= 2 && (
        <div className="flex items-end justify-center gap-3 pt-12">
          {podiumOrder.map((user, i) => (
            <motion.button
              key={user.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => handleOpenMemberStats(user.name)}
              className="relative flex flex-1 flex-col items-center"
            >
              <div className="relative z-10 -mb-5">
                <Avatar name={user.name} className={`h-12 w-12 text-base ${avatarTone[user.rank] ?? 'bg-muted'}`} />
                <span className={`absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full text-xs font-extrabold border-2 border-background ${badgeTone[user.rank] ?? 'bg-muted'}`}>
                  {user.rank}
                </span>
              </div>
              {/* The bar grows from the floor on mount. A podium that is simply *there* on load
                  states a result; one that rises reads as the result of the month's work. */}
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ ...springSoft, delay: 0.1 + i * 0.08 }}
                style={{ originY: 1 }}
                className={`${barHeight[user.rank] ?? 'h-28'} w-full rounded-t-3xl ${barTone[user.rank] ?? 'bg-muted'} flex flex-col items-center justify-end pb-4 pt-8`}
              >
                <CountUp value={user.xp} className="font-display text-2xl font-extrabold" />
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {user.name} · {t('leaderboard.levelShort', { level: user.level })}
                </p>
              </motion.div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Monthly prize (lemon card) */}
      <div className="flex items-start gap-3 rounded-[1.35rem] bg-secondary/25 p-4">
        <Gift className="h-6 w-6 shrink-0 text-secondary-foreground" />
        <div className="min-w-0 flex-1">
          {showPrize ? (
            <div className="space-y-2">
              <input
                value={prize}
                onChange={(e) => setPrize(e.target.value)}
                placeholder={t('leaderboard.monthlyPrizePlaceholder')}
                className="w-full min-h-[var(--ctl-lg)] rounded-lg bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button onClick={handleSetPrize} className="btn-pine min-h-11 flex-1 rounded-lg px-4 py-2 text-sm">
                  {t('leaderboard.savePrize')}
                </button>
                <button onClick={() => setShowPrize(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-card" aria-label={t('common.cancel')}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-display font-extrabold leading-snug">
                {data.monthlyPrize
                  ? `${t('leaderboard.monthlyPrize')} — ${data.monthlyPrize}`
                  : t('leaderboard.monthlyPrizePlaceholder')}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{t('social.prize.resets', { days: daysToMonthEnd() })}</p>
            </>
          )}
        </div>
        {!showPrize && (
          <button onClick={() => setShowPrize(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-card" aria-label={t('leaderboard.savePrize')}>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Period filter */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${p === period ? 'bg-ink text-ink-foreground' : 'bg-card border border-border text-muted-foreground'}`}
          >
            {translateKey('common.leaderboardPeriods', p)}
          </button>
        ))}
      </div>

      {/* Full rankings */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('leaderboard.fullRankings')}</h3>
        {data.players.map((user, i) => (
          <motion.button
            key={user.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => handleOpenMemberStats(user.name)}
            className={`card !p-4 flex w-full items-center gap-3 text-left ${user.name === name ? 'ring-1 ring-primary/30' : ''}`}
          >
            <div className="w-6 text-center font-display font-bold text-sm text-muted-foreground">#{user.rank}</div>
            <Avatar name={user.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium">{user.name}</p>
                <span className="text-[10px] text-muted-foreground">{t('leaderboard.levelShort', { level: user.level })}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{t('leaderboard.tasksCompleted', { count: user.tasksCompleted })}</span>
                <span className="flex items-center gap-0.5"><Flame className="h-2.5 w-2.5 text-secondary" />{t('leaderboard.streak', { count: user.streak })}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display font-bold text-sm">{user.xp}</p>
              <p className="text-[9px] text-muted-foreground">XP</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Period stats. PeriodStatsDto has eleven fields and this card used to show four; the rest
          were fetched on every load and thrown away. The streak, late and skipped counts are the
          ones a household actually argues about, so they belong here. */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-foreground" />
          <p className="text-sm font-semibold">{t('leaderboard.statsTitle', { period: translateKey('common.leaderboardPeriods', period) })}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatTile tone="mint" label={t('leaderboard.stats.totalTasks')} value={<CountUp value={ps.totalTasks} />} />
          <StatTile tone="butter" label={t('leaderboard.stats.totalXp')} value={<CountUp value={ps.totalXp} />} />
          <StatTile tone="peri" label={t('leaderboard.stats.avgXp')} value={<CountUp value={Math.round(ps.avgPerPerson)} />} />
          <StatTile tone="lilac" label={t('leaderboard.stats.topContributor')} value={<span className="truncate text-lg">{ps.topContributor}</span>} />
          {ps.bestStreak > 0 && (
            <StatTile
              tone="blush"
              icon={<Flame className="h-3 w-3" />}
              label={t('leaderboard.stats.bestStreak')}
              value={<CountUp value={ps.bestStreak} />}
              hint={ps.bestStreakHolder}
            />
          )}
          {ps.lateCompletions > 0 && (
            <StatTile
              label={t('leaderboard.stats.lateCompletions')}
              value={<CountUp value={ps.lateCompletions} />}
              hint={ps.lateCompletionsHolder}
            />
          )}
          {ps.skippedCount > 0 && (
            <StatTile
              label={t('leaderboard.stats.skipped')}
              value={<CountUp value={ps.skippedCount} />}
              hint={ps.skippedHolder}
            />
          )}
          {ps.totalPenaltyXp !== 0 && (
            <StatTile label={t('leaderboard.stats.penaltyXp')} value={<CountUp value={ps.totalPenaltyXp} />} />
          )}
        </div>
      </div>

      {/* Fairness. GET /api/fairness has existed since the smart-assignment scaffolding went in and
          has never been called by the app — it answers "is the work actually split evenly", which
          is the question a shared-chores app exists to settle. */}
      {fairness && fairness.shares.length > 1 && (
        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-foreground" />
              <p className="text-sm font-semibold">{t('leaderboard.fairness.title')}</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {t('leaderboard.fairness.window', { days: fairness.windowDays })}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing
              value={fairness.balancePercent}
              size={92}
              thickness={10}
              color={fairness.balancePercent >= 75 ? 'var(--tone-mint)' : fairness.balancePercent >= 50 ? 'var(--tone-butter)' : 'var(--tone-blush)'}
            >
              <div>
                <CountUp value={fairness.balancePercent} className="font-display text-xl font-extrabold" />
                <span className="block text-[8px] font-bold tracking-[.14em] text-muted-foreground">
                  {t('leaderboard.fairness.balanced')}
                </span>
              </div>
            </ProgressRing>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {fairness.shares.map((share) => (
                <li key={share.name} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 truncate text-xs font-semibold">{share.name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.span
                      className="block h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${share.sharePercent}%` }}
                      transition={springSoft}
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {share.sharePercent}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
              <Star className="h-3.5 w-3.5" /> {t('leaderboard.achievements')}
            </h3>
            <button onClick={handleOpenAchievementConfig} aria-label={t('leaderboard.manageAchievements')} className="grid h-11 w-11 place-items-center rounded-lg bg-card">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2">
            {achievements.map((a) => {
              const Icon = iconFor(a.icon);
              // Every AchievementDto already carries progress/total; it was rendered as a 1.5px
              // line under the card. A ring around the badge makes "how close am I" the first
              // thing you see rather than a detail below the fold.
              const hasProgress = a.progress !== undefined && a.total !== undefined && a.total > 0;
              const pct = hasProgress ? (a.progress! / a.total!) * 100 : 0;
              return (
              <motion.div
                key={a.key}
                variants={listItem}
                className={`card !p-3 ${a.unlocked ? `tone-${toneByKey(a.key)} tone-wash tone-edge` : 'opacity-60'}`}
              >
                <div className="flex items-center gap-3">
                  {hasProgress ? (
                    <ProgressRing
                      value={a.unlocked ? 100 : pct}
                      size={44}
                      thickness={4}
                      color={a.unlocked ? 'var(--primary)' : 'var(--secondary)'}
                    >
                      <Icon className={`h-4 w-4 ${a.unlocked ? 'text-primary' : 'text-muted-foreground'}`} />
                    </ProgressRing>
                  ) : (
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${a.unlocked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{t(`leaderboard.achievementKeys.${a.key}.title`, { defaultValue: a.title })}</p>
                    <p className="text-[10px] text-muted-foreground">{t(`leaderboard.achievementKeys.${a.key}.description`, { defaultValue: a.description })}</p>
                    {hasProgress && !a.unlocked && (
                      <p className="mt-1 text-[10px] font-bold tabular-nums text-muted-foreground">{a.progress}/{a.total}</p>
                    )}
                    {a.custom && <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-primary">{t('leaderboard.custom.houseGoal')}</p>}
                  </div>
                </div>
              </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}

      {/* Member stats sheet */}
      <AnimatePresence>
        {selectedMember && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelectedMember(null)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 glass-strong rounded-2xl p-5 pb-6" style={{ width: 'calc(100% - 2rem)', maxWidth: '32rem' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedMember} className="h-10 w-10" />
                  <div>
                    <p className="font-semibold">{selectedMember}</p>
                    {memberStats && <p className="text-[10px] text-muted-foreground">{t('leaderboard.levelShort', { level: memberStats.level })} · #{memberStats.rank}</p>}
                  </div>
                </div>
                <button onClick={() => setSelectedMember(null)} aria-label={t('common.cancel')} className="grid h-11 w-11 place-items-center rounded-xl bg-card"><X className="h-4 w-4" /></button>
              </div>
              {memberStatsLoading && <div className="grid grid-cols-3 gap-2 animate-pulse">{[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-muted/30 rounded-lg" />)}</div>}
              {memberStats && !memberStatsLoading && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'XP', value: memberStats.xp.toString() },
                    { label: 'Streak', value: `${memberStats.streak}d` },
                    { label: 'Tasks done', value: memberStats.tasksCompleted.toString() },
                    { label: 'Late', value: memberStats.lateCompletions.toString() },
                    { label: 'Skipped', value: memberStats.skippedTasks.toString() },
                    { label: 'Achievements', value: `${memberStats.achievementsUnlocked}/${memberStats.achievementsTotal}` },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-background/30 p-2.5 text-center">
                      <p className="font-display font-bold text-sm">{s.value}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Achievement config sheet */}
      <AnimatePresence>
        {showAchievementConfig && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAchievementConfig(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 glass-strong rounded-2xl flex flex-col" style={{ maxHeight: 'calc(100vh - 6rem)', width: 'calc(100% - 2rem)', maxWidth: '32rem' }}>
              <div className="flex items-center justify-between p-5 pb-3 shrink-0">
                <div>
                  <p className="font-semibold">{t('leaderboard.manageAchievements')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('leaderboard.manageAchievementsSubtitle')}</p>
                </div>
                <button onClick={() => setShowAchievementConfig(false)} aria-label={t('common.cancel')} className="grid h-11 w-11 place-items-center rounded-xl bg-card shrink-0"><X className="h-4 w-4" /></button>
              </div>
              <div className="overflow-y-auto px-5 pb-5">
                {catalogLoading && <div className="space-y-2 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted/30 rounded-lg" />)}</div>}
                {!catalogLoading && (
                  <div className="space-y-5">
                    <div>
                      <p className="eyebrow mb-2">{t('leaderboard.custom.builtIn')}</p>
                      {catalog.map((item) => (
                        <button key={item.key} onClick={() => handleToggleAchievement(item.key, !item.enabled)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                          <div className="text-left">
                            <p className="text-sm font-medium">{t(`leaderboard.achievementKeys.${item.key}.title`, { defaultValue: item.title })}</p>
                            <p className="text-[10px] text-muted-foreground">{t(`leaderboard.achievementKeys.${item.key}.description`, { defaultValue: item.description })}</p>
                          </div>
                          <div className={`h-5 w-9 rounded-full transition-colors flex items-center px-0.5 shrink-0 ml-3 ${item.enabled ? 'bg-primary' : 'bg-muted'}`}>
                            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${item.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </button>
                      ))}
                    </div>

                    <div>
                      <p className="eyebrow mb-2">{t('leaderboard.custom.houseGoals')}</p>
                      <div className="space-y-2">
                        {achievements.filter((item) => item.custom).map((item) => (
                          <div key={item.key} className="flex items-center gap-3 rounded-xl bg-background/30 px-3 py-2.5">
                            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.title}</p><p className="text-[10px] text-muted-foreground">{item.description}</p></div>
	                            <OverflowMenu
	                              label={t('common.actions')}
	                              actions={[
	                                {
	                                  label: t('leaderboard.custom.delete'),
	                                  icon: <Trash2 className="h-4 w-4" />,
	                                  destructive: true,
	                                  onSelect: () => {
	                                    void handleDeleteAchievement(item);
	                                  },
	                                },
	                              ]}
	                            />
                          </div>
                        ))}
                        {achievements.every((item) => !item.custom) && <p className="px-3 text-xs text-muted-foreground">{t('leaderboard.custom.none')}</p>}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl bg-background/30 p-3">
                      <div><p className="font-semibold">{t('leaderboard.custom.create')}</p><p className="text-[10px] text-muted-foreground">{t('leaderboard.custom.createHint')}</p></div>
                      <input className="field w-full" maxLength={80} value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder={t('leaderboard.custom.title')} />
                      <textarea className="field min-h-20 w-full resize-none" maxLength={240} value={customDescription} onChange={(event) => setCustomDescription(event.target.value)} placeholder={t('leaderboard.custom.description')} />
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold text-muted-foreground">{t('leaderboard.custom.iconLabel')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {CUSTOM_ICON_CHOICES.map((key) => {
                            const Icon = iconFor(key);
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setCustomIcon(key)}
                                aria-label={key}
                                aria-pressed={customIcon === key}
                                className={`grid h-11 w-11 place-items-center rounded-xl border transition-colors ${customIcon === key ? 'gradient-primary border-transparent text-ink-foreground' : 'border-border bg-card text-muted-foreground'}`}
                              >
                                <Icon className="h-4 w-4" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select className="field" value={customMetric} onChange={(event) => setCustomMetric(event.target.value as CustomAchievementMetric)}>
                          {CUSTOM_METRICS.map((metric) => <option key={metric} value={metric}>{t(`leaderboard.custom.metrics.${metric}`)}</option>)}
                        </select>
                        <input className="field" type="number" min="1" max="10000" value={customTarget} onChange={(event) => setCustomTarget(event.target.value)} aria-label={t('leaderboard.custom.target')} />
                      </div>
                      {customMetric === 'CATEGORY_COMPLETIONS' && (
                        <select className="field w-full" value={customCategory} onChange={(event) => setCustomCategory(event.target.value as TaskCategory)}>
                          {TASK_CATEGORIES.map((category) => <option key={category} value={category}>{t(`common.taskCategories.${category}`)}</option>)}
                        </select>
                      )}
                      <button disabled={savingAchievement || !customTitle.trim() || !customDescription.trim()} onClick={() => void handleCreateAchievement()} className="btn-pine w-full disabled:opacity-50"><Plus className="h-4 w-4" />{t('leaderboard.custom.add')}</button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
