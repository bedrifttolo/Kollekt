/**
 * Per-thread "last message I saw" cursor, stored on the device.
 *
 * The backend has no read state at all — ChatMessage carries no readAt/seenBy and there is no
 * mark-read endpoint — so the unread divider is tracked client-side. That is the honest scope for
 * a "NY" marker: it answers "what is new since I last looked on this device", which is what the
 * divider is for. It deliberately does not sync across devices, and needs no migration or RLS.
 *
 * Same approach BottomNav already uses for its tab dots (kollekt_tab_seen_*).
 */

const KEY_PREFIX = 'kollekt-chat-seen';

/** `thread` is null for the household thread, otherwise the other member's name. */
function storageKey(memberName: string, thread: string | null): string {
  return `${KEY_PREFIX}-${memberName}-${thread ?? '__household__'}`;
}

export function getLastSeenMessageId(memberName: string, thread: string | null): number | null {
  if (!memberName) return null;
  try {
    const raw = localStorage.getItem(storageKey(memberName, thread));
    const parsed = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setLastSeenMessageId(memberName: string, thread: string | null, messageId: number): void {
  if (!memberName) return;
  try {
    localStorage.setItem(storageKey(memberName, thread), String(messageId));
  } catch {
    // Storage disabled — the divider just won't persist across reloads.
  }
}
