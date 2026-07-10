import { Suspense } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import TourOverlay, { type TourStep } from './TourOverlay';
import { useUser } from '../context/UserContext';

const APP_TOUR_STEPS: TourStep[] = [
  { route: '/', selector: '[data-tour="nav-home"]', titleKey: 'tour.steps.home.title', bodyKey: 'tour.steps.home.body' },
  { route: '/tasks', selector: '[data-tour="nav-tasks"]', titleKey: 'tour.steps.tasks.title', bodyKey: 'tour.steps.tasks.body' },
  { route: '/calendar', selector: '[data-tour="nav-calendar"]', titleKey: 'tour.steps.calendar.title', bodyKey: 'tour.steps.calendar.body' },
  { route: '/chat', selector: '[data-tour="nav-chat"]', titleKey: 'tour.steps.chat.title', bodyKey: 'tour.steps.chat.body' },
  { route: '/economy', selector: '[data-tour="nav-economy"]', titleKey: 'tour.steps.economy.title', bodyKey: 'tour.steps.economy.body' },
  { route: '/social', selector: '[data-tour="nav-social"]', titleKey: 'tour.steps.social.title', bodyKey: 'tour.steps.social.body' },
  { route: '/profile', selector: '[data-tour="profile"]', titleKey: 'tour.steps.profile.title', bodyKey: 'tour.steps.profile.body' },
];

export default function AppLayout() {
  const { currentUser, isLoading } = useUser();
  const { pathname } = useLocation();
  // Chat renders its own compact header (thread info + profile button) so the shared
  // header would just duplicate it and cost the messages a full row of space.
  const hideHeader = pathname === '/chat';

  if (isLoading) {
    return (
      <div className="app-viewport bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full gradient-primary animate-pulse" />
      </div>
    );
  }

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!currentUser.collectiveCode) return <Navigate to="/create-household" replace />;

  return (
    <div className="app-viewport bg-background max-w-xl mx-auto relative overflow-x-hidden">
      {!hideHeader && <AppHeader />}
      <main className="safe-content-bottom px-4 sm:px-6 pt-2">
        {/* Keeps header + bottom nav visible while a lazily loaded tab's chunk downloads. */}
        <Suspense
          fallback={
            <div className="space-y-3 pt-4 animate-pulse">
              {[...Array(4)].map((_, i) => <div key={i} className="glass rounded-2xl h-20" />)}
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
      <TourOverlay steps={APP_TOUR_STEPS} storageKey={`kollekt_tour_v2_${currentUser.id}`} />
    </div>
  );
}
