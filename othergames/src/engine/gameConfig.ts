import type { GameConfig } from './types';

// ─── Presets ──────────────────────────────────────────────────────────────────
//
// All three tiers play a 30-round session; they differ in tone, not length —
// CHILL leans toward gentle stat comparisons and hot-seat votes, SPICY leans
// toward challenges and trivia with higher stakes.

export const CHILL_GAME_CONFIG: GameConfig = {
  maxRounds: 30,
  drinkMultiplier: 0.5,
  statInfluence: 0.4,
  roundTypeWeights: {
    STAT_COMPARISON: 15,
    CHALLENGE: 15,
    HOT_SEAT: 35,
    TRIVIA_TWIST: 20,
    RANDOM_EVENT: 15,
    PROMPT_CARD: 15,
  },
  allowSkip: true,
  skipDrinkPenalty: 1,
  alcoholMode: false,
  promptSpice: 'chill',
};

export const MEDIUM_GAME_CONFIG: GameConfig = {
  maxRounds: 30,
  drinkMultiplier: 1.0,
  statInfluence: 0.65,
  roundTypeWeights: {
    STAT_COMPARISON: 30,
    CHALLENGE: 25,
    HOT_SEAT: 20,
    TRIVIA_TWIST: 15,
    RANDOM_EVENT: 10,
    PROMPT_CARD: 15,
  },
  allowSkip: true,
  skipDrinkPenalty: 2,
  alcoholMode: false,
  promptSpice: 'medium',
};

export const SPICY_GAME_CONFIG: GameConfig = {
  maxRounds: 30,
  drinkMultiplier: 2.0,
  statInfluence: 0.85,
  roundTypeWeights: {
    STAT_COMPARISON: 20,
    CHALLENGE: 35,
    HOT_SEAT: 10,
    TRIVIA_TWIST: 25,
    RANDOM_EVENT: 10,
    PROMPT_CARD: 15,
  },
  allowSkip: false,
  skipDrinkPenalty: 4,
  alcoholMode: false,
  promptSpice: 'spicy',
};

export type GamePreset = 'chill' | 'medium' | 'spicy';

export const GAME_PRESETS: Record<
  GamePreset,
  { label: string; description: string; descriptionAlcohol?: string; config: GameConfig }
> = {
  chill: {
    label: 'Chill',
    description: '30 rounds, easygoing — light stakes, mostly hot-seat and trivia.',
    descriptionAlcohol: '30 rounds, easygoing — light sips, mostly hot-seat and trivia.',
    config: CHILL_GAME_CONFIG,
  },
  medium: {
    label: 'Medium',
    description: '30 rounds, balanced mix of chaos and stats.',
    config: MEDIUM_GAME_CONFIG,
  },
  spicy: {
    label: 'Spicy',
    description: '30 rounds, high stakes — more challenges, double points, no mercy.',
    descriptionAlcohol: '30 rounds, high stakes — more challenges, double drinks, no mercy.',
    config: SPICY_GAME_CONFIG,
  },
};
