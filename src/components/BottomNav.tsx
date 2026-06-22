import { useLocation, useNavigate } from 'react-router-dom';
import { Home, CheckSquare, Calendar, MessageCircle, Wallet, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const tabs = [
  { labelKey: 'bottomNav.home', icon: Home, path: '/' },
  { labelKey: 'bottomNav.tasks', icon: CheckSquare, path: '/tasks' },
  { labelKey: 'bottomNav.calendar', icon: Calendar, path: '/calendar' },
  { labelKey: 'bottomNav.chat', icon: MessageCircle, path: '/chat' },
  { labelKey: 'bottomNav.economy', icon: Wallet, path: '/economy' },
  { labelKey: 'bottomNav.social', icon: Trophy, path: '/social' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 left-3 right-3 z-50 safe-bottom">
      <div className="flex items-center justify-around h-17 max-w-xl mx-auto px-2 mb-2 rounded-[1.45rem] bg-sidebar text-sidebar-foreground border border-sidebar-border shadow-[0_12px_34px_rgba(9,25,16,.24)]">
        {tabs.map((tab) => {
          const isActive =
            tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
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
              <tab.icon
                className={`h-5 w-5 transition-colors ${
                  isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/60'
                }`}
              />
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
