import { Outlet } from 'react-router-dom';
import AuthGate from './AuthGate';

/**
 * Chrome-less layout for an open chat thread (household or a DM): no shared AppHeader, no
 * BottomNav, no TourOverlay — the thread owns the full viewport with its own back button and
 * composer, the way the inbox list (which keeps AppLayout's chrome) hands off to it. Sits as a
 * sibling of <AppLayout/> in the route tree, same precedent as LoginPage/CreateHouseholdPage.
 */
export default function ChatThreadLayout() {
  return (
    <AuthGate>
      <div className="app-viewport bg-background max-w-xl mx-auto relative overflow-x-hidden">
        <Outlet />
      </div>
    </AuthGate>
  );
}
