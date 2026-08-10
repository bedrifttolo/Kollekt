import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheck2, Plus, Send, X } from 'lucide-react';
import { api } from '../../lib/api';
import { qk } from '../../lib/queryKeys';
import { useRealtimeEvent } from '../../context/UserContext';
import { backdropVariants, collapseVariants } from '../../lib/motion';
import type { AppUser, MeetingTopic } from '../../lib/types';

interface MeetingTopicMenuProps {
  currentUser: AppUser | null;
  /** Posts a formatted intro message into the household thread (household-only send path). */
  onPostTopic: (text: string) => void;
}

/** Household-only header control: the running weekly house-meeting agenda. Members propose
 *  topics here; "post to chat" drops a formatted intro message into the thread so people can
 *  comment on it using the ordinary reply affordance. */
export default function MeetingTopicMenu({ currentUser, onPostTopic }: MeetingTopicMenuProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const name = currentUser?.name ?? '';
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { data: collective } = useQuery({
    queryKey: ['collectiveId', name],
    enabled: !!currentUser,
    queryFn: () => api.get<{ collectiveId: number }>(`/onboarding/collectives/code/${currentUser!.id}`),
  });
  const collectiveId = collective?.collectiveId;

  const { data: topics = [] } = useQuery({
    queryKey: qk.meetingTopics(name),
    enabled: !!collectiveId,
    queryFn: () => api.get<MeetingTopic[]>(`/collectives/${collectiveId}/meeting-topics`),
  });

  useRealtimeEvent((event) => {
    if (event.type === 'MEETING_TOPIC_CREATED' || event.type === 'MEETING_TOPIC_RESOLVED') {
      queryClient.invalidateQueries({ queryKey: qk.meetingTopics(name) });
    }
  });

  const addTopic = async () => {
    const title = newTitle.trim();
    if (!title || !collectiveId) return;
    setNewTitle('');
    await api.post(`/collectives/${collectiveId}/meeting-topics`, { title });
    queryClient.invalidateQueries({ queryKey: qk.meetingTopics(name) });
  };

  const resolveTopic = async (topicId: number) => {
    if (!collectiveId) return;
    await api.post(`/collectives/${collectiveId}/meeting-topics/${topicId}/resolve`, {});
    queryClient.invalidateQueries({ queryKey: qk.meetingTopics(name) });
  };

  const postTopic = (topic: MeetingTopic) => {
    onPostTopic(t('chat.meetingTopic.introMessage', { title: topic.title }));
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground ${open ? 'bg-ink text-ink-foreground' : 'bg-muted/60'}`}
        aria-label={t('chat.meetingTopic.menuLabel')}
      >
        <CalendarCheck2 className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="fixed inset-0 z-30 bg-black/30"
              onClick={() => setOpen(false)}
            />
            <motion.div
              variants={collapseVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="elev-2 absolute right-0 top-11 z-40 w-72 max-w-[80vw] rounded-2xl border border-border bg-card p-3"
            >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-sm font-bold">{t('chat.meetingTopic.title')}</p>
              <button onClick={() => setOpen(false)} aria-label={t('common.close')} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {topics.length === 0 && <p className="mb-2 text-xs text-muted-foreground">{t('chat.meetingTopic.empty')}</p>}
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {topics.map((topic) => (
                <div key={topic.id} className="flex items-center gap-1.5 rounded-xl bg-muted/40 px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{topic.title}</span>
                  <button
                    onClick={() => postTopic(topic)}
                    aria-label={t('chat.meetingTopic.postToChat')}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-ink-foreground"
                  >
                    <Send className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => void resolveTopic(topic.id)}
                    aria-label={t('chat.meetingTopic.resolve')}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addTopic();
                  }
                }}
                placeholder={t('chat.meetingTopic.addPlaceholder')}
                className="min-w-0 flex-1 rounded-lg bg-muted/50 px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={() => void addTopic()}
                disabled={!newTitle.trim()}
                aria-label={t('chat.meetingTopic.add')}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-ink-foreground disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
