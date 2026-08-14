/**
 * Overlay gallery for the harness.
 *
 * Sheets, modals and full-screen game shells only appear after an interaction, so the page-level
 * harness could never reach them — they were the one part of the app that had *never* been laid out
 * at phone width. (Combined with the missing viewport meta in harness.html, which pinned the layout
 * viewport at 980px, that meant a grid-cols-7 keypad and a w-72 popover were only ever measured with
 * roughly 2.5x the horizontal room they get on a real device.)
 *
 * Each entry mounts the real component with its `open` prop already set, rather than driving clicks:
 * click-driving is slow, order-dependent and breaks whenever a trigger moves. The trade-off is that
 * this proves *layout*, not integration — it does not prove a page passes these same props. The
 * page-level audit still carries that.
 *
 * Add a surface here whenever you add an overlay; anything absent from this list is unverified.
 */
import type { ReactNode } from 'react';
import { Sheet, Button, TextInput } from '../components/ui-kit';
import SubscriptionPaywall from '../components/SubscriptionPaywall';
import VibeSheet from '../components/VibeSheet';
import TourOverlay, { type TourStep } from '../components/TourOverlay';
import EmojiPickerSheet from '../pages/chat/EmojiPickerSheet';
import MeetingTopicMenu from '../pages/chat/MeetingTopicMenu';
import { GameScreen, GameHeader } from '../games/GameScreen';
import PromptGame from '../games/PromptGame';
import LiarsDiceGame from '../games/LiarsDiceGame';
import SpinTheWheel from '../games/SpinTheWheel';
import PlayerSetup from '../games/PlayerSetup';
import DiceGame from '../games/DiceGame';
import DeckGame from '../games/DeckGame';
import type { AppUser, VibeBreakdown } from '../lib/types';

const noop = () => {};

const USER: AppUser = {
  id: 1, name: 'Alice', email: 'alice@example.com',
  collectiveCode: 'ABCD12', status: 'ACTIVE', color: '#ff0000',
};

const MEMBERS = ['Alice', 'Bob', 'Chris'];

const VIBE: VibeBreakdown = {
  base: 50, taskCompletionRate: 0.72, taskCompletionPoints: 18, dueTasksThisWeek: 7,
  completedDueTasksThisWeek: 5, activityBonus: 6, activityBonusCap: 10, tasksCompletedThisWeek: 6,
  planningBonus: 4, planningBonusCap: 8, eventsThisWeek: 2, togethernessBonus: 3,
  togethernessBonusCap: 6, expensesLoggedThisWeek: 3, moodAdjustment: 2, weeklyAverageMood: 4,
  balancePenalty: 2, balancePenaltyCap: 10, balanceSpread: 240,
};

const TOUR_STEPS: TourStep[] = [
  { route: '/', selector: '[data-tour="nav-home"]', titleKey: 'tour.steps.home.title', bodyKey: 'tour.steps.home.body' },
];

/** Long, realistic copy — short lorem never overflows and so never proves anything. */
function SheetBody() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Fordel utgiften mellom de som var med. Alle som er huket av deler likt.
      </p>
      <TextInput placeholder="Beskrivelse" defaultValue="Fellesmiddag med naboene" />
      <div className="flex flex-wrap gap-2">
        {MEMBERS.map((m) => <span key={m} className="pill pill-pine">{m}</span>)}
      </div>
    </div>
  );
}

export const OVERLAYS: Record<string, () => ReactNode> = {
  'sheet-bottom': () => (
    <Sheet open onClose={noop} title="Ny utgift" footer={<Button full>Legg til utgift</Button>}>
      <SheetBody />
    </Sheet>
  ),
  'sheet-center': () => (
    <Sheet open onClose={noop} placement="center" size="md" title="Bekreft betaling"
           footer={<Button full>Marker som betalt</Button>}>
      <SheetBody />
    </Sheet>
  ),
  'sheet-lg-center': () => (
    <Sheet open onClose={noop} placement="center" size="lg" title="Husregler"
           footer={<Button full>Publiser</Button>}>
      <SheetBody />
    </Sheet>
  ),
  paywall: () => <SubscriptionPaywall onClose={noop} />,
  vibe: () => <VibeSheet open score={78} breakdown={VIBE} onClose={noop} />,
  // grid-cols-6 of emoji, the densest grid in the app.
  emoji: () => <EmojiPickerSheet open onClose={noop} onSelect={noop} currentEmoji="🎉" />,
  tour: () => <TourOverlay steps={TOUR_STEPS} storageKey={`harness_tour_${Date.now()}`} />,
  // An anchored popover with a hard w-72, not a modal.
  'meeting-menu': () => (
    <div className="relative flex justify-end p-4">
      <MeetingTopicMenu currentUser={USER} onPostTopic={noop} />
    </div>
  ),
  'game-screen': () => (
    <GameScreen>
      <GameHeader eyebrow="Spillkveld" title="Terningkast" onClose={noop} />
      <SheetBody />
    </GameScreen>
  ),
  // grid-cols-7 spice/round keypad.
  'game-prompt': () => (
    <PromptGame gameId="hundred-questions" players={MEMBERS} onEditPlayers={noop} onClose={noop} />
  ),
  // grid-cols-5 dice tally.
  'game-liars-dice': () => <LiarsDiceGame onClose={noop} />,
  'game-spin': () => <SpinTheWheel members={MEMBERS} onClose={noop} />,
  'game-player-setup': () => (
    <PlayerSetup gameTitle="Terningkast" householdMembers={MEMBERS} initialPlayers={MEMBERS}
                 minPlayers={2} onClose={noop} onStart={noop} />
  ),
  'game-dice': () => <DiceGame onClose={noop} />,
  'game-deck': () => <DeckGame gameKey="whoAreWe" onClose={noop} />,
};

export const OVERLAY_NAMES = Object.keys(OVERLAYS);

/**
 * Overlays render over a page, so mount one behind them — a sheet measured against a blank white
 * document is not the sheet users see, and a transparent panel would look fine over nothing.
 */
export function OverlayStage({ name, children }: { name: string; children: ReactNode }) {
  if (!name) return <>{children}</>;
  const render = OVERLAYS[name];
  if (!render) {
    return (
      <pre style={{ padding: 16, fontFamily: 'monospace' }}>
        Unknown ?overlay={name}
        {'\n\n'}Known: {OVERLAY_NAMES.join(', ')}
      </pre>
    );
  }
  return (
    <>
      {children}
      {render()}
    </>
  );
}
