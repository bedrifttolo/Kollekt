import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { tapFeedback } from '../lib/haptics';

const DIE_FACE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

export default function DiceGame({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [rolling, setRolling] = useState(false);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    void tapFeedback();
    setRotation((current) => current + 720 + Math.floor(Math.random() * 4) * 360);
    if (rollTimer.current) clearTimeout(rollTimer.current);
    rollTimer.current = setTimeout(() => {
      setValue(1 + Math.floor(Math.random() * 6));
      setRolling(false);
      void tapFeedback();
    }, 850);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background safe-top safe-bottom">
      <div className="flex items-center gap-3 px-5 py-4">
        <button onClick={onClose} className="btn-ghost !p-3" aria-label={t('common.cancel')}><ArrowLeft className="h-5 w-5" /></button>
        <div><p className="eyebrow">{t('social.games.singlePlayer')}</p><h2 className="font-display text-2xl font-extrabold">{t('social.games.catalog.dice')}</h2></div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 pb-20 text-center" style={{ perspective: 900 }}>
        <motion.button
          onClick={roll}
          disabled={rolling}
          animate={{ rotateX: rotation, rotateY: rotation, scale: rolling ? [1, 1.15, 0.95, 1] : 1 }}
          transition={{ duration: 0.85, ease: [0.2, 0.8, 0.2, 1] }}
          className="grid h-44 w-44 place-items-center rounded-[2.25rem] border-4 border-primary/20 bg-card text-primary shadow-[0_24px_60px_rgba(16,32,25,.22)] disabled:cursor-wait"
          aria-label={t('social.games.dice.roll')}
        >
          {(() => {
            const Face = DIE_FACE_ICONS[value - 1];
            return <Face className="h-28 w-28" strokeWidth={1.5} />;
          })()}
        </motion.button>
        <div>
          <p className="font-display text-3xl font-extrabold">{rolling ? t('social.games.dice.rolling') : t('social.games.dice.result', { value })}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('social.games.dice.hint')}</p>
        </div>
        <button onClick={roll} disabled={rolling} className="btn-lemon w-full max-w-xs disabled:opacity-50">{t('social.games.dice.roll')}</button>
      </div>
    </div>
  );
}
