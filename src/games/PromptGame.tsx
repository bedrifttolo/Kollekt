import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Hash, PartyPopper, RotateCcw, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../components/ui-kit';
import {
  getDrinkingGame,
  type DrinkingGameId,
  type DrinkingPromptKind,
  type PromptSpice,
} from '../../othergames/src/content';

const SPICE_TIERS: PromptSpice[] = ['chill', 'medium', 'spicy'];
const ROUND_SIZE = 30;

const promptStyles: Record<DrinkingPromptKind, string> = {
  vote: 'border-primary/30 bg-primary/10 text-primary',
  challenge: 'border-secondary/40 bg-secondary/15 text-secondary-foreground',
  toast: 'border-accent/40 bg-accent/15 text-accent-foreground',
  never: 'border-destructive/30 bg-destructive/10 text-destructive',
  command: 'border-ink/30 bg-ink/10 text-ink',
};

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export default function PromptGame({
  gameId,
  players,
  onEditPlayers,
  onClose,
}: {
  gameId: DrinkingGameId;
  players: string[];
  onEditPlayers: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const game = useMemo(
    () => getDrinkingGame(gameId, i18n.resolvedLanguage ?? i18n.language),
    [gameId, i18n.language, i18n.resolvedLanguage],
  );
  const [phase, setPhase] = useState<'tier' | 'rules' | 'playing' | 'roundOver'>('tier');
  const [spice, setSpice] = useState<PromptSpice | null>(null);
  const [deck, setDeck] = useState<number[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [activePromptId, setActivePromptId] = useState<number | null>(null);
  const [usedPromptIds, setUsedPromptIds] = useState<number[]>([]);
  const promptById = useMemo(() => new Map(game.prompts.map((prompt) => [prompt.id, prompt])), [game]);
  const activePrompt = activePromptId == null ? null : promptById.get(activePromptId) ?? null;

  const startGame = () => {
    if (!spice) return;
    const ids = game.prompts.filter((prompt) => prompt.spice === spice).map((prompt) => prompt.id);
    const nextDeck = shuffled(ids).slice(0, ROUND_SIZE);
    setDeck(nextDeck);
    setDeckIndex(0);
    setUsedPromptIds([]);
    setActivePromptId(game.mode === 'ordered-deck' ? nextDeck[0] ?? null : null);
    setPhase('playing');
  };

  const advance = () => {
    const nextIndex = deckIndex + 1;
    if (nextIndex >= deck.length) {
      setPhase('roundOver');
      return;
    }
    setDeckIndex(nextIndex);
    setActivePromptId(deck[nextIndex]);
  };

  const revealNumber = (id: number) => {
    if (usedPromptIds.includes(id)) {
      setActivePromptId(id);
      return;
    }
    const nextUsed = [...usedPromptIds, id];
    setUsedPromptIds(nextUsed);
    setActivePromptId(id);
    if (nextUsed.length >= deck.length) setPhase('roundOver');
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background safe-top safe-bottom">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl font-extrabold">{game.title}</h2>
          {phase === 'playing' && (
            <button onClick={onEditPlayers} className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
              <Users className="h-3 w-3" /> {t('social.games.setup.editPlayers', { count: players.length })}
            </button>
          )}
        </div>
        <IconButton onClick={onClose} label={t('common.cancel')} icon={<X className="h-4 w-4" />} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {phase === 'tier' && (
          <div className="space-y-5">
            <h3 className="font-display text-xl font-bold">{t('games.spice.title')}</h3>
            <div className="space-y-3">
              {SPICE_TIERS.map((tier) => (
                <button
                  key={tier}
                  onClick={() => { setSpice(tier); setPhase('rules'); }}
                  className="card w-full text-left"
                >
                  <p className="font-display text-lg font-extrabold">{t(`games.spice.${tier}`)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`games.spice.${tier}Hint`)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'rules' && (
          <div className="space-y-5">
            <div className="card">
              <p className="text-sm text-muted-foreground">{game.description}</p>
              <div className="mt-4 space-y-2">
                {game.rules.map((rule, index) => (
                  <div key={rule} className="flex gap-3 text-sm">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{index + 1}</span>
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={startGame} className="btn-lemon w-full">{t('games.startGame')}</button>
          </div>
        )}

        {phase === 'playing' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {players.map((player) => <span key={player} className="pill pill-pine">{player}</span>)}
            </div>

            <AnimatePresence mode="wait">
              {activePrompt ? (
                <motion.div
                  key={activePrompt.id}
                  initial={{ opacity: 0, scale: .96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: .96 }}
                  className={`flex min-h-64 flex-col justify-between rounded-xl border p-6 ${promptStyles[activePrompt.kind]}`}
                >
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[.1em]">
                    <span>{t(`games.promptKinds.${activePrompt.kind}`)}</span><span>#{activePrompt.id}</span>
                  </div>
                  <p className="font-display text-2xl font-extrabold leading-snug">{activePrompt.text}</p>
                  <p className="text-sm opacity-70">{players[deckIndex % players.length]}</p>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card py-10 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
                  <h3 className="mt-2 font-display text-xl font-bold">{t('games.numberPrompt')}</h3>
                </motion.div>
              )}
            </AnimatePresence>

            {game.mode === 'ordered-deck' ? (
              <button onClick={advance} className="btn-lemon w-full">
                <ArrowRight className="h-5 w-5" />
                {t('games.nextQuestion')}
              </button>
            ) : (
              <div className="card card-sm">
                <div className="grid grid-cols-7 gap-1.5">
                  {deck.map((promptId) => (
                    <button
                      key={promptId}
                      onClick={() => revealNumber(promptId)}
                      className={`aspect-square rounded-lg border text-xs font-bold ${usedPromptIds.includes(promptId) ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border bg-background'}`}
                    >
                      {promptId}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'roundOver' && (
          <div className="space-y-3">
            <div className="card flex min-h-80 flex-col items-center justify-center text-center">
              <PartyPopper className="h-10 w-10 text-primary" />
              <h3 className="mt-3 font-display text-3xl font-extrabold">{t('games.roundOver.title')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t('games.roundOver.subtitle')}</p>
              <button onClick={startGame} className="btn-lemon mt-6">
                <RotateCcw className="h-4 w-4" />
                {t('games.roundOver.newRound')}
              </button>
            </div>
            <button
              onClick={() => { setSpice(null); setPhase('tier'); }}
              className="mx-auto flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Hash className="h-3 w-3" />
              {t('games.roundOver.changeTier')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
