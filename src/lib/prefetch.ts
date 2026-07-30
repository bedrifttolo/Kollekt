import type { QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { qk } from './queryKeys';
import type {
  AppUser,
  DashboardResponse,
  Task,
  ShoppingItem,
  TaskSwapRequest,
  MaintenanceTicket,
  EconomySummary,
  CalendarEvent,
  GuestNotice,
  LeaderboardResponse,
  Achievement,
  Fairness,
} from './types';

// Warms the caches after the active screen has had a chance to load. Running these
// bundles sequentially avoids saturating the backend/DB pool during session restore.
// The queryKeys + queryFns here must mirror the ones in the corresponding pages so the
// prefetched entries are reused (Dashboard, Tasks, Economy, Calendar). Fire-and-forget; failures
// are ignored — the page's own query will retry.
export async function prefetchMainData(queryClient: QueryClient, user: AppUser): Promise<void> {
  const name = user.name;
  const enc = encodeURIComponent(name);

  await queryClient.prefetchQuery({
    queryKey: qk.dashboard(name),
    queryFn: () => api.get<DashboardResponse>(`/dashboard?memberName=${enc}`),
  });

  await queryClient.prefetchQuery({
    queryKey: qk.members(name),
    queryFn: () => api.get<AppUser[]>(`/members/collective?memberName=${enc}`),
  });

  await queryClient.prefetchQuery({
    queryKey: qk.tasks(name),
    queryFn: async () => {
      const [taskRes, shopRes, swapRequestRes, maintenanceRes] = await Promise.all([
        api.get<Task[]>(`/tasks?memberName=${enc}`),
        api.get<ShoppingItem[]>(`/tasks/shopping?memberName=${enc}`),
        api.get<TaskSwapRequest[]>(`/users/${user.id}/swap-requests`),
        api.get<MaintenanceTicket[]>('/maintenance/tickets'),
      ]);
      return { taskRes, shopRes, swapRequestRes, maintenanceRes };
    },
  });

  await queryClient.prefetchQuery({
    queryKey: qk.economy(name),
    queryFn: () => api.get<EconomySummary>(`/economy/summary?memberName=${enc}`),
  });

  await queryClient.prefetchQuery({
    queryKey: qk.calendar(name),
    queryFn: async () => {
      const [eventResponse, guestResponse] = await Promise.all([
        api.get<CalendarEvent[]>(`/events?memberName=${enc}`),
        api.get<GuestNotice[]>('/guest-notices'),
      ]);
      return { eventResponse, guestResponse };
    },
  });

  // Mirrors RanksPanel's default period ('OVERALL') so the Social tab's first visit each
  // session renders from cache instead of showing a spinner too.
  await queryClient.prefetchQuery({
    queryKey: ['ranks', name, 'OVERALL'],
    queryFn: async () => {
      const [lb, ach] = await Promise.all([
        api.get<LeaderboardResponse>(`/leaderboard?memberName=${enc}&period=OVERALL`),
        api.get<Achievement[]>(`/achievements?memberName=${enc}`),
      ]);
      return { lb, ach };
    },
  });

  await queryClient.prefetchQuery({
    queryKey: ['fairness', name],
    queryFn: () => api.get<Fairness>(`/fairness?memberName=${enc}`),
  });
}
