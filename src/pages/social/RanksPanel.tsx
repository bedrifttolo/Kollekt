import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Flame, Star, Pencil, X, SlidersHorizontal, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { connectCollectiveRealtime } from '../../lib/realtime';
import { useUser } from '../../context/UserContext';
import { translateKey } from '../../i18n/helpers';
import { Avatar } from '../../components/ui-kit';
import type {
  LeaderboardResponse,
  Achievement,
  AchievementCatalogItem,
  LeaderboardPeriod,
  MemberStats,
  CustomAchievementMetric,
  TaskCategory,
} from '../../lib/types';

const PERIODS: LeaderboardPeriod[] = ['OVERALL', 'YEAR', 'MONTH'];
const CUSTOM_METRICS: CustomAchievementMetric[] = ['TASKS_COMPLETED', 'XP_EARNED', 'STREAK_DAYS', 'EARLY_COMPLETIONS', 'ON_TIME_COMPLETIONS', 'RECURRING_COMPLETIONS', 'CATEGORY_COMPLETIONS'];
const TASK_CATEGORIES: TaskCategory[] = ['CLEANING', 'VACUUMING', 'MOPPING', 'BATHROOM', 'KITCHEN', 'LAUNDRY', 'DISHES', 'TRASH', 'DUSTING', 'WINDOWS', 'SHOPPING', 'OTHER'];

// Podium presentation per finishing place (1st, 2nd, 3rd).
const barHeight: Record<number, string> = { 1: 'h-48', 2: 'h-36', 3: 'h-28' };
const barTone: Record<number, string> = {
  1: 'from-secondary/40 to-secondary/10',
  2: 'from-accent/35 to-accent/10',
  3: 'from-destructive/25 to-destructive/5',
};
const avatarTone: Record<number, string> = {
  1: 'bg-primary text-primary-foreground',
  2: 'bg-destructive text-destructive-foreground',
  3: 'bg-accent text-accent-foreground',
};
const badgeTone: Record<number, string> = {
  1: 'bg-secondary text-secondary-foreground',
  2: 'bg-accent text-accent-foreground',
  3: 'bg-destructive text-destructive-foreground',
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
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showPrize, setShowPrize] = useState(false);
  const [prize, setPrize] = useState('');
  const [loading, setLoading] = useState(true);

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
  const [customCategory, setCustomCategory] = useState<TaskCategory>('CLEANING');
  const [savingAchievement, setSavingAchievement] = useState(false);

  const name = currentUser?.name ?? '';

  const fetchData = async (p: LeaderboardPeriod) => {
    if (!name) return;
    setLoading(true);
    const [lb, ach] = await Promise.all([
      api.get<LeaderboardResponse>(`/leaderboard?memberName=${encodeURIComponent(name)}&period=${p}`),
      api.get<Achievement[]>(`/achievements?memberName=${encodeURIComponent(name)}`),
    ]);
    setData(lb);
    setAchievements(ach);
    setPrize(lb.monthlyPrize ?? '');
    setLoading(false);
  };

  useEffect(() => { fetchData(period); }, [name, period]);

  useEffect(() => {
    if (!name) return;
    return connectCollectiveRealtime(name, (event) => {
      if (['TASK_UPDATED', 'TASK_CREATED', 'TASK_DELETED', 'EXPENSE_CREATED', 'BALANCES_SETTLED', 'ACHIEVEMENT_CONFIG_UPDATED'].includes(event.type)) {
        fetchData(period);
      }
    });
  }, [name, period]);

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
    setSavingAchievement(true);
    try {
      const created = await api.post<Achievement>(`/achievements/custom?memberName=${encodeURIComponent(name)}`, {
        title: customTitle.trim(),
        description: customDescription.trim(),
        metric: customMetric,
        target,
        taskCategory: customMetric === 'CATEGORY_COMPLETIONS' ? customCategory : null,
      });
      setAchievements((current) => [...current, created]);
      setCustomTitle('');
      setCustomDescription('');
      setCustomTarget('5');
    } finally {
      setSavingAchievement(false);
    }
  };

  const handleDeleteAchievement = async (achievement: Achievement) => {
    await api.delete(`/achievements/custom/${Math.abs(achievement.id)}?memberName=${encodeURIComponent(name)}`);
    setAchievements((current) => current.filter((item) => item.id !== achievement.id));
  };

  if (loading || !data) {
    return <div className="space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="glass rounded-xl h-14" />)}</div>;
  }

  const top3 = data.players.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const ps = data.periodStats;

  return (
    <div className="space-y-5">
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
              <div className={`${barHeight[user.rank] ?? 'h-28'} w-full rounded-t-3xl bg-gradient-to-b ${barTone[user.rank] ?? 'from-muted to-muted'} flex flex-col items-center justify-end pb-4 pt-8`}>
                <p className="font-display text-2xl font-extrabold tabular-nums">{user.xp}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {user.name} · {t('leaderboard.levelShort', { level: user.level })}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Monthly prize (lemon card) */}
      <div className="flex items-start gap-3 rounded-[1.35rem] bg-secondary/25 p-4">
        <span className="text-2xl leading-none">🎁</span>
        <div className="min-w-0 flex-1">
          {showPrize ? (
            <div className="flex gap-2">
              <input
                value={prize}
                onChange={(e) => setPrize(e.target.value)}
                placeholder={t('leaderboard.monthlyPrizePlaceholder')}
                className="flex-1 rounded-lg bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button onClick={handleSetPrize} className="btn-pine shrink-0 !min-h-0 px-4 py-2 text-sm">
                {t('leaderboard.savePrize')}
              </button>
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
        <button onClick={() => setShowPrize((v) => !v)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-card" aria-label={t('leaderboard.savePrize')}>
          {showPrize ? <X className="h-4 w-4" /> : <Pencil className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>

      {/* Period filter */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${p === period ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'}`}
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
            className={`card !p-3.5 flex w-full items-center gap-3 text-left ${user.name === name ? 'ring-1 ring-primary/30' : ''}`}
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

      {/* Period stats */}
      <div className="card glow-accent">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{t('leaderboard.statsTitle', { period: translateKey('common.leaderboardPeriods', period) })}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: t('leaderboard.stats.totalTasks'), value: ps.totalTasks.toString() },
            { label: t('leaderboard.stats.totalXp'), value: ps.totalXp.toString() },
            { label: t('leaderboard.stats.avgXp'), value: Math.round(ps.avgPerPerson).toString() },
            { label: t('leaderboard.stats.topContributor'), value: ps.topContributor },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-background/30 p-2">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className="text-xs font-medium truncate">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
              <Star className="h-3.5 w-3.5" /> {t('leaderboard.achievements')}
            </h3>
            <button onClick={handleOpenAchievementConfig} className="grid h-7 w-7 place-items-center rounded-lg bg-card">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-2">
            {achievements.map((a) => (
              <div key={a.key} className={`card !p-3 ${a.unlocked ? 'glow-primary' : 'opacity-60'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t(`leaderboard.achievementKeys.${a.key}.title`, { defaultValue: a.title })}</p>
                    <p className="text-[10px] text-muted-foreground">{t(`leaderboard.achievementKeys.${a.key}.description`, { defaultValue: a.description })}</p>
                    {a.custom && <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-primary">{t('leaderboard.custom.houseGoal')}</p>}
                  </div>
                  {a.progress !== undefined && a.total !== undefined && (
                    <span className="text-xs font-medium text-muted-foreground shrink-0">{a.progress}/{a.total}</span>
                  )}
                </div>
                {a.progress !== undefined && a.total !== undefined && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full gradient-primary rounded-full" style={{ width: `${(a.progress / a.total) * 100}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
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
                <button onClick={() => setSelectedMember(null)} className="grid h-8 w-8 place-items-center rounded-xl bg-card"><X className="h-4 w-4" /></button>
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
                <button onClick={() => setShowAchievementConfig(false)} className="grid h-8 w-8 place-items-center rounded-xl bg-card shrink-0"><X className="h-4 w-4" /></button>
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
                            <button onClick={() => void handleDeleteAchievement(item)} aria-label={t('leaderboard.custom.delete')} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-destructive"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        ))}
                        {achievements.every((item) => !item.custom) && <p className="px-3 text-xs text-muted-foreground">{t('leaderboard.custom.none')}</p>}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl bg-background/30 p-3">
                      <div><p className="font-semibold">{t('leaderboard.custom.create')}</p><p className="text-[10px] text-muted-foreground">{t('leaderboard.custom.createHint')}</p></div>
                      <input className="field w-full" maxLength={80} value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder={t('leaderboard.custom.title')} />
                      <textarea className="field min-h-20 w-full resize-none" maxLength={240} value={customDescription} onChange={(event) => setCustomDescription(event.target.value)} placeholder={t('leaderboard.custom.description')} />
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
    </div>
  );
}
