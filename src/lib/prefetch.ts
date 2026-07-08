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
  PayOption,
} from './types';

// Warms the caches for the main tabs right after login/session restore, so the first
// navigation to each renders instantly instead of waiting on the network.
// The queryKeys + queryFns here must mirror the ones in the corresponding pages so the
// prefetched entries are reused (Dashboard, Tasks, Economy). Fire-and-forget; failures
// are ignored — the page's own query will retry.
export function prefetchMainData(queryClient: QueryClient, user: AppUser): void {
  const name = user.name;
  const enc = encodeURIComponent(name);

  void queryClient.prefetchQuery({
    queryKey: qk.dashboard(name),
    queryFn: () => api.get<DashboardResponse>(`/dashboard?memberName=${enc}`),
  });

  void queryClient.prefetchQuery({
    queryKey: qk.members(name),
    queryFn: () => api.get<AppUser[]>(`/members/collective?memberName=${enc}`),
  });

  void queryClient.prefetchQuery({
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

  void queryClient.prefetchQuery({
    queryKey: qk.economy(name),
    queryFn: async () => {
      const [res, payOptionsRes] = await Promise.all([
        api.get<EconomySummary>(`/economy/summary?memberName=${enc}`),
        api.get<PayOption[]>(`/economy/pay-options?memberName=${enc}`),
      ]);
      return { res, payOptionsRes };
    },
  });
}
