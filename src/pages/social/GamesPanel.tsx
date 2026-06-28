import { useEffect, useMemo, useState } from 'react';
import { Play, Users, Clock, Info, X, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useUser } from '../../context/UserContext';
import { useGamesSubscription, isGameLocked } from '../../lib/purchases';
import { GAME_CATALOG, GAME_CATEGORIES, tonightsPick, type GameCategoryFilter, type GameEntry } from '../../games/catalog';
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

export default function GamesPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [members, setMembers] = useState<string[]>([]);
  const [filter, setFilter] = useState<GameCategoryFilter>('all');
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [setupGame, setSetupGame] = useState<GameEntry | null>(null);
  const [rulesGame, setRulesGame] = useState<GameEntry | null>(null);
  const [sessionPlayers, setSessionPlayers] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallBusy, setPaywallBusy] = useState(false);
  const { isSubscriber, available, purchase, restore } = useGamesSubscription();

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
    if (isGameLocked(game.requiresSubscription, isSubscriber)) {
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

  const handleSubscribe = async () => {
    if (!available) { flash(t('social.games.paywall.unavailable')); return; }
    setPaywallBusy(true);
    try {
      const ok = await purchase();
      if (ok) setShowPaywall(false);
    } catch {
      flash(t('social.games.paywall.unavailable'));
    } finally {
      setPaywallBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!available) { flash(t('social.games.paywall.unavailable')); return; }
    setPaywallBusy(true);
    try {
      const ok = await restore();
      if (ok) setShowPaywall(false);
      else flash(t('social.games.paywall.nothingToRestore'));
    } catch {
      flash(t('social.games.paywall.unavailable'));
    } finally {
      setPaywallBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tonight's pick */}
      <div className="househero">
        <p className="eyebrow !text-white/65">{t('social.games.tonightsPick')} 🎲</p>
        <h3 className="font-display text-3xl font-extrabold tracking-[-.03em] mt-1">{t(`social.games.catalog.${pick.titleKey}`)}</h3>
        <p className="mt-2 text-sm text-white/75">{t(`social.games.descriptions.${pick.descriptionKey}`)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
            <Clock className="h-3.5 w-3.5" /> {t('social.games.minutes', { min: pick.minutes })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
            <Users className="h-3.5 w-3.5" /> {t('social.games.playersShort', { count: pick.minPlayers })}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => launch(pick)} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-card px-5 py-3 font-display font-bold text-primary">
            <Play className="h-5 w-5" /> {t('social.games.startGame')}
          </button>
          <button onClick={() => setRulesGame(pick)} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold text-white">
            <Info className="h-4 w-4" /> {t('social.games.howToPlay')}
          </button>
        </div>
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
        {games.map((game) => {
          const locked = isGameLocked(game.requiresSubscription, isSubscriber);
          return (
          <div
            key={game.id}
            className={`group card !p-4 text-left flex flex-col gap-3 ${game.playable ? '' : 'opacity-70'}`}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <span className="min-w-0 truncate rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t(`social.games.categories.${game.category}`)}
              </span>
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
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-4" onClick={() => setRulesGame(null)}>
          <div className="w-full rounded-2xl border border-border bg-card p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('social.games.howToPlay')}</p>
                <h3 className="mt-1 font-display text-xl font-extrabold">{rulesGame.emoji} {t(`social.games.catalog.${rulesGame.titleKey}`)}</h3>
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

      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-4" onClick={() => setShowPaywall(false)}>
          <div className="w-full rounded-2xl border border-border bg-card p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-secondary-foreground">{t('social.games.premium')}</p>
                <h3 className="mt-1 font-display text-xl font-extrabold">{t('social.games.paywall.title')}</h3>
              </div>
              <button onClick={() => setShowPaywall(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted" aria-label={t('common.cancel')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('social.games.paywall.body')}</p>
            <button
              onClick={() => void handleSubscribe()}
              disabled={paywallBusy}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {t('social.games.paywall.subscribe')}
            </button>
            <button
              onClick={() => void handleRestore()}
              disabled={paywallBusy}
              className="mt-2 min-h-11 w-full text-center text-xs font-semibold text-primary disabled:opacity-50"
            >
              {t('social.games.paywall.restore')}
            </button>
            <p className="mt-3 text-[10px] leading-snug text-muted-foreground">{t('social.games.paywall.disclosure')}</p>
            {!available && <p className="mt-2 text-[10px] font-semibold text-muted-foreground">{t('social.games.paywall.unavailable')}</p>}
          </div>
        </div>
      )}

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
