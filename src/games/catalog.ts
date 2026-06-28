// Local games catalog. All game content/logic lives in this folder (src/games) — no API.
// Add new games by appending a GameEntry here and (for playable ones) a component the
// GamesPanel can launch.

export type GameCategory = 'classic' | 'party' | 'cards';
export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'party';
export type GameCategoryFilter = 'all' | GameCategory;

export interface GameEntry {
  id: string;
  /** i18n key under `social.games.catalog.<titleKey>` */
  titleKey: string;
  descriptionKey: string;
  emoji: string;
  category: GameCategory;
  difficulty: GameDifficulty;
  minPlayers: number;
  minutes: number;
  /** Playable locally now. `false` renders a "coming soon" card to be filled in later. */
  playable: boolean;
  /**
   * Premium games require an active games subscription to launch. Always-free games
   * (Kollekt, 100 Questions, Dice, Spin the Wheel) and a few others stay open so the
   * hub is useful without paying. Gating is enforced in GamesPanel via `useGamesSubscription`.
   */
  requiresSubscription?: boolean;
  drinkingGameId?: 'hundred-questions' | 'truth-or-chug' | 'never-have-i-ever';
  roomGame?: boolean;
  soloGame?: boolean;
}

export const GAME_CATALOG: GameEntry[] = [
  { id: 'dice', titleKey: 'dice', descriptionKey: 'dice', emoji: '🎲', category: 'classic', difficulty: 'easy', minPlayers: 1, minutes: 2, playable: true, soloGame: true },
  { id: 'kollekt', titleKey: 'kollekt', descriptionKey: 'kollekt', emoji: '🏠', category: 'classic', difficulty: 'medium', minPlayers: 2, minutes: 20, playable: true },
  { id: 'spin-the-wheel', titleKey: 'spinTheWheel', descriptionKey: 'spinTheWheel', emoji: '🎡', category: 'party', difficulty: 'easy', minPlayers: 2, minutes: 5, playable: true },
  { id: 'prompt-relay', titleKey: 'promptRelay', descriptionKey: 'promptRelay', emoji: '✍️', category: 'party', difficulty: 'party', minPlayers: 2, minutes: 20, playable: true, roomGame: true },
  { id: 'hundred-questions', titleKey: 'hundredQuestions', descriptionKey: 'hundredQuestions', emoji: '💯', category: 'party', difficulty: 'party', minPlayers: 2, minutes: 20, playable: true, drinkingGameId: 'hundred-questions' },
  { id: 'mexican', titleKey: 'mexican', descriptionKey: 'mexican', emoji: '🎲', category: 'classic', difficulty: 'easy', minPlayers: 2, minutes: 10, playable: true },
  { id: 'categories', titleKey: 'categories', descriptionKey: 'categories', emoji: '💭', category: 'party', difficulty: 'easy', minPlayers: 2, minutes: 15, playable: true },
  { id: 'snusboksen', titleKey: 'snusboksen', descriptionKey: 'snusboksen', emoji: '🥫', category: 'party', difficulty: 'party', minPlayers: 2, minutes: 15, playable: true },
  { id: 'liars-dice', titleKey: 'liarsDice', descriptionKey: 'liarsDice', emoji: '🥤', category: 'classic', difficulty: 'medium', minPlayers: 1, minutes: 15, playable: true, soloGame: true, requiresSubscription: true },
  { id: 'truth-or-chug', titleKey: 'truthOrChug', descriptionKey: 'truthOrChug', emoji: '🍻', category: 'party', difficulty: 'party', minPlayers: 2, minutes: 25, playable: true, drinkingGameId: 'truth-or-chug', requiresSubscription: true },
  { id: 'never-have-i-ever', titleKey: 'neverHaveIEver', descriptionKey: 'neverHaveIEver', emoji: '🙈', category: 'party', difficulty: 'party', minPlayers: 2, minutes: 20, playable: true, drinkingGameId: 'never-have-i-ever', requiresSubscription: true },
  { id: 'kings-cup', titleKey: 'kingsCup', descriptionKey: 'kingsCup', emoji: '🃏', category: 'cards', difficulty: 'medium', minPlayers: 2, minutes: 30, playable: true, requiresSubscription: true },
  { id: 'charades', titleKey: 'charades', descriptionKey: 'charades', emoji: '🕺', category: 'party', difficulty: 'party', minPlayers: 2, minutes: 20, playable: true, requiresSubscription: true },
];

export const GAME_CATEGORIES: Array<{ id: GameCategoryFilter; emoji?: string }> = [
  { id: 'all' },
  { id: 'classic', emoji: '🎲' },
  { id: 'party', emoji: '🎉' },
  { id: 'cards', emoji: '🃏' },
];

/** Deterministic "tonight's pick" that rotates once per day. */
export function tonightsPick(): GameEntry {
  const day = Math.floor(Date.now() / 86_400_000);
  return GAME_CATALOG[day % GAME_CATALOG.length];
}
