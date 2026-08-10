import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { backdropVariants, dialogVariants, pressable } from '../../lib/motion';
import { CloseButton } from '../../components/ui-kit';

/** Kept in sync with the backend's `allowedReactionEmojis` in ChatOperations.kt — the server
 *  rejects anything outside that set, so this list must not offer more than it accepts. */
const EMOJI_CATEGORIES: Array<{ labelKey: string; emoji: string[] }> = [
  {
    labelKey: 'chat.emojiPicker.smileys',
    emoji: ['😂', '😅', '😆', '😊', '😍', '🥰', '😘', '😜', '🤪', '🤔', '🙄', '😴', '🤯', '😮', '😢', '😭', '😡', '🥳', '😎', '🤗', '🙃', '😇', '🤩', '😬', '😱', '🥺', '🤨'],
  },
  {
    labelKey: 'chat.emojiPicker.hearts',
    emoji: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💕', '💔', '💯'],
  },
  {
    labelKey: 'chat.emojiPicker.hands',
    emoji: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '👀', '✌️', '🤙', '💪', '🫶', '👋', '🤌'],
  },
  {
    labelKey: 'chat.emojiPicker.other',
    emoji: ['🎉', '🔥', '✅', '❌', '⭐', '💀', '🤷', '🍕', '☕', '🎂', '‼️', '❓'],
  },
];

interface EmojiPickerSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  currentEmoji?: string;
}

/** Full reaction picker behind the reaction strip's grey "more" button — the in-app stand-in for
 *  the OS emoji keyboard, which a web view can't invoke directly for a tapback-style flow. */
export default function EmojiPickerSheet({ open, onClose, onSelect, currentEmoji }: EmojiPickerSheetProps) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
          onClick={onClose}
        >
          <motion.div
            variants={dialogVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={(event) => event.stopPropagation()}
            className="elev-3 glass mb-2 max-h-[70vh] w-full max-w-sm space-y-3 overflow-y-auto rounded-2xl border border-border bg-card/95 p-4 backdrop-blur sm:mb-0"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{t('chat.emojiPicker.title')}</p>
              <CloseButton onClick={onClose} label={t('chat.emojiPicker.title')} />
            </div>
            {EMOJI_CATEGORIES.map((category) => (
              <div key={category.labelKey} className="space-y-1.5">
                <p className="px-1 text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">
                  {t(category.labelKey)}
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {category.emoji.map((emoji) => (
                    <motion.button
                      key={emoji}
                      {...pressable}
                      onClick={() => onSelect(emoji)}
                      aria-label={emoji}
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl ${
                        emoji === currentEmoji ? 'bg-primary/20' : ''
                      }`}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
