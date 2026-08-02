import { useMemo, useState } from 'react';
import { Play, Users, Clock, Info, X, Lock, Dices } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { qk } from '../../lib/queryKeys';
import type { AppUser } from '../../lib/types';
import { useUser } from '../../context/UserContext';
import { usePremiumEntitlement, isGameLocked } from '../../lib/purchases';
import SubscriptionPaywall from '../../components/SubscriptionPaywall';
import { GAME_CATALOG, GAME_CATEGORIES, tonightsPick, type GameCategoryFilter, type GameEntry } from '../../games/catalog';
import { PAGE_ACCENTS } from '../../lib/pageAccent';
import PlayerSetup from '../../games/PlayerSetup';
import PromptGame from '../../games/PromptGame';
import RoomPromptGame from '../../games/RoomPromptGame';
import SpinTheWheel from '../../games/SpinTheWheel';
import MexicanGame from '../../games/MexicanGame';
import KingsCupGame from '../../games/KingsCupGame';
import CategoriesGame from '../../games/CategoriesGame';
import CharadesGame from '../../games/CharadesGame';
import SnusboksenGame from '../../games/SnusboksenGame';
import DiceGame from '../../games/DiceGame';
import LiarsDiceGame from '../../games/LiarsDiceGame';
import DeckGame from '../../games/DeckGame';
import { toneByKey, toneClass } from '../../lib/tones';
import { SegmentedControl } from '../../components/ui-kit';

export default function GamesPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [filter, setFilter] = useState<GameCategoryFilter>('all');
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [setupGame, setSetupGame] = useState<GameEntry | null>(null);
  const [rulesGame, setRulesGame] = useState<GameEntry | null>(null);
  const [sessionPlayers, setSessionPlayers] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const { isUnlocked } = usePremiumEntitlement();

  const name = currentUser?.name ?? '';
  const pick = useMemo(() => tonightsPick(), []);

  // Shares the cached members fetch with the Dashboard/Profile pages.
  const { data: members = [] } = useQuery({
    queryKey: qk.members(name),
    enabled: !!name,
    queryFn: () => api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(name)}`),
    select: (users) => users.map((user) => user.name),
  });

  const visibleCatalog = GAME_CATALOG.filter((g) => !g.hidden);
  const games = filter === 'all' ? visibleCatalog : visibleCatalog.filter((g) => g.category === filter);

  const launch = (game: GameEntry) => {
    if (!game.playable) {
      setNotice(t('social.games.comingSoon'));
      setTimeout(() => setNotice(null), 1800);
      return;
    }
    if (isGameLocked(game.requiresSubscription, isUnlocked)) {
      setShowPaywall(true);
      return;
    }
    if (game.id === 'kollekt') {
      navigate('/games/kollekt');
      return;
    }
    if (game.roomGame || game.soloGame || game.id === 'spin-the-wheel') {
      setActiveGame(game.id);
      return;
    }
    if (game.deckGameKey) {
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

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 1800);
  };

  return (
    <div className="space-y-4">
      {/* Tonight's pick */}
      <div className="househero hero-ink">
        <p className={`eyebrow tone-${PAGE_ACCENTS['/social']} !text-ink-foreground/65 flex items-center gap-1.5`}>
          {t('social.games.tonightsPick')}
          <Dices className="h-3.5 w-3.5" />
        </p>
        <h3 className="font-display text-3xl font-extrabold tracking-[-.03em] mt-1">{t(`social.games.catalog.${pick.titleKey}`)}</h3>
        <p className="mt-2 text-sm text-ink-foreground/75">{t(`social.games.descriptions.${pick.descriptionKey}`)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-foreground/15 px-3 py-1.5 text-xs font-bold">
            <Clock className="h-3.5 w-3.5" /> {t('social.games.minutes', { min: pick.minutes })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-foreground/15 px-3 py-1.5 text-xs font-bold">
            <Users className="h-3.5 w-3.5" /> {t('social.games.playersShort', { count: pick.minPlayers })}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => launch(pick)} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-card px-5 py-3 font-display font-bold text-primary">
            <Play className="h-5 w-5" /> {t('social.games.startGame')}
          </button>
          <button onClick={() => setRulesGame(pick)} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-ink-foreground/15 px-4 py-3 text-sm font-bold text-ink-foreground">
            <Info className="h-4 w-4" /> {t('social.games.howToPlay')}
          </button>
        </div>
      </div>

      {/* Category chips */}
      <div className="flex justify-center">
        <SegmentedControl
          layoutId="games-category"
          value={filter}
          onChange={setFilter}
          options={GAME_CATEGORIES.filter((c) => c.id === 'all' || visibleCatalog.some((g) => g.category === c.id)).map((c) => ({
            value: c.id,
            label: (
              <span className="inline-flex items-center gap-1.5">
                {t(`social.games.categories.${c.id}`)}
                {c.icon && <c.icon className="h-3.5 w-3.5" />}
              </span>
            ),
          }))}
        />
      </div>

      {notice && <p className="text-sm text-center text-muted-foreground">{notice}</p>}

      {/* Games grid */}
      <div className="grid grid-cols-2 gap-3">
        {games.map((game) => {
          const locked = isGameLocked(game.requiresSubscription, isUnlocked);
          return (
          <div
            key={game.id}
            className={`group card !p-4 text-left flex flex-col gap-3 ${game.playable ? '' : 'opacity-70'}`}
          >
            <div className="flex min-w-0 items-start justify-end gap-2">
              <div className="flex shrink-0 items-center gap-1">
                {locked && (
                  <span className="inline-flex max-w-[5rem] items-center gap-1 rounded-full bg-secondary/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">
                    <Lock className="h-3 w-3 shrink-0" /> <span className="truncate">{t('social.games.premium')}</span>
                  </span>
                )}
                <button
                  onClick={() => setRulesGame(game)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                  aria-label={t('social.games.howToPlay')}
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div>
              {/* Keyed on the game id so a tile keeps its colour as the category filter changes. */}
              <div className={`tone-tile mb-2 flex h-10 w-10 items-center justify-center rounded-[--r-sm] ${toneClass(toneByKey(game.id))}`}>
                <game.icon className="h-5 w-5" />
              </div>
              <p className="font-display font-extrabold leading-tight">{t(`social.games.catalog.${game.titleKey}`)}</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{t(`social.games.descriptions.${game.descriptionKey}`)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('social.games.playersLong', { count: game.minPlayers })} · {t('social.games.minutes', { min: game.minutes })}
              </p>
            </div>
            <button
              onClick={() => launch(game)}
              className={`mt-auto inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold ${!game.playable ? 'bg-muted/60 text-muted-foreground' : locked ? 'bg-secondary/15 text-secondary-foreground group-hover:bg-secondary/25' : 'bg-primary/10 text-primary group-hover:bg-primary/15'}`}
            >
              {!game.playable ? (
                t('social.games.soon')
              ) : locked ? (
                <>
                  <Lock className="h-3.5 w-3.5" /> {t('social.games.unlock')}
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> {t('social.games.startGame')}
                </>
              )}
            </button>
          </div>
          );
        })}
      </div>

      {rulesGame && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/35 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]" onClick={() => setRulesGame(null)}>
          <div className="w-full rounded-2xl border border-border bg-card p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('social.games.howToPlay')}</p>
                <h3 className="mt-1 flex items-center gap-2 font-display text-xl font-extrabold">
                  <rulesGame.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  {t(`social.games.catalog.${rulesGame.titleKey}`)}
                </h3>
              </div>
              <button onClick={() => setRulesGame(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted" aria-label={t('common.cancel')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(`social.games.ruleText.${rulesGame.descriptionKey}`)}</p>
            <button
              onClick={() => {
                const game = rulesGame;
                setRulesGame(null);
                launch(game);
              }}
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
            >
              <Play className="h-4 w-4" /> {rulesGame.playable ? t('social.games.startGame') : t('social.games.soon')}
            </button>
          </div>
        </div>
      )}

      {showPaywall && <SubscriptionPaywall onClose={() => setShowPaywall(false)} />}

      {activeGame === 'spin-the-wheel' && (
        <SpinTheWheel members={members} onClose={() => setActiveGame(null)} />
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
      {activeGame === 'mexican' && <MexicanGame players={sessionPlayers} onClose={() => setActiveGame(null)} />}
      {activeGame === 'kings-cup' && <KingsCupGame players={sessionPlayers} onClose={() => setActiveGame(null)} />}
      {activeGame === 'categories' && <CategoriesGame players={sessionPlayers} onClose={() => setActiveGame(null)} />}
      {activeGame === 'charades' && <CharadesGame players={sessionPlayers} onClose={() => setActiveGame(null)} />}
      {activeGame === 'snusboksen' && <SnusboksenGame players={sessionPlayers} onClose={() => setActiveGame(null)} />}
      {activeEntry?.deckGameKey && (
        <DeckGame gameKey={activeEntry.deckGameKey} onClose={() => setActiveGame(null)} />
      )}
      {activeGame === 'dice' && <DiceGame onClose={() => setActiveGame(null)} />}
      {activeGame === 'liars-dice' && <LiarsDiceGame onClose={() => setActiveGame(null)} />}
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
