import type { Tone } from './tones';

/** Tone | 'primary' — 'primary' is Tasks' one deliberate exception to the 6-tone ramp. */
export type Accent = Tone | 'primary';

/** Single source of truth for "this belongs to page X" — read by AppHeader, Eyebrow's `accent`
 *  prop, Home's preview-section tones, and the Tasks "x/y" fraction. Home ("/") stays absent:
 *  it mixes every category, so it keeps neutral chrome. */
export const PAGE_ACCENTS: Record<string, Accent> = {
  '/tasks': 'primary',
  '/calendar': 'sage',
  '/economy': 'mint',
  '/economy/pant': 'mint',
  '/social': 'butter',
  '/chat': 'lilac',
};
