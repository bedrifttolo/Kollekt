import type { Tone } from './tones';

/** Tone | 'leaf' — 'leaf' is Tasks' one deliberate exception to the 6-tone ramp (see --tone-leaf
 *  in globals.css for why: mint and sage were both already spoken for). */
export type Accent = Tone | 'leaf';

/** Single source of truth for "this belongs to page X" — read by AppHeader, Eyebrow's `accent`
 *  prop, Home's preview-section tones, and the Tasks "x/y" fraction. Home ("/") stays absent:
 *  it mixes every category, so it keeps neutral chrome. */
export const PAGE_ACCENTS: Record<string, Accent> = {
  '/tasks': 'leaf',
  '/calendar': 'sage',
  '/economy': 'mint',
  '/economy/pant': 'mint',
  '/social': 'butter',
  '/chat': 'lilac',
};
