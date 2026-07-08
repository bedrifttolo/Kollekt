import { QueryClient } from '@tanstack/react-query';

// Shared query client. Tuned for a mobile app talking to a latency-heavy backend:
// cached data is served instantly on re-navigation (staleTime) and only refetched in
// the background when it has aged, so switching pages feels instant after the first load.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // treat data as fresh for 30s — revisits render from cache with no spinner
      gcTime: 24 * 60 * 60_000, // keep cached for 24h so it survives to be persisted across app launches
      retry: 1, // one retry on failure; avoids hammering a slow backend
      refetchOnWindowFocus: false, // don't refetch every time the app regains focus
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
