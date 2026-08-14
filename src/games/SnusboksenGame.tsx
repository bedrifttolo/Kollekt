import { useMemo, useState } from 'react';
import { Eye, RotateCcw, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GameHeader, GameScreen } from './GameScreen';

type DeckId = 'chill' | 'medium' | 'spicy';

const DECKS: DeckId[] = ['chill', 'medium', 'spicy'];
const PROMPTS_PER_SESSION = 30;

export default function SnusboksenGame({ players, onClose }: { players: string[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [deckId, setDeckId] = useState<DeckId | null>(null);
  const [seed, setSeed] = useState(0);
  const [turn, setTurn] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // Draw a fresh shuffled session of up to 30 prompts whenever a deck is chosen or the
  // game is restarted (seed changes). Decks live in the locale files so the text is localized.
  const session = useMemo(() => {
    if (!deckId) return [] as string[];
    const raw = t(`social.games.snusboksen.decks.${deckId}`, { returnObjects: true });
    const all = Array.isArray(raw) ? (raw as string[]) : [];
    return [...all].sort(() => Math.random() - 0.5).slice(0, PROMPTS_PER_SESSION);
  }, [deckId, seed, t]);

  const player = players.length > 0 ? players[turn % players.length] : '';
  const finished = deckId !== null && turn >= session.length;

  const advance = () => {
    setRevealed(false);
    setTurn((value) => value + 1);
  };

  const restart = (nextDeck: DeckId | null) => {
    setDeckId(nextDeck);
    setTurn(0);
    setRevealed(false);
    setSeed((value) => value + 1);
  };

  return (
    <GameScreen>
        <GameHeader
          eyebrow={t('social.games.catalog.snusboksen')}
          title={deckId ? t(`social.games.snusboksen.deckNames.${deckId}`) : t('social.games.snusboksen.pickDeck')}
          onClose={onClose}
        />

        {!deckId && (
          <div className="space-y-3">
            {DECKS.map((id) => (
              <button
                key={id}
                onClick={() => restart(id)}
                className="card w-full text-left"
              >
                <p className="font-display text-lg font-extrabold">{t(`social.games.snusboksen.deckNames.${id}`)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t(`social.games.snusboksen.deckDescriptions.${id}`)}</p>
              </button>
            ))}
          </div>
        )}

        {deckId && !finished && (
          <>
            <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-secondary">
              {t('social.games.snusboksen.progress', { current: turn + 1, total: session.length })}
            </p>
            <div className="card flex min-h-80 flex-col items-center justify-center text-center">
              {!revealed ? (
                <>
                  <Eye className="h-10 w-10 text-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">{t('social.games.snusboksen.pass', { player })}</p>
                  <button onClick={() => setRevealed(true)} className="btn-lemon mt-6">{t('social.games.snusboksen.reveal')}</button>
                </>
              ) : (
                <>
                  {player && <p className="text-sm font-bold text-primary">{player}</p>}
                  <h3 className="mt-4 font-display text-2xl font-extrabold leading-snug">{session[turn]}</h3>
                </>
              )}
            </div>
            {revealed && (
              <button onClick={advance} className="btn-pine w-full">
                <SkipForward className="h-4 w-4" />{t('social.games.snusboksen.next')}
              </button>
            )}
          </>
        )}

        {finished && (
          <div className="card flex min-h-80 flex-col items-center justify-center text-center">
            <h3 className="font-display text-3xl font-extrabold">{t('social.games.snusboksen.done')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t('social.games.snusboksen.doneSubtitle')}</p>
            <button onClick={() => restart(deckId)} className="btn-lemon mt-6">{t('social.games.snusboksen.playAgain')}</button>
          </div>
        )}

        {deckId && (
          <button
            onClick={() => restart(null)}
            className="mx-auto flex items-center gap-2 text-xs text-muted-foreground"
          >
            <RotateCcw className="h-3 w-3" />{t('social.games.snusboksen.changeDeck')}
          </button>
        )}
    </GameScreen>
  );
}
