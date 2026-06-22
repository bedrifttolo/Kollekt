// Per-member avatar colors. Each member gets a stable, distinct color derived from their
// name so avatars look the same on every screen, and can be overridden by an explicit
// color the member picks in their profile.

export const MEMBER_COLORS = [
  '#1f563f', // pine
  '#b84d6d', // rose
  '#7fa7c9', // sky
  '#d99a2b', // amber
  '#356d53', // moss
  '#e07a5f', // clay
  '#6b6bb8', // iris
  '#3f8a8a', // teal
  '#9c5fb8', // plum
  '#c98a3d', // ochre
];

/** Deterministic color from a seed (member name), unless an explicit color is set. */
export function colorForMember(seed: string, explicit?: string | null): string {
  if (explicit && explicit.trim()) return explicit;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return MEMBER_COLORS[hash % MEMBER_COLORS.length];
}
