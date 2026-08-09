// Harness-only stand-in for '../lib/api', aliased in via vite.harness.config.ts.
// Returns canned fixtures per endpoint so ProfilePage can be mounted without a real backend.
import type { NotificationPreferences } from "../lib/types";

const params = new URLSearchParams(window.location.search);
const scenario = params.get("scenario") ?? "happy";

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
    return { players: [{ rank: 1, name: "Alice", level: 3, xp: 120, tasksCompleted: 5, streak: 2, badges: [] }] } as unknown as T;
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
  if (url.startsWith("/tasks")) {
    return [] as unknown as T;
  }
  if (url.startsWith("/notifications/preferences")) {
    return {} as unknown as T;
  }
  throw new Error("unhandled GET " + url);
}

async function post<T>(url: string, _body?: unknown): Promise<T> {
  log(url);
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
