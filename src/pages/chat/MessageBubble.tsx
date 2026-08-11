import type { PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { popIn, pressable, springPop } from '../../lib/motion';
import type { ChatMessage } from '../../lib/types';

export type LocalChatMessage = ChatMessage & { status?: 'sending' | 'failed' };

interface MessageBubbleProps {
  message: LocalChatMessage;
  /** The message this one replies to, already resolved by the thread. */
  replyTarget?: LocalChatMessage;
  isSelf: boolean;
  isFirstOfGroup: boolean;
  isLastOfGroup: boolean;
  /** The sender's assigned colour, used for the name label and the bubble's leading edge. */
  senderColor: string;
  /** Viewer's own member name — decides which side the quoted bubble sits on. */
  currentUserName: string;
  /**
   * `preview` is the clone lifted into the long-press overlay: same bubble, no interaction, no
   * reactions row (the overlay renders its own reaction strip above it).
   */
  variant?: 'thread' | 'preview';
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp?: () => void;
  onExpandImage?: (image: { src: string; alt: string }) => void;
  onVotePoll?: (messageId: number, optionId: number) => void;
  onRetry?: (message: LocalChatMessage) => void;
  onToggleReaction?: (messageId: number, emoji: string) => void;
  /** Scroll the quoted original back into view, the way tapping a quote does in iOS Messages. */
  onJumpToMessage?: (messageId: number) => void;
  /** The thread's own locale-aware formatter, so bubble timestamps stay in one place. */
  formatTimestamp: (value: string) => string;
}

/**
 * One message in the thread: optional sender name, optional quoted reply, the bubble itself
 * (text / image / poll / send state) and the reactions row.
 *
 * Lives in its own component so the long-press overlay can render a pixel-identical clone of the
 * pressed message as its lifted preview card — the overlay used to dim the real bubble in place
 * for text while iOS's native callout took over for images, which is why the two looked nothing
 * alike.
 */
export default function MessageBubble({
  message,
  replyTarget,
  isSelf,
  isFirstOfGroup,
  isLastOfGroup,
  senderColor,
  currentUserName,
  variant = 'thread',
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onExpandImage,
  onVotePoll,
  onRetry,
  onToggleReaction,
  onJumpToMessage,
  formatTimestamp,
}: MessageBubbleProps) {
  const { t } = useTranslation();
  const isPreview = variant === 'preview';
  const imageSrc = message.imageData ? `data:${message.imageMimeType};base64,${message.imageData}` : null;
  const imageAlt = message.imageFileName ?? t('chat.imageAlt');

  const bubbleTone = isSelf
    ? `bg-secondary text-white ${isLastOfGroup ? 'bub-tail-self' : ''}`
    : `border border-border bg-white text-black dark:bg-neutral-700 dark:text-white ${isLastOfGroup ? 'bub-tail-other' : ''}`;

  return (
    <div className={`flex w-full flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
      {replyTarget && (
        <QuotedMessage
          target={replyTarget}
          replyIsSelf={isSelf}
          currentUserName={currentUserName}
          onJump={isPreview ? undefined : onJumpToMessage}
        />
      )}

      <div className={`flex w-full ${isSelf ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[78%] space-y-1">
          {/* The quote above already names its author; repeating it directly underneath when the
              reply is from that same person just reads as a stutter. */}
          {!isSelf && isFirstOfGroup && replyTarget?.sender !== message.sender && (
            <p className="font-ios px-1 text-xs font-bold" style={{ color: senderColor }}>
              {message.sender}
            </p>
          )}

          {/* The tail is the *last* bubble of a run: mid-run bubbles stay fully round on both
              bottom corners so a run reads as one continuous shape. */}
          <motion.div
            whileTap={isPreview ? undefined : { scale: 0.985 }}
            transition={springPop}
            className={`elev-1 select-none bub ${bubbleTone}`}
            style={!isSelf ? { borderLeftColor: senderColor, borderLeftWidth: 3 } : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {message.deleted && (
              <p className={`font-ios text-[15px] italic leading-relaxed ${isSelf ? 'text-white/70' : 'text-muted-foreground'}`}>
                {t('chat.messageDeleted')}
              </p>
            )}

            {!message.deleted && message.text && !message.poll && (
              <p className={`font-ios text-[15px] leading-relaxed ${isSelf ? 'text-white' : 'text-black dark:text-white'}`}>
                {message.text}
              </p>
            )}

            {!message.deleted && imageSrc && (
              <img
                src={imageSrc}
                alt={imageAlt}
                /* chat-media suppresses WebKit's own long-press callout, which used to hijack
                   every image and leave them with no reply/react/pin at all. */
                className={`chat-media mt-1 max-h-56 rounded-xl object-cover ${isPreview ? '' : 'cursor-zoom-in'}`}
                onClick={(event) => {
                  if (isPreview) return;
                  event.stopPropagation();
                  onExpandImage?.({ src: imageSrc, alt: imageAlt });
                }}
              />
            )}

            {!message.deleted && message.poll && (
              <div className="mt-1 space-y-2.5">
                <p className="flex items-center gap-1.5 font-display text-base font-bold">
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  {message.poll.question}
                </p>
                {message.poll.options.map((opt) => {
                  const total = message.poll!.options.reduce((sum, o) => sum + o.users.length, 0);
                  const votes = opt.users.length;
                  const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                  const voted = opt.users.includes(currentUserName);
                  return (
                    <button
                      key={opt.id}
                      disabled={isPreview}
                      onClick={() => onVotePoll?.(message.id, opt.id)}
                      className={`relative w-full overflow-hidden rounded-xl p-2.5 text-left text-sm font-semibold ${
                        voted ? 'border border-accent/50 bg-accent/30' : isSelf ? 'bg-background/20' : 'bg-muted/70'
                      }`}
                    >
                      <div className="absolute inset-y-0 left-0 bg-accent/25 transition-all" style={{ width: `${pct}%` }} />
                      <span className="relative flex justify-between gap-2">
                        <span>{opt.text}</span>
                        <span>{votes}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {isLastOfGroup && message.status === 'failed' && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onRetry?.(message);
                }}
                className="mt-1 text-[9px] font-semibold text-destructive underline decoration-dotted"
              >
                {t('chat.sendFailedRetry')}
              </button>
            )}
            {isLastOfGroup && message.status !== 'failed' && (
              <p className={`font-ios text-[11px] mt-1 ${isSelf ? 'text-white/70' : 'text-muted-foreground'}`}>
                {message.status === 'sending' ? t('chat.sending') : formatTimestamp(message.timestamp)}
                {!message.deleted && message.edited && ` · ${t('chat.edited')}`}
              </p>
            )}
          </motion.div>

          {!isPreview && !message.deleted && message.reactions.length > 0 && (
            <div className={`px-1 flex gap-1 flex-wrap ${isSelf ? 'justify-end' : 'justify-start'}`}>
              <AnimatePresence initial={false}>
                {message.reactions.map((r) => {
                  const reacted = r.users.includes(currentUserName);
                  return (
                    <motion.button
                      key={r.emoji}
                      layout
                      variants={popIn}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      {...pressable}
                      onClick={() => onToggleReaction?.(message.id, r.emoji)}
                      className={`elev-1 pressable-tight flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
                        reacted ? 'border-primary/40 bg-primary/20' : 'border-border bg-card'
                      }`}
                    >
                      <span className="text-sm leading-none">{r.emoji}</span>
                      {r.users.length}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The quoted original above a reply, as iOS Messages draws it: a smaller, faded copy of the real
 * bubble aligned to *its own* author's side (not the replier's), with a short curved connector
 * hooking down toward the reply below. Replaces the bordered grey rectangle this used to be.
 */
function QuotedMessage({
  target,
  replyIsSelf,
  currentUserName,
  onJump,
}: {
  target: LocalChatMessage;
  replyIsSelf: boolean;
  currentUserName: string;
  onJump?: (messageId: number) => void;
}) {
  const { t } = useTranslation();
  const quoteIsSelf = target.sender === currentUserName;
  const thumbSrc = target.imageData ? `data:${target.imageMimeType};base64,${target.imageData}` : null;
  const previewText = target.deleted ? t('chat.messageDeleted') : target.poll?.question || target.text || t('chat.imageAlt');

  return (
    <div className={`flex w-full flex-col ${quoteIsSelf ? 'items-end' : 'items-start'}`}>
      <button
        type="button"
        disabled={!onJump}
        onClick={() => onJump?.(target.id)}
        className="max-w-[70%] text-left opacity-60 disabled:opacity-60"
        aria-label={t('chat.replyingTo', { name: target.sender })}
      >
        <span className="block truncate px-2 text-[10px] font-semibold text-muted-foreground">{target.sender}</span>
        <span
          className={`bub-quote mt-0.5 flex items-center gap-1.5 ${
            quoteIsSelf ? 'bg-secondary/70 text-white' : 'border border-border bg-muted text-foreground'
          }`}
        >
          {thumbSrc && <img src={thumbSrc} alt="" className="chat-media h-6 w-6 shrink-0 rounded-md object-cover" />}
          <span className="font-ios truncate text-[13px] leading-snug">{previewText}</span>
        </span>
      </button>
      {/* Down-then-across hook, mirrored so it always points from the quote toward the reply. */}
      <svg
        viewBox="0 0 24 20"
        aria-hidden="true"
        className={`-mt-px h-4 w-6 shrink-0 text-muted-foreground ${
          quoteIsSelf ? 'mr-5 scale-x-[-1] self-end' : 'ml-5 self-start'
        } ${quoteIsSelf === replyIsSelf ? '' : 'opacity-70'}`}
        fill="none"
      >
        <path d="M4 0v7a9 9 0 0 0 9 9h7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.5" />
      </svg>
    </div>
  );
}
