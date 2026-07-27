import type { ChatMessage } from './types';

/**
 * Layout decisions for a chat thread: which bubbles belong to the same run, where a new day
 * starts, and where the unread boundary sits.
 *
 * Kept as a pure function over the message array so the rules are testable on their own and the
 * render stays a straight map. Messages are assumed to arrive oldest-first, as the API returns.
 */

/** Two consecutive messages from the same person within this window read as one utterance and are
 *  drawn tight together, the way Snapchat and iMessage group them. */
const GROUP_WINDOW_MS = 2 * 60 * 1000;

export interface DecoratedMessage {
  message: ChatMessage;
  /** First bubble of a same-sender run — the only one that shows the sender's name. */
  isFirstOfGroup: boolean;
  /** Last bubble of a run — the only one that shows a timestamp, and the only one with a tail. */
  isLastOfGroup: boolean;
  /** A date chip goes above this message. */
  startsNewDay: boolean;
  /** The "NY" divider goes above this message. */
  startsUnread: boolean;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

// Both sides are optional: the first message has no predecessor and the last has no successor.
// Indexing a ChatMessage[] is typed as non-optional here, so this has to be guarded by hand.
function isGrouped(previous: ChatMessage | undefined, current: ChatMessage | undefined): boolean {
  if (!previous || !current) return false;
  if (previous.sender !== current.sender) return false;
  const gap = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
  // A negative gap means the two arrived out of order; treat that as "not grouped" rather than
  // trusting the clock, so a mis-stamped message can't swallow the sender label of the next run.
  return gap >= 0 && gap <= GROUP_WINDOW_MS;
}

/**
 * @param lastSeenId the newest message id this member had already seen; null when they have never
 *   opened the thread, in which case nothing is marked unread — a first visit is not "new".
 */
export function decorateMessages(messages: ChatMessage[], lastSeenId: number | null): DecoratedMessage[] {
  // Only mark a boundary if there is something newer AND something older to divide it from.
  // When the whole thread is newer than the cursor the divider would sit at the very top saying
  // "everything is new", which tells the reader nothing — so it is suppressed entirely rather
  // than pushed down onto the second message, which would falsely imply the first was seen.
  const firstNewIndex = lastSeenId === null ? -1 : messages.findIndex((message) => message.id > lastSeenId);
  const firstUnreadIndex = firstNewIndex > 0 ? firstNewIndex : -1;

  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const startsNewDay =
      !previous || !sameDay(new Date(previous.timestamp), new Date(message.timestamp));
    const startsUnread = index === firstUnreadIndex;

    // A day chip or the unread divider visually breaks a run, so the bubble under it starts a new
    // group even when the sender and timing would otherwise have merged it into the one above.
    const grouped = isGrouped(previous, message) && !startsNewDay && !startsUnread;
    const nextGrouped =
      isGrouped(message, next) &&
      !!next &&
      sameDay(new Date(message.timestamp), new Date(next.timestamp)) &&
      index + 1 !== firstUnreadIndex;

    return {
      message,
      isFirstOfGroup: !grouped,
      isLastOfGroup: !nextGrouped,
      startsNewDay,
      startsUnread,
    };
  });
}

/** Newest id in the thread, for parking the seen cursor once the user has looked at it. */
export function newestMessageId(messages: ChatMessage[]): number | null {
  return messages.length > 0 ? messages[messages.length - 1].id : null;
}
