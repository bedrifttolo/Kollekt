// Local games catalog. All game content/logic lives in this folder (src/games) — no API.
// Add new games by appending a GameEntry here and (for playable ones) a component the
// GamesPanel can launch.

import {
  Beer,
  Dices,
  Drama,
  EyeOff,
  FerrisWheel,
  GlassWater,
  House,
  MessageCircle,
  MessageCircleQuestionMark,
  MessagesSquare,
  Package,
  PartyPopper,
  PenLine,
  Spade,
  Wine,
  type LucideIcon,
} from 'lucide-react';

export type GameCategory = 'classic' | 'party' | 'cards';
export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'party';
export type GameCategoryFilter = 'all' | GameCategory;

export interface GameEntry {
  id: string;
  /** i18n key under `social.games.catalog.<titleKey>` */
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  category: GameCategory;
  difficulty: GameDifficulty;
  minPlayers: number;
  minutes: number;
  /** Playable locally now. `false` renders a "coming soon" card to be filled in later. */
  playable: boolean;
  /**
   * All games require an active games subscription to launch. Gating is enforced in
   * GamesPanel via `useGamesSubscription`.
   */
  requiresSubscription?: boolean;
  drinkingGameId?: 'hundred-questions' | 'truth-or-chug' | 'never-have-i-ever' | 'who-are-we';
  /** Key into `social.games.<deckGameKey>` locale section — uses DeckGame component with mild/medium/droy decks */
  deckGameKey?: string;
  roomGame?: boolean;
  soloGame?: boolean;
}

export const GAME_CATALOG: GameEntry[] = [
  { id: 'kollekt', titleKey: 'kollekt', descriptionKey: 'kollekt', icon: House, category: 'classic', difficulty: 'medium', minPlayers: 2, minutes: 20, playable: true, requiresSubscription: false },
  { id: 'dice', titleKey: 'dice', descriptionKey: 'dice', icon: Dices, category: 'classic', difficulty: 'easy', minPlayers: 1, minutes: 2, playable: true, soloGame: true, requiresSubscription: true },
  { id: 'spin-the-wheel', titleKey: 'spinTheWheel', descriptionKey: 'spinTheWheel', icon: FerrisWheel, category: 'party', difficulty: 'easy', minPlayers: 2, minutes: 5, playable: true, requiresSubscription: true },
  { id: 'prompt-relay', titleKey: 'promptRelay', descriptionKey: 'promptRelay', icon: PenLine, category: 'party', difficulty: 'party', minPlayers: 2, minutes: 20, playable: true, roomGame: true, requiresSubscription: true },
  { id: 'hundred-questions', titleKey: 'hundredQuestions', descriptionKey: 'hundredQuestions', icon: MessageCircleQuestionMark, category: 'party', difficulty: 'party', minPlayers: 2, minutes: 20, playable: true, drinkingGameId: 'hundred-questions', requiresSubscription: true },
  { id: 'mexican', titleKey: 'mexican', descriptionKey: 'mexican', icon: Dices, category: 'classic', difficulty: 'easy', minPlayers: 2, minutes: 10, playable: true, requiresSubscription: true },
  { id: 'categories', titleKey: 'categories', descriptionKey: 'categories', icon: MessagesSquare, category: 'party', difficulty: 'easy', minPlayers: 2, minutes: 15, playable: true, requiresSubscription: true },
  { id: 'snusboksen', titleKey: 'snusboksen', descriptionKey: 'snusboksen', icon: Package, category: 'party', difficulty: 'party', minPlayers: 2, minutes: 15, playable: true, requiresSubscription: true },
  { id: 'who-are-we', titleKey: 'whoAreWe', descriptionKey: 'whoAreWe', icon: MessageCircle, category: 'party', difficulty: 'easy', minPlayers: 2, minutes: 20, playable: true, deckGameKey: 'whoAreWe', requiresSubscription: true },
  { id: 'guys-night', titleKey: 'guysNight', descriptionKey: 'guysNight', icon: Beer, category: 'party', difficulty: 'party', minPlayers: 2, minutes: 30, playable: true, deckGameKey: 'guysNight', requiresSubscription: true },
  { id: 'girls-night', titleKey: 'girlsNight', descriptionKey: 'girlsNight', icon: Wine, category: 'party', difficulty: 'party', minPlayers: 2, minutes: 30, playable: true, deckGameKey: 'girlsNight', requiresSubscription: true },
  { id: 'liars-dice', titleKey: 'liarsDice', descriptionKey: 'liarsDice', icon: GlassWater, category: 'classic', difficulty: 'medium', minPlayers: 1, minutes: 15, playable: true, soloGame: true, requiresSubscription: true },
  { id: 'truth-or-chug', titleKey: 'truthOrChug', descriptionKey: 'truthOrChug', icon: Beer, category: 'party', difficulty: 'party', minPlayers: 2, minutes: 25, playable: true, drinkingGameId: 'truth-or-chug', requiresSubscription: true },
  { id: 'never-have-i-ever', titleKey: 'neverHaveIEver', descriptionKey: 'neverHaveIEver', icon: EyeOff, category: 'party', difficulty: 'party', minPlayers: 2, minutes: 20, playable: true, drinkingGameId: 'never-have-i-ever', requiresSubscription: true },
  { id: 'kings-cup', titleKey: 'kingsCup', descriptionKey: 'kingsCup', icon: Spade, category: 'cards', difficulty: 'medium', minPlayers: 2, minutes: 30, playable: true, requiresSubscription: true },
  { id: 'charades', titleKey: 'charades', descriptionKey: 'charades', icon: Drama, category: 'party', difficulty: 'party', minPlayers: 2, minutes: 20, playable: true, requiresSubscription: true },
];

export const GAME_CATEGORIES: Array<{ id: GameCategoryFilter; icon?: LucideIcon }> = [
  { id: 'all' },
  { id: 'classic', icon: Dices },
  { id: 'party', icon: PartyPopper },
  { id: 'cards', icon: Spade },
];

/** Deterministic "tonight's pick" that rotates once per day. */
export function tonightsPick(): GameEntry {
  const day = Math.floor(Date.now() / 86_400_000);
  return GAME_CATALOG[day % GAME_CATALOG.length];
}
