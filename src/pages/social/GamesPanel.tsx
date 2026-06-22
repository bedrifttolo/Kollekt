import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Users, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { useUser } from '../../context/UserContext';
import { GAME_CATALOG, GAME_CATEGORIES, tonightsPick, type GameCategoryFilter, type GameEntry } from '../../games/catalog';
import PlayerSetup from '../../games/PlayerSetup';
import PromptGame from '../../games/PromptGame';
import RoomPromptGame from '../../games/RoomPromptGame';
import SpinTheWheel from '../../games/SpinTheWheel';

export default function GamesPanel() {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const [members, setMembers] = useState<string[]>([]);
  const [filter, setFilter] = useState<GameCategoryFilter>('all');
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [setupGame, setSetupGame] = useState<GameEntry | null>(null);
  const [sessionPlayers, setSessionPlayers] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const name = currentUser?.name ?? '';
  const pick = useMemo(() => tonightsPick(), []);

  useEffect(() => {
    if (!name) return;
    api.get<{ name: string }[]>(`/members/collective?memberName=${encodeURIComponent(name)}`)
      .then((res) => setMembers(res.map((m) => m.name)))
      .catch(() => {});
  }, [name]);

  const games = filter === 'all' ? GAME_CATALOG : GAME_CATALOG.filter((g) => g.category === filter);

  const launch = (game: GameEntry) => {
    if (!game.playable) {
      setNotice(t('social.games.comingSoon'));
      setTimeout(() => setNotice(null), 1800);
      return;
    }
    if (game.roomGame) {
      setActiveGame(game.id);
      return;
    }
    setSetupGame(game);
  };

  const activeEntry = activeGame ? GAME_CATALOG.find((game) => game.id === activeGame) ?? null : null;

  const editPlayers = () => {
    if (!activeEntry) return;
    setActiveGame(null);
    setSetupGame(activeEntry);
  };

  return (
    <div className="space-y-4">
      {/* Tonight's pick */}
      <div className="househero">
        <p className="eyebrow !text-white/65">{t('social.games.tonightsPick')} 🎲</p>
        <h3 className="font-display text-3xl font-extrabold tracking-[-.03em] mt-1">{t(`social.games.catalog.${pick.titleKey}`)}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
            <Clock className="h-3.5 w-3.5" /> {t('social.games.minutes', { min: pick.minutes })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
            <Users className="h-3.5 w-3.5" /> {t('social.games.playersShort', { count: pick.minPlayers })}
          </span>
        </div>
        <button onClick={() => launch(pick)} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-card px-5 py-3 font-display font-bold text-primary">
          <Play className="h-5 w-5" /> {t('social.games.startGame')}
        </button>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {GAME_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${
              filter === c.id ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
            }`}
          >
            {t(`social.games.categories.${c.id}`)}{c.emoji ? ` ${c.emoji}` : ''}
          </button>
        ))}
      </div>

      {notice && <p className="text-sm text-center text-muted-foreground">{notice}</p>}

      {/* Games grid */}
      <div className="grid grid-cols-2 gap-3">
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => launch(game)}
            className={`card !p-4 text-left flex flex-col gap-3 ${game.playable ? '' : 'opacity-70'}`}
          >
            <div className="flex items-start justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-xl">{game.emoji}</span>
              <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {game.playable ? t(`social.games.difficulty.${game.difficulty}`) : t('social.games.soon')}
              </span>
            </div>
            <div>
              <p className="font-display font-extrabold leading-tight">{t(`social.games.catalog.${game.titleKey}`)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('social.games.playersLong', { count: game.minPlayers })} · {t('social.games.minutes', { min: game.minutes })}
              </p>
            </div>
          </button>
        ))}
      </div>

      {activeGame === 'spin-the-wheel' && (
        <SpinTheWheel members={sessionPlayers} onClose={() => setActiveGame(null)} />
      )}
      {activeEntry?.drinkingGameId && (
        <PromptGame
          gameId={activeEntry.drinkingGameId}
          players={sessionPlayers}
          onEditPlayers={editPlayers}
          onClose={() => setActiveGame(null)}
        />
      )}
      {activeEntry?.roomGame && <RoomPromptGame onClose={() => setActiveGame(null)} />}
      {setupGame && (
        <PlayerSetup
          key={setupGame.id}
          gameTitle={t(`social.games.catalog.${setupGame.titleKey}`)}
          householdMembers={members}
          initialPlayers={sessionPlayers}
          minPlayers={setupGame.minPlayers}
          onClose={() => setSetupGame(null)}
          onStart={(players) => {
            setSessionPlayers(players);
            setActiveGame(setupGame.id);
            setSetupGame(null);
          }}
        />
      )}
    </div>
  );
}
