import type { LeaderboardPlayer, MemberStats } from './types';
import {
  DEFAULT_GUEST_STATS,
  GAME_PRESETS,
  MIN_PLAYERS,
  buildSessionSummaries as buildLocalSummaries,
  generateRound as generateLocalRound,
  performanceTier,
} from '../../othergames/src/engine';
import type {
  GameConfig,
  GameLang,
  Player,
  PlayerStats,
  Round,
  RoundType,
} from '../../othergames/src/engine';
import type { GamePreset } from '../../othergames/src/engine';

export type { GameConfig, GameLang, GamePreset, Player, PlayerStats, Round, RoundType };

export interface GamePresetEntry {
  label: string;
  description: string;
  config: GameConfig;
}

export type PerformanceTier = 'elite' | 'solid' | 'average' | 'struggling' | 'rookie';

export interface SessionPlayerSummary {
  name: string;
  isGuest: boolean;
  performanceScore: number;
  sessionRank: number;
  tier: PerformanceTier;
}

function genId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

export function getKollektMeta(): Promise<{
  presets: Record<GamePreset, GamePresetEntry>;
  minPlayers: number;
  defaultGuestStats: PlayerStats;
}> {
  return Promise.resolve({ presets: GAME_PRESETS, minPlayers: MIN_PLAYERS, defaultGuestStats: DEFAULT_GUEST_STATS });
}

export async function generateRound(params: {
  roundNumber: number;
  players: Player[];
  preset: GamePreset;
  usedIds: string[];
  lang: GameLang;
}): Promise<{ round: Round | null; usedIds: string[] }> {
  const usedIds = new Set(params.usedIds);
  const round = generateLocalRound(params.roundNumber, params.players, GAME_PRESETS[params.preset].config, usedIds, params.lang);
  return { round, usedIds: [...usedIds] };
}

export async function buildSessionSummaries(players: Player[]): Promise<SessionPlayerSummary[]> {
  return buildLocalSummaries(players).map((summary) => ({
    ...summary,
    tier: performanceTier(summary.performanceScore),
  }));
}

export function fromLeaderboardPlayer(lb: LeaderboardPlayer, detail?: MemberStats): Player {
  return {
    id: genId(),
    name: lb.name,
    isGuest: false,
    active: true,
    stats: {
      level: lb.level,
      xp: lb.xp,
      rank: lb.rank,
      streak: lb.streak,
      tasksCompleted: lb.tasksCompleted,
      lateCompletions: detail?.lateCompletions ?? 0,
      skippedTasks: detail?.skippedTasks ?? 0,
      achievementsUnlocked: detail?.achievementsUnlocked ?? 0,
      badges: lb.badges,
    },
  };
}

export function createGuestPlayer(name: string): Player {
  if (!name.trim()) throw new Error('Guest player name must not be empty');
  return { id: genId(), name: name.trim(), isGuest: true, active: true, stats: { ...DEFAULT_GUEST_STATS } };
}

export function togglePlayerActive(players: Player[], name: string): Player[] {
  return players.map((player) => player.name === name ? { ...player, active: !player.active } : player);
}

export function addPlayer(players: Player[], newPlayer: Player): Player[] {
  if (players.some((player) => player.name.toLowerCase() === newPlayer.name.toLowerCase())) throw new Error('Duplicate player');
  return [...players, newPlayer];
}

export function removePlayer(players: Player[], name: string): Player[] {
  return players.filter((player) => player.name !== name);
}

export function getActivePlayers(players: Player[]): Player[] {
  return players.filter((player) => player.active);
}

export function canStartGame(players: Player[]): boolean {
  return getActivePlayers(players).length >= MIN_PLAYERS;
}
