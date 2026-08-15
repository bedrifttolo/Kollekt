import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { ArrowLeft, ArrowUp, Image as ImageIcon, BarChart3, Check, Copy, Download, X, Reply, HeartHandshake, ChevronDown, WashingMachine, Film, Lock, Plus, Send, Smile, MessageCircleHeart, Wallpaper, Pin, PinOff, Pencil, Trash2 } from 'lucide-react';

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
import { clearChatBackground, fetchChatBackground, getCachedChatBackground, pickChatBackgroundFile, saveChatBackground } from '../../lib/chatBackground';
import { getLastSeenMessageId, setLastSeenMessageId } from '../../lib/chatSeen';
import { useSwipeBack } from '../../lib/swipeBack';
import { keyboardHeight, onKeyboardInset } from '../../lib/keyboardInsets';
import { decorateMessages, newestMessageId } from '../../lib/chatThread';
import { CHAT_SYSTEM_SENDER } from '../../lib/chatThreadSummary';
import { useUser, useRealtimeEvent } from '../../context/UserContext';
import { formatDate, formatDateTime, formatTime } from '../../i18n/helpers';
import { tapFeedback } from '../../lib/haptics';
import { usePremiumEntitlement } from '../../lib/purchases';
import SubscriptionPaywall from '../../components/SubscriptionPaywall';
import type { AppUser, ChatMessage, CheckinResponse, CheckinSummary, HouseCheckin, Kudo, KudoType, Task } from '../../lib/types';
import MeetingTopicMenu from './MeetingTopicMenu';
import MessageBubble from './MessageBubble';
/** Local-only send state layered onto a message while it's in flight; never sent to the server.
 *  Declared alongside MessageBubble, which renders it. */
import type { LocalChatMessage } from './MessageBubble';

const KUDO_TYPES: KudoType[] = ['THANK_YOU', 'CLEANEST', 'MOST_HELPFUL', 'PEACEMAKER'];
import { AddSheet, AvatarStack, CloseButton } from '../../components/ui-kit';
import { backdropVariants, collapseVariants, dialogVariants, popIn, pressable, springPop, springSoft, useReducedMotion } from '../../lib/motion';
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

/** Reserved for the reaction strip above the lifted preview: `h-10` buttons + `py-2` + borders.
 *  Only used for the first-frame estimate — `clampPopoverTop` re-derives from the real DOM. */
const REACTION_STRIP_HEIGHT = 58;
const POPOVER_GAP = 8;

/** The vertical band the popover is allowed to occupy, measured from the chrome that actually
 *  bounds it rather than from hardcoded numbers: the thread header (which carries `safe-top` and
 *  may or may not be showing its check-in card) and the composer (whose own `.safe-bottom` padding
 *  already tracks `--keyboard-inset`, so its `top` sits on the keyboard's edge — which is why the
 *  keyboard is not subtracted a second time here). The fallbacks cover the read-only system thread,
 *  which renders a notice instead of a composer. */
function popoverBounds() {
  const header = document.querySelector('[data-chat-header]')?.getBoundingClientRect();
  const composer = document.querySelector('[data-chat-composer]')?.getBoundingClientRect();
  return {
    minTop: (header ? header.bottom : 84) + POPOVER_GAP,
    bottomLimit: (composer ? composer.top : window.innerHeight - keyboardHeight() - 96) - POPOVER_GAP,
  };
}

/** Where to put the message action popover so it always fits on screen: hugs the bubble's own
 *  side (own messages hug the right edge, others the left, matching iOS), prefers sitting above
 *  the bubble, and falls back below it when there isn't enough headroom under the header. */
function computePopoverPlacement(anchor: PopoverAnchor, actionRowCount: number) {
  // The anchor is the whole message row (see `startMessagePress`), which already spans the message
  // list's content width — so the lifted preview lands at exactly the width the real message had,
  // on any viewport, including the `max-w-xl` desktop column the old `innerWidth - 32` ignored.
  const left = anchor.left;
  const width = anchor.right - anchor.left;

  // How tall the lifted preview may be before it scrolls inside itself. This is a cap the preview
  // only hits when it genuinely is that tall — NOT a clamp to the anchor's height. Clamping to the
  // anchor is what used to slice the bubble: the preview re-renders the message as first+last of
  // its group, so it grows a sender name, a timestamp and (for replies) the quoted chip that the
  // measured row did not necessarily have.
  //
  // The second term is what makes the menu fit on a short screen: whatever the reaction strip and
  // the action list do not need. Without it a six-row menu on an SE-sized screen simply ran off the
  // bottom, because 45% of the viewport plus the rest is more than the band between header and
  // composer. The preview is the only part that can afford to scroll — the actions cannot.
  const actionsHeight = actionRowCount * 44 + 8;
  const { minTop, bottomLimit } = popoverBounds();
  const previewCap = Math.max(
    64,
    Math.min(
      Math.round(window.innerHeight * 0.45),
      // 12 = the clip box's own py-1.5, which is the room the 3% lift grows into.
      bottomLimit - minTop - REACTION_STRIP_HEIGHT - POPOVER_GAP * 2 - actionsHeight - 12,
    ),
  );

  const estimatedHeight =
    REACTION_STRIP_HEIGHT + POPOVER_GAP + Math.min(anchor.bottom - anchor.top, previewCap) + POPOVER_GAP + actionsHeight;

  // Anchored so the preview sits where the real message was — it appears to lift in place rather
  // than the menu appearing somewhere else on screen. Corrected against the column's true height
  // by `clampPopoverTop` in a layout effect, before this ever paints.
  const top = clampPopoverTop(anchor, estimatedHeight);

  return { top, left, width, previewCap };
}

/** Keeps the popover column inside `popoverBounds()`, preferring to sit right above the message. */
function clampPopoverTop(anchor: PopoverAnchor, height: number) {
  const { minTop, bottomLimit } = popoverBounds();
  const maxTop = Math.max(minTop, bottomLimit - height);
  return Math.min(maxTop, Math.max(minTop, anchor.top - REACTION_STRIP_HEIGHT - POPOVER_GAP));
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
  const popoverColumnRef = useRef<HTMLDivElement>(null);
  /** The popover's `top` re-derived from its rendered height; null until it has been measured. */
  const [popoverTop, setPopoverTop] = useState<number | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  /** Briefly ringed after jumping to it from a reply quote, so the eye lands on the right bubble. */
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  /** Server-provided reason the last photo upload failed, shown above the composer. */
  const [imageError, setImageError] = useState<string | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [emojiPickerForId, setEmojiPickerForId] = useState<number | null>(null);
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
  const expandedImageDragY = useMotionValue(0);
  const expandedImageDragScale = useTransform(expandedImageDragY, [-250, 0, 250], [0.85, 1, 0.85]);
  const expandedImageBackdrop = useTransform(
    expandedImageDragY,
    [-420, -160, 0, 160, 420],
    ['rgba(0,0,0,.3)', 'rgba(0,0,0,.68)', 'rgba(0,0,0,.94)', 'rgba(0,0,0,.68)', 'rgba(0,0,0,.3)'],
  );
  useEffect(() => {
    expandedImageDragY.set(0);
  }, [expandedImage?.src, expandedImageDragY]);
  // Leaving a thread with a left-edge swipe, the way Messages and Snapchat do — same destination
  // as the header's back button. Suspended while a full-screen layer (photo viewer, message
  // popover, paywall) is up, since those own the whole screen and dismiss themselves.
  useSwipeBack(() => navigate('/chat'), !expandedImage && popoverMessageId === null && !showPaywall);
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
  // The thread's shared wallpaper. Server-owned — everyone in the thread sees the same one — but
  // seeded from the device's last-seen copy so it paints with the first frame instead of flashing
  // the plain background while the fetch lands.
  const [background, setBackground] = useState<string | null>(() =>
    getCachedChatBackground(currentUser?.name ?? '', thread),
  );

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

  // The initial state ran before the session restored and only had the device's cached copy, so
  // re-read the cache once the member name is known and then reconcile against the server, which
  // is what makes a housemate's change show up here.
  const refreshBackground = async () => {
    if (!name) return;
    setBackground(getCachedChatBackground(name, thread));
    try {
      setBackground(await fetchChatBackground(name, thread));
    } catch {
      // Offline or the request failed — keep showing the cached wallpaper rather than blanking it.
    }
  };

  useRealtimeEvent(
    (event) => {
      if (!name) return;
      if (
        ['MESSAGE_CREATED', 'MESSAGE_REACTION_UPDATED', 'MESSAGE_POLL_UPDATED', 'MESSAGE_PINNED', 'MESSAGE_UPDATED', 'MESSAGE_DELETED'].includes(
          event.type,
        )
      ) {
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
      if (event.type === 'CHAT_BACKGROUND_UPDATED') {
        // The payload carries the thread's participants (empty for the household thread) rather
        // than the server's opaque thread key, so this page can tell whether the change was to the
        // thread it has open without reimplementing the key format.
        const { participants = [] } = (event.payload ?? {}) as { participants?: string[] };
        const isThisThread = thread === null
          ? participants.length === 0
          : participants.includes(name) && participants.includes(thread);
        if (isThisThread) void refreshBackground();
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

  useEffect(() => {
    void refreshBackground();
    // `thread` is fixed for this mount (see the route keying above), so member identity is the
    // only thing that can change under us here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // The composer's bottom padding grows into the keyboard's space over the keyboard's own
  // animation (see .safe-bottom in globals.css), which shrinks this list frame by frame. A
  // scroller sitting at the bottom does not stay there when its height changes — scrollTop is left
  // where it was while its maximum grows — so the newest message would sink behind the composer as
  // it rises. Re-pinning every frame for the length of the animation makes the whole transcript
  // ride up with the keyboard, which is the half of the iMessage feel that isn't just timing.
  // Skipped when the reader has scrolled up into history, so they keep their place.
  useEffect(() => {
    return onKeyboardInset(({ durationMs }) => {
      const list = scrollContainerRef.current;
      if (!list) return;
      // Measured here rather than read off nearBottomRef: that ref is only refreshed by the
      // scroll event, which has not fired yet for the jump-to-bottom the composer's own onFocus
      // just did — so it would still say "scrolled up" on the very tap that opens the keyboard.
      if (list.scrollHeight - list.scrollTop - list.clientHeight >= 150) return;
      const until = performance.now() + durationMs + 60;
      const pin = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        if (performance.now() < until) window.requestAnimationFrame(pin);
      };
      window.requestAnimationFrame(pin);
    });
  }, []);

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

  // Images use the same optimistic path as text: the local preview is already visible while the
  // resize, moderation and upload happen in the background. The local File/URL stays attached to
  // a failed bubble so Retry can resend without asking the user to pick the photo again.
  const deliverImage = async (tempId: number, file: File, caption: string, localImageUrl: string) => {
    try {
      const prepared = await prepareImageForUpload(file);
      const form = new FormData();
      form.append('image', prepared);
      if (caption) form.append('caption', caption);
      const saved = await api.postForm<ChatMessage>('/chat/images', form);
      clientIdByServerIdRef.current.set(saved.id, tempId);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
      void fetchMessages();
      URL.revokeObjectURL(localImageUrl);
    } catch (error) {
      setImageError(getUserMessage(error, t('chat.imageSendFailed')));
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    } finally {
      setSendingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /** Persists an edit to an existing message instead of sending a new one — routed here from
   *  `sendMessage` whenever `editingMessageId` is set, so the composer's Enter key and send
   *  button don't need their own edit-aware branch. */
  const saveEditedMessage = async () => {
    const id = editingMessageId;
    const text = input.trim();
    if (id == null || !text) return;
    if (messageInputRef.current) messageInputRef.current.style.height = 'auto';
    setInput('');
    setEditingMessageId(null);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text, edited: true } : m)));
    try {
      const updated = await api.patch<ChatMessage>(`/chat/messages/${id}`, { text });
      applyIncomingMessage(updated);
    } catch {
      fetchMessages();
    }
  };

  const sendMessage = async () => {
    if (editingMessageId != null) {
      await saveEditedMessage();
      return;
    }
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
   *  input state — used by the meeting-topic menu's "post to chat" action and by the check-in
   *  summary's "discuss this issue" rows. */
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

  /** Picks one issue out of the weekly check-in and drops it into the thread as a discussion
   *  starter — the same shape MeetingTopicMenu posts, so the ordinary reply affordance carries the
   *  conversation from there. The summary collapses on the way out so the new message is in view. */
  const discussCheckinIssue = (response: CheckinResponse) => {
    const issue = response.issue?.trim();
    if (!issue) return;
    tapFeedback();
    postFormattedMessage(
      t('checkin.discussMessage', { author: response.author ?? t('checkin.anonymousAuthor'), issue }),
    );
    setCheckinExpanded(false);
    setHeaderExpanded(false);
  };

  const retryMessage = (message: LocalChatMessage) => {
    if (message.status !== 'failed') return;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'sending' } : m)));
    if (message.localImageFile && message.localImageUrl) {
      setImageError(null);
      setSendingImage(true);
      void deliverImage(message.id, message.localImageFile, message.text, message.localImageUrl);
      return;
    }
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
    setPopoverTop(null);
  };

  /** Re-places the popover once it has actually rendered. `computePopoverPlacement` can only
   *  estimate the column's height (the preview is a live MessageBubble whose content — quote chip,
   *  sender name, wrapped text, image — the placement math cannot know), and when that estimate ran
   *  short the action list slid under the composer or the keyboard. Measuring the real box and
   *  re-clamping in a layout effect fixes it before the browser paints, so there is no jump. */
  const repositionPopover = useCallback(() => {
    const column = popoverColumnRef.current;
    if (!popoverAnchor || !column) return;
    // offsetHeight, not getBoundingClientRect(): the entrance variant is mid-`scale(0.94)` on the
    // first pass and a bounding rect would report 94% of the real height.
    const height = column.offsetHeight;
    setPopoverTop((current) => {
      const next = clampPopoverTop(popoverAnchor, height);
      // Sub-pixel churn would otherwise re-render on every measure.
      return current != null && Math.abs(current - next) < 0.5 ? current : next;
    });
  }, [popoverAnchor]);

  useLayoutEffect(() => { repositionPopover(); }, [popoverMessageId, repositionPopover]);

  /** Opening the menu dismisses the keyboard (see `openMessageActions`), but the composer rides it
   *  down over the platform's own animation, so the band this menu may occupy is still the small
   *  keyboard-up one at the moment it first lays out. Re-place it once the composer has landed. */
  useEffect(() => {
    if (popoverMessageId == null) return;
    let timer = 0;
    const unsubscribe = onKeyboardInset(({ durationMs }) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(repositionPopover, durationMs + 30);
    });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [popoverMessageId, repositionPopover]);

  const openMessageActions = (messageId: number, element: HTMLElement) => {
    if (isSystemThread) return;
    const message = messageById.get(messageId);
    if (!message || message.deleted) return;
    // Give the keyboard back, the way iOS does when a message's context menu takes over the screen.
    // It is not just tidiness: with the keyboard up there are only ~330pt between the header and the
    // composer on a 844pt phone, and a six-row menu does not fit in that. Any typed draft is kept.
    messageInputRef.current?.blur();
    const rect = element.getBoundingClientRect();
    setPopoverAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right });
    setPopoverMessageId(messageId);
    void tapFeedback();
  };

  const startMessagePress = (messageId: number, event: React.PointerEvent<HTMLElement>) => {
    // The automated-notice thread is fully read-only — nothing to reply to or react to there.
    if (isSystemThread) return;
    // A deleted message has nothing left to react to, copy, pin or edit.
    if (messageById.get(messageId)?.deleted) return;
    // Buttons (poll options, retry) keep their own tap. Images deliberately do NOT bail out any
    // more: excluding them meant WebKit's native callout owned the gesture, leaving image
    // messages with no reply/react/pin at all. `longPressFiredRef` below stops the image's
    // tap-to-expand from also firing once the hold has opened the overlay.
    if ((event.target as HTMLElement).closest('button')) return;
    longPressFiredRef.current = false;
    clearLongPress();
    // Captured now (not re-derived from the event later, which isn't safe once the handler
    // returns) so the popover can measure its on-screen position when the timer actually fires.
    // The handlers sit on the bubble (so the reactions row and quote chip keep their own taps), but
    // the popover is anchored to the whole message ROW — the bubble alone excludes the sender name,
    // the quoted-reply chip and the reactions, all of which the lifted preview does render.
    const bubbleEl = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-message-id]')
      ?? (event.currentTarget as HTMLElement);
    longPressRef.current = {
      timer: window.setTimeout(() => {
        longPressRef.current.timer = null;
        longPressFiredRef.current = true;
        // Measured now, not at press-start — the message may have scrolled during the 450ms hold.
        openMessageActions(messageId, bubbleEl);
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
    setEditingMessageId(null);
    closePopover();
    // Opening the menu dismissed the keyboard; a reply is the one action that wants it straight
    // back, so hand it over rather than making the user tap the composer again. Same as edit.
    requestAnimationFrame(() => messageInputRef.current?.focus());
  };

  /** Seeds the composer with the message's own text and switches `sendMessage` (via
   *  `editingMessageId`) into "save" mode instead of "send a new message" mode. */
  const startEditMessage = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setInput(message.text);
    setReplyingToId(null);
    closePopover();
    requestAnimationFrame(() => messageInputRef.current?.focus());
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setInput('');
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
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message.text);
      } else {
        const helper = document.createElement('textarea');
        helper.value = message.text;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        helper.remove();
      }
      void tapFeedback();
      setCopiedMessageId(message.id);
      window.setTimeout(() => {
        setCopiedMessageId(null);
        closePopover();
      }, 900);
    } catch {
      // Some WebViews expose neither async clipboard nor execCommand. Keep the menu open so the
      // user can still use the system selection/share affordance instead of losing the action.
    }
  };

  /** Opens the native share sheet when available; on iOS that exposes "Save Image" to Photos. */
  const saveImageToDevice = async (image: { src: string; alt: string }) => {
    try {
      const response = await fetch(image.src);
      const blob = await response.blob();
      const extension = blob.type.split('/')[1] || 'jpg';
      const file = new File([blob], `kollekt-image-${Date.now()}.${extension}`, { type: blob.type || 'image/jpeg' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: image.alt });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
      void tapFeedback();
    } catch {
      // Sharing can be cancelled from the system sheet; that is not an app error.
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

  const deleteMessage = async (messageId: number) => {
    closePopover();
    void tapFeedback();
    try {
      const updated = await api.delete<ChatMessage>(`/chat/messages/${messageId}`);
      applyIncomingMessage(updated);
    } catch {
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
    const previousReactions = msg?.reactions ?? [];
    const optimisticReactions = alreadyReacted
      ? previousReactions
          .map((reaction) => reaction.emoji === emoji
            ? { ...reaction, users: reaction.users.filter((user) => user !== name) }
            : reaction)
          .filter((reaction) => reaction.users.length > 0)
      : existing
        ? previousReactions.map((reaction) => reaction.emoji === emoji
          ? { ...reaction, users: [...reaction.users, name] }
          : reaction)
        : [...previousReactions, { emoji, users: [name] }];

    // Tapback should feel instant on a photo or text bubble; reconcile with the server in the
    // background and restore the old chip if the request fails.
    setMessages((prev) => prev.map((message) => message.id === messageId ? { ...message, reactions: optimisticReactions } : message));
    void tapFeedback();
    try {
      if (alreadyReacted) {
        await api.delete(`/chat/messages/${messageId}/reactions`, { emoji });
      } else {
        await api.post(`/chat/messages/${messageId}/reactions`, { emoji });
      }
      void fetchMessages();
    } catch {
      setMessages((prev) => prev.map((message) => message.id === messageId ? { ...message, reactions: previousReactions } : message));
    }
  };

  const handlePickImage = async () => {
    if (nativeCameraAvailable()) {
      try {
        const file = await capturePhotoFile();
        if (file) await sendImage(file);
      } catch (error) {
        setImageError(getUserMessage(error, t('chat.imageSendFailed')));
      }
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
  const sendImage = (file: File) => {
    const caption = input.trim();
    const localImageUrl = URL.createObjectURL(file);
    const tempId = -Date.now();
    setImageError(null);
    setInput('');
    setMention(null);
    setMessages((prev) => [...prev, {
      id: tempId,
      sender: name,
      recipient: thread ?? null,
      text: caption,
      imageData: null,
      imageMimeType: file.type || 'image/jpeg',
      imageFileName: file.name,
      timestamp: new Date().toISOString(),
      reactions: [],
      status: 'sending',
      localImageUrl,
      localImageFile: file,
    }]);
    setSendingImage(true);
    void deliverImage(tempId, file, caption, localImageUrl);
  };

  const applyBackgroundFile = async (file: File) => {
    // Everyone in the thread gets this wallpaper — the server publishes the change and their open
    // threads refetch. A null result means the upload was rejected (moderation, bad format), in
    // which case the thread keeps the wallpaper it already had.
    const saved = await saveChatBackground(name, thread, file);
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
    setBackground(null);
    void clearChatBackground(name, thread);
  };

  if (loading) {
    wasLoadingRef.current = true;
    return (
      <div className="app-thread-screen relative flex flex-col">
        <div className="skeleton h-[3.75rem] animate-pulse rounded-none border-b border-border" />
        <div className="min-h-0 flex-1 space-y-3 px-4 py-4 sm:px-6">
          {[70, 45, 60, 35].map((width, i) => (
            <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
              <div className="h-9 skeleton animate-pulse rounded-2xl" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
        <div className="h-12 skeleton animate-pulse rounded-full" />
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
        data-chat-header
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
                  <p className="text-[11px] text-muted-foreground">{t('checkin.progress', { count: checkinSummary.responseCount, total: checkinSummary.memberCount })}</p>
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
                      <p className="text-[11px] text-muted-foreground">{t('checkin.discussHint')}</p>
                      {checkinSummary.responses.map((response) => (
                        <div key={response.id} className="rounded-xl bg-card p-3 text-xs">
                          <p className="font-bold">{response.author ?? t('checkin.anonymousAuthor')} · {response.mood}/5</p>
                          {/* The issue is the one line people act on, so it is a 44px-tall button that
                              posts it into the thread; the improvement stays plain text. */}
                          {response.issue?.trim() ? (
                            <button
                              type="button"
                              onClick={() => discussCheckinIssue(response)}
                              aria-label={t('checkin.discussIssue')}
                              className="pressable-tight mt-1 flex min-h-[44px] w-full items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-left"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="text-muted-foreground">{t('checkin.issueLabel')}:</span> {response.issue}
                              </span>
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-ink-foreground">
                                <Send className="h-3.5 w-3.5" />
                              </span>
                            </button>
                          ) : (
                            <p className="mt-1"><span className="text-muted-foreground">{t('checkin.issueLabel')}:</span> {response.issue}</p>
                          )}
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
                <span className="block text-[11px] font-bold uppercase tracking-[.1em] text-muted-foreground">
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
                  <span className="rounded-full bg-foreground/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.1em] text-muted-foreground backdrop-blur-sm">
                    {formatDayDivider(message.timestamp)}
                  </span>
                </div>
              )}
              {startsUnread && (
                <div className="flex justify-center py-3">
                  <span className="rounded-full bg-foreground px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.14em] text-background">
                    {t('chat.newDivider')}
                  </span>
                </div>
              )}
            <motion.div
              /* Only the newest few messages animate in. The thread is refetched in full on every
                 websocket event, so animating every bubble would replay the whole conversation each
                 time someone sends one. `i` counts from the end for exactly that reason. */
              initial={isRecent ? { opacity: 0, y: 7, scale: 0.985 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={springSoft}
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
        <div className="safe-bottom relative z-10 px-4 pb-2 sm:px-6">
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
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{t('kudos.typeLabel')}</p>
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
              {/* Same opt-out as the composer below: these forms sit in the thread's flex column,
                  which already reflows above the keyboard, so the generic centre-the-field assist
                  would only fight the message list's own pinning. */}
              <input data-keyboard-scroll-assist="off" value={kudosContext} onChange={(event) => setKudosContext(event.target.value)} maxLength={500} placeholder={t('kudos.contextPlaceholder')} className="w-full rounded-lg bg-muted/50 px-3 py-2 text-xs" />
              <button onClick={() => void sendKudos()} disabled={!kudosReceiver} className="w-full rounded-lg bg-ink py-2 text-xs font-bold text-ink-foreground disabled:opacity-50">{t('kudos.send')}</button>
              <p className="text-[11px] text-muted-foreground">{t('kudos.privateNote')}</p>
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
              <p className="text-[11px] font-semibold text-muted-foreground">{t('laundry.typeLabel')}</p>
              <div className="flex flex-wrap gap-3">
                {LAUNDRY_TYPES.map((type) => (
                  <button key={type} onClick={() => setLaundryType(type)}
                    className={`btn-sm font-medium transition-colors ${laundryType === type ? 'bg-ink text-ink-foreground' : 'bg-muted/60 text-muted-foreground'}`}>
                    {t(`laundry.types.${type}`)}
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground">{t('laundry.tempLabel')}</p>
              <div className="flex flex-wrap gap-3">
                {LAUNDRY_TEMPS.map((temp) => (
                  <button key={temp} onClick={() => setLaundryTemp(temp)}
                    className={`btn-sm font-medium transition-colors ${laundryTemp === temp ? 'bg-ink text-ink-foreground' : 'bg-muted/60 text-muted-foreground'}`}>
                    {temp}°C
                  </button>
                ))}
              </div>
              <button onClick={() => void sendLaundry()} className="btn-pine w-full">{t('laundry.send')}</button>
            </AddSheet>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPollForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative z-10 overflow-hidden">
            <AddSheet title={t('chat.createPoll')} onClose={() => setShowPollForm(false)} className="mb-2 p-3">
              {/* data-keyboard-scroll-assist="off" for the same reason as the kudos field above. */}
              <input data-keyboard-scroll-assist="off" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)}
                placeholder={t('chat.pollQuestionPlaceholder')}
                className="w-full bg-muted/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              {pollOptions.map((opt, i) => (
                <input key={i} data-keyboard-scroll-assist="off" value={opt}
                  onChange={(e) => setPollOptions((prev) => prev.map((o, j) => j === i ? e.target.value : o))}
                  placeholder={t('chat.pollOption', { index: i + 1 })}
                  className="w-full bg-muted/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              ))}
              <div className="flex gap-2">
                <button onClick={() => setPollOptions((p) => [...p, ''])} className="pressable-tight text-xs text-primary font-medium">
                  {t('chat.addOption')}
                </button>
                <button onClick={sendPoll} className="btn-sm !rounded-lg ml-auto gradient-primary font-semibold text-ink-foreground">
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

      <AnimatePresence initial={false}>
        {editingMessageId != null && (
          <motion.div
            variants={collapseVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="relative z-10 mb-2 overflow-hidden px-4 sm:px-6"
          >
            <div className="glass elev-1 flex items-start gap-2 overflow-hidden rounded-lg border-l-2 border-l-primary py-2 pl-2.5 pr-2">
              <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 text-xs font-semibold text-foreground">{t('chat.editingMessage')}</p>
              <button onClick={cancelEditMessage} className="pressable-tight shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label={t('chat.cancelEdit')}>
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
              <span className="text-[11px] font-medium text-muted-foreground">
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
              <span className="text-[11px] font-medium text-muted-foreground">GIF</span>
            </button>
            {!isDirect && (
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowPollForm((v) => !v); setShowActionBar(false); }} className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60" aria-label={t('chat.togglePollForm')}>
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground">{t('chat.createPoll')}</span>
              </button>
            )}
            {!isDirect && (
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowLaundryForm((v) => !v); setShowActionBar(false); }} className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60" aria-label={t('laundry.title')}>
                <WashingMachine className="h-5 w-5 text-accent" />
                <span className="text-[11px] font-medium text-muted-foreground">{t('laundry.title')}</span>
              </button>
            )}
            {!isDirect && (
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowKudosForm((v) => !v); setShowActionBar(false); }} className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60" aria-label={t('kudos.sendTitle')}>
                <HeartHandshake className="h-5 w-5 text-primary" />
                <span className="text-[11px] font-medium text-muted-foreground">{t('kudos.sendTitle')}</span>
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
              aria-label={t('chat.background.changeShared')}
            >
              {isUnlocked ? <Wallpaper className="h-5 w-5 text-muted-foreground" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
              <span className="text-[11px] font-medium text-muted-foreground">{t('chat.background.label')}</span>
            </button>
            {background && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setShowActionBar(false); handleClearBackground(); }}
                className="flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 hover:bg-muted/60"
                aria-label={t('chat.background.removeShared')}
              >
                <X className="h-5 w-5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground">{t('chat.background.remove')}</span>
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
            onPointerDown={(event) => {
              // Focus during the user's tap, before WebKit has a chance to defer the keyboard
              // while the thread is re-rendering. This keeps the composer feeling native on iOS.
              if (document.activeElement !== event.currentTarget) {
                event.currentTarget.focus({ preventScroll: true });
              }
            }}
            onFocus={() => {
              // Guarded: an unconditional setState here re-rendered the whole thread on the exact
              // frame the keyboard starts animating, which is the frame that can least afford it.
              if (showActionBar) setShowActionBar(false);
              // Do not call scrollIntoView here: on iOS it can scroll the page ancestor while the
              // keyboard is animating, which makes the composer arrive a beat after the keyboard.
              // Scrolling the chat list directly keeps the composer and native keyboard in lockstep;
              // the keyboard-inset effect above then holds it there for the rest of the animation.
              const list = scrollContainerRef.current;
              if (list) list.scrollTop = list.scrollHeight;
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
            inputMode="text"
            enterKeyHint="send"
            className="font-ios input input-sm min-w-36 flex-1 resize-none self-center rounded-full bg-muted leading-snug"
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
          (Reply / Copy / Pin / Edit / Delete) below — the same lifted-preview shape iOS uses, and
          now the same for text, image and poll messages. */}
      <AnimatePresence>
        {popoverMessage && popoverAnchor && (() => {
          const canCopy = popoverMessage.text.trim().length > 0;
          const popoverIsSelf = popoverMessage.sender === name;
          const canEdit = popoverIsSelf && !popoverMessage.imageData && !popoverMessage.poll;
          const canDelete = popoverIsSelf;
          const actionRowCount = 1 + (canCopy ? 1 : 0) + (popoverMessage.imageData ? 1 : 0) + (!isDirect ? 1 : 0) + (canEdit ? 1 : 0) + (canDelete ? 1 : 0);
          const placement = computePopoverPlacement(popoverAnchor, actionRowCount);
          return (
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              data-swipe-block
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-md"
              onClick={closePopover}
            >
              <motion.div
                variants={dialogVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                ref={popoverColumnRef}
                className={`flex flex-col ${popoverIsSelf ? 'items-end' : 'items-start'}`}
                style={{ position: 'fixed', top: popoverTop ?? placement.top, left: placement.left, width: placement.width }}
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
                {/* Clipping and scaling are deliberately on two different elements, and the
                    max-height is a cap rather than the pressed bubble's own height. It used to be
                    both at once, on one element, clamped to `anchor.bottom - anchor.top` — i.e. to
                    the `.bub`, while the preview also renders a sender name, a forced timestamp and
                    (for replies) the quoted chip that lives outside that bubble. Measured in the
                    harness, that sliced 20px off a plain message and 62px off a reply. */}
                {/* The padding is the room the 3% growth (and the shadow) expands into — it has to
                    be on the clipping box, not inside the scaled one: the scaled element is as wide
                    as its container, so its own padding cannot stop it from outgrowing it. The
                    negative margin gives that padding back, so the preview still lines up with the
                    real message rather than sitting 8px inboard of it. */}
                <div
                  className="-mx-2 mb-2 w-[calc(100%+1rem)] overflow-y-auto px-2 py-1.5 scrollbar-none"
                  style={{ maxHeight: placement.previewCap }}
                >
                  <motion.div
                    initial={{ scale: 1 }}
                    animate={{ scale: 1.03 }}
                    transition={springPop}
                    className="origin-center drop-shadow-2xl"
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
                </div>

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
                  {popoverMessage.imageData && (
                    <button
                      onClick={() => void saveImageToDevice({
                        src: `data:${popoverMessage.imageMimeType};base64,${popoverMessage.imageData}`,
                        alt: popoverMessage.imageFileName ?? t('chat.imageAlt'),
                      })}
                      className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-semibold hover:bg-muted/60"
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                      {t('chat.saveImage')}
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
                  {canEdit && (
                    <button
                      onClick={() => startEditMessage(popoverMessage)}
                      className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-semibold hover:bg-muted/60"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                      {t('chat.editMessage')}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => void deleteMessage(popoverMessage.id)}
                      className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-semibold text-destructive hover:bg-muted/60"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      {t('chat.deleteMessage')}
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
            /* A column, not a centred box: the safe areas and the button row are subtracted as real
               layout, so what is left over IS the photo's box. The old version centred the image in
               the whole screen and capped it at a guessed 90dvh — which left ~42pt of slack against
               a 47-59pt notch inset, so the top of a portrait photo sat under the status bar with
               the buttons floating on top of the picture. */
            data-swipe-block
            className="absolute inset-0 z-50 flex flex-col overflow-hidden"
            style={{
              backgroundColor: expandedImageBackdrop,
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            onClick={() => setExpandedImage(null)}
          >
            <div className="relative z-10 flex h-14 shrink-0 items-center justify-between px-4">
              <button
                className="pressable-tight grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                onClick={() => void saveImageToDevice(expandedImage)}
                aria-label={t('chat.saveImage')}
              >
                <Download className="h-5 w-5 text-white" />
              </button>
              <button
                className="pressable-tight grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                onClick={() => setExpandedImage(null)}
                aria-label={t('chat.closeImage')}
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.82}
              dragMomentum={false}
              style={{ y: expandedImageDragY, scale: expandedImageDragScale }}
              /* min-h-0 is load-bearing: without it this flex item refuses to shrink below its
                 content and the photo overflows the screen again. */
              className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2 touch-pan-x"
              onClick={(event) => event.stopPropagation()}
              onDragEnd={(_, info) => {
                // Snapchat closes an opened Snap on a downward swipe; upward pulls simply spring
                // back to the full-screen viewer.
                if (info.offset.y > 120 || info.velocity.y > 600) {
                  setExpandedImage(null);
                }
              }}
            >
              <img
                src={expandedImage.src}
                alt={expandedImage.alt}
                className="max-h-full max-w-full select-none rounded-[1.5rem] object-contain"
                draggable={false}
              />
            </motion.div>
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
