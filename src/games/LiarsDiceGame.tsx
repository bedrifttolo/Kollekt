import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { tapFeedback } from '../lib/haptics';

const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const STARTING_COUNTS = Array.from({ length: 10 }, (_, index) => index + 1);

export default function LiarsDiceGame({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [selectedCount, setSelectedCount] = useState(5);
  const [diceCount, setDiceCount] = useState(5);
  const [started, setStarted] = useState(false);
  const [dice, setDice] = useState<number[]>([]);
  const [shaking, setShaking] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    setDiceCount(selectedCount);
    setDice([]);
    setStarted(true);
  };

  const roll = () => {
    if (shaking || diceCount === 0) return;
    setShaking(true);
    setDice([]);
    void tapFeedback();
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => {
      setDice(Array.from({ length: diceCount }, () => 1 + Math.floor(Math.random() * 6)));
      setShaking(false);
      void tapFeedback();
    }, 900);
  };

  const removeDie = () => {
    const next = Math.max(0, diceCount - 1);
    setDiceCount(next);
    setDice([]);
    setConfirmRemove(false);
  };

  const reset = () => {
    setStarted(false);
    setDice([]);
    setShaking(false);
    setConfirmRemove(false);
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background safe-top safe-bottom">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 py-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="btn-ghost !p-3" aria-label={t('common.cancel')}><ArrowLeft className="h-5 w-5" /></button>
          <div><p className="eyebrow">{t('social.games.singlePlayer')}</p><h2 className="font-display text-2xl font-extrabold">{t('social.games.catalog.liarsDice')}</h2></div>
        </div>

        {!started ? (
          <div className="flex flex-1 flex-col justify-center gap-5 py-8">
            <div className="card text-sm leading-relaxed"><p className="font-bold">{t('social.games.rules')}</p><p className="mt-2 text-muted-foreground">{t('social.games.liarsDice.rules')}</p></div>
            <label className="card block"><span className="text-sm font-bold">{t('social.games.liarsDice.chooseDice')}</span><select className="field mt-3 w-full" value={selectedCount} onChange={(event) => setSelectedCount(Number(event.target.value))}>{STARTING_COUNTS.map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
            <button onClick={start} className="btn-lemon w-full">{t('social.games.liarsDice.start', { count: selectedCount })}</button>
          </div>
        ) : diceCount === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <ShieldAlert className="h-16 w-16 text-destructive" />
            <h3 className="mt-5 font-display text-4xl font-extrabold">{t('social.games.liarsDice.out')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t('social.games.liarsDice.outHint')}</p>
            <button onClick={reset} className="btn-pine mt-8 w-full"><RotateCcw className="h-4 w-4" />{t('social.games.playAgain')}</button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-5 py-5">
            <div className="flex items-center justify-between"><span className="pill pill-pine">{t('social.games.liarsDice.diceLeft', { count: diceCount })}</span><button onClick={() => setConfirmRemove(true)} disabled={shaking} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-destructive disabled:opacity-40"><Trash2 className="h-4 w-4" />{t('social.games.liarsDice.remove')}</button></div>

            <button onClick={roll} disabled={shaking} className="flex flex-col items-center py-2" aria-label={t('social.games.liarsDice.shake')}>
              <motion.div
                animate={shaking ? { rotate: [-8, 9, -10, 8, -6, 0], x: [-8, 10, -9, 8, -5, 0], y: [0, -8, 3, -6, 2, 0] } : { rotate: 0, x: 0, y: 0 }}
                transition={{ duration: 0.9 }}
                className="relative h-44 w-48 rounded-t-[2rem] rounded-b-[4.5rem] border-4 border-primary/20 bg-primary shadow-[0_22px_44px_rgba(16,32,25,.28)]"
              >
                <div className="absolute left-1/2 top-5 h-2 w-24 -translate-x-1/2 rounded-full bg-white/20" />
                <div className="absolute inset-x-5 bottom-5 rounded-full bg-black/15 py-2 text-center font-display text-sm font-extrabold uppercase tracking-[.2em] text-primary-foreground">Kollekt</div>
              </motion.div>
              <p className="mt-4 font-bold text-primary">{shaking ? t('social.games.liarsDice.shaking') : t('social.games.liarsDice.shake')}</p>
            </button>

            {dice.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex flex-wrap justify-center gap-2">{dice.map((value, index) => <span key={`${index}-${value}`} className={`grid h-16 w-16 place-items-center rounded-2xl border text-5xl leading-none shadow-sm ${value === 1 ? 'border-secondary bg-secondary/20 text-secondary-foreground' : 'border-border bg-card text-primary'}`}>{DIE_FACES[value - 1]}</span>)}</div>
                <p className="text-center text-xs font-medium text-muted-foreground">{t('social.games.liarsDice.wildHint')}</p>
                <div className="grid grid-cols-5 gap-1.5">{[2, 3, 4, 5, 6].map((face) => <div key={face} className="rounded-xl bg-card p-2 text-center"><p className="text-xs text-muted-foreground">{face}s</p><p className="font-display text-xl font-extrabold">{dice.filter((value) => value === 1 || value === face).length}</p></div>)}</div>
              </motion.div>
            ) : <p className="text-center text-sm text-muted-foreground">{t('social.games.liarsDice.tapCup')}</p>}
          </div>
        )}
      </div>

      <AnimatePresence>
        {confirmRemove && (
          <div className="fixed inset-0 z-[70] grid place-items-center px-6">
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmRemove(false)} className="absolute inset-0 bg-black/50" aria-label={t('common.cancel')} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl">
              <ShieldAlert className="h-10 w-10 text-destructive" /><h3 className="mt-4 font-display text-2xl font-extrabold">{t('social.games.liarsDice.confirmTitle')}</h3><p className="mt-2 text-sm text-muted-foreground">{t('social.games.liarsDice.confirmDescription')}</p>
              <div className="mt-6 grid grid-cols-2 gap-3"><button onClick={() => setConfirmRemove(false)} className="btn-ghost">{t('common.cancel')}</button><button onClick={removeDie} className="btn-pine !bg-destructive !text-destructive-foreground">{t('social.games.liarsDice.confirm')}</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
