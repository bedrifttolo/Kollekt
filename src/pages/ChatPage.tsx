import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image as ImageIcon, BarChart3, X, Smile, Reply, HeartHandshake, ChevronDown, WashingMachine, Film, Lock, Plus, ThumbsUp, ThumbsDown, Heart, Laugh, PartyPopper, Flame, Frown, MessageCircle, type LucideIcon } from 'lucide-react';

type LaundryType = 'WHITES' | 'COLORS' | 'DELICATES' | 'WOOL' | 'SPORTS' | 'TOWELS';
const LAUNDRY_TYPES: LaundryType[] = ['WHITES', 'COLORS', 'DELICATES', 'WOOL', 'SPORTS', 'TOWELS'];
const LAUNDRY_TEMPS = [30, 40, 60, 90];
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { qk } from '../lib/queryKeys';
import { queryClient as sharedQueryClient } from '../lib/queryClient';
import { capturePhotoFile, nativeCameraAvailable } from '../lib/camera';
import { useUser } from '../context/UserContext';
import { formatDateTime, formatTime } from '../i18n/helpers';
import { connectCollectiveRealtime } from '../lib/realtime';
import { tapFeedback } from '../lib/haptics';
import { useGamesSubscription } from '../lib/purchases';
import SubscriptionPaywall from '../components/SubscriptionPaywall';
import type { AppUser, ChatMessage, CheckinSummary, HouseCheckin, Kudo, KudoType, Task } from '../lib/types';

const KUDO_TYPES: KudoType[] = ['THANK_YOU', 'CLEANEST', 'MOST_HELPFUL', 'PEACEMAKER'];
import { AddSheet, AvatarStack } from '../components/ui-kit';
import { colorForMember } from '../lib/memberColors';

// The backend validates reactions against a fixed emoji allowlist and stores them as emoji
// strings, so the emoji stays the wire format — icons are presentation only.
const REACTIONS: Array<{ emoji: string; icon: LucideIcon; labelKey: string }> = [
  { emoji: '👍', icon: ThumbsUp, labelKey: 'chat.reactions.like' },
  { emoji: '❤️', icon: Heart, labelKey: 'chat.reactions.love' },
  { emoji: '😂', icon: Laugh, labelKey: 'chat.reactions.laugh' },
  { emoji: '🎉', icon: PartyPopper, labelKey: 'chat.reactions.celebrate' },
  { emoji: '🔥', icon: Flame, labelKey: 'chat.reactions.fire' },
  { emoji: '😢', icon: Frown, labelKey: 'chat.reactions.sad' },
  { emoji: '👎', icon: ThumbsDown, labelKey: 'chat.reactions.dislike' },
];

const REACTION_ICON_BY_EMOJI = new Map(REACTIONS.map((r) => [r.emoji, r.icon]));

// Sticker glyphs are the lucide icon paths inlined as strings: the sticker is serialised to a
// standalone SVG data URL and uploaded as an image, so it can't hold a React component, and
// pulling in react-dom/server to render one added ~70kB to this chunk. Paths are lucide's
// 24x24 originals — refresh them from the matching icon if lucide is upgraded.
const STARTER_GIFS = [
  { id: 'cheers', bg: '#2F6F5E', fg: '#FFF8D7', paths: `<path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z"/><path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0"/>` },
  { id: 'laugh', bg: '#F7C948', fg: '#18332C', paths: `<circle cx="12" cy="12" r="10"/><path d="M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12Z"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>` },
  { id: 'party', bg: '#E65A7A', fg: '#FFF8D7', paths: `<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>` },
  { id: 'fire', bg: '#F97316', fg: '#FFF8D7', paths: `<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>` },
  { id: 'yes', bg: '#4F9D69', fg: '#FFF8D7', paths: `<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>` },
  { id: 'eyes', bg: '#5B7CFA', fg: '#FFF8D7', paths: `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>` },
  { id: 'mindBlown', bg: '#8B5CF6', fg: '#FFF8D7', paths: `<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>` },
  { id: 'love', bg: '#BE3455', fg: '#FFF8D7', paths: `<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>` },
  { id: 'nope', bg: '#56616B', fg: '#FFF8D7', paths: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>` },
  { id: 'clean', bg: '#00A6A6', fg: '#FFF8D7', paths: `<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>` },
];

const GIF_ICON_SIZE = 96;
const LUCIDE_VIEWBOX = 24;

function starterGifDataUrl({ paths, bg, fg }: (typeof STARTER_GIFS)[number]) {
  const scale = GIF_ICON_SIZE / LUCIDE_VIEWBOX;
  const half = GIF_ICON_SIZE / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220">
    <rect width="320" height="220" rx="32" fill="${bg}"/>
    <circle cx="160" cy="110" r="72" fill="${fg}" opacity=".18">
      <animate attributeName="r" values="56;78;56" dur="1.15s" repeatCount="indefinite"/>
    </circle>
    <g transform="translate(160 110)">
      <animateTransform attributeName="transform" type="scale" values="1;1.16;1" dur="1.15s" additive="sum" repeatCount="indefinite"/>
      <g transform="translate(${-half} ${-half}) scale(${scale})" fill="none" stroke="${fg}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        ${paths}
      </g>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function ChatPage() {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const navigate = useNavigate();
  // Seed the household thread from the warm cache so re-opening Chat shows messages
  // instantly instead of the loading state; a background fetch then refreshes them.
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => sharedQueryClient.getQueryData<ChatMessage[]>(qk.chat(currentUser?.name ?? '')) ?? [],
  );
  const [members, setMembers] = useState<AppUser[]>([]);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [showActionBar, setShowActionBar] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [showLaundryForm, setShowLaundryForm] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { isSubscriber } = useGamesSubscription();
  const [laundryType, setLaundryType] = useState<LaundryType>('COLORS');
  const [laundryTemp, setLaundryTemp] = useState(40);
  const [showKudosForm, setShowKudosForm] = useState(false);
  const [kudosReceiver, setKudosReceiver] = useState('');
  const [kudosType, setKudosType] = useState<KudoType>('THANK_YOU');
  const [kudosContext, setKudosContext] = useState('');
  const [kudosTaskId, setKudosTaskId] = useState('');
  const [householdTasks, setHouseholdTasks] = useState<Task[]>([]);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [expandedReactionId, setExpandedReactionId] = useState<number | null>(null);
  const [actionMenuMessageId, setActionMenuMessageId] = useState<number | null>(null);
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(
    () => !sharedQueryClient.getQueryData(qk.chat(currentUser?.name ?? '')),
  );
  const [checkinSummary, setCheckinSummary] = useState<CheckinSummary | null>(null);
  const [checkinExpanded, setCheckinExpanded] = useState(false);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  // null = the household thread; otherwise the member name of the 1:1 private thread.
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const activeThreadRef = useRef<string | null>(null);
  const isDirect = activeThread != null;

  // Show whole averages as "5", fractional ones as "4.3".
  const formatMood = (value?: number | null) =>
    value == null ? '' : Number.isInteger(value) ? String(value) : value.toFixed(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const inputBlurTimeoutRef = useRef<number | null>(null);
  const longPressRef = useRef<{ timer: number | null; messageId: number | null; startX: number; startY: number }>({
    timer: null,
    messageId: null,
    startX: 0,
    startY: 0,
  });
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const name = currentUser?.name ?? '';
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const memberNames = members.map((member) => member.name);
  const memberColorMap = new Map(members.map((member) => [member.name, member.color]));
  const participants = Array.from(new Set(messages.map((message) => message.sender)));
  const headerMembers =
    members.length > 0
      ? members
      : (participants.length > 0 ? participants : [name]).map((memberName) => ({ name: memberName }));
  const mentionCandidates = mention
    ? memberNames.filter((m) => m !== name && m.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6)
    : [];
  const actionMenuMessage = actionMenuMessageId != null ? messageById.get(actionMenuMessageId) : undefined;
  const reactionPickerMessage = expandedReactionId != null ? messageById.get(expandedReactionId) : undefined;
  const formatMessageTimestamp = (value: string) => {
    const messageDate = new Date(value);
    const now = new Date();
    const isToday =
      messageDate.getFullYear() === now.getFullYear() &&
      messageDate.getMonth() === now.getMonth() &&
      messageDate.getDate() === now.getDate();
    return isToday ? formatTime(value) : formatDateTime(value);
  };

  const fetchMessages = async (thread: string | null = activeThreadRef.current) => {
    if (!name) return;
    const url = thread
      ? `/chat/direct?memberName=${encodeURIComponent(name)}&otherName=${encodeURIComponent(thread)}`
      : `/chat/messages?memberName=${encodeURIComponent(name)}`;
    const res = await api.get<ChatMessage[]>(url);
    setMessages(res);
    setLoading(false);
    // Cache the household thread so the next visit to Chat renders instantly from cache.
    if (!thread) sharedQueryClient.setQueryData(qk.chat(name), res);
  };

  const selectThread = (thread: string | null) => {
    if (thread === activeThreadRef.current) return;
    activeThreadRef.current = thread;
    setActiveThread(thread);
    setMessages([]);
    setLoading(true);
    setReplyingToId(null);
    setActionMenuMessageId(null);
    setExpandedReactionId(null);
    setInput('');
    setMention(null);
    void fetchMessages(thread);
  };

  const fetchCheckinSummary = async () => {
    if (!currentUser) return;
    const collective = await api.get<{ collectiveId: number }>(`/onboarding/collectives/code/${currentUser.id}`);
    const checkin = await api.post<HouseCheckin>(`/collectives/${collective.collectiveId}/checkins/generate`, {});
    setCheckinSummary(await api.get<CheckinSummary>(`/checkins/${checkin.id}/summary`));
  };

  useEffect(() => {
    fetchMessages();
    void fetchCheckinSummary();
    if (name) {
      api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(name)}`)
        .then(setMembers)
        .catch(() => {});
      api.get<Task[]>(`/tasks?memberName=${encodeURIComponent(name)}`).then(setHouseholdTasks).catch(() => {});
    }
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(
      name,
      (event) => {
        if (['MESSAGE_CREATED', 'MESSAGE_REACTION_UPDATED', 'MESSAGE_POLL_UPDATED'].includes(event.type)) {
          // Household events only matter while the household thread is open.
          if (activeThreadRef.current == null) void fetchMessages(null);
        }
        if (event.type === 'DIRECT_MESSAGE_CREATED') {
          const dm = event.payload as { sender?: string; recipient?: string } | undefined;
          const other = dm?.sender === name ? dm?.recipient : dm?.sender;
          if (other && other === activeThreadRef.current) void fetchMessages(other);
        }
        if (event.type === 'CHECKIN_UPDATED') void fetchCheckinSummary();
        if (event.type === 'MEMBER_ONLINE' || event.type === 'MEMBER_OFFLINE') {
          const count = (event.payload as { count?: number })?.count;
          if (count !== undefined) setOnlineCount(count);
        }
      },
      {
        onReconnected: () => {
          void fetchMessages(activeThreadRef.current);
          void fetchCheckinSummary();
        },
      },
    );
    return disconnect;
  }, [name]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      clearLongPress();
      if (inputBlurTimeoutRef.current != null) window.clearTimeout(inputBlurTimeoutRef.current);
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input;
    const replyToMessageId = replyingToId;
    const thread = activeThreadRef.current;
    setInput('');
    setMention(null);
    setReplyingToId(null);

    // Show the message instantly with a temporary id, then swap in the persisted version
    // when the server responds. Avoids waiting on the POST (and a second full refetch)
    // before anything appears — the send now feels immediate.
    const tempId = -Date.now();
    const optimistic: ChatMessage = {
      id: tempId,
      sender: name,
      recipient: thread ?? null,
      text,
      replyToMessageId: replyToMessageId ?? null,
      timestamp: new Date().toISOString(),
      reactions: [],
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const saved = thread
        ? await api.post<ChatMessage>('/chat/direct', { recipient: thread, text })
        : await api.post<ChatMessage>('/chat/messages', { sender: name, text, replyToMessageId });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
    } catch {
      // Roll back the placeholder and restore the draft so the user can retry.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    }
  };

  // Detect an in-progress "@name" token immediately before the caret.
  const detectMention = (value: string, caret: number): { query: string; start: number } | null => {
    for (let i = caret - 1; i >= 0; i--) {
      const char = value[i];
      if (/\s/.test(char)) return null;
      if (char === '@') {
        const prev = i === 0 ? ' ' : value[i - 1];
        return /\s/.test(prev) ? { query: value.slice(i + 1, caret), start: i } : null;
      }
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    setMention(detectMention(value, e.target.selectionStart ?? value.length));
  };

  const insertMention = (member: string) => {
    if (!mention) return;
    const before = input.slice(0, mention.start);
    const after = input.slice(mention.start + 1 + mention.query.length);
    setInput(`${before}@${member} ${after}`);
    setMention(null);
    const caret = before.length + member.length + 2;
    requestAnimationFrame(() => {
      const el = messageInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  const handleSwipeStart = (e: React.TouchEvent) => {
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;
    const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
    const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const allThreads: Array<string | null> = [null, ...members.filter((m) => m.name !== name).map((m) => m.name)];
    const currentIndex = allThreads.findIndex((t) => t === activeThread);
    const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= 0 && nextIndex < allThreads.length) selectThread(allThreads[nextIndex]);
  };

  const clearLongPress = () => {
    if (longPressRef.current.timer != null) window.clearTimeout(longPressRef.current.timer);
    longPressRef.current.timer = null;
    longPressRef.current.messageId = null;
  };

  const startMessagePress = (messageId: number, event: React.PointerEvent<HTMLElement>) => {
    // Private 1:1 threads are text-only (no reactions/replies/polls), so skip the action menu.
    if (isDirect) return;
    if ((event.target as HTMLElement).closest('button, img')) return;
    clearLongPress();
    longPressRef.current = {
      timer: window.setTimeout(() => {
        longPressRef.current.timer = null;
        setActionMenuMessageId(messageId);
        void tapFeedback();
      }, 450),
      messageId,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const moveMessagePress = (event: React.PointerEvent<HTMLElement>) => {
    const press = longPressRef.current;
    if (press.timer == null) return;
    const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (moved > 10) clearLongPress();
  };

  const replyToMessage = (messageId: number) => {
    setReplyingToId(messageId);
    setActionMenuMessageId(null);
    setExpandedReactionId(null);
  };

  const openReactionPicker = (messageId: number) => {
    setExpandedReactionId(messageId);
    setActionMenuMessageId(null);
  };

  const chooseReaction = (messageId: number, emoji: string) => {
    toggleReaction(messageId, emoji);
    setExpandedReactionId(null);
  };

  const sendStarterGif = async (gif: (typeof STARTER_GIFS)[number]) => {
    const response = await fetch(starterGifDataUrl(gif));
    const blob = await response.blob();
    const file = new File([blob], `${gif.id}.svg`, { type: 'image/svg+xml' });
    setShowGifPicker(false);
    await sendImage(file);
  };

  const sendLaundry = async () => {
    const question = t('laundry.message', { temp: laundryTemp, type: t(`laundry.types.${laundryType}`).toLowerCase() });
    setShowLaundryForm(false);
    await api.post('/chat/polls', {
      question,
      options: [t('laundry.join'), t('laundry.notThisTime')],
    });
    fetchMessages();
  };

  const sendPoll = async () => {
    const opts = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || opts.length < 2) return;
    const question = pollQuestion;
    const draftOptions = pollOptions;
    // Close the form at once; the poll appears when the refetch lands. Restore on failure.
    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPollForm(false);
    try {
      await api.post('/chat/polls', { question, options: opts });
      fetchMessages();
    } catch {
      setPollQuestion(question);
      setPollOptions(draftOptions);
      setShowPollForm(true);
    }
  };

  const sendKudos = async () => {
    if (!kudosReceiver) return;
    const body = {
      receiver: kudosReceiver,
      type: kudosType,
      context: kudosContext.trim() || t(`kudos.types.${kudosType}`),
      taskId: kudosTaskId ? Number(kudosTaskId) : null,
    };
    const draft = { kudosReceiver, kudosType, kudosContext, kudosTaskId };
    // Close the form immediately; kudos is delivered to the receiver server-side. Restore on failure.
    setKudosReceiver('');
    setKudosType('THANK_YOU');
    setKudosContext('');
    setKudosTaskId('');
    setShowKudosForm(false);
    try {
      await api.post<Kudo>('/kudos', body);
    } catch {
      setKudosReceiver(draft.kudosReceiver);
      setKudosType(draft.kudosType);
      setKudosContext(draft.kudosContext);
      setKudosTaskId(draft.kudosTaskId);
      setShowKudosForm(true);
    }
  };

  const votePoll = async (messageId: number, optionId: number) => {
    await api.post(`/chat/messages/${messageId}/poll/vote`, { optionId });
    fetchMessages();
  };

  const toggleReaction = async (messageId: number, emoji: string) => {
    const msg = messages.find((m) => m.id === messageId);
    const existing = msg?.reactions.find((r) => r.emoji === emoji);
    const alreadyReacted = existing?.users.includes(name);

    if (alreadyReacted) {
      await api.delete(`/chat/messages/${messageId}/reactions`, { emoji });
    } else {
      await api.post(`/chat/messages/${messageId}/reactions`, { emoji });
    }
    setExpandedReactionId(null);
    fetchMessages();
  };

  const handlePickImage = async () => {
    if (nativeCameraAvailable()) {
      const file = await capturePhotoFile();
      if (file) await sendImage(file);
    } else {
      fileInputRef.current?.click();
    }
  };

  const sendImage = async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    if (input.trim()) {
      form.append('caption', input.trim());
      setInput('');
    }
    await api.postForm('/chat/images', form);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fetchMessages();
  };

  if (loading) {
    return (
      <div className="app-screen-full flex flex-col animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className={`glass rounded-2xl h-12 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2 ml-auto'}`} />)}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="app-screen-full relative flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border py-2.5">
        {isDirect ? (
          <span style={{ backgroundColor: colorForMember(activeThread!, memberColorMap.get(activeThread!)) }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white">
            {activeThread![0]?.toUpperCase()}
          </span>
        ) : (
          <AvatarStack members={headerMembers} max={3} />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-extrabold">{isDirect ? activeThread : t('chat.threadTitle')}</h2>
          <p className="text-xs text-muted-foreground">
            {isDirect ? (
              <span className="font-semibold text-primary">{t('chat.directSubtitle')}</span>
            ) : (
              <>
                <span className="font-semibold text-primary">● {onlineCount === null ? t('common.connecting') : t('chat.onlineCount', { count: onlineCount })}</span>
                {members.length > 0 && <> · {t('chat.memberCount', { count: members.length })}</>}
              </>
            )}
          </p>
        </div>
        {/* Chat hides the shared app header, so profile access lives here instead. */}
        <button
          data-tour="profile"
          onClick={() => navigate('/profile')}
          style={currentUser ? { backgroundColor: colorForMember(currentUser.name, currentUser.color) } : undefined}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-base font-bold text-white"
          aria-label={t('header.profile')}
        >
          {currentUser?.name[0]?.toUpperCase()}
        </button>
      </div>

      {/* Thread switcher: household + a private 1:1 thread per housemate. */}
      <div className="relative -mx-1">
        <div className="flex gap-2 overflow-x-auto py-1.5 px-1 scrollbar-none">
        <button
          onClick={() => selectThread(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${!isDirect ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
        >
          {t('chat.householdThread')}
        </button>
        {members.filter((member) => member.name !== name).map((member) => (
          <button
            key={member.name}
            onClick={() => selectThread(member.name)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${activeThread === member.name ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            <span style={{ backgroundColor: colorForMember(member.name, member.color) }} className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white">
              {member.name[0]?.toUpperCase()}
            </span>
            {member.name}
          </button>
        ))}
        </div>
        {members.length > 3 && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
        )}
      </div>

      {!isDirect && checkinSummary && checkinSummary.responseCount > 0 && (
        <div className="mt-3 rounded-[1.35rem] border border-primary/25 bg-primary/5">
          <button
            onClick={() => setCheckinExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-3 p-3 text-left"
          >
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 font-display text-sm font-bold truncate">
                <MessageCircle className="h-4 w-4 shrink-0" />
                {t('checkin.summaryTitle')}
              </h3>
              <p className="text-[10px] text-muted-foreground">{t('checkin.progress', { count: checkinSummary.responseCount, total: checkinSummary.memberCount })}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-bold text-primary">{t('checkin.averageMood', { mood: formatMood(checkinSummary.averageMood) })}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${checkinExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>
          <AnimatePresence>
            {checkinExpanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="space-y-2 px-3 pb-3">
                  {checkinSummary.responses.map((response) => (
                    <div key={response.id} className="rounded-xl bg-card p-3 text-xs">
                      <p className="font-bold">{response.author ?? t('checkin.anonymousAuthor')} · {response.mood}/5</p>
                      <p className="mt-1"><span className="text-muted-foreground">{t('checkin.issueLabel')}:</span> {response.issue}</p>
                      <p className="mt-1"><span className="text-muted-foreground">{t('checkin.improvementLabel')}:</span> {response.improvement}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Message list */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
        {messages.map((message, i) => {
          const isSelf = message.sender === name;
          const senderColor = colorForMember(message.sender, memberColorMap.get(message.sender));
          const replyTarget = message.replyToMessageId != null ? messageById.get(message.replyToMessageId) : undefined;
          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[82%] space-y-1">
                {!isSelf && <p className="px-1 text-xs font-bold" style={{ color: senderColor }}>{message.sender}</p>}
                {replyTarget && (
                  <div
                    className={`mx-1 rounded-lg px-2.5 py-1.5 text-[10px] leading-tight border ${
                      isSelf
                        ? 'border-primary/25 bg-primary/10 text-foreground'
                        : 'border-border/60 bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <div className={`mb-1 flex items-center gap-1 ${isSelf ? 'text-primary/80' : 'text-muted-foreground'}`}>
                      <Reply className="h-2.5 w-2.5" />
                      <span>{t('chat.replyingTo', { name: replyTarget.sender })}</span>
                    </div>
                    <p className={`font-semibold ${isSelf ? 'text-foreground' : 'text-primary'}`}>{replyTarget.sender}</p>
                    <p className="truncate">{replyTarget.text || t('chat.imageAlt')}</p>
                  </div>
                )}
	                <div
	                  className={`select-none px-4 py-3 ${
	                    isSelf
	                      ? 'rounded-[1.35rem] rounded-br-md bg-primary text-primary-foreground'
	                      : 'rounded-[1.35rem] rounded-bl-md border border-border bg-card'
	                  }`}
	                  style={!isSelf ? { borderLeftColor: senderColor, borderLeftWidth: 3 } : undefined}
	                  onPointerDown={(event) => startMessagePress(message.id, event)}
	                  onPointerMove={moveMessagePress}
	                  onPointerUp={clearLongPress}
	                  onPointerCancel={clearLongPress}
	                  onPointerLeave={clearLongPress}
	                >
                  {message.text && !message.poll && <p className="text-[15px] leading-relaxed">{message.text}</p>}
                  {message.imageData && (
                    <img
                      src={`data:${message.imageMimeType};base64,${message.imageData}`}
                      alt={message.imageFileName ?? t('chat.imageAlt')}
                      className="mt-1 max-h-56 cursor-zoom-in rounded-xl object-cover"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedImage({
                          src: `data:${message.imageMimeType};base64,${message.imageData}`,
                          alt: message.imageFileName ?? t('chat.imageAlt'),
                        });
                      }}
                    />
                  )}
                  {message.poll && (
                    <div className="mt-1 space-y-2.5">
                      <p className="flex items-center gap-1.5 font-display text-base font-bold">
                        <BarChart3 className="h-4 w-4 shrink-0" />
                        {message.poll.question}
                      </p>
                      {message.poll.options.map((opt) => {
                        const total = message.poll!.options.reduce((s, o) => s + o.users.length, 0);
                        const votes = opt.users.length;
                        const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                        const voted = opt.users.includes(name);
                        return (
                          <button key={opt.id} onClick={() => votePoll(message.id, opt.id)}
                            className={`relative w-full overflow-hidden rounded-xl p-2.5 text-left text-sm font-semibold ${
                              voted ? 'border border-accent/50 bg-accent/30' : isSelf ? 'bg-background/20' : 'bg-muted/70'
                            }`}>
                            <div className="absolute inset-y-0 left-0 bg-accent/25 transition-all" style={{ width: `${pct}%` }} />
                            <span className="relative flex justify-between gap-2"><span>{opt.text}</span><span>{votes}</span></span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className={`text-[9px] mt-1 ${isSelf ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {formatMessageTimestamp(message.timestamp)}
                  </p>
                </div>

	                {message.reactions.length > 0 && (
	                  <div className={`px-1 flex gap-1 flex-wrap ${isSelf ? 'justify-end' : 'justify-start'}`}>
	                    {message.reactions.map((r) => {
	                      const reacted = r.users.includes(name);
	                      // Reactions sent before the icon set existed fall back to their emoji.
	                      const ReactionIcon = REACTION_ICON_BY_EMOJI.get(r.emoji);
	                      return (
	                        <button key={r.emoji} onClick={() => chooseReaction(message.id, r.emoji)}
	                          className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-2 text-xs ${reacted ? 'border-primary/40 bg-primary/20' : 'border-border bg-card'}`}>
	                          {ReactionIcon ? <ReactionIcon className="h-3.5 w-3.5 shrink-0" /> : r.emoji}
	                          {r.users.length}
	                        </button>
	                      );
	                    })}
	                  </div>
	                )}
	              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Poll form */}
      <AnimatePresence>
        {showKudosForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <AddSheet title={t('kudos.sendTitle')} onClose={() => setShowKudosForm(false)} className="mb-2 p-3">
              <select value={kudosReceiver} onChange={(event) => setKudosReceiver(event.target.value)} className="w-full rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <option value="">{t('kudos.chooseRoommate')}</option>
                {memberNames.filter((member) => member !== name).map((member) => <option key={member} value={member}>{member}</option>)}
              </select>
              <div>
                <p className="mb-1 text-[10px] font-semibold text-muted-foreground">{t('kudos.typeLabel')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {KUDO_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setKudosType(type)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${kudosType === type ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'}`}
                    >
                      {t(`kudos.types.${type}`)}
                    </button>
                  ))}
                </div>
              </div>
              <select value={kudosTaskId} onChange={(event) => setKudosTaskId(event.target.value)} className="w-full rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <option value="">{t('kudos.generalHelp')}</option>
                {householdTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
              <input value={kudosContext} onChange={(event) => setKudosContext(event.target.value)} maxLength={500} placeholder={t('kudos.contextPlaceholder')} className="w-full rounded-lg bg-muted/50 px-3 py-2 text-xs" />
              <button onClick={() => void sendKudos()} disabled={!kudosReceiver} className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">{t('kudos.send')}</button>
              <p className="text-[9px] text-muted-foreground">{t('kudos.privateNote')}</p>
            </AddSheet>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGifPicker && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <AddSheet title={t('chat.gifPickerTitle')} onClose={() => setShowGifPicker(false)} className="mb-2 p-3">
              <div className="grid grid-cols-5 gap-2">
                {STARTER_GIFS.map((gif) => (
                  <button
                    key={gif.id}
                    onClick={() => void sendStarterGif(gif)}
                    className="grid aspect-square min-h-11 place-items-center overflow-hidden rounded-xl border border-border bg-card"
                    aria-label={t('chat.sendGif')}
                  >
                    <img src={starterGifDataUrl(gif)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </AddSheet>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLaundryForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <AddSheet title={t('laundry.title')} onClose={() => setShowLaundryForm(false)} className="mb-2 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground">{t('laundry.typeLabel')}</p>
              <div className="flex flex-wrap gap-1.5">
                {LAUNDRY_TYPES.map((type) => (
                  <button key={type} onClick={() => setLaundryType(type)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${laundryType === type ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'}`}>
                    {t(`laundry.types.${type}`)}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-semibold text-muted-foreground">{t('laundry.tempLabel')}</p>
              <div className="flex flex-wrap gap-1.5">
                {LAUNDRY_TEMPS.map((temp) => (
                  <button key={temp} onClick={() => setLaundryTemp(temp)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${laundryTemp === temp ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'}`}>
                    {temp}°C
                  </button>
                ))}
              </div>
              <button onClick={() => void sendLaundry()} className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground">{t('laundry.send')}</button>
            </AddSheet>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPollForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <AddSheet title={t('chat.createPoll')} onClose={() => setShowPollForm(false)} className="mb-2 p-3">
              <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)}
                placeholder={t('chat.pollQuestionPlaceholder')}
                className="w-full bg-muted/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              {pollOptions.map((opt, i) => (
                <input key={i} value={opt}
                  onChange={(e) => setPollOptions((prev) => prev.map((o, j) => j === i ? e.target.value : o))}
                  placeholder={t('chat.pollOption', { index: i + 1 })}
                  className="w-full bg-muted/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              ))}
              <div className="flex gap-2">
                <button onClick={() => setPollOptions((p) => [...p, ''])} className="text-[10px] text-primary font-medium">
                  {t('chat.addOption')}
                </button>
                <button onClick={sendPoll} className="ml-auto px-3 py-1 rounded-lg gradient-primary text-[10px] font-semibold text-primary-foreground">
                  {t('chat.sendPoll')}
                </button>
              </div>
            </AddSheet>
          </motion.div>
        )}
      </AnimatePresence>

      {replyingToId != null && messageById.get(replyingToId) && (
        <div className="glass rounded-lg px-3 py-2 mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-primary">{t('chat.replyingTo', { name: messageById.get(replyingToId)?.sender })}</p>
            <p className="text-xs truncate text-muted-foreground">{messageById.get(replyingToId)?.text || t('chat.imageAlt')}</p>
          </div>
          <button onClick={() => setReplyingToId(null)} className="text-[10px] text-muted-foreground hover:text-foreground shrink-0">
            {t('chat.cancelReply')}
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="relative">
        {mention && mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 z-30 max-h-52 overflow-y-auto rounded-2xl border border-border bg-popover p-1 shadow-xl">
            {mentionCandidates.map((member) => (
              <button
                key={member}
                onMouseDown={(e) => { e.preventDefault(); insertMention(member); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted/60"
              >
                <span style={{ backgroundColor: colorForMember(member, memberColorMap.get(member)) }} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white">
                  {member[0].toUpperCase()}
                </span>
                <span className="font-medium">{member}</span>
              </button>
            ))}
          </div>
        )}
        {/* Action bar — revealed by the + button */}
        {!isDirect && showActionBar && (
          <div className="mb-2 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => { void handlePickImage(); setShowActionBar(false); }} className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60" aria-label={t('chat.sendImage')}>
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-[9px] font-medium text-muted-foreground">{t('chat.sendImage')}</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowActionBar(false);
                if (!isSubscriber) { setShowPaywall(true); return; }
                setShowGifPicker((v) => !v);
              }}
              className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60"
              aria-label={t('chat.sendGif')}
            >
              {isSubscriber ? <Film className="h-5 w-5 text-muted-foreground" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
              <span className="text-[9px] font-medium text-muted-foreground">GIF</span>
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowPollForm((v) => !v); setShowActionBar(false); }} className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60" aria-label={t('chat.togglePollForm')}>
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <span className="text-[9px] font-medium text-muted-foreground">{t('chat.createPoll')}</span>
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowLaundryForm((v) => !v); setShowActionBar(false); }} className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60" aria-label={t('laundry.title')}>
              <WashingMachine className="h-5 w-5 text-accent" />
              <span className="text-[9px] font-medium text-muted-foreground">{t('laundry.title')}</span>
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowKudosForm((v) => !v); setShowActionBar(false); }} className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60" aria-label={t('kudos.sendTitle')}>
              <HeartHandshake className="h-5 w-5 text-primary" />
              <span className="text-[9px] font-medium text-muted-foreground">{t('kudos.sendTitle')}</span>
            </button>
          </div>
        )}
        <div className="flex gap-2 rounded-[1.35rem] border border-border bg-card p-2 shadow-sm">
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImage(f); }} />
          {!isDirect && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowActionBar((v) => !v)}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors ${showActionBar ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              aria-label="Actions"
            >
              <Plus className={`h-5 w-5 transition-transform ${showActionBar ? 'rotate-45' : ''}`} />
            </button>
          )}
          <input
            ref={messageInputRef}
            value={input}
            onChange={handleInputChange}
            onFocus={() => {
              if (inputBlurTimeoutRef.current != null) window.clearTimeout(inputBlurTimeoutRef.current);
              setInputFocused(true);
              setShowActionBar(false);
            }}
            onBlur={() => {
              inputBlurTimeoutRef.current = window.setTimeout(() => setInputFocused(false), 140);
            }}
            onKeyDown={(e) => {
              if (mention && mentionCandidates.length > 0) {
                if (e.key === 'Enter') { e.preventDefault(); insertMention(mentionCandidates[0]); return; }
                if (e.key === 'Escape') { setMention(null); return; }
              }
              if (e.key === 'Enter' && !e.shiftKey) sendMessage();
            }}
            placeholder={t('chat.messagePlaceholder')}
            className="min-w-36 flex-1 rounded-full bg-muted px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={sendMessage} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary" aria-label={t('common.send')}>
            <Send className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {actionMenuMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-end bg-black/25 p-4"
            onClick={() => setActionMenuMessageId(null)}
          >
            <motion.div
              initial={{ y: 24, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 24, scale: 0.98 }}
              className="w-full rounded-2xl border border-border bg-card p-2 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => replyToMessage(actionMenuMessage.id)}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-muted/60"
              >
                <Reply className="h-4 w-4 text-muted-foreground" />
                {t('chat.replyToMessage')}
              </button>
              <button
                onClick={() => openReactionPicker(actionMenuMessage.id)}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-muted/60"
              >
                <Smile className="h-4 w-4 text-muted-foreground" />
                {t('chat.reactToMessage')}
              </button>
              <button
                onClick={() => setActionMenuMessageId(null)}
                className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted/60"
              >
                {t('common.cancel')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reactionPickerMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
            onClick={() => setExpandedReactionId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              className="w-full max-w-xs rounded-2xl border border-border bg-card p-3 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="grid grid-cols-4 gap-1">
                {REACTIONS.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    onClick={() => chooseReaction(reactionPickerMessage.id, reaction.emoji)}
                    aria-label={t(reaction.labelKey)}
                    className="grid h-12 w-12 place-items-center rounded-xl transition-transform hover:scale-110 hover:bg-muted"
                  >
                    <reaction.icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-0"
            onClick={() => setExpandedImage(null)}
          >
            <button
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              onClick={() => setExpandedImage(null)}
              aria-label={t('chat.closeImage')}
            >
              <X className="h-5 w-5 text-white" />
            </button>
            <img
              src={expandedImage.src}
              alt={expandedImage.alt}
              className="h-full w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showPaywall && <SubscriptionPaywall onClose={() => setShowPaywall(false)} />}
    </motion.div>
  );
}
