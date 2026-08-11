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
import { Avatar, AvatarStack, Eyebrow } from '../../components/ui-kit';
import { PAGE_ACCENTS } from '../../lib/pageAccent';
import type { AppUser, ChatMessage, ChatThreadSummary } from '../../lib/types';

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
      <div className="space-y-2 pt-3 pb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1 pt-3 pb-6">
      <Eyebrow accent={PAGE_ACCENTS['/chat']}>{t('chat.inbox.eyebrow')}</Eyebrow>
      <h1 className="mb-2 font-display text-2xl font-extrabold">{t('chat.inbox.title')}</h1>
      <div>
        {threads.map((thread) => {
          const unread = thread.lastMessageId != null && (getLastSeenMessageId(name, thread.thread) ?? -1) < thread.lastMessageId;
          return (
            <button
              key={thread.thread ?? '__household__'}
              onClick={() => openThread(thread)}
              className="flex w-full items-center gap-3 border-b border-border px-2 py-3.5 text-left transition-colors hover:bg-muted/40"
            >
              {thread.thread === null ? (
                <AvatarStack members={members.length > 0 ? members : [{ name: thread.displayName }]} max={1} />
              ) : thread.isSystem ? (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Bot className="h-4 w-4" />
                </span>
              ) : (
                <Avatar name={thread.displayName} color={members.find((m) => m.name === thread.thread)?.color} />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                  <span className={`truncate font-display text-sm ${unread ? 'font-extrabold' : 'font-bold'}`}>{thread.displayName}</span>
                </span>
                <span className={`block truncate text-xs ${unread ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {thread.lastMessageDeleted
                    ? t('chat.inbox.messageDeleted')
                    : thread.lastMessagePreview || t('chat.inbox.noMessages')}
                </span>
              </span>
              {thread.lastMessageTimestamp && (
                <span className="shrink-0 self-start pt-0.5 text-[10px] text-muted-foreground">{formatRowTimestamp(thread.lastMessageTimestamp)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
