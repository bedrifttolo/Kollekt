import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowUp, Image as ImageIcon, BarChart3, Check, Copy, X, Reply, HeartHandshake, ChevronDown, WashingMachine, Film, Lock, Plus, Smile, MessageCircleHeart, Wallpaper, Pin, PinOff } from 'lucide-react';

type LaundryType = 'WHITES' | 'COLORS' | 'DELICATES' | 'WOOL' | 'SPORTS' | 'TOWELS';
const LAUNDRY_TYPES: LaundryType[] = ['WHITES', 'COLORS', 'DELICATES', 'WOOL', 'SPORTS', 'TOWELS'];

/** How tall the composer may grow before it starts scrolling instead. */
const MAX_COMPOSER_ROWS = 4;
const LAUNDRY_TEMPS = [30, 40, 60, 90];
import { useTranslation } from 'react-i18next';
import { api, getUserMessage } from '../../lib/api';
import { prepareImageForUpload } from '../../lib/imageUpload';
import { qk } from '../../lib/queryKeys';
import { queryClient as sharedQueryClient } from '../../lib/queryClient';
import { capturePhotoFile, nativeCameraAvailable } from '../../lib/camera';
import { clearChatBackground, getChatBackground, pickChatBackgroundFile, saveChatBackground } from '../../lib/chatBackground';
import { getLastSeenMessageId, setLastSeenMessageId } from '../../lib/chatSeen';
import { decorateMessages, newestMessageId } from '../../lib/chatThread';
import { CHAT_SYSTEM_SENDER } from '../../lib/chatThreadSummary';
import { useUser, useRealtimeEvent } from '../../context/UserContext';
import { formatDate, formatDateTime, formatTime } from '../../i18n/helpers';
import { tapFeedback } from '../../lib/haptics';
import { usePremiumEntitlement } from '../../lib/purchases';
import SubscriptionPaywall from '../../components/SubscriptionPaywall';
import type { AppUser, ChatMessage, CheckinSummary, HouseCheckin, Kudo, KudoType, Task } from '../../lib/types';
import MeetingTopicMenu from './MeetingTopicMenu';
import MessageBubble from './MessageBubble';
/** Local-only send state layered onto a message while it's in flight; never sent to the server.
 *  Declared alongside MessageBubble, which renders it. */
import type { LocalChatMessage } from './MessageBubble';

const KUDO_TYPES: KudoType[] = ['THANK_YOU', 'CLEANEST', 'MOST_HELPFUL', 'PEACEMAKER'];
import { AddSheet, AvatarStack, CloseButton } from '../../components/ui-kit';
import { backdropVariants, collapseVariants, dialogVariants, popIn, pressable, springPop, useReducedMotion } from '../../lib/motion';
import { colorForMember } from '../../lib/memberColors';
import { PAGE_ACCENTS } from '../../lib/pageAccent';
import { isIOS } from '../../lib/platform';
import EmojiPickerSheet from './EmojiPickerSheet';

// The backend validates reactions against a fixed emoji allowlist (ChatOperations.kt) and stores
// them as emoji strings, so the emoji itself is the wire format — no icon mapping needed. Real
// glyphs render in each platform's own color-emoji font automatically, which is what makes these
// look native on iOS vs Android without any per-platform asset work.
// Apple's own Tapback set — leads the strip on iOS builds.
const IOS_LEAD_REACTIONS = ['❤️', '👍', '👎', '😂', '‼️', '❓'];
// Google Messages' own default quick reactions — leads the strip on Android builds.
const ANDROID_LEAD_REACTIONS = ['❤️', '👍', '👎', '😆', '😮', '😢'];
// A few extras shown after the platform lead set, before the "more" button opens the full picker.
const EXTRA_REACTIONS = ['🎉', '🔥', '🙏', '💯'];

const REACTION_LABEL_KEYS: Record<string, string> = {
  '❤️': 'chat.reactions.love',
  '👍': 'chat.reactions.like',
  '👎': 'chat.reactions.dislike',
  '😂': 'chat.reactions.laugh',
  '‼️': 'chat.reactions.exclaim',
  '❓': 'chat.reactions.question',
  '😆': 'chat.reactions.laugh',
  '😮': 'chat.reactions.wow',
  '😢': 'chat.reactions.sad',
  '🎉': 'chat.reactions.celebrate',
  '🔥': 'chat.reactions.fire',
  '🙏': 'chat.reactions.pray',
  '💯': 'chat.reactions.hundred',
};

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

/** The backend's image-moderation check only classifies raster photo formats, so a sticker sent
 *  as a chat "image" must be rasterized first — sending it as `image/svg+xml` would either be
 *  rejected outright or (worse) carve out an SVG exemption that could smuggle an embedded raster
 *  image past moderation. */
async function starterGifPngFile(gif: (typeof STARTER_GIFS)[number]): Promise<File> {
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to render sticker'));
  });
  img.src = starterGifDataUrl(gif);
  await loaded;

  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to render sticker');
  return new File([blob], `${gif.id}.png`, { type: 'image/png' });
}

interface PopoverAnchor {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Where to put the message action popover so it always fits on screen: hugs the bubble's own
 *  side (own messages hug the right edge, others the left, matching iOS), prefers sitting above
 *  the bubble, and falls back below it when there isn't enough headroom under the header.
 *  `estimatedHeight` is exact, not a guess — every row in the popover is a fixed 44px (`min-h-11`). */
function computePopoverPlacement(anchor: PopoverAnchor, actionRowCount: number) {
  const margin = 16;
  // The column spans the same content width as the message list (which is the viewport minus its
  // px-4 gutters), so the lifted preview lands at the width the real bubble already had.
  const width = window.innerWidth - margin * 2;

  const reactionStripHeight = 52;
  const gap = 8;
  const rowHeight = 44;
  const cardPadding = 8;
  const actionsHeight = actionRowCount * rowHeight + cardPadding;
  // The preview is a clone of the pressed bubble, so its height is the anchor's height. Capped
  // because a very tall image message would otherwise push the action list off screen.
  const previewHeight = Math.min(anchor.bottom - anchor.top, window.innerHeight * 0.45);
  const totalHeight = reactionStripHeight + gap + previewHeight + gap + actionsHeight;

  // Rough clearance for the header above and the composer/safe-area below — exact heights vary
  // (composer grows with text, header collapses its check-in card), so these are deliberately
  // generous rather than pixel-exact.
  const headerClearance = 84;
  const composerClearance = 96;
  const maxTop = Math.max(headerClearance, window.innerHeight - composerClearance - totalHeight);

  // Anchored so the preview sits where the real bubble was — the message appears to lift in place
  // rather than the menu appearing somewhere else on screen.
  const top = Math.min(maxTop, Math.max(headerClearance, anchor.top - reactionStripHeight - gap));

  return { top, left: margin, width, previewHeight };
}

interface ChatThreadPageProps {
  /** Pass `null` to fix this mount to the household thread (the /chat/household route). Left
   *  undefined on the DM route, where the thread comes from the :memberName param instead. */
  thread?: null;
}

export default function ChatThreadPage({ thread: fixedThread }: ChatThreadPageProps) {
  const { t } = useTranslation();
  const { currentUser, onlineCount } = useUser();
  const navigate = useNavigate();
  const params = useParams<{ memberName?: string }>();
  // Fixed for the lifetime of this mount — App.tsx keys the DM route on :memberName so a link
  // straight from one DM to another (bypassing the inbox) remounts rather than silently reusing
  // this thread's state for someone else's messages.
  const thread = fixedThread === null ? null : params.memberName ? decodeURIComponent(params.memberName) : null;
  const isDirect = thread != null;
  const isSystemThread = thread === CHAT_SYSTEM_SENDER;
  const threadCacheKey = (memberName: string) => (thread ? qk.chatDirect(memberName, thread) : qk.chat(memberName));

  // Seed from the warm cache so re-opening a thread shows messages instantly instead of the
  // loading state; a background fetch then refreshes them.
  const [messages, setMessages] = useState<LocalChatMessage[]>(
    () => sharedQueryClient.getQueryData<ChatMessage[]>(threadCacheKey(currentUser?.name ?? '')) ?? [],
  );
  const [input, setInput] = useState('');
  const [showActionBar, setShowActionBar] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [showLaundryForm, setShowLaundryForm] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { isUnlocked } = usePremiumEntitlement();
  const [laundryType, setLaundryType] = useState<LaundryType>('COLORS');
  const [laundryTemp, setLaundryTemp] = useState(40);
  const [showKudosForm, setShowKudosForm] = useState(false);
  const [kudosReceiver, setKudosReceiver] = useState('');
  const [kudosType, setKudosType] = useState<KudoType>('THANK_YOU');
  const [kudosContext, setKudosContext] = useState('');
  const [kudosTaskId, setKudosTaskId] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [popoverMessageId, setPopoverMessageId] = useState<number | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<PopoverAnchor | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  /** Briefly ringed after jumping to it from a reply quote, so the eye lands on the right bubble. */
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  /** Server-provided reason the last photo upload failed, shown above the composer. */
  const [imageError, setImageError] = useState<string | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [emojiPickerForId, setEmojiPickerForId] = useState<number | null>(null);
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
  const [loading, setLoading] = useState(
    () => !sharedQueryClient.getQueryData(threadCacheKey(currentUser?.name ?? '')),
  );
  // Tracks whether this render followed a real loading state, so the content fade-in below only
  // plays right after a genuine cold load — a warm revisit (loading never true) renders instantly.
  const wasLoadingRef = useRef(loading);
  const reducedMotion = useReducedMotion();
  const [checkinExpanded, setCheckinExpanded] = useState(false);
  // Collapses the check-in summary card (household only) so more of the message list is visible.
  // Starts collapsed so it doesn't push the message list down on every load — the header's
  // chevron toggle opens it on demand instead.
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  // Snapshot of the seen-cursor taken when the thread opened. Held in state rather than read live
  // so the "NY" divider stays anchored while the user reads, instead of disappearing as soon as
  // we park the cursor at the newest message.
  const [seenCursor, setSeenCursor] = useState<number | null>(null);
  // Device-local chat wallpaper. Seeded synchronously so it paints with the first frame instead
  // of flashing the plain background first.
  const [background, setBackground] = useState<string | null>(() => getChatBackground(currentUser?.name ?? ''));

  // Show whole averages as "5", fractional ones as "4.3".
  const formatMood = (value?: number | null) =>
    value == null ? '' : Number.isInteger(value) ? String(value) : value.toFixed(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Whether the reader is close enough to the bottom that a new message should auto-scroll them
  // along with it. Someone scrolled up reading history should never get yanked back down by a
  // message or reaction that isn't theirs.
  const nearBottomRef = useRef(true);
  // The last id we already auto-scrolled for, so a reaction/poll update that patches an existing
  // message (not the newest one) doesn't re-trigger a scroll it never needed.
  const lastAutoScrolledIdRef = useRef<number | null>(null);
  // True until the thread currently on screen has done its first scroll-to-bottom. Opening a
  // thread should land on the latest message instantly, not animate down through the whole
  // history — only messages that arrive after that should scroll smoothly.
  const instantScrollRef = useRef(true);
  // False until just after the first commit, so the tail-bubble entrance animation (see `isRecent`
  // below) never replays for messages that were already there when the page mounted — only for
  // ones that arrive afterward.
  const hasMountedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const longPressRef = useRef<{ timer: number | null; messageId: number | null; startX: number; startY: number; bubbleEl: HTMLElement | null }>({
    timer: null,
    messageId: null,
    startX: 0,
    startY: 0,
    bubbleEl: null,
  });
  /** True between the hold firing and the next press starting, so the image inside the pressed
   *  bubble doesn't also open the full-screen viewer on pointer-up. */
  const longPressFiredRef = useRef(false);

  const name = currentUser?.name ?? '';
  // Computed once per render rather than memoized — Capacitor.getPlatform() is a cheap sync read
  // and the result never changes for the lifetime of the app.
  const quickReactions = [...(isIOS() ? IOS_LEAD_REACTIONS : ANDROID_LEAD_REACTIONS), ...EXTRA_REACTIONS];
  const queryClient = useQueryClient();
  const { data: members = [] } = useQuery({
    queryKey: qk.members(name),
    enabled: !!name,
    queryFn: () => api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(name)}`),
  });
  const { data: householdTasks = [] } = useQuery({
    queryKey: qk.tasksList(name),
    enabled: !!name,
    queryFn: () => api.get<Task[]>(`/tasks?memberName=${encodeURIComponent(name)}`),
  });
  // Shares Dashboard's/Calendar's cache entry, so navigating between pages doesn't refire the POST.
  const { data: checkin } = useQuery({
    queryKey: qk.checkin(name),
    enabled: !!currentUser,
    queryFn: async () => {
      const collective = await api.get<{ collectiveId: number }>(`/onboarding/collectives/code/${currentUser!.id}`);
      return api.post<HouseCheckin>(`/collectives/${collective.collectiveId}/checkins/generate`, {});
    },
  });
  const { data: checkinSummary } = useQuery({
    queryKey: ['checkin', 'summary', name, checkin?.id],
    enabled: !!checkin,
    queryFn: () => api.get<CheckinSummary>(`/checkins/${checkin!.id}/summary`),
  });
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
  const popoverMessage = popoverMessageId != null ? messageById.get(popoverMessageId) : undefined;
  // The backend allows several messages to carry `pinned`, but the banner only has room for one, so
  // the newest wins — pinning something new supersedes rather than stacks.
  const pinnedMessage = [...messages].reverse().find((message) => message.pinned);
  /** Label for a day-separator chip: "Today"/"Yesterday" near the present, an absolute date
   *  further back — the relative words are what people actually scan for. */
  const formatDayDivider = (value: string) => {
    const messageDate = new Date(value);
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayDelta = Math.round((startOfDay(new Date()) - startOfDay(messageDate)) / 86_400_000);
    if (dayDelta === 0) return t('chat.today');
    if (dayDelta === 1) return t('chat.yesterday');
    // Inside the last week the weekday alone is unambiguous; older than that needs the date.
    return dayDelta < 7
      ? formatDate(value, { weekday: 'long' })
      : formatDate(value, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatMessageTimestamp = (value: string) => {
    const messageDate = new Date(value);
    const now = new Date();
    const isToday =
      messageDate.getFullYear() === now.getFullYear() &&
      messageDate.getMonth() === now.getMonth() &&
      messageDate.getDate() === now.getDate();
    return isToday ? formatTime(value) : formatDateTime(value);
  };

  const fetchMessages = async () => {
    if (!name) return;
    const url = thread
      ? `/chat/direct?memberName=${encodeURIComponent(name)}&otherName=${encodeURIComponent(thread)}`
      : `/chat/messages?memberName=${encodeURIComponent(name)}`;
    const res = await api.get<ChatMessage[]>(url);
    // Cache this thread so revisiting it renders instantly from cache.
    sharedQueryClient.setQueryData(threadCacheKey(name), res);
    setMessages(res);
    setLoading(false);
  };

  // Patches a single message into the thread instead of refetching the whole conversation — the
  // realtime event already carries the full message. Handles three cases: a brand new message
  // from someone else (append), an update to one already on screen (reaction/poll vote, or our
  // own message echoed back — replace in place), and our own message's echo arriving before its
  // POST response does (reconcile the matching "sending" placeholder so the POST's own
  // reconciliation becomes a no-op instead of creating a duplicate bubble).
  const applyIncomingMessage = (incoming: ChatMessage) => {
    setMessages((prev) => {
      const existingIndex = prev.findIndex((m) => m.id === incoming.id);
      let next: LocalChatMessage[];
      if (existingIndex !== -1) {
        next = prev.map((m) => (m.id === incoming.id ? incoming : m));
      } else if (incoming.sender === name) {
        const pendingIndex = prev.findIndex(
          (m) =>
            m.status === 'sending' &&
            m.text === incoming.text &&
            (m.recipient ?? null) === (incoming.recipient ?? null),
        );
        if (pendingIndex === -1) {
          next = [...prev, incoming];
        } else {
          clientIdByServerIdRef.current.set(incoming.id, prev[pendingIndex].id);
          next = prev.map((m, i) => (i === pendingIndex ? incoming : m));
        }
      } else {
        next = [...prev, incoming];
      }
      sharedQueryClient.setQueryData(threadCacheKey(name), next);
      return next;
    });
  };

  useEffect(() => {
    void fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, thread]);

  useRealtimeEvent(
    (event) => {
      if (!name) return;
      if (['MESSAGE_CREATED', 'MESSAGE_REACTION_UPDATED', 'MESSAGE_POLL_UPDATED', 'MESSAGE_PINNED'].includes(event.type)) {
        // The payload already carries the full message, so patch it in directly instead of
        // refetching everything. Household messages (recipient null) only matter while the
        // household thread is open; a DM message's reaction/pin update only matters while that
        // exact DM thread is open — same matching DIRECT_MESSAGE_CREATED already does below.
        const msg = event.payload as ChatMessage;
        if (msg.recipient == null) {
          if (thread === null) applyIncomingMessage(msg);
        } else {
          const other = msg.sender === name ? msg.recipient : msg.sender;
          if (other && other === thread) applyIncomingMessage(msg);
        }
      }
      if (event.type === 'DIRECT_MESSAGE_CREATED') {
        const dm = event.payload as ChatMessage;
        const other = dm.sender === name ? dm.recipient : dm.sender;
        if (other && other === thread) applyIncomingMessage(dm);
      }
      if (event.type === 'CHECKIN_UPDATED') {
        queryClient.invalidateQueries({ queryKey: qk.checkin(name) });
        queryClient.invalidateQueries({ queryKey: ['checkin', 'summary', name] });
      }
      if (event.type === 'MEMBER_UPDATED') {
        queryClient.invalidateQueries({ queryKey: qk.members(name) });
      }
      if (event.type === 'MEMBER_RENAMED') {
        // A housemate's name changed — refetch this thread's messages (sender/recipient
        // fields) and the member list rather than patching the rename in place.
        queryClient.invalidateQueries({ queryKey: qk.members(name) });
        void fetchMessages();
      }
    },
    () => {
      void fetchMessages();
      queryClient.invalidateQueries({ queryKey: qk.checkin(name) });
    },
  );

  // The initial state ran before the session restored, so pick the wallpaper up once the member
  // name is known (and swap it when a different member signs in on this device).
  useEffect(() => {
    setBackground(getChatBackground(name));
  }, [name]);

  // Tracks how close to the bottom the reader currently is, so an incoming message only pulls
  // them along when they're already near the end of the thread — not when they've scrolled up to
  // read history and someone else's message (or a reaction on an old one) refreshes the array.
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  };

  useEffect(() => {
    if (messages.length === 0) return;
    const newestId = newestMessageId(messages);
    const isNewMessage = newestId !== null && newestId !== lastAutoScrolledIdRef.current;
    if (!instantScrollRef.current && !isNewMessage) return;
    const newest = messages[messages.length - 1];
    const shouldFollow = instantScrollRef.current || newest?.sender === name || nearBottomRef.current;
    if (newestId !== null) lastAutoScrolledIdRef.current = newestId;
    if (!shouldFollow) return;
    bottomRef.current?.scrollIntoView({ behavior: instantScrollRef.current ? 'auto' : 'smooth' });
    instantScrollRef.current = false;
  }, [messages]);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  // Re-read the cursor before any new messages land.
  useEffect(() => {
    setSeenCursor(getLastSeenMessageId(name, thread));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, thread]);

  // Park the cursor at the newest message once the thread is on screen. The divider itself is
  // driven by the snapshot above, so writing here doesn't make it jump away mid-read.
  useEffect(() => {
    const newest = newestMessageId(messages);
    if (newest === null || !name) return;
    setLastSeenMessageId(name, thread, newest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, name, thread]);

  useEffect(() => {
    return () => {
      clearLongPress();
    };
  }, []);

  // Keeps a sent message's on-screen identity stable across the optimistic-id → real-id swap
  // below, so the bubble doesn't unmount/remount (and replay its pop-in animation a second time)
  // the instant the server responds. Session-scoped and tiny — no cleanup needed.
  const clientIdByServerIdRef = useRef(new Map<number, number>());

  // Does the actual POST for a message already showing on screen with status "sending", and
  // reconciles the result. Shared by the initial send and by retry, both keyed off the same
  // tempId — retry never creates a second bubble, it just re-tries the same one.
  const deliverMessage = async (tempId: number, text: string, replyToMessageId: number | null) => {
    try {
      const saved = thread
        ? await api.post<ChatMessage>('/chat/direct', { recipient: thread, text, replyToMessageId })
        : await api.post<ChatMessage>('/chat/messages', { sender: name, text, replyToMessageId });
      clientIdByServerIdRef.current.set(saved.id, tempId);
      // A no-op if the realtime echo already reconciled this message (see applyIncomingMessage) —
      // no message with id === tempId remains, so nothing matches and nothing duplicates.
      setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
      // Also write the query cache directly (not just local state), matching every other mutation
      // in this file — otherwise a fast remount before the realtime echo arrives re-seeds from a
      // cache that never learned about the message just sent.
      void fetchMessages();
    } catch {
      // Keep the bubble visible so the user can retry instead of losing the message and having
      // to retype it.
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    if (messageInputRef.current) messageInputRef.current.style.height = 'auto';
    const text = input;
    const replyToMessageId = replyingToId;
    setInput('');
    setMention(null);
    setReplyingToId(null);

    // Show the message instantly with a temporary id, then swap in the persisted version
    // when the server responds. Avoids waiting on the POST (and a second full refetch)
    // before anything appears — the send now feels immediate.
    const tempId = -Date.now();
    const optimistic: LocalChatMessage = {
      id: tempId,
      sender: name,
      recipient: thread ?? null,
      text,
      replyToMessageId: replyToMessageId ?? null,
      timestamp: new Date().toISOString(),
      reactions: [],
      status: 'sending',
    };
    setMessages((prev) => [...prev, optimistic]);
    await deliverMessage(tempId, text, replyToMessageId ?? null);
  };

  /** Posts a formatted string straight to the household thread, bypassing the composer's own
   *  input state — used by the meeting-topic menu's "post to chat" action. */
  const postFormattedMessage = (text: string) => {
    const tempId = -Date.now();
    const optimistic: LocalChatMessage = {
      id: tempId,
      sender: name,
      recipient: null,
      text,
      replyToMessageId: null,
      timestamp: new Date().toISOString(),
      reactions: [],
      status: 'sending',
    };
    setMessages((prev) => [...prev, optimistic]);
    void deliverMessage(tempId, text, null);
  };

  const retryMessage = (message: LocalChatMessage) => {
    if (message.status !== 'failed') return;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'sending' } : m)));
    void deliverMessage(message.id, message.text, message.replyToMessageId ?? null);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    setMention(detectMention(value, e.target.selectionStart ?? value.length));
    autoGrow(e.target);
  };

  /** Grows the composer with its content up to MAX_COMPOSER_ROWS, then scrolls internally.
   *  Height has to be reset first or the scrollHeight only ever ratchets upwards. */
  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const padding = el.offsetHeight - el.clientHeight + 20;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * MAX_COMPOSER_ROWS + padding)}px`;
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

  const clearLongPress = () => {
    if (longPressRef.current.timer != null) window.clearTimeout(longPressRef.current.timer);
    longPressRef.current.timer = null;
    longPressRef.current.messageId = null;
    longPressRef.current.bubbleEl = null;
  };

  const closePopover = () => {
    setPopoverMessageId(null);
    setPopoverAnchor(null);
  };

  const startMessagePress = (messageId: number, event: React.PointerEvent<HTMLElement>) => {
    // The automated-notice thread is fully read-only — nothing to reply to or react to there.
    if (isSystemThread) return;
    // Buttons (poll options, retry) keep their own tap. Images deliberately do NOT bail out any
    // more: excluding them meant WebKit's native callout owned the gesture, leaving image
    // messages with no reply/react/pin at all. `longPressFiredRef` below stops the image's
    // tap-to-expand from also firing once the hold has opened the overlay.
    if ((event.target as HTMLElement).closest('button')) return;
    longPressFiredRef.current = false;
    clearLongPress();
    // Captured now (not re-derived from the event later, which isn't safe once the handler
    // returns) so the popover can measure its on-screen position when the timer actually fires.
    const bubbleEl = event.currentTarget as HTMLElement;
    longPressRef.current = {
      timer: window.setTimeout(() => {
        longPressRef.current.timer = null;
        longPressFiredRef.current = true;
        // Measured now, not at press-start — the message may have scrolled during the 450ms hold.
        const rect = bubbleEl.getBoundingClientRect();
        setPopoverAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right });
        setPopoverMessageId(messageId);
        void tapFeedback();
      }, 450),
      messageId,
      startX: event.clientX,
      startY: event.clientY,
      bubbleEl,
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
    closePopover();
  };

  /** Tapping a quoted message scrolls back to the original and flashes it, as iOS Messages does.
   *  No-ops when the original has scrolled out of the loaded window rather than jumping nowhere. */
  const jumpToMessage = (messageId: number) => {
    const target = scrollContainerRef.current?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    void tapFeedback();
    setHighlightedMessageId(messageId);
    window.setTimeout(() => setHighlightedMessageId((current) => (current === messageId ? null : current)), 1200);
  };

  const copyMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.text);
      void tapFeedback();
      setCopiedMessageId(message.id);
      window.setTimeout(() => {
        setCopiedMessageId(null);
        closePopover();
      }, 900);
    } catch {
      closePopover();
    }
  };

  /**
   * Pin or unpin a message.
   *
   * The endpoint and MessageDto.pinned have existed on the backend all along — a household could
   * never reach them because nothing in the UI read or called either. Pinning is a toggle server
   * side, so the same call covers both directions; the MESSAGE_PINNED websocket event updates the
   * thread for everyone else.
   */
  const togglePin = async (messageId: number) => {
    closePopover();
    void tapFeedback();
    try {
      await api.post(`/chat/messages/${messageId}/pin`, {});
      fetchMessages();
    } catch {
      // Refetch anyway so the UI never keeps an optimistic pin the server rejected.
      fetchMessages();
    }
  };

  const sendStarterGif = async (gif: (typeof STARTER_GIFS)[number]) => {
    const file = await starterGifPngFile(gif);
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

  /**
   * Uploads a photo into the thread.
   *
   * Every failure here used to be an unhandled rejection — both callers invoked this without
   * awaiting or catching — so a rejected upload (oversize file, a moderation verdict, the
   * moderation provider being down) closed the tray and showed the user precisely nothing. The
   * server's own message is surfaced instead, and the caption is only cleared once the send
   * succeeds so a retry isn't retyped from scratch.
   */
  const sendImage = async (file: File) => {
    const caption = input.trim();
    setImageError(null);
    setSendingImage(true);
    try {
      const prepared = await prepareImageForUpload(file);
      const form = new FormData();
      form.append('image', prepared);
      if (caption) form.append('caption', caption);
      await api.postForm('/chat/images', form);
      setInput('');
      fetchMessages();
    } catch (error) {
      setImageError(getUserMessage(error, t('chat.imageSendFailed')));
    } finally {
      setSendingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const applyBackgroundFile = async (file: File) => {
    const saved = await saveChatBackground(name, file);
    if (saved) setBackground(saved);
    if (backgroundInputRef.current) backgroundInputRef.current.value = '';
  };

  const handleChangeBackground = async () => {
    if (nativeCameraAvailable()) {
      const file = await pickChatBackgroundFile();
      if (file) await applyBackgroundFile(file);
    } else {
      backgroundInputRef.current?.click();
    }
  };

  const handleClearBackground = () => {
    clearChatBackground(name);
    setBackground(null);
  };

  if (loading) {
    wasLoadingRef.current = true;
    return (
      <div className="app-thread-screen relative flex flex-col">
        <div className="-mx-4 -mt-2 h-[3.75rem] animate-pulse border-b border-border bg-muted/20 sm:-mx-6" />
        <div className="min-h-0 flex-1 space-y-3 px-4 py-4 sm:px-6">
          {[70, 45, 60, 35].map((width, i) => (
            <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
              <div className="h-9 animate-pulse rounded-3xl bg-muted/20" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
        <div className="h-12 animate-pulse rounded-full bg-muted/20" />
      </div>
    );
  }
  const justFinishedLoading = wasLoadingRef.current && !reducedMotion;
  wasLoadingRef.current = false;

  return (
    <motion.div initial={justFinishedLoading ? { opacity: 0 } : false} animate={{ opacity: 1 }} className="app-thread-screen relative flex flex-col">
      {/* Wallpaper paints behind the WHOLE screen (header, list, composer) — like Snapchat, not
          just the middle scroll region. Everything else stacks above it with `relative`. */}
      {background && (
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <img src={background} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div
        className={`relative z-20 safe-top -mt-2 border-b border-border ${
          background ? 'glass' : `tone-tile tone-${PAGE_ACCENTS['/chat']}`
        }`}
      >
        {/* Stronger scrim than the message list gets — header text doesn't have a bubble
            background behind it to help with contrast. */}
        {background && <div className="pointer-events-none absolute inset-0 bg-background/70" aria-hidden="true" />}
        <div className="relative flex items-center gap-2 px-4 py-2.5 sm:px-6">
          <button
            onClick={() => navigate('/chat')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted/60 text-muted-foreground"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          {isDirect ? (
            <span style={{ backgroundColor: colorForMember(thread!, memberColorMap.get(thread!)) }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white">
              {thread![0]?.toUpperCase()}
            </span>
          ) : (
            <AvatarStack members={headerMembers} max={3} />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-extrabold">{isDirect ? thread : t('chat.threadTitle')}</h2>
            <p className="text-xs text-muted-foreground">
              {isDirect ? (
                <span className="font-semibold text-foreground">{isSystemThread ? t('chat.systemThreadSubtitle') : t('chat.directSubtitle')}</span>
              ) : (
                <>
                  <span className="font-semibold text-primary">● {onlineCount === null ? t('common.connecting') : t('chat.onlineCount', { count: onlineCount })}</span>
                  {members.length > 0 && <> · {t('chat.memberCount', { count: members.length })}</>}
                </>
              )}
            </p>
          </div>
          {!isDirect && <MeetingTopicMenu currentUser={currentUser} onPostTopic={postFormattedMessage} />}
          {!isDirect && checkinSummary && checkinSummary.responseCount > 0 && (
            <button
              onClick={() => setHeaderExpanded((v) => !v)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted/60 text-muted-foreground"
              aria-label={headerExpanded ? t('chat.collapseHeader') : t('chat.expandHeader')}
            >
              <ChevronDown className={`h-5 w-5 transition-transform ${headerExpanded ? '' : 'rotate-180'}`} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {headerExpanded && !isDirect && checkinSummary && checkinSummary.responseCount > 0 && (
          <motion.div variants={collapseVariants} initial="hidden" animate="show" exit="exit" className="relative z-10 overflow-hidden px-4 sm:px-6">
            <div className="card mt-3 !p-0">
              <button
                onClick={() => setCheckinExpanded((v) => !v)}
                className="flex w-full items-center justify-between gap-3 p-3 text-left"
              >
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 font-display text-sm font-bold truncate">
                    <MessageCircleHeart className="h-4 w-4 shrink-0" />
                    {t('checkin.summaryTitle')}
                  </h3>
                  <p className="text-[10px] text-muted-foreground">{t('checkin.progress', { count: checkinSummary.responseCount, total: checkinSummary.memberCount })}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-bold text-primary">{t('checkin.averageMood', { mood: formatMood(checkinSummary.averageMood) })}</span>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-muted/60">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${checkinExpanded ? 'rotate-180' : ''}`} />
                  </span>
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pinned message. Surfaces MessageDto.pinned, which the backend has always sent and the app
          never read — the house rule or the address everyone keeps scrolling back for. */}
      <AnimatePresence>
        {pinnedMessage && (
          <motion.div
            variants={collapseVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="relative z-10 mb-2 overflow-hidden px-4 sm:px-6"
          >
            <button
              onClick={() => void togglePin(pinnedMessage.id)}
              className="tone-butter tone-wash tone-edge flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left"
            >
              <Pin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">
                  {t('chat.pinnedLabel', { name: pinnedMessage.sender })}
                </span>
                <span className="block truncate text-sm font-semibold">
                  {pinnedMessage.text || t('chat.imageAlt')}
                </span>
              </span>
              <PinOff className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message list. ChatThreadLayout has no horizontal padding of its own, so the scroller's
          px-4 IS the gutter — roughly the 16pt iOS Messages keeps between a bubble and the screen
          edge. (This used to carry -mx-4 to cancel <main>'s padding from back when the thread
          rendered inside AppLayout; the leftover negative margin pushed bubbles flush to the
          edge.) The wallpaper still bleeds edge to edge — it's painted by the absolutely
          positioned layer at the screen root, not by this list. */}
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden">
        {background && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {/* Theme-aware scrim so sender names and reply chips stay legible over any photo. */}
            <div className="absolute inset-0 bg-background/55" />
          </div>
        )}
        <div
          ref={scrollContainerRef}
          data-chat-scroll
          className="relative h-full overflow-y-auto px-4 py-4 sm:px-6"
          onScroll={handleScroll}
        >
        {decorateMessages(messages, seenCursor).map(({ message, isFirstOfGroup, isLastOfGroup, startsNewDay, startsUnread }, i, all) => {
          const isSelf = message.sender === name;
          const senderColor = colorForMember(message.sender, memberColorMap.get(message.sender));
          const replyTarget = message.replyToMessageId != null ? messageById.get(message.replyToMessageId) : undefined;
          // Only the tail of the thread animates on arrival — see the bubble's `initial` below.
          const isRecent = hasMountedRef.current && i >= all.length - 3;
          return (
            <div key={clientIdByServerIdRef.current.get(message.id) ?? message.id}>
              {startsNewDay && (
                <div className="flex justify-center py-3">
                  <span className="rounded-full bg-foreground/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground backdrop-blur-sm">
                    {formatDayDivider(message.timestamp)}
                  </span>
                </div>
              )}
              {startsUnread && (
                <div className="flex justify-center py-3">
                  <span className="rounded-full bg-foreground px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-background">
                    {t('chat.newDivider')}
                  </span>
                </div>
              )}
            <motion.div
              /* Only the newest few messages animate in. The thread is refetched in full on every
                 websocket event, so animating every bubble would replay the whole conversation each
                 time someone sends one. `i` counts from the end for exactly that reason. */
              initial={isRecent ? { opacity: 0, y: 12, scale: 0.96 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={springPop}
              data-message-id={message.id}
              /* Tight inside a run, roomy between runs — the grouping is carried by the gap. */
              className={`flex scroll-mt-24 ${isFirstOfGroup && !startsNewDay && !startsUnread ? 'mt-3' : 'mt-0.5'} ${
                highlightedMessageId === message.id ? 'rounded-2xl ring-2 ring-primary/60 ring-offset-2 ring-offset-background' : ''
              }`}
            >
              <MessageBubble
                message={message}
                replyTarget={replyTarget}
                isSelf={isSelf}
                isFirstOfGroup={isFirstOfGroup}
                isLastOfGroup={isLastOfGroup}
                senderColor={senderColor}
                currentUserName={name}
                formatTimestamp={formatMessageTimestamp}
                onPointerDown={(event) => startMessagePress(message.id, event)}
                onPointerMove={moveMessagePress}
                onPointerUp={clearLongPress}
                onExpandImage={(image) => {
                  if (longPressFiredRef.current) return;
                  setExpandedImage(image);
                }}
                onVotePoll={votePoll}
                onRetry={retryMessage}
                onToggleReaction={(messageId, emoji) => void toggleReaction(messageId, emoji)}
                onJumpToMessage={jumpToMessage}
              />
            </motion.div>
            </div>
          );
        })}
        <div ref={bottomRef} />
        </div>
      </div>

      {isSystemThread ? (
        <div className="safe-bottom relative z-10 -mx-4 px-4 pb-2 sm:-mx-6 sm:px-6">
          <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
            {t('chat.systemThreadReadOnly')}
          </p>
        </div>
      ) : (
      <>
      {/* Poll form */}
      <AnimatePresence>
        {showKudosForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative z-10 overflow-hidden">
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
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${kudosType === type ? 'bg-ink text-ink-foreground' : 'bg-muted/60 text-muted-foreground'}`}
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
              <button onClick={() => void sendKudos()} disabled={!kudosReceiver} className="w-full rounded-lg bg-ink py-2 text-xs font-bold text-ink-foreground disabled:opacity-50">{t('kudos.send')}</button>
              <p className="text-[9px] text-muted-foreground">{t('kudos.privateNote')}</p>
            </AddSheet>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGifPicker && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative z-10 overflow-hidden">
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
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative z-10 overflow-hidden">
            <AddSheet title={t('laundry.title')} onClose={() => setShowLaundryForm(false)} className="mb-2 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground">{t('laundry.typeLabel')}</p>
              <div className="flex flex-wrap gap-1.5">
                {LAUNDRY_TYPES.map((type) => (
                  <button key={type} onClick={() => setLaundryType(type)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${laundryType === type ? 'bg-ink text-ink-foreground' : 'bg-muted/60 text-muted-foreground'}`}>
                    {t(`laundry.types.${type}`)}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-semibold text-muted-foreground">{t('laundry.tempLabel')}</p>
              <div className="flex flex-wrap gap-1.5">
                {LAUNDRY_TEMPS.map((temp) => (
                  <button key={temp} onClick={() => setLaundryTemp(temp)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${laundryTemp === temp ? 'bg-ink text-ink-foreground' : 'bg-muted/60 text-muted-foreground'}`}>
                    {temp}°C
                  </button>
                ))}
              </div>
              <button onClick={() => void sendLaundry()} className="w-full rounded-lg bg-ink py-2 text-xs font-bold text-ink-foreground">{t('laundry.send')}</button>
            </AddSheet>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPollForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative z-10 overflow-hidden">
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
                <button onClick={sendPoll} className="ml-auto px-3 py-1 rounded-lg gradient-primary text-[10px] font-semibold text-ink-foreground">
                  {t('chat.sendPoll')}
                </button>
              </div>
            </AddSheet>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {replyingToId != null && messageById.get(replyingToId) && (
          <motion.div
            variants={collapseVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="relative z-10 mb-2 overflow-hidden px-4 sm:px-6"
          >
            <div className="glass elev-1 flex items-start gap-2 overflow-hidden rounded-lg border-l-2 border-l-primary py-2 pl-2.5 pr-2">
              <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">{t('chat.replyingTo', { name: messageById.get(replyingToId)?.sender })}</p>
                <p className="truncate text-xs text-muted-foreground">{messageById.get(replyingToId)?.text || t('chat.imageAlt')}</p>
              </div>
              <button onClick={() => setReplyingToId(null)} className="pressable-tight shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label={t('chat.cancelReply')}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar. safe-bottom keeps the composer clear of the home indicator now that there's no
          bottom nav reserving that strip; px-4 matches the message list's gutter so the pill lines
          up with the bubbles above it. */}
      <div data-chat-composer className="safe-bottom relative z-10 px-4 pb-2 sm:px-6">
        {mention && mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 z-30 max-h-52 overflow-y-auto rounded-2xl border border-border bg-popover p-1 shadow-xl">
            {mentionCandidates.map((member) => (
              <button
                key={member}
                onMouseDown={(e) => { e.preventDefault(); insertMention(member); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-muted/60"
              >
                <span style={{ backgroundColor: colorForMember(member, memberColorMap.get(member)) }} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white">
                  {member[0].toUpperCase()}
                </span>
                <span className="font-medium">{member}</span>
              </button>
            ))}
          </div>
        )}
        {/* Action bar — revealed by the + button. Photo comes first since it's the most common
            non-text action (mirrors iMessage's attachment tray); the rest are collective-only
            concepts and stay hidden in a 1:1 thread. */}
        <AnimatePresence>
        {showActionBar && (
          <motion.div
            variants={collapseVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="elev-2 mb-2 flex gap-2 overflow-x-auto overflow-y-hidden rounded-2xl border border-border bg-card px-3 py-2"
          >
            <button
              onMouseDown={(e) => e.preventDefault()}
              disabled={sendingImage}
              onClick={() => { setShowActionBar(false); void handlePickImage(); }}
              className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60 disabled:opacity-50"
              aria-label={t('chat.sendImage')}
            >
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-[9px] font-medium text-muted-foreground">
                {sendingImage ? t('chat.sending') : t('chat.sendImage')}
              </span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowActionBar(false);
                if (!isUnlocked) { setShowPaywall(true); return; }
                setShowGifPicker((v) => !v);
              }}
              className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60"
              aria-label={t('chat.sendGif')}
            >
              {isUnlocked ? <Film className="h-5 w-5 text-muted-foreground" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
              <span className="text-[9px] font-medium text-muted-foreground">GIF</span>
            </button>
            {!isDirect && (
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowPollForm((v) => !v); setShowActionBar(false); }} className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60" aria-label={t('chat.togglePollForm')}>
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <span className="text-[9px] font-medium text-muted-foreground">{t('chat.createPoll')}</span>
              </button>
            )}
            {!isDirect && (
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowLaundryForm((v) => !v); setShowActionBar(false); }} className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60" aria-label={t('laundry.title')}>
                <WashingMachine className="h-5 w-5 text-accent" />
                <span className="text-[9px] font-medium text-muted-foreground">{t('laundry.title')}</span>
              </button>
            )}
            {!isDirect && (
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowKudosForm((v) => !v); setShowActionBar(false); }} className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60" aria-label={t('kudos.sendTitle')}>
                <HeartHandshake className="h-5 w-5 text-primary" />
                <span className="text-[9px] font-medium text-muted-foreground">{t('kudos.sendTitle')}</span>
              </button>
            )}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowActionBar(false);
                if (!isUnlocked) { setShowPaywall(true); return; }
                void handleChangeBackground();
              }}
              className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60"
              aria-label={t('chat.background.change')}
            >
              {isUnlocked ? <Wallpaper className="h-5 w-5 text-muted-foreground" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
              <span className="text-[9px] font-medium text-muted-foreground">{t('chat.background.label')}</span>
            </button>
            {background && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setShowActionBar(false); handleClearBackground(); }}
                className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60"
                aria-label={t('chat.background.remove')}
              >
                <X className="h-5 w-5 text-muted-foreground" />
                <span className="text-[9px] font-medium text-muted-foreground">{t('chat.background.remove')}</span>
              </button>
            )}
          </motion.div>
        )}
        </AnimatePresence>
        {/* A failed photo upload has to say so. It used to reject silently, so an image that the
            backend refused (oversize, moderation) looked exactly like nothing happening. */}
        <AnimatePresence>
          {imageError && (
            <motion.div variants={collapseVariants} initial="hidden" animate="show" exit="exit" className="mb-2 overflow-hidden">
              <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2">
                <p className="min-w-0 flex-1 text-xs font-semibold text-destructive">{imageError}</p>
                <button
                  onClick={() => setImageError(null)}
                  className="pressable-tight shrink-0 rounded-full p-0.5 text-destructive"
                  aria-label={t('common.close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Fully round rather than a rounded rectangle — the composer is the one control that is
            always on screen, and the pill shape is what makes the chat read as a chat. */}
        <div className={`elev-2 flex gap-2 rounded-full border border-border p-2 ${background ? 'glass' : 'bg-card'}`}>
          {/* No `capture` attribute: it forces the camera and hides the photo library, so the web
              fallback could never pick an existing picture. */}
          <input ref={fileInputRef} type="file" accept="image/*"
            className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendImage(f); }} />
          {/* Web fallback for the wallpaper picker; native uses the Camera plugin's own sheet. */}
          <input ref={backgroundInputRef} type="file" accept="image/*"
            className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void applyBackgroundFile(f); }} />
          <motion.button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { void tapFeedback(); setShowActionBar((v) => !v); }}
            {...pressable}
            className={`pressable grid shrink-0 place-items-center rounded-full transition-colors ${showActionBar ? 'bg-ink text-ink-foreground' : 'bg-muted'}`}
            aria-label="Actions"
          >
            <motion.span animate={{ rotate: showActionBar ? 45 : 0 }} transition={springPop}>
              <Plus className="h-5 w-5" />
            </motion.span>
          </motion.button>
          <textarea
            ref={messageInputRef}
            // Opts out of nativeBootstrap's generic keyboard-scroll-assist (which centers whichever
            // field was focused) — it fought the re-anchor-to-bottom below, and the two together are
            // what caused the message list to visibly jump twice when the keyboard opened.
            data-keyboard-scroll-assist="off"
            value={input}
            rows={1}
            onChange={handleInputChange}
            onFocus={() => {
              setShowActionBar(false);
              // The keyboard opening shrinks the message list's viewport (see .app-thread-screen's
              // keyboard-open override), which otherwise leaves it looking scrolled to the middle
              // of the thread — re-anchor to the latest message once the resize settles. 350ms
              // matches the keyboard's own animation duration (see nativeBootstrap's assist).
              window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 350);
            }}
            onKeyDown={(e) => {
              if (mention && mentionCandidates.length > 0) {
                if (e.key === 'Enter') { e.preventDefault(); insertMention(mentionCandidates[0]); return; }
                if (e.key === 'Escape') { setMention(null); return; }
              }
              // Enter sends; Shift+Enter is the newline, which is why this is a textarea now.
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder={t('chat.messagePlaceholder')}
            className="font-ios min-w-36 flex-1 resize-none self-center rounded-3xl bg-muted px-4 py-2.5 text-sm leading-snug text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {/* The send button wakes up when there is something to send: dimmed and slightly small
              while the composer is empty, full size and full colour the moment you type. */}
          <motion.button
            onClick={sendMessage}
            {...pressable}
            animate={{ scale: input.trim() ? 1 : 0.88, opacity: input.trim() ? 1 : 0.5 }}
            transition={springPop}
            className="pressable grid shrink-0 place-items-center rounded-full bg-primary dark:bg-white"
            aria-label={t('common.send')}
          >
            <ArrowUp className="h-4 w-4 text-primary-foreground dark:text-black" strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>
      </>
      )}

      {/* Message action popover: the pressed message lifted out of the thread onto a blurred
          backdrop, with a scroll-across reaction strip above it and a compact action list
          (Reply / Copy / Pin) below — the same lifted-preview shape iOS uses, and now the same for
          text, image and poll messages. Images used to get WebKit's native callout instead, so the
          two looked nothing alike and image messages had no actions at all. */}
      <AnimatePresence>
        {popoverMessage && popoverAnchor && (() => {
          const canCopy = popoverMessage.text.trim().length > 0;
          const actionRowCount = 1 + (canCopy ? 1 : 0) + (!isDirect ? 1 : 0);
          const placement = computePopoverPlacement(popoverAnchor, actionRowCount);
          const popoverIsSelf = popoverMessage.sender === name;
          return (
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-md"
              onClick={closePopover}
            >
              <motion.div
                variants={dialogVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className={`flex flex-col ${popoverIsSelf ? 'items-end' : 'items-start'}`}
                style={{ position: 'fixed', top: placement.top, left: placement.left, width: placement.width }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="elev-3 mb-2 flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-card/95 px-2 py-2 backdrop-blur scrollbar-none">
                  {quickReactions.map((emoji) => {
                    const mine = popoverMessage.reactions.find((r) => r.emoji === emoji)?.users.includes(name);
                    return (
                      <motion.button
                        key={emoji}
                        {...pressable}
                        onClick={() => { void toggleReaction(popoverMessage.id, emoji); closePopover(); }}
                        aria-label={REACTION_LABEL_KEYS[emoji] ? t(REACTION_LABEL_KEYS[emoji]) : emoji}
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-2xl ${mine ? 'bg-primary/20' : ''}`}
                      >
                        {emoji}
                      </motion.button>
                    );
                  })}
                  <motion.button
                    {...pressable}
                    onClick={() => { setEmojiPickerForId(popoverMessage.id); closePopover(); }}
                    aria-label={t('chat.emojiPicker.more')}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                  >
                    <Smile className="h-5 w-5" />
                  </motion.button>
                </div>

                {/* The lifted message itself: a real MessageBubble in `preview` mode, so it is the
                    same shape, colour and content as the bubble still sitting in the thread. */}
                {/* drop-shadow (not elev-3/box-shadow) so the lift follows the bubble's own
                    rounded shape — a shadow on this full-width wrapper painted a phantom
                    rectangle across the empty half of the row. */}
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: 1.03 }}
                  transition={springPop}
                  className="mb-2 w-full origin-center overflow-y-auto drop-shadow-2xl"
                  style={{ maxHeight: placement.previewHeight }}
                >
                  <MessageBubble
                    message={popoverMessage}
                    replyTarget={
                      popoverMessage.replyToMessageId != null ? messageById.get(popoverMessage.replyToMessageId) : undefined
                    }
                    isSelf={popoverIsSelf}
                    isFirstOfGroup
                    isLastOfGroup
                    senderColor={colorForMember(popoverMessage.sender, memberColorMap.get(popoverMessage.sender))}
                    currentUserName={name}
                    formatTimestamp={formatMessageTimestamp}
                    variant="preview"
                  />
                </motion.div>

                <div className="elev-3 w-full max-w-[280px] divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  <button
                    onClick={() => replyToMessage(popoverMessage.id)}
                    className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-semibold hover:bg-muted/60"
                  >
                    <Reply className="h-4 w-4 text-muted-foreground" />
                    {t('chat.replyToMessage')}
                  </button>
                  {canCopy && (
                    <button
                      onClick={() => void copyMessage(popoverMessage)}
                      className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-semibold hover:bg-muted/60"
                    >
                      {copiedMessageId === popoverMessage.id
                        ? <><Check className="h-4 w-4 text-primary" />{t('chat.copied')}</>
                        : <><Copy className="h-4 w-4 text-muted-foreground" />{t('chat.copyMessage')}</>}
                    </button>
                  )}
                  {!isDirect && (
                    <button
                      onClick={() => void togglePin(popoverMessage.id)}
                      className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-semibold hover:bg-muted/60"
                    >
                      {popoverMessage.pinned
                        ? <><PinOff className="h-4 w-4 text-muted-foreground" />{t('chat.unpinMessage')}</>
                        : <><Pin className="h-4 w-4 text-muted-foreground" />{t('chat.pinMessage')}</>}
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
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
              className="pressable-tight absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
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

      <EmojiPickerSheet
        open={emojiPickerForId != null}
        onClose={() => setEmojiPickerForId(null)}
        currentEmoji={
          emojiPickerForId != null
            ? messageById.get(emojiPickerForId)?.reactions.find((r) => r.users.includes(name))?.emoji
            : undefined
        }
        onSelect={(emoji) => {
          if (emojiPickerForId != null) void toggleReaction(emojiPickerForId, emoji);
          setEmojiPickerForId(null);
        }}
      />
    </motion.div>
  );
}
