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
  emoji: string;
  category: GameCategory;
  difficulty: GameDifficulty;
  minPlayers: number;
  minutes: number;
  /** Playable locally now. `false` renders a "coming soon" card to be filled in later. */
  playable: boolean;
  drinkingGameId?: 'hundred-questions' | 'truth-or-chug' | 'never-have-i-ever';
  roomGame?: boolean;
  soloGame?: boolean;
}

export const GAME_CATALOG: GameEntry[] = [
  { id: 'dice', titleKey: 'dice', emoji: '🎲', category: 'classic', difficulty: 'easy', minPlayers: 1, minutes: 2, playable: true, soloGame: true },
  { id: 'liars-dice', titleKey: 'liarsDice', emoji: '🥤', category: 'classic', difficulty: 'medium', minPlayers: 1, minutes: 15, playable: true, soloGame: true },
  { id: 'kollekt', titleKey: 'kollekt', emoji: '🏠', category: 'classic', difficulty: 'medium', minPlayers: 2, minutes: 20, playable: true },
  { id: 'spin-the-wheel', titleKey: 'spinTheWheel', emoji: '🎡', category: 'party', difficulty: 'easy', minPlayers: 2, minutes: 5, playable: true },
  { id: 'prompt-relay', titleKey: 'promptRelay', emoji: '✍️', category: 'party', difficulty: 'party', minPlayers: 2, minutes: 20, playable: true, roomGame: true },
  { id: 'hundred-questions', titleKey: 'hundredQuestions', emoji: '💯', category: 'party', difficulty: 'party', minPlayers: 2, minutes: 20, playable: true, drinkingGameId: 'hundred-questions' },
  { id: 'truth-or-chug', titleKey: 'truthOrChug', emoji: '🍻', category: 'party', difficulty: 'party', minPlayers: 2, minutes: 25, playable: true, drinkingGameId: 'truth-or-chug' },
  { id: 'never-have-i-ever', titleKey: 'neverHaveIEver', emoji: '🙈', category: 'party', difficulty: 'party', minPlayers: 2, minutes: 20, playable: true, drinkingGameId: 'never-have-i-ever' },
  { id: 'mexican', titleKey: 'mexican', emoji: '🎲', category: 'classic', difficulty: 'easy', minPlayers: 2, minutes: 10, playable: true },
  { id: 'kings-cup', titleKey: 'kingsCup', emoji: '🃏', category: 'cards', difficulty: 'medium', minPlayers: 2, minutes: 30, playable: true },
  { id: 'categories', titleKey: 'categories', emoji: '💭', category: 'party', difficulty: 'easy', minPlayers: 2, minutes: 15, playable: true },
  { id: 'charades', titleKey: 'charades', emoji: '🕺', category: 'party', difficulty: 'party', minPlayers: 2, minutes: 20, playable: true },
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
