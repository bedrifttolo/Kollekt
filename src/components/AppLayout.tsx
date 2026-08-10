import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';
import AuthGate from './AuthGate';
import BottomNav from './BottomNav';
import TourOverlay, { type TourStep } from './TourOverlay';
import { LoadingDot } from './ui-kit';
import { useUser } from '../context/UserContext';
import { useScrollDirection } from '../lib/useScrollDirection';

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
  const { currentUser } = useUser();

  // Every tab (Chat included, now that it's just the inbox list) shares the sticky app header and
  // fixed bottom nav — the full-screen chat thread view lives outside this layout entirely (see
  // ChatThreadLayout), which is how it gets neither.
  //
  // Every route here has its own internal scroll container (wired up per-page) rather than
  // body-scrolling, since .app-screen's layout never grows past the viewport.
  useScrollDirection();

  return (
    <AuthGate>
      <div className="app-viewport bg-background max-w-xl mx-auto relative overflow-x-hidden">
        <AppHeader />
        <main className="safe-content-bottom px-4 sm:px-6 pt-2">
          {/* Keeps header + bottom nav visible while a lazily loaded tab's chunk downloads. No
              route-level fade here: each page seeds its own loading/data state from the shared query
              cache, so a warm tab paints instantly on mount instead of fading in from a blank frame. */}
          <Suspense
            fallback={
              <div className="flex items-center justify-center pt-16">
                <LoadingDot />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
        <BottomNav />
        <TourOverlay steps={APP_TOUR_STEPS} storageKey={`kollekt_tour_v2_${currentUser?.id ?? ''}`} />
      </div>
    </AuthGate>
  );
}
