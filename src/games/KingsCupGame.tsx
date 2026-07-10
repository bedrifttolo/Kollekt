import { useMemo, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suits = ['♠', '♥', '♦', '♣'];

function shuffledDeck() {
  return ranks.flatMap((rank) => suits.map((suit) => ({ rank, suit }))).sort(() => Math.random() - 0.5);
}

export default function KingsCupGame({ players, onClose }: { players: string[]; onClose: () => void }) {
  const { t } = useTranslation();
  const initialDeck = useMemo(shuffledDeck, []);
  const [deck, setDeck] = useState(initialDeck);
  const [drawn, setDrawn] = useState<{ rank: string; suit: string } | null>(null);
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
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background p-5"><div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center gap-3"><button onClick={onClose} className="btn-ghost !p-3"><ArrowLeft className="h-5 w-5" /></button><div><p className="eyebrow">{t('social.games.catalog.kingsCup')}</p><h2 className="font-display text-2xl font-extrabold">{t('social.games.turn', { player })}</h2></div></div>
      <div className="flex justify-between text-sm text-muted-foreground"><span>{t('social.games.kings.cardsLeft', { count: deck.length })}</span><span>{t('social.games.kings.kingsDrawn', { count: kings })}</span></div>
      <div className="card flex min-h-80 flex-col items-center justify-center text-center">
        {drawn ? <><div className={`font-display text-8xl font-black ${drawn.suit === '♥' || drawn.suit === '♦' ? 'text-destructive' : ''}`}>{drawn.rank}{drawn.suit}</div><h3 className="mt-6 text-xl font-extrabold">{t(`social.games.kings.cards.${drawn.rank}.title`)}</h3><p className="mt-2 text-sm text-muted-foreground">{t(`social.games.kings.cards.${drawn.rank}.rule`, { player: players[(turn - 1 + players.length) % players.length] })}</p></> : <p className="text-muted-foreground">{t('social.games.kings.ready')}</p>}
      </div>
      {deck.length > 0 ? <button onClick={draw} className="btn-lemon w-full">{t('social.games.kings.draw')}</button> : <button onClick={reset} className="btn-pine w-full"><RotateCcw className="h-4 w-4" />{t('social.games.playAgain')}</button>}
    </div></div>
  );
}
