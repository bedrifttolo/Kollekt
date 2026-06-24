import { Outlet, Navigate } from 'react-router-dom';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import TourOverlay, { type TourStep } from './TourOverlay';
import { useUser } from '../context/UserContext';

const APP_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="nav-home"]', titleKey: 'tour.steps.home.title', bodyKey: 'tour.steps.home.body' },
  { selector: '[data-tour="nav-tasks"]', titleKey: 'tour.steps.tasks.title', bodyKey: 'tour.steps.tasks.body' },
  { selector: '[data-tour="nav-calendar"]', titleKey: 'tour.steps.calendar.title', bodyKey: 'tour.steps.calendar.body' },
  { selector: '[data-tour="nav-chat"]', titleKey: 'tour.steps.chat.title', bodyKey: 'tour.steps.chat.body' },
  { selector: '[data-tour="nav-economy"]', titleKey: 'tour.steps.economy.title', bodyKey: 'tour.steps.economy.body' },
  { selector: '[data-tour="nav-social"]', titleKey: 'tour.steps.social.title', bodyKey: 'tour.steps.social.body' },
  { selector: '[data-tour="profile"]', titleKey: 'tour.steps.profile.title', bodyKey: 'tour.steps.profile.body' },
];

export default function AppLayout() {
  const { currentUser, isLoading } = useUser();

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
      <AppHeader />
      <main className="safe-content-bottom px-4 sm:px-6 pt-2">
        <Outlet />
      </main>
      <BottomNav />
      <TourOverlay steps={APP_TOUR_STEPS} storageKey="kollekt_tour_v2" />
    </div>
  );
}
