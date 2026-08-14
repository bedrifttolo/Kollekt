import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';
import { api } from '../../lib/api';
import { qk } from '../../lib/queryKeys';
import { useUser, useRealtimeEvent } from '../../context/UserContext';
import { getLastSeenMessageId } from '../../lib/chatSeen';
import { patchThreadsOnDirectMessage, patchThreadsOnHouseholdMessage, patchThreadsOnMessageUpdate } from '../../lib/chatThreadSummary';
import { formatDate, formatTime } from '../../i18n/helpers';
import { Avatar, Eyebrow } from '../../components/ui-kit';
import { PAGE_ACCENTS } from '../../lib/pageAccent';
import type { AppUser, ChatMessage, ChatThreadSummary } from '../../lib/types';

/**
 * The household thread's avatar, drawn as two offset circles *inside* one 48px slot rather than as a
 * row of them beside each other. A side-by-side stack is wider than a single avatar, which pushed
 * the group row's name and preview further right than every DM row below it; the platform pattern
 * keeps every row's text on the same left edge no matter how many people are in the conversation.
 */
function GroupAvatar({ members }: { members: AppUser[] }) {
  const [first, second] = members;
  if (!second) return <Avatar name={first.name} color={first.color} size="lg" />;
  return (
    <span className="relative h-12 w-12 shrink-0">
      <Avatar name={first.name} color={first.color} className="absolute left-0 top-0 h-8 w-8 border-2 border-card text-xs" />
      <Avatar name={second.name} color={second.color} className="absolute bottom-0 right-0 h-9 w-9 border-2 border-card text-sm" />
    </span>
  );
}

/** "13:50" for something said today, "10 Aug" further back — same rule as the in-thread bubble
 *  timestamps (ChatThreadPage's formatMessageTimestamp), just date-only once it's not today. */
function formatRowTimestamp(value: string): string {
  const messageDate = new Date(value);
  const now = new Date();
  const isToday =
    messageDate.getFullYear() === now.getFullYear() &&
    messageDate.getMonth() === now.getMonth() &&
    messageDate.getDate() === now.getDate();
  return isToday ? formatTime(value) : formatDate(value, { day: 'numeric', month: 'short' });
}

export default function ChatInboxPage() {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const name = currentUser?.name ?? '';

  const { data: members = [] } = useQuery({
    queryKey: qk.members(name),
    enabled: !!name,
    queryFn: () => api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(name)}`),
  });

  const { data: threads = [], isLoading } = useQuery({
    queryKey: qk.chatThreads(name),
    enabled: !!name,
    queryFn: () => api.get<ChatThreadSummary[]>(`/chat/threads?memberName=${encodeURIComponent(name)}`),
  });

  // Live-updates previews/unread state for any thread, not just one that happens to be open —
  // ChatThreadPage's own realtime listener only ever patches the single thread it has open.
  useRealtimeEvent(
    (event) => {
      if (!name) return;
      if (event.type === 'MESSAGE_CREATED') {
        queryClient.setQueryData<ChatThreadSummary[]>(qk.chatThreads(name), (prev) =>
          patchThreadsOnHouseholdMessage(prev, event.payload as ChatMessage),
        );
      }
      if (event.type === 'DIRECT_MESSAGE_CREATED') {
        const dm = event.payload as ChatMessage;
        const other = dm.sender === name ? dm.recipient : dm.sender;
        if (other) {
          queryClient.setQueryData<ChatThreadSummary[]>(qk.chatThreads(name), (prev) =>
            patchThreadsOnDirectMessage(prev, other, dm),
          );
        }
      }
      if (event.type === 'MESSAGE_UPDATED' || event.type === 'MESSAGE_DELETED') {
        queryClient.setQueryData<ChatThreadSummary[]>(qk.chatThreads(name), (prev) =>
          patchThreadsOnMessageUpdate(prev, event.payload as ChatMessage),
        );
      }
    },
    () => queryClient.invalidateQueries({ queryKey: qk.chatThreads(name) }),
  );

  const openThread = (thread: ChatThreadSummary) => {
    navigate(thread.thread === null ? '/chat/household' : `/chat/dm/${encodeURIComponent(thread.thread)}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-2 pt-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[72px] skeleton animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1 pt-3">
      <Eyebrow accent={PAGE_ACCENTS['/chat']}>{t('chat.inbox.eyebrow')}</Eyebrow>
      <h1 className="mb-2 display-md">{t('chat.inbox.title')}</h1>
      <div>
        {threads.map((thread) => {
          const unread = thread.lastMessageId != null && (getLastSeenMessageId(name, thread.thread) ?? -1) < thread.lastMessageId;
          return (
            /* Sized to the platform conversation list, not to a dense settings row: a 48px avatar
               with 12px of padding above and below sets a ~72px row, and the type scale (17px name /
               15px preview) is the one every other messages app on the phone uses. The separator
               hangs off the text column rather than the button, so it stays inset under the avatar
               the way a native list does. */
            <button
              key={thread.thread ?? '__household__'}
              onClick={() => openThread(thread)}
              className="flex w-full items-stretch gap-3 px-2 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
            >
              <span className="flex shrink-0 items-center gap-2 py-3">
                <span className="flex w-2.5 justify-center">
                  {unread && <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />}
                </span>
                {thread.thread === null ? (
                  <GroupAvatar members={members.length > 0 ? members : [{ name: thread.displayName } as AppUser]} />
                ) : thread.isSystem ? (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Bot className="h-5 w-5" />
                  </span>
                ) : (
                  <Avatar name={thread.displayName} color={members.find((m) => m.name === thread.thread)?.color} size="lg" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2 border-b border-border py-3">
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-display text-[17px] leading-tight ${unread ? 'font-extrabold' : 'font-bold'}`}>
                    {thread.displayName}
                  </span>
                  {/* No `block` here: `line-clamp-2` sets its own display and the two would race. */}
                  <span className={`mt-1 line-clamp-2 text-[15px] leading-snug ${unread ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                    {thread.lastMessageDeleted
                      ? t('chat.inbox.messageDeleted')
                      : thread.lastMessagePreview || t('chat.inbox.noMessages')}
                  </span>
                </span>
                {thread.lastMessageTimestamp && (
                  <span className="shrink-0 self-start pt-0.5 text-[13px] text-muted-foreground">{formatRowTimestamp(thread.lastMessageTimestamp)}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
