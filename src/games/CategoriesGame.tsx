import { useEffect, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const categoryKeys = ['countries', 'foods', 'movies', 'animals', 'brands', 'songs', 'cities', 'thingsInKitchen', 'excuses', 'houseRules'];

export default function CategoriesGame({ players, onClose }: { players: string[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(players);
  const [turn, setTurn] = useState(0);
  const [category, setCategory] = useState(() => categoryKeys[Math.floor(Math.random() * categoryKeys.length)]);
  const [seconds, setSeconds] = useState(8);
  const player = active[turn % active.length];

  useEffect(() => {
    if (active.length <= 1 || seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [active.length, seconds]);

  const next = () => { setTurn((value) => value + 1); setSeconds(8); };
  const eliminate = () => {
    const nextPlayers = active.filter((name) => name !== player);
    setActive(nextPlayers);
    setTurn((value) => nextPlayers.length ? value % nextPlayers.length : 0);
    setSeconds(8);
  };
  const newRound = () => { setActive(players); setTurn(0); setSeconds(8); setCategory(categoryKeys[Math.floor(Math.random() * categoryKeys.length)]); };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-5"><div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center gap-3"><button onClick={onClose} className="btn-ghost !p-3"><ArrowLeft className="h-5 w-5" /></button><div><p className="eyebrow">{t('social.games.catalog.categories')}</p><h2 className="font-display text-2xl font-extrabold">{active.length > 1 ? player : t('social.games.categoriesGame.winner', { player: active[0] })}</h2></div></div>
      <div className="card text-sm text-muted-foreground">{t('social.games.categoriesGame.rules')}</div>
      <div className="househero text-center"><p className="eyebrow !text-white/65">{t('social.games.categoriesGame.category')}</p><h3 className="mt-2 font-display text-3xl font-extrabold">{t(`social.games.categoriesGame.prompts.${category}`)}</h3>{active.length > 1 && <div className={`mx-auto mt-7 grid h-24 w-24 place-items-center rounded-full text-5xl font-black ${seconds === 0 ? 'bg-destructive text-white' : 'bg-white/15'}`}>{seconds}</div>}</div>
      {active.length > 1 ? <div className="grid grid-cols-2 gap-3"><button onClick={eliminate} className="btn-ghost">{t(seconds === 0 ? 'social.games.categoriesGame.timeOut' : 'social.games.categoriesGame.out')}</button><button onClick={next} className="btn-lemon">{t('social.games.categoriesGame.next')}</button></div> : <button onClick={newRound} className="btn-pine w-full"><RotateCcw className="h-4 w-4" />{t('social.games.playAgain')}</button>}
    </div></div>
  );
}
