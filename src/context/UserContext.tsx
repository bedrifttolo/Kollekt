import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getAccessToken, logoutSession, deleteNotification, deleteAllNotifications } from '../lib/api';
import { onAppResume } from '../lib/appLifecycle';
import { prefetchMainData } from '../lib/prefetch';
import { connectCollectiveRealtime, type RealtimeEvent } from '../lib/realtime';
import { registerPushNotifications, unregisterPushNotifications } from '../lib/pushNotifications';
import { identifyPurchaser, resetPurchaser } from '../lib/purchases';
import type { AppUser, Notification } from '../lib/types';

type RealtimeEventListener = (event: RealtimeEvent) => void;
type RealtimeReconnectListener = () => void;

interface UserContextValue {
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  handleLogout: () => Promise<void>;
  isLoading: boolean;
  notifications: Notification[];
  notificationsLoading: boolean;
  refreshNotifications: () => void;
  dismissNotification: (id: number) => void;
  clearAllNotifications: () => void;
  markAllNotificationsRead: () => void;
  /** Subscribe to every event on the single shared collective WebSocket. Prefer the
   *  useRealtimeEvent hook below over calling this directly. */
  subscribeRealtimeEvent: (listener: RealtimeEventListener) => () => void;
  subscribeRealtimeReconnect: (listener: RealtimeReconnectListener) => () => void;
  /** Live count of members connected to the collective's realtime socket right now, derived
   *  from MEMBER_ONLINE/OFFLINE broadcasts. Kept here (not per-page) because the bootstrap
   *  count arrives once, right when the shared socket opens at login — long before any page
   *  that wants to display it has mounted. */
  onlineCount: number | null;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<AppUser | null>(() => {
    const stored = localStorage.getItem('kollekt-user');
    if (!stored) return null;
    try { return JSON.parse(stored) as AppUser; } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const queryClient = useQueryClient();
  // Every page used to open its own `connectCollectiveRealtime` socket, so switching bottom-nav
  // tabs tore one connection down and stood a new one up on every navigation (plus a re-auth
  // round trip and a MEMBER_ONLINE/OFFLINE broadcast to the whole collective each time). This is
  // the one connection for the whole session; pages register interest via useRealtimeEvent below
  // instead of opening their own socket.
  const eventListenersRef = useRef(new Set<RealtimeEventListener>());
  const reconnectListenersRef = useRef(new Set<RealtimeReconnectListener>());
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  const subscribeRealtimeEvent = useCallback((listener: RealtimeEventListener) => {
    eventListenersRef.current.add(listener);
    return () => { eventListenersRef.current.delete(listener); };
  }, []);

  const subscribeRealtimeReconnect = useCallback((listener: RealtimeReconnectListener) => {
    reconnectListenersRef.current.add(listener);
    return () => { reconnectListenersRef.current.delete(listener); };
  }, []);

  // Warm secondary tabs only after session verification and the active screen's first
  // request. Eagerly firing every screen request here used to contend with /me and the
  // dashboard for the same small DB connection pool.
  useEffect(() => {
    if (!currentUser || isLoading) return;
    const timer = window.setTimeout(() => {
      void prefetchMainData(queryClient, currentUser).catch(() => undefined);
    }, 1_500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.name, isLoading, queryClient]);

  useEffect(() => {
    let cancelled = false;

    const initializeSession = async () => {
      try {
        if (!await getAccessToken()) {
          if (!cancelled) {
            setCurrentUserState(null);
            localStorage.removeItem('kollekt-user');
          }
          return;
        }

        const user = await api.get<AppUser>('/onboarding/me');
        if (!cancelled) {
          setCurrentUserState(user);
          localStorage.setItem('kollekt-user', JSON.stringify(user));
        }
      } catch {
        if (!cancelled && !await getAccessToken()) {
          setCurrentUserState(null);
          localStorage.removeItem('kollekt-user');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const frame = window.requestAnimationFrame(() => {
      void initializeSession();
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const fetchNotifications = useCallback((name: string) => {
    setNotificationsLoading(true);
    api.get<Notification[]>(`/notifications/${encodeURIComponent(name)}`)
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setNotificationsLoading(false));
  }, []);

  useEffect(() => {
    if (!currentUser?.name) { setNotifications([]); return; }
    fetchNotifications(currentUser.name);
  }, [currentUser?.name, fetchNotifications]);

  useEffect(() => {
    if (!currentUser?.name) return;
    const frame = window.requestAnimationFrame(() => {
      void registerPushNotifications();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentUser?.name]);

  useEffect(() => {
    if (!currentUser?.name) return;
    void identifyPurchaser(currentUser.name);
  }, [currentUser?.name]);

  // Coming back from the background refreshes the token (inside onAppResume) and then re-syncs
  // the state that has no other way to catch up: the user record, and anything the WebSocket
  // pushed while the socket was down. Query data has its own staleness rules.
  useEffect(() => {
    if (!currentUser?.name) return;
    const name = currentUser.name;
    return onAppResume(() => {
      void api.get<AppUser>('/onboarding/me')
        .then((user) => {
          setCurrentUserState(user);
          localStorage.setItem('kollekt-user', JSON.stringify(user));
        })
        .catch(() => undefined);
      fetchNotifications(name);
    });
  }, [currentUser?.name, fetchNotifications]);

  useEffect(() => {
    if (!currentUser?.name) return;
    const name = currentUser.name;
    const disconnect = connectCollectiveRealtime(
      name,
      (event) => {
        if (event.type === 'NOTIFICATION_CREATED') {
          fetchNotifications(name);
        }
        if (event.type === 'MEMBER_ONLINE' || event.type === 'MEMBER_OFFLINE') {
          const count = (event.payload as { count?: number })?.count;
          if (count !== undefined) setOnlineCount(count);
        }
        eventListenersRef.current.forEach((listener) => listener(event));
      },
      {
        onReconnected: () => {
          fetchNotifications(name);
          reconnectListenersRef.current.forEach((listener) => listener());
        },
      },
    );
    return disconnect;
  }, [currentUser?.name, fetchNotifications]);

  const setCurrentUser = (user: AppUser | null) => {
    setCurrentUserState(user);
    if (user) localStorage.setItem('kollekt-user', JSON.stringify(user));
    else localStorage.removeItem('kollekt-user');
  };

  const handleLogout = async () => {
    await unregisterPushNotifications();
    await resetPurchaser();
    await logoutSession();
    setCurrentUserState(null);
    setNotifications([]);
    localStorage.removeItem('kollekt-user');
  };

  const refreshNotifications = useCallback(() => {
    if (currentUser?.name) fetchNotifications(currentUser.name);
  }, [currentUser?.name, fetchNotifications]);

  const dismissNotification = useCallback(async (id: number) => {
    if (!currentUser?.name) return;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(currentUser.name, id).catch(() => {});
  }, [currentUser?.name]);

  const clearAllNotifications = useCallback(async () => {
    if (!currentUser?.name) return;
    setNotifications([]);
    await deleteAllNotifications(currentUser.name).catch(() => {});
  }, [currentUser?.name]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!currentUser?.name) return;
    await api.post(`/notifications/${encodeURIComponent(currentUser.name)}/read`, {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [currentUser?.name]);

  return (
    <UserContext.Provider value={{
      currentUser,
      setCurrentUser,
      handleLogout,
      isLoading,
      notifications,
      notificationsLoading,
      refreshNotifications,
      dismissNotification,
      clearAllNotifications,
      markAllNotificationsRead,
      subscribeRealtimeEvent,
      subscribeRealtimeReconnect,
      onlineCount,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside UserProvider');
  return ctx;
}

/**
 * Registers interest in the single shared collective WebSocket instead of opening a page-scoped
 * one. `onEvent`/`onReconnected` are read from a ref on every call, so passing a fresh inline
 * closure each render is fine — the subscription itself is only (re)established once, on mount.
 */
export function useRealtimeEvent(onEvent: RealtimeEventListener, onReconnected?: RealtimeReconnectListener) {
  const { subscribeRealtimeEvent, subscribeRealtimeReconnect } = useUser();
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const reconnectRef = useRef(onReconnected);
  reconnectRef.current = onReconnected;

  useEffect(() => {
    const unsubscribeEvent = subscribeRealtimeEvent((event) => eventRef.current(event));
    const unsubscribeReconnect = subscribeRealtimeReconnect(() => reconnectRef.current?.());
    return () => {
      unsubscribeEvent();
      unsubscribeReconnect();
    };
  }, [subscribeRealtimeEvent, subscribeRealtimeReconnect]);
}
