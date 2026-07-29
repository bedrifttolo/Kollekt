/**
 * The app's categorical palette, defined as CSS custom properties per theme in globals.css.
 *
 * Use these instead of tinting --primary/--accent when a screen needs several things to look
 * distinct from one another (categories, stat tiles, chart segments, room rows). Because the
 * values live in the theme, anything built on them re-colours for free in dark mode.
 */
export const TONES = ['peri', 'butter', 'mint', 'blush', 'sage', 'lilac'] as const;

export type Tone = (typeof TONES)[number];

/** The `.tone-*` class for a tone, pairing a fill with a foreground that is legible on it. */
export function toneClass(tone: Tone): string {
  return `tone-${tone}`;
}

/** Cycles through the ramp by position — for lists where order is the only thing distinguishing
 *  items (podium places, room rows, month bars). Handles negative indices. */
export function toneByIndex(index: number): Tone {
  return TONES[((index % TONES.length) + TONES.length) % TONES.length];
}

/**
 * Picks a stable tone from a string, so the same category or member keeps its colour across
 * screens and reloads rather than depending on list order.
 */
export function toneByKey(key: string): Tone {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return toneByIndex(hash);
}

/** The raw CSS variable for a tone's fill, for inline styles (SVG charts, gradients). */
export function toneVar(tone: Tone): string {
  return `var(--tone-${tone})`;
}
