import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Hash, RotateCcw, Shuffle, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getDrinkingGame,
  type DrinkingGameId,
  type DrinkingPromptKind,
} from '../../othergames/src/content';

const promptStyles: Record<DrinkingPromptKind, string> = {
  vote: 'border-primary/30 bg-primary/10 text-primary',
  challenge: 'border-secondary/40 bg-secondary/15 text-secondary-foreground',
  toast: 'border-accent/40 bg-accent/15 text-accent-foreground',
  never: 'border-destructive/30 bg-destructive/10 text-destructive',
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
  const [phase, setPhase] = useState<'rules' | 'playing'>('rules');
  const [randomOrder, setRandomOrder] = useState(false);
  const [deck, setDeck] = useState<number[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [activePromptId, setActivePromptId] = useState<number | null>(null);
  const [usedPromptIds, setUsedPromptIds] = useState<number[]>([]);
  const promptById = useMemo(() => new Map(game.prompts.map((prompt) => [prompt.id, prompt])), [game]);
  const activePrompt = activePromptId == null ? null : promptById.get(activePromptId) ?? null;

  const startGame = () => {
    const ids = game.prompts.map((prompt) => prompt.id);
    const nextDeck = game.allowRandomOrder && randomOrder ? shuffled(ids) : ids;
    setDeck(nextDeck);
    setDeckIndex(0);
    setUsedPromptIds([]);
    setActivePromptId(game.mode === 'ordered-deck' ? nextDeck[0] ?? null : null);
    setPhase('playing');
  };

  const advance = () => {
    const nextIndex = deckIndex + 1;
    setDeckIndex(nextIndex);
    setActivePromptId(nextIndex < deck.length ? deck[nextIndex] : null);
  };

  const revealNumber = (id: number) => {
    if (!usedPromptIds.includes(id)) setUsedPromptIds((current) => [...current, id]);
    setActivePromptId(id);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background safe-top safe-bottom">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl font-extrabold">{game.title}</h2>
          <button onClick={onEditPlayers} className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
            <Users className="h-3 w-3" /> {t('social.games.setup.editPlayers', { count: players.length })}
          </button>
        </div>
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card" aria-label={t('common.cancel')}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {phase === 'rules' ? (
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
            {game.allowRandomOrder && (
              <button onClick={() => setRandomOrder((value) => !value)} className="card flex w-full items-center gap-3 text-left">
                <Shuffle className="h-5 w-5 text-primary" />
                <span className="flex-1 font-semibold">{t(randomOrder ? 'games.randomOrder' : 'games.sequentialOrder')}</span>
                <span className={`h-6 w-10 rounded-full p-1 ${randomOrder ? 'bg-primary' : 'bg-muted'}`}><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${randomOrder ? 'translate-x-4' : ''}`} /></span>
              </button>
            )}
            <button onClick={startGame} className="btn-lemon w-full">{t('games.startGame')}</button>
          </div>
        ) : (
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
                  className={`flex min-h-64 flex-col justify-between rounded-[1.6rem] border p-6 ${promptStyles[activePrompt.kind]}`}
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
                  <h3 className="mt-2 font-display text-xl font-bold">{game.mode === 'number-board' ? t('games.numberPrompt') : t('games.finishedTitle')}</h3>
                </motion.div>
              )}
            </AnimatePresence>

            {game.mode === 'ordered-deck' ? (
              <button onClick={activePrompt ? advance : startGame} className="btn-lemon w-full">
                {activePrompt ? <ArrowRight className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}
                {activePrompt ? t('games.nextQuestion') : t('games.playAgain')}
              </button>
            ) : (
              <>
                <div className="card !p-3">
                  <div className="grid grid-cols-7 gap-1.5">
                    {game.prompts.map((prompt) => (
                      <button
                        key={prompt.id}
                        onClick={() => revealNumber(prompt.id)}
                        className={`aspect-square rounded-lg border text-xs font-bold ${usedPromptIds.includes(prompt.id) ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border bg-background'}`}
                      >
                        {prompt.id}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={startGame} className="btn-ghost w-full"><Hash className="h-4 w-4" />{t('games.restart')}</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
