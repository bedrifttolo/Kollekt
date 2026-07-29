import confetti from 'canvas-confetti';
import { errorFeedback, successFeedback, tapFeedback, ImpactStyle } from './haptics';

/**
 * The app's reward moments.
 *
 * Kollekt asks people to do chores. The only reason to come back is that the app notices when you
 * do, and nothing here noticed: a completed task, a settled balance and a level-up all resolved into
 * a silently re-rendered list. This is the one place that decides how loud each of those is.
 *
 * The volume ladder matters more than the effects themselves. Confetti on every checkbox stops
 * meaning anything within a day, so routine actions get a haptic and an in-place animation, and the
 * full burst is reserved for things that genuinely do not happen often.
 */
export type CelebrationKind =
  /** A chore ticked off. The most frequent action in the app — haptic only, no confetti. */
  | 'task-complete'
  /** Every 200 XP. Full burst. */
  | 'level-up'
  /** Hitting 3 / 7 / 14 consecutive days. Full burst. */
  | 'streak-milestone'
  /** A balance cleared. Full burst — this is the moment the money features exist for. */
  | 'settled'
  /** An achievement unlocked. Medium burst. */
  | 'achievement'
  /** A pant goal reached. Medium burst. */
  | 'goal-reached'
  /** Onboarding finished / household created. Medium burst. */
  | 'joined';

type Recipe = {
  particleCount: number;
  spread: number;
  startVelocity: number;
  scalar: number;
  /** Which palette to draw from — see paletteFor(). */
  palette: 'tone' | 'money' | 'gold';
  haptic: 'success' | 'impact' | 'none';
};

const RECIPES: Record<CelebrationKind, Recipe> = {
  'task-complete': { particleCount: 0, spread: 0, startVelocity: 0, scalar: 1, palette: 'tone', haptic: 'impact' },
  'level-up': { particleCount: 90, spread: 82, startVelocity: 42, scalar: 1.05, palette: 'tone', haptic: 'success' },
  'streak-milestone': { particleCount: 70, spread: 70, startVelocity: 40, scalar: 1, palette: 'gold', haptic: 'success' },
  settled: { particleCount: 80, spread: 76, startVelocity: 40, scalar: 1, palette: 'money', haptic: 'success' },
  achievement: { particleCount: 55, spread: 62, startVelocity: 36, scalar: 0.95, palette: 'gold', haptic: 'success' },
  'goal-reached': { particleCount: 55, spread: 62, startVelocity: 36, scalar: 0.95, palette: 'money', haptic: 'success' },
  joined: { particleCount: 60, spread: 90, startVelocity: 38, scalar: 1, palette: 'tone', haptic: 'success' },
};

/** Resolve a CSS custom property to a concrete colour. Confetti draws to a canvas, which cannot
 *  read var(), so the current theme's values have to be sampled at call time — not cached, since
 *  the user can switch theme mid-session. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function paletteFor(palette: Recipe['palette']): string[] {
  switch (palette) {
    // Money moments borrow the hero's positive tint plus the two greens already used for balances,
    // so a settle-up burst reads as "paid" rather than as generic party confetti.
    case 'money':
      return [
        cssVar('--hero-positive', '#7df0b4'),
        cssVar('--tone-mint', '#b7dcc9'),
        cssVar('--cat-groceries', '#1baf7a'),
      ];
    case 'gold':
      return [
        cssVar('--tone-butter', '#efd98a'),
        cssVar('--cat-food', '#eda100'),
        cssVar('--tone-blush', '#f0d6cc'),
      ];
    default:
      return [
        cssVar('--tone-peri', '#b9bef5'),
        cssVar('--tone-butter', '#efd98a'),
        cssVar('--tone-mint', '#b7dcc9'),
        cssVar('--tone-lilac', '#cfc0ee'),
        cssVar('--tone-blush', '#f0d6cc'),
      ];
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fire a celebration.
 *
 * `origin` is in normalised viewport coordinates (0-1, top-left origin), so a caller can burst from
 * the element that was actually tapped — see originOf(). Defaults to slightly above centre, which
 * is where the eye already is on a phone.
 *
 * Safe to call from anywhere: it never throws, is a no-op during SSR, and downgrades to haptics
 * alone when the user has asked for reduced motion.
 */
export function celebrate(kind: CelebrationKind, origin?: { x: number; y: number }): void {
  const recipe = RECIPES[kind];

  if (recipe.haptic === 'success') void successFeedback();
  else if (recipe.haptic === 'impact') void tapFeedback(ImpactStyle.Medium);

  if (recipe.particleCount === 0) return;
  if (typeof window === 'undefined') return;
  // Reduced motion still gets the haptic above — the feedback survives, the spectacle does not.
  if (prefersReducedMotion()) return;

  try {
    confetti({
      particleCount: recipe.particleCount,
      spread: recipe.spread,
      startVelocity: recipe.startVelocity,
      scalar: recipe.scalar,
      colors: paletteFor(recipe.palette),
      origin: origin ?? { x: 0.5, y: 0.42 },
      ticks: 160,
      gravity: 1.1,
      decay: 0.92,
      disableForReducedMotion: true,
      // Above the bottom nav (z-50) and below the sheets (z-60), so a burst triggered from inside a
      // modal is not painted over the modal that triggered it.
      zIndex: 55,
    });
  } catch {
    // Confetti is decoration; never let it break the action that earned it.
  }
}

/** Normalised viewport origin of an element, for bursting from the thing the user actually tapped. */
export function originOf(element: Element | null | undefined): { x: number; y: number } | undefined {
  if (!element || typeof window === 'undefined') return undefined;
  const rect = element.getBoundingClientRect();
  if (!rect.width && !rect.height) return undefined;
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };
}

/** Failure counterpart, so an action that is rejected is as legible by feel as one that succeeds. */
export function reject(): void {
  void errorFeedback();
}
