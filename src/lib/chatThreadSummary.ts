import type { ChatMessage, ChatThreadSummary } from './types';

/** Display name for the pseudo-sender behind an anonymous private complaint — not a real member,
 *  mirrors ChatOperations.SYSTEM_SENDER on the backend. */
export const CHAT_SYSTEM_SENDER = 'Kollekt Bot 🤖';

function previewOf(message: ChatMessage): string {
  if (message.deleted) return '';
  if (message.text.trim()) {
    return message.text.length > 60 ? `${message.text.slice(0, 60)}...` : message.text;
  }
  if (message.imageData) return '[Image]';
  return '';
}

/** Bumps the household row's preview/timestamp when a new household message arrives — used by
 *  the inbox's realtime listener so it doesn't have to refetch the whole summary list. */
export function patchThreadsOnHouseholdMessage(
  summaries: ChatThreadSummary[] | undefined,
  message: ChatMessage,
): ChatThreadSummary[] | undefined {
  if (!summaries) return summaries;
  return summaries.map((summary) =>
    summary.thread === null
      ? {
          ...summary,
          lastMessageId: message.id,
          lastMessageSender: message.sender,
          lastMessagePreview: previewOf(message),
          lastMessageTimestamp: message.timestamp,
        }
      : summary,
  );
}

/** Bumps a DM row's preview/timestamp when a new direct message arrives, for either direction. */
export function patchThreadsOnDirectMessage(
  summaries: ChatThreadSummary[] | undefined,
  otherName: string,
  message: ChatMessage,
): ChatThreadSummary[] | undefined {
  if (!summaries) return summaries;
  const patched = summaries.map((summary) =>
    summary.thread === otherName
      ? {
          ...summary,
          lastMessageId: message.id,
          lastMessageSender: message.sender,
          lastMessagePreview: previewOf(message),
          lastMessageTimestamp: message.timestamp,
        }
      : summary,
  );
  // A DM to/from someone with no existing row yet (e.g. the very first message from the system
  // pseudo-sender) — append a synthetic row rather than dropping the update on the floor.
  if (patched.some((summary) => summary.thread === otherName)) return patched;
  return [
    ...patched,
    {
      thread: otherName,
      displayName: otherName,
      isSystem: otherName === CHAT_SYSTEM_SENDER,
      lastMessageId: message.id,
      lastMessageSender: message.sender,
      lastMessagePreview: previewOf(message),
      lastMessageTimestamp: message.timestamp,
    },
  ];
}

/** Refreshes a thread row's preview after its *latest* message was edited or deleted — matched by
 *  id (not by thread) so this works for either the household row or a DM row with one function,
 *  and correctly no-ops when the edited/deleted message isn't actually the thread's last one
 *  (mirroring how a reaction or pin change on an older message is already ignored by the inbox). */
export function patchThreadsOnMessageUpdate(
  summaries: ChatThreadSummary[] | undefined,
  message: ChatMessage,
): ChatThreadSummary[] | undefined {
  if (!summaries) return summaries;
  return summaries.map((summary) =>
    summary.lastMessageId === message.id
      ? {
          ...summary,
          lastMessageSender: message.sender,
          lastMessagePreview: previewOf(message),
          lastMessageTimestamp: message.timestamp,
          lastMessageDeleted: message.deleted ?? false,
        }
      : summary,
  );
}
