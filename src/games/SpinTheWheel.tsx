import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, RotateCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { tapFeedback } from '../lib/haptics';

const SEGMENT_COLORS = ['#1f563f', '#efc64b', '#7fa7c9', '#b84d6d', '#356d53', '#e99a5c'];

export default function SpinTheWheel({ members, onClose }: { members: string[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<string[]>(() => (members.length ? members : []));
  const [newOption, setNewOption] = useState('');
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const spinTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const seg = options.length > 0 ? 360 / options.length : 360;

  const gradient = useMemo(() => {
    if (options.length === 0) return 'var(--muted)';
    const stops = options
      .map((_, i) => `${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${i * seg}deg ${(i + 1) * seg}deg`)
      .join(', ');
    return `conic-gradient(${stops})`;
  }, [options, seg]);

  const addOption = () => {
    const value = newOption.trim();
    if (!value || options.some((o) => o.toLowerCase() === value.toLowerCase())) return;
    setOptions((p) => [...p, value]);
    setNewOption('');
    setWinner(null);
  };

  const removeOption = (name: string) => {
    setOptions((p) => p.filter((o) => o !== name));
    setWinner(null);
  };

  const spin = () => {
    if (spinning || options.length < 2) return;
    setWinner(null);
    setSpinning(true);
    void tapFeedback();
    const extra = Math.floor(Math.random() * 360);
    const next = rotation + 360 * 5 + extra;
    setRotation(next);
    const angleAtTop = (360 - (next % 360)) % 360;
    const winnerIndex = Math.floor(angleAtTop / seg) % options.length;
    if (spinTimeout.current) clearTimeout(spinTimeout.current);
    spinTimeout.current = setTimeout(() => {
      setWinner(options[winnerIndex]);
      setSpinning(false);
      void tapFeedback();
    }, 4200);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background safe-top safe-bottom">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="font-display text-xl font-extrabold">{t('social.games.catalog.spinTheWheel')}</h2>
        <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-card border border-border" aria-label={t('common.cancel')}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <div className="relative grid place-items-center">
          {/* pointer */}
          <div className="absolute -top-1 z-10 h-0 w-0 border-x-[10px] border-t-[16px] border-x-transparent border-t-secondary" />
          <motion.div
            className="grid h-72 w-72 place-items-center rounded-full border-4 border-card shadow-[0_12px_36px_rgba(16,32,25,.24)]"
            style={{ background: gradient }}
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: [0.16, 1, 0.3, 1] }}
          >
            {options.map((name, i) => (
              <span
                key={name}
                className="absolute font-bold text-white text-sm"
                style={{ transform: `rotate(${i * seg + seg / 2}deg) translateY(-7.5rem)` }}
              >
                {name[0]?.toUpperCase()}
              </span>
            ))}
            <div className="z-10 grid h-14 w-14 place-items-center rounded-full bg-card font-display text-xs font-extrabold text-muted-foreground">
              {options.length}
            </div>
          </motion.div>
        </div>

        <div className="min-h-[2rem] text-center">
          {winner && (
            <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-2xl font-extrabold text-primary dark:text-secondary">
              {t('social.games.spin.winner', { name: winner })}
            </motion.p>
          )}
        </div>

        <button
          onClick={spin}
          disabled={spinning || options.length < 2}
          className="btn-lemon w-full max-w-xs font-bold disabled:opacity-50"
        >
          <RotateCw className="h-5 w-5" />
          {winner ? t('social.games.spin.spinAgain') : t('social.games.spin.spinButton')}
        </button>
        {options.length < 2 && <p className="text-sm text-muted-foreground">{t('social.games.spin.needPlayers')}</p>}
      </div>

      <div className="px-5 pb-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          {options.map((name) => (
            <button
              key={name}
              onClick={() => removeOption(name)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium"
            >
              {name}
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addOption(); }}
            placeholder={t('social.games.spin.optionPlaceholder')}
            className="field flex-1 !min-h-0 py-2.5 text-sm"
          />
          <button onClick={addOption} className="btn-ghost shrink-0 px-4 font-bold" aria-label={t('social.games.spin.addOption')}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
