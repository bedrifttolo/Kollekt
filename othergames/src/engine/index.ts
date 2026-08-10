// Public API of the Kollekt drinking game engine (server-side).
// The pure round-generation, scoring and config logic extracted from the
// Kollekt frontend. UI-state helpers (player list management) deliberately
// stay in the frontend and are NOT part of this engine.

export type {
  Player,
  PlayerStats,
  GameEvent,
  GameEventText,
  Round,
  RoundType,
  GameLang,
  GameSession,
  GameConfig,
  SessionStatus,
  SessionPlayerSummary,
} from './types';

export { DEFAULT_GUEST_STATS } from './types';

export {
  CHILL_GAME_CONFIG,
  MEDIUM_GAME_CONFIG,
  SPICY_GAME_CONFIG,
  GAME_PRESETS,
} from './gameConfig';
export type { GamePreset } from './gameConfig';

export { generateRound, generateAllRounds } from './roundEngine';

export {
  buildSessionSummaries,
  performanceTier,
} from './statProcessor';
export type { PerformanceTier } from './statProcessor';

/** Minimum active players required to start a session. */
export const MIN_PLAYERS = 2;
