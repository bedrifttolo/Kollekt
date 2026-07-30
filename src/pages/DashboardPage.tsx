import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Calendar, Wallet, Zap, ShoppingCart, MessageCircleHeart, Leaf, PartyPopper, CircleCheckBig, CalendarPlus, Receipt, ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { qk } from '../lib/queryKeys';
import { useUser, useRealtimeEvent } from '../context/UserContext';
import { formatCurrency, formatDate, formatTime, translateKey } from '../i18n/helpers';
import type { AppUser, DashboardResponse, HouseCheckin } from '../lib/types';
import { TASK_CATEGORY_ICONS } from '../lib/categoryIcons';
import { AvatarStack, CountUp, EmptyState, Eyebrow, ProgressRing, VibeRing } from '../components/ui-kit';
import { VibeSheetPortal } from '../components/VibeSheet';
import { dailyIndex, listContainer, listItem, pressableSubtle } from '../lib/motion';
import { celebrate } from '../lib/celebrate';
import type { Tone } from '../lib/tones';
import { colorForMember } from '../lib/memberColors';
import { showHomeBanner, hideHomeBanner } from '../lib/ads';

/** Mirrors TaskOperations.XP_PER_LEVEL on the backend — a level is 200 XP. */
const XP_PER_LEVEL = 200;

/**
 * One row of the home feed: a titled section whose card carries a colour identity.
 *
 * All four preview sections were previously identical white rows differing only by their icon
 * tile, so the screen read as one undifferentiated stack. Giving each its tone lets you find
 * "expenses" by colour before you have read a word, and collapses four near-identical blocks into
 * one component.
 */
function PreviewSection({
  title,
  tone,
  onSeeAll,
  seeAllLabel,
  isEmpty,
  empty,
  children,
}: {
  title: string;
  tone: Tone;
  onSeeAll: () => void;
  seeAllLabel: string;
  isEmpty: boolean;
  empty: ReactNode;
  children: ReactNode;
}) {
  return (
    <motion.div variants={listItem}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-base font-bold">{title}</h3>
        <button onClick={onSeeAll} className="-mr-2 min-h-11 px-2 text-xs font-semibold text-foreground">
          {seeAllLabel}
        </button>
      </div>
      <div className="space-y-2">{isEmpty ? empty : children}</div>
    </motion.div>
  );
}

/** A tappable row inside a PreviewSection. */
function PreviewRow({
  icon,
  tone,
  title,
  subtitle,
  trailing,
  onClick,
}: {
  icon: ReactNode;
  tone: Tone;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      {...pressableSubtle}
      className={`elev-1 flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left tone-${tone} tone-wash tone-edge`}
    >
      <span className={`tone-tile tone-${tone} grid h-10 w-10 shrink-0 place-items-center rounded-[--r-sm]`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
      {trailing}
    </motion.button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t: translate } = useTranslation();
  const { currentUser } = useUser();
  const queryClient = useQueryClient();
  const [mood, setMood] = useState(3);
  const [issue, setIssue] = useState('');
  const [improvement, setImprovement] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [showVibeSheet, setShowVibeSheet] = useState(false);
  const [checkinExpanded, setCheckinExpanded] = useState(false);

  // Home-screen AdMob banner (no-op until ads are enabled in src/lib/ads.ts).
  useEffect(() => {
    void showHomeBanner();
    return () => { void hideHomeBanner(); };
  }, []);

  // Level-up celebration. The API reports a level, never an event, so the rise has to be noticed
  // client-side by comparing against the last level this component saw. The ref starts undefined so
  // the first load — where every level looks "new" — stays silent.
  const lastLevelRef = useRef<number | undefined>(undefined);

  const { data, isPending } = useQuery({
    queryKey: qk.dashboard(currentUser?.name),
    enabled: !!currentUser,
    queryFn: () => api.get<DashboardResponse>(`/dashboard?memberName=${encodeURIComponent(currentUser!.name)}`),
  });

  const { data: members = [] } = useQuery({
    queryKey: qk.members(currentUser?.name),
    enabled: !!currentUser,
    queryFn: () => api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(currentUser!.name)}`),
  });

  const { data: checkin } = useQuery({
    queryKey: qk.checkin(currentUser?.name),
    enabled: !!currentUser,
    queryFn: async () => {
      const collective = await api.get<{ collectiveId: number }>(`/onboarding/collectives/code/${currentUser!.id}`);
      return api.post<HouseCheckin>(`/collectives/${collective.collectiveId}/checkins/generate`, {});
    },
  });

  const submitCheckin = async () => {
    if (!checkin || !issue.trim() || !improvement.trim()) return;
    await api.post(`/checkins/${checkin.id}/responses`, { mood, issue, improvement, anonymous });
    queryClient.setQueryData(qk.checkin(currentUser?.name), {
      ...checkin,
      hasResponded: true,
      responseCount: checkin.responseCount + 1,
    });
  };

  const currentLevel = data?.currentUserLevel;
  useEffect(() => {
    if (currentLevel === undefined) return;
    const previous = lastLevelRef.current;
    lastLevelRef.current = currentLevel;
    if (previous !== undefined && currentLevel > previous) celebrate('level-up');
  }, [currentLevel]);

  // Keyed on the stable member name (not the currentUser object) so the socket isn't torn
  // down and reconnected on every unrelated re-render — same presence logic as the chat.
  const name = currentUser?.name;
  useRealtimeEvent(
    (event) => {
      if (!name) return;
      if (['TASK_UPDATED', 'TASK_COMPLETED_LATE', 'EXPENSE_CREATED', 'EVENT_CREATED', 'BALANCES_SETTLED'].includes(event.type)) {
        void queryClient.invalidateQueries({ queryKey: qk.dashboard(name) });
      }
      if (event.type === 'MEMBER_UPDATED') {
        void queryClient.invalidateQueries({ queryKey: qk.members(name) });
      }
    },
    () => { if (name) void queryClient.invalidateQueries({ queryKey: qk.dashboard(name) }); },
  );

  if (isPending || !data) {
    return (
      <div className="space-y-4 pt-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-2xl h-24" />
        ))}
      </div>
    );
  }

  const xpLabel = `${data.currentUserXp % XP_PER_LEVEL}/${XP_PER_LEVEL} XP`;

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? 'dashboard.greetingMorning' : hour < 18 ? 'dashboard.greetingAfternoon' : 'dashboard.greetingEvening';

  // One of six house prompts, rotating once a day. Seeded by the calendar date rather than random,
  // so it is the same line all day for everyone in the household and cannot reshuffle under you
  // when a websocket event refetches the dashboard.
  const promptKey = `dashboard.prompts.${dailyIndex(6)}`;

  return (
    <motion.div variants={listContainer} initial={false} animate="show" className="space-y-5 pt-3 pb-6">
      {/* Welcome */}
      <motion.div variants={listItem}>
        <Eyebrow>{translate('dashboard.today')}</Eyebrow>
        <h2 className="display-lg mt-2">
          {translate(greetingKey, { name: currentUser?.name })}{' '}
          <Leaf className="mark inline h-8 w-8 align-baseline" strokeWidth={2.5} />
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{translate(promptKey)}</p>
      </motion.div>

      <motion.div variants={listItem} className="househero hero-ink">
        <p className="eyebrow !text-ink-foreground/65">{translate('dashboard.householdTitle')}</p>
        <h3 className="mt-2 font-display text-2xl font-extrabold leading-tight text-ink-foreground">
          {data.collectiveName}
        </h3>
        {members.length > 0 && (
          <div className="mb-3 mt-2">
            <AvatarStack members={members} />
          </div>
        )}
        <div className="mb-3 flex items-center gap-3">
          {/* The level ring replaces a flat XP bar. It reads as a gauge you are filling rather than
              a line that happens to be partly coloured, and it animates, which the bar never did. */}
          <ProgressRing
            value={(data.currentUserXp % XP_PER_LEVEL) / XP_PER_LEVEL * 100}
            size={64}
            thickness={7}
            color="var(--hero-positive)"
            trackColor="color-mix(in srgb, var(--ink-foreground) 18%, transparent)"
          >
            <span className="font-display text-base font-extrabold text-ink-foreground">{data.currentUserLevel}</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{translate('dashboard.level', { level: data.currentUserLevel })}</p>
              <span className="rounded-full bg-ink-foreground/15 px-2 py-0.5 text-xs font-medium text-ink-foreground/85">
                {translate('dashboard.rank', { rank: data.currentUserRank })}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-ink-foreground/75">{xpLabel}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            // Only the icon takes the tone: these tiles sit on the ink hero, where a pastel fill
            // would fight the hero surface, but a tinted glyph still separates the three stats.
            { label: translate('dashboard.stats.tasksDone'), value: data.completedTasksCount, icon: CheckSquare, tone: 'mint' as const },
            { label: translate('dashboard.stats.balance'), value: data.currentUserBalance, format: formatCurrency, icon: Wallet, tone: 'butter' as const },
            { label: translate('dashboard.stats.xpEarned'), value: data.currentUserXp, icon: Zap, tone: 'peri' as const },
          ].map((s) => (
            <div key={s.label} className="stat-tile text-center">
              <s.icon className="mx-auto mb-1 h-3.5 w-3.5" style={{ color: `var(--tone-${s.tone})` }} />
              <CountUp value={s.value} format={s.format} className="block font-display text-base font-bold" />
              <p className="text-[10px] text-ink-foreground/70">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.button
        variants={listItem}
        onClick={() => setShowVibeSheet(true)}
        {...pressableSubtle}
        className="card flex w-full items-center gap-4 text-left"
      >
        <VibeRing score={data.vibeScore} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold">{translate('dashboard.vibeTitle')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {data.vibeScore >= 75 ? translate('dashboard.vibeGreat') : data.vibeScore >= 50 ? translate('dashboard.vibeSteady') : translate('dashboard.vibeNeedsLove')}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </motion.button>

      {checkin && (
        <motion.div variants={listItem} className="card !p-0">
          <button
            onClick={() => setCheckinExpanded((v) => !v)}
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <MessageCircleHeart className="h-5 w-5 shrink-0 text-foreground" />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg font-bold">{translate('checkin.title')}</h3>
              <p className="text-xs text-muted-foreground">
                {translate('checkin.progress', { count: checkin.responseCount, total: checkin.memberCount })}
              </p>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${checkinExpanded ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {checkinExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 px-4 pb-4">
                  {checkin.hasResponded ? (
                    <p className="text-sm text-primary">{translate('checkin.thanks')}</p>
                  ) : (
                    <>
                      <label className="block text-xs font-semibold">
                        {translate('checkin.mood')}
                        <input className="mood-slider mt-2 w-full accent-primary" type="range" min="1" max="5" value={mood} onChange={(event) => setMood(Number(event.target.value))} />
                      </label>
                      <input value={issue} onChange={(event) => setIssue(event.target.value)} placeholder={translate('checkin.issue')} className="w-full min-h-[var(--ctl-lg)] rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                      <input value={improvement} onChange={(event) => setImprovement(event.target.value)} placeholder={translate('checkin.improvement')} className="w-full min-h-[var(--ctl-lg)] rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
                        {translate('checkin.anonymous')}
                      </label>
                      <button onClick={() => void submitCheckin()} disabled={!issue.trim() || !improvement.trim()} className="w-full rounded-xl bg-ink py-2 text-sm font-bold text-ink-foreground disabled:opacity-50">
                        {translate('checkin.submit')}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <PreviewSection
        title={translate('dashboard.upcomingTasks')}
        tone="mint"
        onSeeAll={() => navigate('/tasks')}
        seeAllLabel={translate('common.seeAll')}
        isEmpty={data.upcomingTasks.length === 0}
        empty={
          <EmptyState
            tone="mint"
            icon={<PartyPopper className="h-6 w-6" />}
            title={translate('dashboard.noUpcomingTasks')}
            body={translate('dashboard.noUpcomingTasksBody')}
            action={{ label: translate('tasks.addTask'), onClick: () => navigate('/tasks') }}
          />
        }
      >
        {data.upcomingTasks.slice(0, 5).map((task) => {
          const CategoryIcon = TASK_CATEGORY_ICONS[task.category] ?? CircleCheckBig;
          return (
            <PreviewRow
              key={task.id}
              tone="mint"
              icon={<CategoryIcon className="h-5 w-5" />}
              title={task.title}
              subtitle={`${task.assignee} · ${formatDate(task.dueDate)}`}
              trailing={<span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">+{task.xp} XP</span>}
              onClick={() => navigate('/tasks')}
            />
          );
        })}
      </PreviewSection>

      <PreviewSection
        title={translate('dashboard.shoppingList')}
        tone="butter"
        onSeeAll={() => navigate('/tasks?tab=shopping')}
        seeAllLabel={translate('common.seeAll')}
        isEmpty={data.pendingShoppingItems.length === 0}
        empty={
          <EmptyState
            tone="butter"
            icon={<ShoppingCart className="h-6 w-6" />}
            title={translate('dashboard.noShoppingItems')}
            body={translate('dashboard.noShoppingItemsBody')}
            action={{ label: translate('tasks.addSupply'), onClick: () => navigate('/tasks?tab=shopping') }}
          />
        }
      >
        {data.pendingShoppingItems.slice(0, 3).map((s) => (
          <PreviewRow
            key={s.id}
            tone="butter"
            icon={<ShoppingCart className="h-5 w-5" />}
            title={s.item}
            subtitle={translate('dashboard.addedBy', { name: s.addedBy })}
            onClick={() => navigate('/tasks?tab=shopping')}
          />
        ))}
      </PreviewSection>

      <PreviewSection
        title={translate('dashboard.upcomingEvents')}
        tone="peri"
        onSeeAll={() => navigate('/calendar')}
        seeAllLabel={translate('common.seeAll')}
        isEmpty={data.upcomingEvents.length === 0}
        empty={
          <EmptyState
            tone="peri"
            icon={<CalendarPlus className="h-6 w-6" />}
            title={translate('dashboard.noUpcomingEvents')}
            body={translate('dashboard.noUpcomingEventsBody')}
            action={{ label: translate('calendar.addEvent'), onClick: () => navigate('/calendar') }}
          />
        }
      >
        {data.upcomingEvents.slice(0, 3).map((e) => (
          <PreviewRow
            key={e.id}
            tone="peri"
            icon={<Calendar className="h-5 w-5" />}
            title={e.title}
            subtitle={`${formatDate(e.date)}${e.time ? ` · ${formatTime(e.time)}` : ''}`}
            trailing={<span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{translateKey('common.eventTypes', e.type)}</span>}
            onClick={() => navigate('/calendar')}
          />
        ))}
      </PreviewSection>

      <PreviewSection
        title={translate('dashboard.recentExpenses')}
        tone="blush"
        onSeeAll={() => navigate('/economy')}
        seeAllLabel={translate('common.seeAll')}
        isEmpty={data.recentExpenses.length === 0}
        empty={
          <EmptyState
            tone="blush"
            icon={<Receipt className="h-6 w-6" />}
            title={translate('dashboard.noRecentExpenses')}
            body={translate('dashboard.noRecentExpensesBody')}
            action={{ label: translate('economy.addExpense'), onClick: () => navigate('/economy') }}
          />
        }
      >
        {data.recentExpenses.slice(0, 3).map((e) => (
          <PreviewRow
            key={e.id}
            tone="blush"
            icon={<Wallet className="h-5 w-5" />}
            title={e.description}
            subtitle={`${translate('dashboard.paidBy', { name: e.paidBy })} · ${formatDate(e.date)}`}
            trailing={<p className="shrink-0 text-sm font-bold">{formatCurrency(e.amount)}</p>}
            onClick={() => navigate('/economy')}
          />
        ))}
      </PreviewSection>

      <VibeSheetPortal
        open={showVibeSheet}
        score={data.vibeScore}
        breakdown={data.vibeBreakdown}
        onClose={() => setShowVibeSheet(false)}
      />
    </motion.div>
  );
}
