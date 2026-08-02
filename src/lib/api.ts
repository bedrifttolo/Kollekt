import i18n from '../i18n';
import { Capacitor } from '@capacitor/core';
import { authStorage } from './authStorage';

// Late approval (regret missed task)
export async function regretTask(taskId: string, memberName: string) {
  return api.post(`/tasks/${taskId}/regret?memberName=${encodeURIComponent(memberName)}`, {});
}
export async function markAllNotificationsAsRead(userName: string): Promise<void> {
  await api.post(`/notifications/${userName}/read`, {});
}
const configuredApiBase =
  import.meta.env.VITE_API_URL?.trim() || (Capacitor.isNativePlatform() ? 'https://kollekt-backend-7mdp.onrender.com/api' : '');

if (Capacitor.isNativePlatform() && !configuredApiBase?.startsWith('https://')) {
  throw new Error('VITE_API_URL must be an absolute HTTPS URL in the native app');
}

export const API_BASE = (configuredApiBase || '/api').replace(/\/$/, '');

// Upper bound for any single request, so a dead connection never hangs the UI
// indefinitely. Generous, because a slow network is not the same as a broken one.
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Fire-and-forget ping issued at launch so the first real request finds a ready
 * connection. Silent by design: failures are irrelevant to the user.
 */
export function warmUpBackend(): void {
  void fetch(`${API_BASE}/health`).catch(() => undefined);
}

export function getAccessToken(): Promise<string | null> {
  return authStorage.getAccessToken();
}

export function setAccessToken(token: string): Promise<void> {
  return authStorage.setAccessToken(token);
}

export function getRefreshToken(): Promise<string | null> {
  return authStorage.getRefreshToken();
}

export function setRefreshToken(token: string): Promise<void> {
  return authStorage.setRefreshToken(token);
}

export function clearAccessToken(): Promise<void> {
  return authStorage.clearAccessToken();
}

export function clearRefreshToken(): Promise<void> {
  return authStorage.clearRefreshToken();
}

export async function logoutSession(): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    await Promise.all([clearAccessToken(), clearRefreshToken()]);
    return;
  }
  const refreshToken = await getRefreshToken();
  try {
    await fetch(`${API_BASE}/onboarding/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ refreshToken }),
    });
  } finally {
    await Promise.all([clearAccessToken(), clearRefreshToken()]);
  }
}

function t(key: string, defaultValue?: string): string {
  return i18n.t(key, { defaultValue });
}

function sanitizeMessage(message: string, fallback: string): string {
  const normalized = message.trim();
  if (!normalized) return fallback;

  const lower = normalized.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  ) {
    return t('errors.network', fallback);
  }

  // Checked before the generic 401/JWT branch below: a rejected username+password is a
  // credentials problem, not an expired session, and telling someone to "sign in again" when
  // signing in is exactly what just failed sends them in a loop. The backend words this
  // "Invalid name or password" (AccountOperations.login), so match that, not "invalid credentials".
  if (
    lower.includes('invalid credentials') ||
    lower.includes('invalid name or password') ||
    lower.includes('has no password configured')
  ) {
    return t('errors.invalidCredentials', fallback);
  }

  if (
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('token expired') ||
    lower.includes('jwt')
  ) {
    return t('errors.sessionExpired', fallback);
  }

  if (lower.includes('403') || lower.includes('forbidden')) {
    return t('errors.forbidden', fallback);
  }

  if (lower.includes('404') || lower.includes('not found')) {
    return t('errors.notFound', fallback);
  }

  // Checked before the generic "already exists" branch below: a same-household name collision
  // at join time needs its own copy pointing the user back to the name step, not the generic
  // "this already exists" message (CollectiveOperations.joinCollective).
  if (lower.includes('already exists in this household')) {
    return t('errors.nameTakenInHousehold', fallback);
  }

  if (lower.includes('already exists') || lower.includes('duplicate')) {
    return t('errors.alreadyExists', fallback);
  }

  if (lower.includes('already belongs')) {
    return t('errors.alreadyInCollective', fallback);
  }

  if (lower.includes('join code') || lower.includes('collective not found')) {
    return t('errors.invalidJoinCode', fallback);
  }

  if (
    lower.includes('backend') ||
    lower.includes('server') ||
    lower.includes('api') ||
    lower.includes('response') ||
    lower.includes('request') ||
    /^[45]\d{2}\b/.test(lower)
  ) {
    return fallback;
  }

  return normalized;
}

/**
 * Thrown for any non-OK backend response. `message` is already translated for display, so
 * `rawMessage` keeps the backend's untranslated text — the only thing callers can reliably
 * branch on when they need to react to a *specific* failure rather than just show it.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly rawMessage: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getUserMessage(error: unknown, fallback = t('errors.generic', 'Something went wrong. Please try again.')): string {
  if (error instanceof Error) {
    return sanitizeMessage(error.message, fallback);
  }

  if (typeof error === 'string') {
    return sanitizeMessage(error, fallback);
  }

  return fallback;
}

interface AuthRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * Refresh tokens are single-use: the server revokes the presented token and issues a new pair.
 * So two concurrent refreshes are not merely wasteful — the second one presents a token the
 * first already burned, gets rejected, and (before this guard existed) wiped the session of a
 * perfectly healthy user. The dashboard fires many requests at once, so a stale access token
 * reliably produced exactly that race. Every caller shares one in-flight refresh instead.
 */
let refreshInFlight: Promise<boolean> | null = null;

function tryRefreshTokens(): Promise<boolean> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function performRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/onboarding/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Offline or the request was aborted — keep the tokens and let the caller surface the
    // original failure rather than a refresh error the user can do nothing about.
    return false;
  }

  // Only a genuine rejection of the refresh token means the session is over. A 429 from the
  // auth rate limiter (which covers /api/onboarding/*), a 5xx, or a dropped connection are all
  // transient — throwing the tokens away there logs the user out of a still-valid session and,
  // because their retries are throttled too, locks them out until the window clears.
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await Promise.all([clearAccessToken(), clearRefreshToken()]);
    }
    return false;
  }

  const payload = (await response.json()) as AuthRefreshResponse;
  await Promise.all([
    setAccessToken(payload.accessToken),
    setRefreshToken(payload.refreshToken),
  ]);
  return true;
}

/** Seconds of remaining validity below which an access token is treated as already stale. */
const REFRESH_SKEW_SECONDS = 300;

/** Reads `exp` out of a JWT without verifying it — the server is the only authority on validity;
 *  this is purely a scheduling hint. Returns null for anything unparseable. */
function accessTokenExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/**
 * Refreshes ahead of expiry so requests aren't spent discovering the token is dead. Without this
 * every wake-up costs a guaranteed 401 round-trip first, and the WebSocket — which has no retry
 * path of its own — just fails its handshake.
 */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const exp = accessTokenExpiry(token);
  if (exp === null) return token;
  if (exp - Date.now() / 1000 > REFRESH_SKEW_SECONDS) return token;
  // A failed pre-emptive refresh must not fail the caller's request: this runs before request()'s
  // own error handling, so a rejection here would surface as a raw error instead of a readable
  // one. Fall through with whatever token is stored and let the normal 401 path deal with it.
  await tryRefreshTokens().catch(() => false);
  return getAccessToken();
}

async function request<T>(path: string, init?: RequestInit, retryOnAuthFailure = true): Promise<T> {
  // Refresh before spending the request when the token is about to lapse. The refresh endpoint
  // itself must not recurse through this.
  const token = path === '/onboarding/refresh' ? await getAccessToken() : await ensureFreshAccessToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  let response: Response;

  try {
    const isFormDataBody = init?.body instanceof FormData;
    // Merge headers safely
    let mergedHeaders: Record<string, any> = {
      ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(authHeader || {}),
    };
    if (init && init.headers) {
      if (typeof init.headers === 'object' && !(init.headers instanceof Headers)) {
        mergedHeaders = { ...mergedHeaders, ...init.headers };
      } else if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          mergedHeaders[key] = value;
        });
      } // If it's a string, ignore (rare, not recommended)
    }
    // Abort a request that hangs, so the UI never waits forever.
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
    try {
      response = await fetch(`${API_BASE}${path}` , {
        ...init,
        headers: mergedHeaders,
        signal: init?.signal ?? timeoutController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    throw new Error(getUserMessage(error, t('errors.network', 'Couldn\'t connect right now. Please try again in a moment.')));
  }

  if (response.status === 401 && retryOnAuthFailure && path !== '/onboarding/refresh') {
    const refreshed = await tryRefreshTokens();
    if (refreshed) {
      return request<T>(path, init, false);
    }
  }

  // The auth rate limiter answers with Retry-After but an empty body, so without this the user
  // would just get the generic error and no idea that waiting is what fixes it.
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After'));
    const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60;
    throw new Error(i18n.t('errors.rateLimited', {
      defaultValue: 'Too many attempts. Try again in {{seconds}}s.',
      seconds,
    }));
  }

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: string };
        message = parsed.error ?? text;
      } catch {
        // Keep raw body when it is not JSON.
      }
    }
    throw new ApiError(getUserMessage(message, t('errors.generic', 'Something went wrong. Please try again.')), message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (!text.trim()) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('application/json')) {
    return JSON.parse(text) as T;
  }

  return text as T;
}

export async function deleteNotification(userName: string, id: number): Promise<void> {
  await api.delete(`/notifications/${encodeURIComponent(userName)}/${id}`);
}

export async function deleteAllNotifications(userName: string): Promise<void> {
  await api.delete(`/notifications/${encodeURIComponent(userName)}`);
}

export async function getNotificationPreferences(memberName: string): Promise<Record<string, boolean>> {
  return api.get<Record<string, boolean>>(`/notifications/preferences?memberName=${encodeURIComponent(memberName)}`);
}

export async function updateNotificationPreference(memberName: string, prefs: Record<string, boolean>): Promise<void> {
  await api.patch(`/notifications/preferences?memberName=${encodeURIComponent(memberName)}`, prefs);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: <T>(path: string, body: FormData) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = void>(path: string, body?: unknown) =>
      request<T>(path, {
        method: 'DELETE',
        body: body ? JSON.stringify(body) : undefined,
      }),
};
