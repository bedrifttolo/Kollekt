import { useEffect, useState } from 'react';
import type { TargetAndTransition, Transition, Variants } from 'framer-motion';

/**
 * The app's motion vocabulary.
 *
 * Before this file, framer-motion was used in 18 components and every one of them re-typed its own
 * literals: five different page-entrance offsets (y: 10/12/16, opacity-only, initial={false}), three
 * accordion variants, and modal slides at y: 24 and y: 40 on adjacent screens. The result read as
 * several apps stitched together. Everything below is the one set those callers should import.
 *
 * Durations and easings mirror the `--dur-` and `--ease-` custom properties in globals.css.
 * A CSS transition and a spring sitting next to each other must agree, so change both or neither.
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** One-time snapshot, for call sites that fire once outside a render (e.g. celebrate.ts). Does not
 *  react to the user toggling the OS setting mid-session — use useReducedMotion() for that. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Live-updating reduced-motion preference, for components that need to branch their own JS logic
 * (skip a fade, skip a stagger delay) rather than rely on framer-motion's own stilling, which only
 * ever touches positional/transform values (x, y, scale, layout, height, ...) — opacity and colour
 * keep animating at full duration by framer-motion's own design. Mirrors ThemeContext's matchMedia
 * listener pattern so a mid-session OS toggle (Settings → Accessibility → Motion, then back to the
 * already-open app) takes effect without a relaunch.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Cards, lists, layout shifts. Settles without overshoot — the default for anything large. */
export const springSoft: Transition = { type: 'spring', stiffness: 320, damping: 32, mass: 0.9 };

/** Presses, badges, counters, celebration marks. Deliberately overshoots; use on small things only. */
export const springPop: Transition = { type: 'spring', stiffness: 520, damping: 22, mass: 0.6 };

/** Non-spring easing for opacity-only and colour crossfades, where a spring has nothing to overshoot. */
export const easeOut: Transition = { duration: 0.22, ease: [0, 0, 0.2, 1] };
export const easeOutSlow: Transition = { duration: 0.38, ease: [0, 0, 0.2, 1] };

/**
 * Staggered list reveal. Promoted from DashboardPage's local container/item pair, which was the
 * de-facto house style but never exported.
 *
 * Pair them: `<motion.ul variants={listContainer} initial="hidden" animate="show">` with
 * `<motion.li variants={listItem}>` children. The parent animates nothing itself — it only owns the
 * stagger — so it is safe to put on an element that already has layout.
 */
export const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0, 0, 0.2, 1] } },
};

/** Same stagger, for grids where items should arrive faster because there are more of them. */
export const gridContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
};

/** Bottom sheets and modals. The backdrop crossfades; the sheet springs up under it. */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

export const sheetVariants: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: springSoft },
  exit: { opacity: 0, y: 24, scale: 0.99, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } },
};

/** Centred dialogs, for the few cases that are not bottom-anchored. */
export const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 12 },
  show: { opacity: 1, scale: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.15 } },
};

/**
 * The expand/collapse accordion repeated verbatim in six files (Chat, Tasks, Pant, Calendar,
 * Profile x2). `height: 'auto'` needs `overflow-hidden` on the animating element or the content
 * spills during the tween — callers must keep that class.
 */
export const collapseVariants: Variants = {
  hidden: { opacity: 0, height: 0 },
  show: { opacity: 1, height: 'auto', transition: { duration: 0.24, ease: [0, 0, 0.2, 1] } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
};

/** A single item arriving on its own — a new chat message, a toast, an unlocked badge. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: springPop },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.12 } },
};

/**
 * Press feedback for a motion component.
 *
 * Spread onto any `motion.button`: `<motion.button {...pressable} data-motion-press>`. The
 * data-motion-press attribute opts the element out of the global CSS `:active { scale(.97) }` in
 * globals.css, which would otherwise compete for the same transform property and cause a visible
 * double-dip on tap.
 */
export const pressable = {
  whileTap: { scale: 0.96 } as TargetAndTransition,
  transition: springPop,
  'data-motion-press': true,
} as const;

/** As above, for large surfaces where a 4% squeeze is too much travel. */
export const pressableSubtle = {
  whileTap: { scale: 0.985 } as TargetAndTransition,
  transition: springPop,
  'data-motion-press': true,
} as const;

/**
 * Deterministic daily variety.
 *
 * Picks an index from `length` that changes once a day and never mid-session. Seeded by the local
 * calendar date so a refetch, a remount or a websocket event cannot reshuffle the copy under the
 * user — the dashboard should feel fresh each morning, not restless each render.
 */
export function dailyIndex(length: number, salt = 0): number {
  if (length <= 0) return 0;
  const now = new Date();
  const day = Math.floor(
    (now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000,
  );
  // Weyl-style hash: multiplying by a large odd constant decorrelates consecutive days, which a
  // plain `day % length` does not — that would walk the list in order and feel like a rotation.
  const hashed = Math.abs(Math.imul(day + salt * 0x9e37, 0x27d4eb2d));
  return hashed % length;
}
