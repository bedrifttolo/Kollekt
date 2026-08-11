import { useMemo, useState } from 'react';
import { RotateCcw, Spade, Heart, Diamond, Club, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GameHeader, GameScreen } from './GameScreen';

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suits: Array<{ id: string; Icon: LucideIcon; red: boolean }> = [
  { id: 'spades', Icon: Spade, red: false },
  { id: 'hearts', Icon: Heart, red: true },
  { id: 'diamonds', Icon: Diamond, red: true },
  { id: 'clubs', Icon: Club, red: false },
];

function shuffledDeck() {
  return ranks.flatMap((rank) => suits.map((suit) => ({ rank, suit }))).sort(() => Math.random() - 0.5);
}

export default function KingsCupGame({ players, onClose }: { players: string[]; onClose: () => void }) {
  const { t } = useTranslation();
  const initialDeck = useMemo(shuffledDeck, []);
  const [deck, setDeck] = useState(initialDeck);
  const [drawn, setDrawn] = useState<{ rank: string; suit: (typeof suits)[number] } | null>(null);
  const [turn, setTurn] = useState(0);
  const [kings, setKings] = useState(0);
  const player = players[turn % players.length];

  const draw = () => {
    const [card, ...rest] = deck;
    if (!card) return;
    setDrawn(card);
    setDeck(rest);
    if (card.rank === 'K') setKings((value) => value + 1);
    setTurn((value) => value + 1);
  };

  const reset = () => { setDeck(shuffledDeck()); setDrawn(null); setTurn(0); setKings(0); };

  return (
    <GameScreen>
      <GameHeader eyebrow={t('social.games.catalog.kingsCup')} title={t('social.games.turn', { player })} onClose={onClose} />
      <div className="flex justify-between text-sm text-muted-foreground"><span>{t('social.games.kings.cardsLeft', { count: deck.length })}</span><span>{t('social.games.kings.kingsDrawn', { count: kings })}</span></div>
      <div className="card flex min-h-80 flex-col items-center justify-center text-center">
        {drawn ? <><div className={`flex items-center justify-center gap-3 font-display text-8xl font-black ${drawn.suit.red ? 'text-destructive' : ''}`}><span>{drawn.rank}</span><drawn.suit.Icon className="h-16 w-16" strokeWidth={2} /></div><h3 className="mt-6 text-xl font-extrabold">{t(`social.games.kings.cards.${drawn.rank}.title`)}</h3><p className="mt-2 text-sm text-muted-foreground">{t(`social.games.kings.cards.${drawn.rank}.rule`, { player: players[(turn - 1 + players.length) % players.length] })}</p></> : <p className="text-muted-foreground">{t('social.games.kings.ready')}</p>}
      </div>
      {deck.length > 0 ? <button onClick={draw} className="btn-lemon w-full">{t('social.games.kings.draw')}</button> : <button onClick={reset} className="btn-pine w-full"><RotateCcw className="h-4 w-4" />{t('social.games.playAgain')}</button>}
    </GameScreen>
  );
}
