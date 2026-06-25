import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckSquare, Calendar, Wallet, Zap, ShoppingCart, MessageCircleHeart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import { formatCurrency, formatDate, formatTime, translateKey } from '../i18n/helpers';
import { connectCollectiveRealtime } from '../lib/realtime';
import type { DashboardResponse, HouseCheckin } from '../lib/types';
import { AvatarStack, Eyebrow, VibeRing } from '../components/ui-kit';
import { colorForMember } from '../lib/memberColors';
import PromoSlider from '../components/PromoSlider';

const PROMO_SLIDER_ENABLED = import.meta.env.VITE_ENABLE_PROMO_SLIDER !== 'false';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] as const } },
};

function XpProgress({ xp, label }: { xp: number; label: string }) {
  const xpPerLevel = 200;
  const progress = Math.min((xp % xpPerLevel) / xpPerLevel * 100, 100);
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/80">
        <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${progress}%` }} />
      </div>
      <span className="shrink-0 text-[10px] text-white/75">{label}</span>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t: translate } = useTranslation();
  const { currentUser } = useUser();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkin, setCheckin] = useState<HouseCheckin | null>(null);
  const [mood, setMood] = useState(3);
  const [issue, setIssue] = useState('');
  const [improvement, setImprovement] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const fetchDashboard = () => {
    if (!currentUser) return;
    api.get<DashboardResponse>(`/dashboard?memberName=${encodeURIComponent(currentUser.name)}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchCheckin = async () => {
    if (!currentUser) return;
    const collective = await api.get<{ collectiveId: number }>(`/onboarding/collectives/code/${currentUser.id}`);
    const current = await api.post<HouseCheckin>(`/collectives/${collective.collectiveId}/checkins/generate`, {});
    setCheckin(current);
  };

  useEffect(() => {
    fetchDashboard();
    void fetchCheckin();
    if (currentUser) {
      api.get<{ name: string }[]>(`/members/collective?memberName=${encodeURIComponent(currentUser.name)}`)
        .then((list) => setMembers(list.map((m) => m.name)))
        .catch(() => {});
    }
  }, [currentUser]);

  const submitCheckin = async () => {
    if (!checkin || !issue.trim() || !improvement.trim()) return;
    await api.post(`/checkins/${checkin.id}/responses`, { mood, issue, improvement, anonymous });
    setCheckin({ ...checkin, hasResponded: true, responseCount: checkin.responseCount + 1 });
  };

  useEffect(() => {
    if (!currentUser) return;
    const disconnect = connectCollectiveRealtime(
      currentUser.name,
      (event) => {
        if (['TASK_UPDATED', 'TASK_COMPLETED_LATE', 'EXPENSE_CREATED', 'EVENT_CREATED', 'BALANCES_SETTLED'].includes(event.type)) {
          fetchDashboard();
        }
        if (event.type === 'MEMBER_ONLINE' || event.type === 'MEMBER_OFFLINE') {
          const count = (event.payload as { count?: number })?.count;
          if (count !== undefined) setOnlineCount(count);
        }
      },
    );
    return disconnect;
  }, [currentUser]);

  if (loading || !data) {
    return (
      <div className="space-y-4 pt-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-2xl h-24" />
        ))}
      </div>
    );
  }

  const xpLabel = `${data.currentUserXp % 200}/200 XP`;

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? 'dashboard.greetingMorning' : hour < 18 ? 'dashboard.greetingAfternoon' : 'dashboard.greetingEvening';

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 pt-3 pb-6">
      {/* Welcome */}
      <motion.div variants={item}>
        <Eyebrow>{translate('dashboard.today')}</Eyebrow>
        <h2 className="font-display text-[2.55rem] leading-[.98] font-extrabold tracking-[-.04em] mt-2">
          {translate(greetingKey, { name: currentUser?.name })} <span className="mark">🌿</span>
        </h2>
      </motion.div>

      <motion.div variants={item} className="househero">
        <p className="eyebrow !text-white/65">{translate('dashboard.householdTitle')}</p>
        <h3 className="mt-2 font-display text-2xl font-extrabold leading-tight text-white">
          {data.collectiveName}
        </h3>
        {members.length > 0 && (
          <div className="mb-3 mt-2">
            <AvatarStack names={members} />
          </div>
        )}
        <div className="flex items-center gap-3 mb-3">
          <div
            style={currentUser ? { backgroundColor: colorForMember(currentUser.name, currentUser.color) } : undefined}
            className="h-12 w-12 rounded-full border-2 border-white/30 flex items-center justify-center shrink-0"
          >
            <span className="font-display text-lg font-bold text-white">
              {currentUser?.name[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{translate('dashboard.level', { level: data.currentUserLevel })}</p>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium text-white/85">
                {translate('dashboard.rank', { rank: data.currentUserRank })}
              </span>
            </div>
            <XpProgress xp={data.currentUserXp} label={xpLabel} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: translate('dashboard.stats.tasksDone'), value: data.completedTasksCount.toString(), icon: CheckSquare },
            { label: translate('dashboard.stats.balance'), value: formatCurrency(data.currentUserBalance), icon: Wallet },
            { label: translate('dashboard.stats.xpEarned'), value: data.currentUserXp.toString(), icon: Zap },
          ].map((s) => (
            <div key={s.label} className="stat-tile text-center">
              <s.icon className="mx-auto mb-1 h-3.5 w-3.5 text-white/70" />
              <p className="font-display font-bold text-base">{s.value}</p>
              <p className="text-[10px] text-white/70">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={item} className="card flex items-center gap-4">
        <VibeRing score={data.vibeScore} />
        <div>
          <h3 className="font-display text-lg font-bold">{translate('dashboard.vibeTitle')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {data.vibeScore >= 75 ? translate('dashboard.vibeGreat') : data.vibeScore >= 50 ? translate('dashboard.vibeSteady') : translate('dashboard.vibeNeedsLove')}
          </p>
        </div>
      </motion.div>

      {checkin && (
        <motion.div variants={item} className="card space-y-3">
          <div className="flex items-center gap-3">
            <MessageCircleHeart className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display text-lg font-bold">{translate('checkin.title')}</h3>
              <p className="text-xs text-muted-foreground">
                {translate('checkin.progress', { count: checkin.responseCount, total: checkin.memberCount })}
              </p>
            </div>
          </div>
          {checkin.hasResponded ? (
            <p className="text-sm text-primary">{translate('checkin.thanks')}</p>
          ) : (
            <>
              <label className="block text-xs font-semibold">
                {translate('checkin.mood')}
                <input className="mt-2 w-full accent-primary" type="range" min="1" max="5" value={mood} onChange={(event) => setMood(Number(event.target.value))} />
              </label>
              <input value={issue} onChange={(event) => setIssue(event.target.value)} placeholder={translate('checkin.issue')} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              <input value={improvement} onChange={(event) => setImprovement(event.target.value)} placeholder={translate('checkin.improvement')} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
                {translate('checkin.anonymous')}
              </label>
              <button onClick={() => void submitCheckin()} disabled={!issue.trim() || !improvement.trim()} className="w-full rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                {translate('checkin.submit')}
              </button>
            </>
          )}
        </motion.div>
      )}

      {/* Real-time indicator */}
      <motion.div variants={item} className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <p className="text-[10px] text-muted-foreground">
          {translate('common.live')} • {onlineCount > 0 ? translate('dashboard.onlineRoommates', { count: onlineCount }) : translate('common.connecting')}
        </p>
      </motion.div>

      {/* Promo / info slider */}
      {PROMO_SLIDER_ENABLED && (
        <motion.div variants={item}>
          <PromoSlider />
        </motion.div>
      )}

      {/* Upcoming tasks */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-muted-foreground">{translate('dashboard.upcomingTasks')}</h3>
          <button onClick={() => navigate('/tasks')} className="text-xs text-primary font-medium">{translate('common.seeAll')}</button>
        </div>
        <div className="space-y-2">
          {data.upcomingTasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">{translate('dashboard.noUpcomingTasks')} 🎉</p>
          )}
          {data.upcomingTasks.slice(0, 5).map((task) => (
            <button key={task.id} onClick={() => navigate('/tasks')} className="card !rounded-[1.1rem] !p-3 flex items-center gap-3 w-full text-left">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <p className="text-[10px] text-muted-foreground">{task.assignee} • {formatDate(task.dueDate)}</p>
              </div>
              <span className="text-[10px] font-medium text-primary">{translate('dashboard.xpValue', { xp: task.xp })}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Shopping list */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-muted-foreground">{translate('dashboard.shoppingList')}</h3>
          <button onClick={() => navigate('/tasks?tab=shopping')} className="text-xs text-primary font-medium">{translate('common.seeAll')}</button>
        </div>
        <div className="space-y-2">
          {data.pendingShoppingItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">{translate('dashboard.noShoppingItems')}</p>
          )}
          {data.pendingShoppingItems.slice(0, 3).map((s) => (
            <button key={s.id} onClick={() => navigate('/tasks?tab=shopping')} className="card !rounded-[1.1rem] !p-3 flex items-center gap-3 w-full text-left">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.item}</p>
                <p className="text-[10px] text-muted-foreground">{translate('dashboard.addedBy', { name: s.addedBy })}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Upcoming events */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-muted-foreground">{translate('dashboard.upcomingEvents')}</h3>
          <button onClick={() => navigate('/calendar')} className="text-xs text-primary font-medium">{translate('common.seeAll')}</button>
        </div>
        <div className="space-y-2">
          {data.upcomingEvents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">{translate('dashboard.noUpcomingEvents')}</p>
          )}
          {data.upcomingEvents.slice(0, 3).map((e) => (
            <button key={e.id} onClick={() => navigate('/calendar')} className="card !rounded-[1.1rem] !p-3 flex items-center gap-3 w-full text-left">
              <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(e.date)} {formatTime(e.time)}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{translateKey('common.eventTypes', e.type)}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Recent expenses */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-muted-foreground">{translate('dashboard.recentExpenses')}</h3>
          <button onClick={() => navigate('/economy')} className="text-xs text-primary font-medium">{translate('common.seeAll')}</button>
        </div>
        <div className="space-y-2">
          {data.recentExpenses.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">{translate('dashboard.noRecentExpenses')}</p>
          )}
          {data.recentExpenses.slice(0, 3).map((e) => (
            <button key={e.id} onClick={() => navigate('/economy')} className="card !rounded-[1.1rem] !p-3 flex items-center gap-3 w-full text-left">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.description}</p>
                <p className="text-[10px] text-muted-foreground">{translate('dashboard.paidBy', { name: e.paidBy })} • {formatDate(e.date)}</p>
              </div>
              <p className="text-sm font-bold">{formatCurrency(e.amount)}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
