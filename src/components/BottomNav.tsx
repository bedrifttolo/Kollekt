import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, CheckSquare, Calendar, MessageCircle, Wallet, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useUser } from '../context/UserContext';
import { springPop } from '../lib/motion';
import { selectionFeedback } from '../lib/haptics';

/** A visibly bouncier settle than springPop — used only for the pill sliding between tabs, where
 *  the lower damping reads as a dock catching the tap rather than a UI element sliding into place. */
const springDock = { type: 'spring', stiffness: 380, damping: 20, mass: 0.7 } as const;

const tabs = [
  { labelKey: 'bottomNav.home', icon: Home, path: '/', tour: 'home' },
  { labelKey: 'bottomNav.tasks', icon: CheckSquare, path: '/tasks', tour: 'tasks' },
  { labelKey: 'bottomNav.calendar', icon: Calendar, path: '/calendar', tour: 'calendar' },
  { labelKey: 'bottomNav.chat', icon: MessageCircle, path: '/chat', tour: 'chat' },
  { labelKey: 'bottomNav.economy', icon: Wallet, path: '/economy', tour: 'economy' },
  { labelKey: 'bottomNav.social', icon: Trophy, path: '/social', tour: 'social' },
];

// Notification types that should light up each tab. Shopping lives inside the Tasks tab.
const TAB_NOTIFICATION_TYPES: Record<string, string[]> = {
  '/tasks': [
    'TASK_ASSIGNED', 'TASK_DEADLINE_SOON', 'TASK_OVERDUE', 'TASK_OVERDUE_GROUP',
    'TASK_FEEDBACK', 'TASK_COMPLETED_LATE', 'SHOPPING_ITEM_ADDED',
  ],
  '/chat': ['NEW_MESSAGE'],
  '/economy': ['EXPENSE_OWED', 'EXPENSE_DEADLINE_SOON', 'EXPENSE_OVERDUE'],
};

// Map a route to the tab whose badge it should clear (e.g. /economy/pant -> /economy).
function tabForPath(pathname: string): string | null {
  return Object.keys(TAB_NOTIFICATION_TYPES).find(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  ) ?? null;
}

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { notifications, currentUser } = useUser();

  const seenKey = `kollekt_tab_seen_${currentUser?.name ?? 'anon'}`;
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({});

  // Load this user's per-tab "last seen" markers.
  useEffect(() => {
    try {
      setLastSeen(JSON.parse(localStorage.getItem(seenKey) ?? '{}'));
    } catch {
      setLastSeen({});
    }
  }, [seenKey]);

  // Latest activity timestamp per tab, derived from the notifications feed.
  const latestActivity: Record<string, number> = {};
  for (const n of notifications) {
    const ts = new Date(n.timestamp).getTime();
    if (Number.isNaN(ts)) continue;
    for (const [path, types] of Object.entries(TAB_NOTIFICATION_TYPES)) {
      if (types.includes(n.type)) {
        latestActivity[path] = Math.max(latestActivity[path] ?? 0, ts);
      }
    }
  }

  // Being on a tab (or new activity arriving while on it) marks it seen, so it never badges itself.
  useEffect(() => {
    const path = tabForPath(location.pathname);
    if (!path) return;
    setLastSeen((prev) => {
      const next = { ...prev, [path]: Date.now() };
      localStorage.setItem(seenKey, JSON.stringify(next));
      return next;
    });
  }, [location.pathname, notifications, seenKey]);

  return (
    // bottom-[calc(...)] lifts the dock clear of the safe area with its own visible margin, rather
    // than sitting flush against it — the gap is what reads as "floating" instead of "docked".
    <nav className="app-bottom-nav fixed left-3 right-3 z-50 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
      <div role="tablist" className="nav-glass flex items-center justify-around h-[4.75rem] max-w-xl mx-auto px-1 rounded-full text-sidebar-foreground border border-sidebar-border shadow-[0_16px_38px_rgba(9,25,16,.3)]">
        {tabs.map((tab) => {
          const isActive =
            tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path);
          const hasBadge =
            !!latestActivity[tab.path] && latestActivity[tab.path] > (lastSeen[tab.path] ?? 0);
          return (
            <button
              key={tab.path}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              data-tour={`nav-${tab.tour}`}
              onClick={() => {
                if (isActive) return;
                void selectionFeedback();
                navigate(tab.path);
              }}
              className="relative flex flex-1 items-center justify-center self-stretch"
              aria-label={t(tab.labelKey)}
            >
              {/* This inner span is what layoutId measures: sized to hug the icon+label, not the
                  full-height button, so the filled pill reads as a capsule around the tab's
                  content rather than a floor-to-ceiling highlight. */}
              <span className="relative flex flex-col items-center gap-1 rounded-full px-3 py-1.5">
                {isActive && (
                  <motion.span
                    layoutId="nav-active-pill"
                    transition={springDock}
                    className="absolute inset-0 rounded-full bg-sidebar-primary"
                  />
                )}
                <span className="relative z-10">
                  {/* The icon pops harder than a plain colour swap would say on its own — the
                      sliding pill says *where* you are, this says the tap landed. */}
                  <motion.span
                    className="block"
                    animate={isActive ? { scale: [1, 1.4, 0.92, 1.05, 1], y: [0, -5, 1, -1, 0] } : { scale: 1, y: 0 }}
                    transition={springPop}
                  >
                    <tab.icon
                      className={`h-6 w-6 transition-colors duration-300 ${
                        isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/60'
                      }`}
                    />
                  </motion.span>
                  {hasBadge && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={springPop}
                      className="absolute -top-1 -right-1.5 h-3 w-3 rounded-full bg-destructive border-2 border-sidebar"
                    />
                  )}
                </span>
                <span
                  className={`relative z-10 text-[10px] font-medium transition-colors duration-300 ${
                    isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/60'
                  }`}
                >
                  {t(tab.labelKey)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
