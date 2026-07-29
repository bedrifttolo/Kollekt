// Central query-key registry. Keys are arrays prefixed by domain so related data can be
// invalidated by prefix (e.g. queryClient.invalidateQueries({ queryKey: ['dashboard'] })).
export const qk = {
  dashboard: (memberName?: string) => ['dashboard', memberName] as const,
  members: (memberName?: string) => ['members', memberName] as const,
  checkin: (memberName?: string) => ['checkin', memberName] as const,
  tasks: (memberName?: string) => ['tasks', memberName] as const,
  shopping: (memberName?: string) => ['shopping', memberName] as const,
  calendar: (memberName?: string) => ['calendar', memberName] as const,
  economy: (memberName?: string) => ['economy', memberName] as const,
  budgets: (memberName?: string) => ['budgets', memberName] as const,
  pant: (memberName?: string) => ['pant', memberName] as const,
  chat: (memberName?: string) => ['chat', memberName] as const,
  profile: (memberName?: string) => ['profile', memberName] as const,
  profileStats: (memberName?: string) => ['profile', 'stats', memberName] as const,
  profileRules: (memberName?: string) => ['profile', 'rules', memberName] as const,
  profileKudos: (memberName?: string) => ['profile', 'kudos', memberName] as const,
  profileNotifs: (memberName?: string) => ['profile', 'notifs', memberName] as const,
  profilePayments: (memberName?: string) => ['profile', 'payments', memberName] as const,
  notifications: (userName?: string) => ['notifications', userName] as const,
};
