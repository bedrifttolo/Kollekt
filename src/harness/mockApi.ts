// Harness-only stand-in for '../lib/api', aliased in via vite.harness.config.ts.
// Returns canned fixtures per endpoint so ProfilePage can be mounted without a real backend.
import type { NotificationPreferences } from "../lib/types";

const params = new URLSearchParams(window.location.search);
const scenario = params.get("scenario") ?? "happy";
const strict = params.get("strict") === "1";

function log(url: string) {
  // eslint-disable-next-line no-console
  console.log("[mockApi]", scenario, url);
}

class ApiErrorLike extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const HOUSE_RULES = {
  version: 2,
  content: "- Clean the kitchen\n- No guests after midnight",
  updatedBy: "Alice",
  createdAt: new Date().toISOString(),
  acknowledged: true,
  canEdit: true,
};

const QUIET_HOURS = { enabled: true, startTime: "22:00", endTime: "07:00", canEdit: true };
const COLLECTIVE_DETAILS = { id: 1, name: "The Loft", address: "123 Main St" };

// Dates are generated relative to today so the calendar and "this week" views always have content
// to lay out, rather than going empty whenever the fixture's hard-coded month falls out of range.
const today = new Date();
const iso = (offsetDays: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const TASKS = [
  { id: 1, title: "Take out the recycling", assignee: "Alice", dueDate: iso(0), category: "CLEANING", completed: false, xp: 20, penaltyXp: 5, recurrenceRule: "WEEKLY" },
  { id: 2, title: "Buy dish soap and coffee filters", assignee: "Bob", dueDate: iso(2), category: "SHOPPING", completed: false, xp: 15, penaltyXp: 5, recurrenceRule: null },
  { id: 3, title: "Vacuum the living room", assignee: "Alice", dueDate: iso(-1), category: "CLEANING", completed: true, xp: 25, penaltyXp: 5, recurrenceRule: "WEEKLY" },
];

const EVENTS = [
  { id: 1, title: "House dinner", date: iso(1), time: "19:00", endTime: "22:00", type: "DINNER", organizer: "Alice", attendees: 3, joining: ["Alice", "Bob"], passing: [] },
  { id: 2, title: "Film night", date: iso(4), time: "20:30", endTime: null, type: "MOVIE", organizer: "Bob", attendees: 2, joining: ["Bob"], passing: ["Chris"] },
];

const EXPENSES = [
  { id: 1, description: "Weekly groceries", amount: 842.5, paidBy: "Alice", category: "Groceries", date: iso(-2), participantNames: ["Alice", "Bob", "Chris"] },
  { id: 2, description: "Internet — March", amount: 599, paidBy: "Bob", category: "Bills", date: iso(-6), participantNames: ["Alice", "Bob", "Chris"] },
  { id: 3, description: "Cleaning supplies", amount: 214, paidBy: "Chris", category: "Cleaning", date: iso(-9), participantNames: ["Alice", "Bob", "Chris"] },
];

const PANT_SUMMARY = {
  currentAmount: 348,
  goalAmount: 1000,
  entries: [
    { id: 1, bottles: 24, amount: 72, addedBy: "Alice", date: iso(-3) },
    { id: 2, bottles: 40, amount: 120, addedBy: "Bob", date: iso(-11) },
  ],
};

const CHECKIN = { id: 1, weekStart: iso(-3), hasResponded: false, responseCount: 1, memberCount: 3 };

/** 600x1400 and 1400x600 placeholders for the chat photo messages — see the /chat fixture. */
const PORTRAIT_IMAGE =
  "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MDAiIGhlaWdodD0iMTQwMCI+PHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIxNDAwIiBmaWxsPSIjYzQ1MjZlIi8+PGNpcmNsZSBjeD0iMzAwIiBjeT0iNzAwIiByPSIyMzAiIGZpbGw9IiNmZmYiLz48L3N2Zz4=";
const LANDSCAPE_IMAGE =
  "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNDAwIiBoZWlnaHQ9IjYwMCI+PHJlY3Qgd2lkdGg9IjE0MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjM2Y2ZWE4Ii8+PGNpcmNsZSBjeD0iNzAwIiBjeT0iMzAwIiByPSIyMzAiIGZpbGw9IiNmZmYiLz48L3N2Zz4=";

const VIBE_BREAKDOWN = {
  base: 50, taskCompletionRate: 0.72, taskCompletionPoints: 18, dueTasksThisWeek: 7,
  completedDueTasksThisWeek: 5, activityBonus: 6, activityBonusCap: 10, tasksCompletedThisWeek: 6,
  planningBonus: 4, planningBonusCap: 8, eventsThisWeek: 2, togethernessBonus: 3,
  togethernessBonusCap: 6, expensesLoggedThisWeek: 3, moodAdjustment: 2, weeklyAverageMood: 4,
  balancePenalty: 2, balancePenaltyCap: 10, balanceSpread: 240,
};

async function get<T>(url: string): Promise<T> {
  log(url);
  if (url.startsWith("/onboarding/collectives/code/")) {
    return { collectiveId: 1 } as unknown as T;
  }
  if (/^\/collectives\/\d+\/rules$/.test(url)) {
    if (scenario === "rules-404") throw new ApiErrorLike(404, "not found");
    return HOUSE_RULES as unknown as T;
  }
  if (/^\/collectives\/\d+\/quiet-hours$/.test(url)) {
    if (scenario === "quiet-404") throw new ApiErrorLike(404, "not found");
    return QUIET_HOURS as unknown as T;
  }
  if (/^\/collectives\/\d+$/.test(url)) {
    if (scenario === "home-404" || scenario === "endpoint-not-rolled-out") throw new ApiErrorLike(404, "not found");
    return COLLECTIVE_DETAILS as unknown as T;
  }
  if (url === "/kudos/feed") {
    return [] as unknown as T;
  }
  if (url.startsWith("/leaderboard")) {
    if (scenario === "leaderboard-error") throw new ApiErrorLike(500, "boom");
    // periodStats is required, not optional: RanksPanel reads periodStats.totalTasks unguarded, so
    // a fixture without it renders a blank page. Three players so the podium has all three places.
    return {
      players: [
        { rank: 1, name: "Alice", level: 3, xp: 120, tasksCompleted: 5, streak: 2, badges: [] },
        { rank: 2, name: "Bob", level: 2, xp: 90, tasksCompleted: 4, streak: 1, badges: [] },
        { rank: 3, name: "Chris", level: 2, xp: 60, tasksCompleted: 2, streak: 0, badges: [] },
      ],
      periodStats: {
        totalTasks: 11, totalXp: 270, avgPerPerson: 3.7, topContributor: "Alice",
        bestStreak: 2, bestStreakHolder: "Alice", totalPenaltyXp: 0,
        lateCompletions: 1, lateCompletionsHolder: "Bob", skippedCount: 0, skippedHolder: "",
      },
      monthlyPrize: "Dish duty amnesty",
    } as unknown as T;
  }
  if (url.startsWith("/members/stats") || /\/stats$/.test(url)) {
    return { xp: 120, streak: 2, tasksCompleted: 5, level: 3, rank: 1 } as unknown as T;
  }
  if (url.startsWith("/achievements")) {
    if (scenario === "achievements-error") throw new ApiErrorLike(500, "boom");
    return [{ id: 1, key: "k", title: "t", description: "d", icon: "i", unlocked: true }] as unknown as T;
  }
  if (url.startsWith("/members/collective")) {
    return [
      { id: 1, name: "Alice", email: "a@a.com", collectiveCode: "ABCD12", status: "ACTIVE", color: "#ff0000" },
      { id: 2, name: "Bob", email: "b@b.com", collectiveCode: "ABCD12", status: "AWAY", color: "#00ff00" },
    ] as unknown as T;
  }
  if (url.startsWith("/members/payment-handles")) {
    return {} as unknown as T;
  }
  // The thread wallpaper is shared, so it comes from the API now rather than localStorage. No
  // picture set is the interesting default for layout work — a wallpaper hides the chat surface.
  if (url.startsWith("/chat/background")) {
    return { imageUrl: null, setBy: null, updatedAt: null, otherName: null } as unknown as T;
  }
  if (url.startsWith("/chat/threads")) {
    return [
      { thread: null, displayName: "The Kollektiv", isSystem: false, lastMessageId: 5, lastMessageSender: "Bob", lastMessagePreview: "Pasta at 7", lastMessageTimestamp: new Date(Date.now() - 12 * 60000).toISOString() },
      { thread: "Bob", displayName: "Bob", isSystem: false, lastMessageId: 9, lastMessageSender: "Bob", lastMessagePreview: "Sent you the receipt", lastMessageTimestamp: new Date(Date.now() - 5400000).toISOString() },
      { thread: "Kollekt", displayName: "Kollekt", isSystem: true, lastMessageId: 11, lastMessageSender: "Kollekt", lastMessagePreview: "Weekly check-in is open", lastMessageTimestamp: new Date(Date.now() - 86400000).toISOString() },
    ] as unknown as T;
  }
  if (url.startsWith("/chat")) {
    const ts = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000).toISOString();
    return [
      { id: 1, sender: "Bob", text: "Anyone home tonight? I'm cooking too much pasta again", timestamp: ts(180), reactions: [{ emoji: "\u{1F604}", users: ["Alice"] }] },
      { id: 2, sender: "Alice", text: "Yes! Save me a plate", timestamp: ts(174), reactions: [] },
      { id: 3, sender: "Alice", text: "Also I took the recycling out, bins are empty again", timestamp: ts(173), reactions: [] },
      { id: 4, sender: "Chris", text: "Legend. I'll do the bathroom this weekend", timestamp: ts(96), reactions: [{ emoji: "\u2764\uFE0F", users: ["Alice", "Bob"] }], replyToMessageId: 3 },
      { id: 5, sender: "Bob", text: "Pasta at 7", timestamp: ts(12), reactions: [], pinned: true },
      // Photo messages, in both orientations. SVG (not a real photo) purely so the fixture stays a
      // couple of lines instead of kilobytes of base64 — the bubble and the fullscreen viewer size
      // an <img> from its intrinsic dimensions either way, and 600x1400 / 1400x600 are both far
      // larger than the phone viewport, which is the case that has to be measured.
      { id: 6, sender: "Chris", text: "", timestamp: ts(8), reactions: [], imageMimeType: "image/svg+xml", imageFileName: "tall.svg", imageData: PORTRAIT_IMAGE },
      { id: 7, sender: "Alice", text: "", timestamp: ts(6), reactions: [], imageMimeType: "image/svg+xml", imageFileName: "wide.svg", imageData: LANDSCAPE_IMAGE },
    ] as unknown as T;
  }
  if (url.startsWith("/tasks")) {
    return TASKS as unknown as T;
  }
  if (url.startsWith("/dashboard")) {
    return {
      collectiveName: "The Loft",
      currentUserName: "Alice",
      currentUserXp: 120,
      currentUserLevel: 3,
      currentUserRank: 1,
      completedTasksCount: 5,
      currentUserBalance: 214.5,
      upcomingTasks: TASKS.filter((task) => !task.completed),
      upcomingEvents: EVENTS,
      recentExpenses: EXPENSES,
      pendingShoppingItems: [
        { id: 1, item: "Oat milk", addedBy: "Bob", completed: false },
        { id: 2, item: "Bin bags", addedBy: "Alice", completed: false, staple: true },
      ],
      vibeScore: 78,
      vibeBreakdown: VIBE_BREAKDOWN,
    } as unknown as T;
  }
  if (url.startsWith("/economy/pant")) {
    return PANT_SUMMARY as unknown as T;
  }
  if (url.startsWith("/economy/summary")) {
    return {
      expenses: EXPENSES,
      balances: [
        { name: "Alice", amount: 214.5 },
        { name: "Bob", amount: -86 },
        { name: "Chris", amount: -128.5 },
      ],
      pantSummary: PANT_SUMMARY,
      payOptions: [
        { name: "Bob", amount: 86, handles: { vipps: "90012345", paypal: "bob@example.com" } },
        { name: "Chris", amount: 128.5, handles: { bankAccount: "1234.56.78901" } },
      ],
      owedToYou: [
        { name: "Dana", amount: 240 },
        { name: "Erik", amount: 45 },
      ],
    } as unknown as T;
  }
  if (url.startsWith("/economy/budgets")) {
    return [
      { category: "Groceries", monthlyLimit: 3000 },
      { category: "Bills", monthlyLimit: 1500 },
      { category: "Cleaning", monthlyLimit: 500 },
      { category: "Entertainment", monthlyLimit: 0 },
      { category: "Food", monthlyLimit: 1200 },
      { category: "Other", monthlyLimit: 0 },
    ] as unknown as T;
  }
  if (url.startsWith("/fairness")) {
    return {
      windowDays: 30,
      totalTasks: 11,
      balancePercent: 82,
      // `completedTasks` is the field MemberShareDto actually sends — this fixture used to say
      // `taskCount`, which typed as `unknown` on the way out and so silently fed 0 to every
      // consumer that reads it.
      shares: [
        { name: "Alice", completedTasks: 5, sharePercent: 45 },
        { name: "Bob", completedTasks: 4, sharePercent: 36 },
        { name: "Chris", completedTasks: 2, sharePercent: 19 },
      ],
    } as unknown as T;
  }
  if (url.startsWith("/events/calendar-feed")) {
    return { path: "/calendar-feed/harness.ics" } as unknown as T;
  }
  if (url.startsWith("/events")) {
    return EVENTS as unknown as T;
  }
  if (url.startsWith("/guest-notices")) {
    return [
      { id: 1, guestName: "Sam", date: iso(3), startTime: "18:00", endTime: "23:00", overnight: false, createdBy: "Bob", overlapsQuietHours: false },
    ] as unknown as T;
  }
  if (url.startsWith("/notifications/preferences")) {
    return {} as unknown as T;
  }
  // Anything without a fixture resolves empty rather than throwing, so a page the harness has never
  // been pointed at still renders (usually into its empty state) instead of blanking the screen on
  // the first unmocked call. The original crash-repro use case wants the opposite, so ?strict=1
  // restores the throw. List-shaped paths get [] since most callers .map() the result.
  if (strict) throw new Error("unhandled GET " + url);
  // eslint-disable-next-line no-console
  console.warn("[mockApi] unmocked GET, returning []:", url);
  // [] rather than {}: the object-shaped endpoints are all matched explicitly above, and everything
  // left over is a collection. Pages call .filter/.map/.some/.reduce/.length on these without
  // guarding, so returning {} crashes the render — which the harness then screenshots as a blank
  // page. If a new object-shaped endpoint appears, give it an explicit fixture above.
  return [] as unknown as T;
}

async function post<T>(url: string, _body?: unknown): Promise<T> {
  log(url);
  // Dashboard and Calendar both render the weekly check-in card from this POST's response, and both
  // read .weekStart through a date formatter that throws on undefined.
  if (url.includes("/checkins/generate")) {
    return CHECKIN as unknown as T;
  }
  return {} as unknown as T;
}
async function patch<T>(url: string, _body?: unknown): Promise<T> {
  log(url);
  return {} as unknown as T;
}
async function del<T>(url: string): Promise<T> {
  log(url);
  return {} as unknown as T;
}
async function postForm<T>(url: string): Promise<T> {
  log(url);
  return {} as unknown as T;
}

export const api = { get, post, patch, delete: del, postForm };

export async function getNotificationPreferences(_name: string): Promise<NotificationPreferences> {
  return {};
}
export async function updateNotificationPreference(_name: string, _prefs: NotificationPreferences): Promise<void> {}

export function getUserMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/* The rest of lib/api's public surface. This has to be a *superset* of what the app imports, not
   just what one page needs: the harness swaps the module by resolved file path, so every importer
   in the tree gets this file, and one missing name is a hard SyntaxError at load with a blank page
   and no React error boundary to catch it. If you add an export to lib/api, mirror it here. */
export const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function warmUpBackend(): void {}
export async function getAccessToken(): Promise<string | null> {
  return 'harness-token';
}
export async function setAccessToken(_token: string): Promise<void> {}
export async function getRefreshToken(): Promise<string | null> {
  return 'harness-refresh';
}
export async function setRefreshToken(_token: string): Promise<void> {}
export async function clearAccessToken(): Promise<void> {}
export async function clearRefreshToken(): Promise<void> {}
export async function logoutSession(): Promise<void> {}
export async function ensureFreshAccessToken(): Promise<string | null> {
  return 'harness-token';
}
export async function deleteNotification(_userName: string, _id: number): Promise<void> {}
export async function deleteAllNotifications(_userName: string): Promise<void> {}
export async function markAllNotificationsAsRead(_userName: string): Promise<void> {}
export async function regretTask(_taskId: string, _memberName: string): Promise<void> {}
