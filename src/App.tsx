import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { UserProvider, useUser } from './context/UserContext';
import AppLayout from './components/AppLayout';

// Route-level code splitting: each page loads as its own chunk so the initial
// download stays small (the games engine alone is a large chunk that only
// people opening a game should pay for). Chunks are served from disk in the
// native apps, so tab switches stay instant there.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const CreateHouseholdPage = lazy(() => import('./pages/CreateHouseholdPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const EconomyPage = lazy(() => import('./pages/EconomyPage'));
const PantTrackerPage = lazy(() => import('./pages/PantTrackerPage'));
const SocialPage = lazy(() => import('./pages/SocialPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CollektGamePage = lazy(() => import('./pages/CollektGamePage'));

// Guard for auth-only pages that don't need a collective (create-household)
function AuthOnlyRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useUser();
  if (isLoading && !currentUser) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full gradient-primary animate-pulse" />
    </div>
  );
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Guard for login page: redirect already-authed users
function GuestOnlyRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useUser();
  if (isLoading && !currentUser) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full gradient-primary animate-pulse" />
    </div>
  );
  if (currentUser) {
    return <Navigate to={currentUser.collectiveCode ? '/' : '/create-household'} replace />;
  }
  return <>{children}</>;
}

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full gradient-primary animate-pulse" />
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route path="/login" element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
      <Route
        path="/create-household"
        element={<AuthOnlyRoute><CreateHouseholdPage /></AuthOnlyRoute>}
      />
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/economy" element={<EconomyPage />} />
        <Route path="/economy/pant" element={<PantTrackerPage />} />
        <Route path="/social" element={<SocialPage />} />
        <Route path="/leaderboard" element={<Navigate to="/social" replace />} />
        <Route path="/games" element={<Navigate to="/social" replace />} />
        <Route path="/games/kollekt" element={<CollektGamePage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    // reducedMotion="user" is the only thing that actually stills framer-motion when the OS setting
    // is on. The `prefers-reduced-motion` block in globals.css clamps CSS animations, but JS-driven
    // springs ignore it entirely, so without this the app kept animating for people who asked it not
    // to. Transform/opacity animations are skipped; layout and colour changes still apply.
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <UserProvider>
          <AppRoutes />
        </UserProvider>
      </BrowserRouter>
    </MotionConfig>
  );
}
