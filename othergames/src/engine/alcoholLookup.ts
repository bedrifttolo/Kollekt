import type { GameLang } from './types';
import {
  ALCOHOL_CHALLENGE_TEMPLATES,
  ALCOHOL_GUEST_CHALLENGE_TEMPLATES,
  ALCOHOL_GUEST_HOT_SEAT_TEMPLATES,
  ALCOHOL_HOT_SEAT_TEMPLATES,
  ALCOHOL_RANDOM_EVENT_TEMPLATES,
  ALCOHOL_STAT_COMP_TEMPLATES,
  ALCOHOL_TRIVIA_TWIST_TEMPLATES,
} from './eventTemplatesAlcohol';

interface AlcoholText {
  title: Record<GameLang, string>;
  // Signature varies by template type (target,value,drinkCount | player | players) — callers
  // already know which shape to expect for a given template id, so this stays loosely typed.
  describe: Record<GameLang, (...args: never[]) => string>;
}

const ALCOHOL_BY_ID = new Map<string, AlcoholText>();
for (const template of [
  ...ALCOHOL_STAT_COMP_TEMPLATES,
  ...ALCOHOL_CHALLENGE_TEMPLATES,
  ...ALCOHOL_GUEST_CHALLENGE_TEMPLATES,
  ...ALCOHOL_HOT_SEAT_TEMPLATES,
  ...ALCOHOL_GUEST_HOT_SEAT_TEMPLATES,
  ...ALCOHOL_TRIVIA_TWIST_TEMPLATES,
  ...ALCOHOL_RANDOM_EVENT_TEMPLATES,
]) {
  ALCOHOL_BY_ID.set(template.id, template as unknown as AlcoholText);
}

/** Original alcohol-themed title/describe for a template id, if one exists. */
export function alcoholTextFor(id: string): AlcoholText | undefined {
  return ALCOHOL_BY_ID.get(id);
}
