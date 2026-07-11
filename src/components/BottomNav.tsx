import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, CheckSquare, Calendar, MessageCircle, Wallet, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useUser } from '../context/UserContext';

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
    <nav className="app-bottom-nav fixed bottom-0 left-3 right-3 z-50 safe-bottom">
      <div className="flex items-center justify-around h-17 max-w-xl mx-auto px-2 mb-2 rounded-[1.45rem] bg-sidebar text-sidebar-foreground border border-sidebar-border shadow-[0_12px_34px_rgba(9,25,16,.24)]">
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
              data-tour={`nav-${tab.tour}`}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-colors"
              aria-label={t(tab.labelKey)}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute -top-0.5 w-6 h-1 rounded-full bg-sidebar-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative">
                <tab.icon
                  className={`h-5 w-5 transition-colors ${
                    isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/60'
                  }`}
                />
                {hasBadge && (
                  <span className="absolute -top-1 -right-1.5 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-sidebar" />
                )}
              </span>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/60'
                }`}
              >
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
