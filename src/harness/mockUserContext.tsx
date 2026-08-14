// Harness-only stand-in for '../context/UserContext', swapped in by vite.harness.config.ts.
//
// This must mirror the real context's value object field for field. The harness swaps the module by
// resolved path, so AppHeader and BottomNav get this too — and they destructure `notifications`,
// which is what a partial mock silently breaks (a `notifications is not iterable` crash inside
// BottomNav, rendering as a blank page with no error boundary above it).
import { useState, type ReactNode } from "react";
import type { AppUser } from "../lib/types";

const FIXTURE_USER: AppUser = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  collectiveCode: "ABCD12",
  status: "ACTIVE",
  color: "#ff0000",
};

export function UserProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useUser() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(FIXTURE_USER);
  return {
    currentUser,
    setCurrentUser,
    handleLogout: async () => {},
    isLoading: false,
    notifications: [],
    notificationsLoading: false,
    refreshNotifications: async () => {},
    dismissNotification: async (_id: number) => {},
    clearAllNotifications: async () => {},
    markAllNotificationsRead: async () => {},
    subscribeRealtimeEvent: () => () => {},
    subscribeRealtimeReconnect: () => () => {},
    onlineCount: 3,
  };
}

export function useRealtimeEvent(
  _onEvent: (event: { type: string }) => void,
  _onReconnect?: () => void,
) {}
