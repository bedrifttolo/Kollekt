import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { isIOS } from './platform';

/**
 * Publishes the on-screen keyboard's height as `--keyboard-inset` on <html>, so bottom-docked
 * chrome (the chat composer above all) rides up *with* the keyboard instead of after it.
 *
 * Why this exists at all: @capacitor/keyboard's iOS `resize: native` mode schedules its
 * `webView.setFrame` for `keyboardAnimationDuration + 0.2s` after UIKeyboardWillShow, and then
 * applies it outside any animation block (see Keyboard.m `setKeyboardHeight:delay:` /
 * `_updateFrame`). The keyboard therefore finishes sliding up, ~200ms of nothing passes, and only
 * then does the webview snap to its new size — which is precisely the "the input box doesn't open
 * as fast as the keyboard" lag. iMessage and Snapchat have no such gap because their input bar is
 * animated from `keyboardWillShow` with the keyboard's own duration and curve.
 *
 * So the app opts out of the native resize entirely (`KeyboardResize.None` in capacitor.config.ts)
 * and drives layout from this module instead: the inset is set in the same turn as
 * `keyboardWillShow` — i.e. as UIKit starts the keyboard animation, not after it ends — and the
 * consuming CSS transitions on the matching duration/curve, so the two move as one surface.
 */

/**
 * iOS animates the keyboard over 250ms on UIViewAnimationCurve(7), a private curve UIKit does not
 * expose to the webview; cubic-bezier(.17,.59,.4,1) is its standard approximation. Matching the
 * curve matters as much as the start time — an input bar that eases differently from the keyboard
 * still reads as lag even when both begin on the same frame.
 */
const IOS_KEYBOARD_DURATION_MS = 250;
const IOS_KEYBOARD_EASE = 'cubic-bezier(.17,.59,.4,1)';

/** Below this the "keyboard" is really browser chrome collapsing, not a keyboard. Web path only. */
const WEB_MIN_KEYBOARD_HEIGHT = 120;

/** Fired on `window` whenever the inset changes, before the CSS transition has run. */
export const KEYBOARD_EVENT = 'kollekt:keyboard';

export interface KeyboardInsetDetail {
  /** Keyboard height in CSS pixels — 0 when it is closing or closed. */
  height: number;
  /** How long the layout takes to follow it; 0 when the platform reports position live. */
  durationMs: number;
}

/** Subscribes to keyboard inset changes. Returns an unsubscribe function. */
export function onKeyboardInset(handler: (detail: KeyboardInsetDetail) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<KeyboardInsetDetail>).detail);
  window.addEventListener(KEYBOARD_EVENT, listener);
  return () => window.removeEventListener(KEYBOARD_EVENT, listener);
}

let currentHeight = 0;

/** The last reported keyboard height, for code that mounts mid-animation. */
export function keyboardHeight(): number {
  return currentHeight;
}

function applyInset(height: number, durationMs: number): void {
  if (height === currentHeight) return;
  currentHeight = height;
  const root = document.documentElement;
  // Duration first and in the same turn: a CSS transition reads its timing from the after-change
  // style, so both custom properties have to land before the browser next computes style.
  root.style.setProperty('--keyboard-anim-duration', `${durationMs}ms`);
  root.style.setProperty('--keyboard-inset', `${height}px`);
  window.dispatchEvent(
    new CustomEvent<KeyboardInsetDetail>(KEYBOARD_EVENT, { detail: { height, durationMs } }),
  );
}

export function initKeyboardInsets(): void {
  document.documentElement.style.setProperty('--keyboard-anim-ease', IOS_KEYBOARD_EASE);

  if (Capacitor.isNativePlatform()) {
    // Android only: the WebView is already shrunk for the IME, so 100dvh and the safe-area
    // utilities track it for free and publishing an inset here as well would move bottom-docked
    // chrome twice as far as the keyboard travels. Note it is NOT windowSoftInputMode that does
    // this — android/variables.gradle targets SDK 36, and from API 35 edge-to-edge is enforced and
    // adjustResize ignored. What shrinks it is Capacitor's own SystemBars.initWindowInsetsListener
    // (@capacitor/android), which pads the WebView's parent by imeInsets.bottom while the IME is
    // visible; its `insetsHandling` config defaults to "css" and this app never overrides it.
    if (!isIOS()) return;
    void Keyboard.addListener('keyboardWillShow', (info) => {
      applyInset(Math.round(info.keyboardHeight), IOS_KEYBOARD_DURATION_MS);
    });
    void Keyboard.addListener('keyboardWillHide', () => {
      applyInset(0, IOS_KEYBOARD_DURATION_MS);
    });
    return;
  }

  // Web: mobile browsers don't shrink the layout viewport for the on-screen keyboard either, but
  // the visual viewport does track it — and it does so live, frame by frame, so this path wants no
  // transition of its own (durationMs 0) or the layout would trail the reported position.
  const viewport = window.visualViewport;
  if (!viewport) return;
  const sync = () => {
    const overlap = window.innerHeight - viewport.height - viewport.offsetTop;
    applyInset(overlap > WEB_MIN_KEYBOARD_HEIGHT ? Math.round(overlap) : 0, 0);
  };
  viewport.addEventListener('resize', sync);
  viewport.addEventListener('scroll', sync);
}
