import { useMemo, useState } from 'react';
import { Eye, RotateCcw, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GameHeader, GameScreen } from './GameScreen';

type DeckId = 'chill' | 'medium' | 'spicy';
const DECKS: DeckId[] = ['chill', 'medium', 'spicy'];
const PROMPTS_PER_SESSION = 30;

export default function DeckGame({
  gameKey,
  onClose,
}: {
  gameKey: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [deckId, setDeckId] = useState<DeckId | null>(null);
  const [seed, setSeed] = useState(0);
  const [turn, setTurn] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const session = useMemo(() => {
    if (!deckId) return [] as string[];
    const raw = t(`social.games.${gameKey}.decks.${deckId}`, { returnObjects: true });
    const all = Array.isArray(raw) ? (raw as string[]) : [];
    return [...all].sort(() => Math.random() - 0.5).slice(0, PROMPTS_PER_SESSION);
  }, [deckId, seed, t, gameKey]);

  const finished = deckId !== null && turn >= session.length;

  const advance = () => {
    setRevealed(false);
    setTurn((v) => v + 1);
  };

  const restart = (nextDeck: DeckId | null) => {
    setDeckId(nextDeck);
    setTurn(0);
    setRevealed(false);
    setSeed((v) => v + 1);
  };

  return (
    <GameScreen>
        <GameHeader
          eyebrow={t(`social.games.catalog.${gameKey}`)}
          title={deckId ? t(`social.games.${gameKey}.deckNames.${deckId}`) : t('social.games.deckGame.pickDeck')}
          onClose={onClose}
        />

        {!deckId && (
          <div className="space-y-3">
            {DECKS.map((id) => (
              <button
                key={id}
                onClick={() => restart(id)}
                className="card !p-4 w-full text-left"
              >
                <p className="font-display text-lg font-extrabold">
                  {t(`social.games.${gameKey}.deckNames.${id}`)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`social.games.${gameKey}.deckDescriptions.${id}`)}
                </p>
              </button>
            ))}
          </div>
        )}

        {deckId && !finished && (
          <>
            <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-secondary">
              {t('social.games.deckGame.progress', { current: turn + 1, total: session.length })}
            </p>
            <div className="card flex min-h-80 flex-col items-center justify-center gap-6 text-center">
              {!revealed ? (
                <>
                  <Eye className="h-10 w-10 text-foreground" />
                  <button onClick={() => setRevealed(true)} className="btn-lemon">
                    {t('social.games.deckGame.reveal')}
                  </button>
                </>
              ) : (
                <h3 className="px-2 font-display text-2xl font-extrabold leading-snug">
                  {session[turn]}
                </h3>
              )}
            </div>
            {revealed && (
              <button onClick={advance} className="btn-pine w-full">
                <SkipForward className="h-4 w-4" />
                {t('social.games.deckGame.next')}
              </button>
            )}
          </>
        )}

        {finished && (
          <div className="card flex min-h-80 flex-col items-center justify-center text-center">
            <h3 className="font-display text-3xl font-extrabold">
              {t('social.games.deckGame.done')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('social.games.deckGame.doneSubtitle')}
            </p>
            <button onClick={() => restart(deckId)} className="btn-lemon mt-6">
              {t('social.games.deckGame.playAgain')}
            </button>
          </div>
        )}

        {deckId && (
          <button
            onClick={() => restart(null)}
            className="mx-auto flex items-center gap-2 text-xs text-muted-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            {t('social.games.deckGame.changeDeck')}
          </button>
        )}
    </GameScreen>
  );
}
