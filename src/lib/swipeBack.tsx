import { useEffect, useRef } from 'react';

/**
 * iOS-style edge-swipe back gesture.
 *
 * A screen that has a back affordance calls `useSwipeBack(...)` with the *same* action its back
 * button performs — dragging from the left edge then becomes an alternative to tapping it, the way
 * Messages and Snapchat let you leave a conversation with a thumb. Screens that have no back
 * affordance (the bottom-nav tabs) simply never register, so the gesture is inert there instead of
 * dropping people onto whatever route happens to be behind them in history.
 *
 * The listener lives in <SwipeBackGesture/>, mounted once for the app's lifetime, rather than in
 * the hook: the committing animation outlives the screen that started it (calling the handler
 * unmounts that screen), so it must not be tied to a component's effect cleanup.
 */

type BackHandler = () => void;

let activeHandler: BackHandler | null = null;

/** Registers this screen's "go back" action with the global edge-swipe gesture. */
export function useSwipeBack(onBack: BackHandler, enabled = true) {
  const latest = useRef(onBack);
  latest.current = onBack;

  useEffect(() => {
    if (!enabled) return;
    const handler = () => latest.current();
    activeHandler = handler;
    return () => {
      if (activeHandler === handler) activeHandler = null;
    };
  }, [enabled]);
}

const EDGE_ZONE = 28;         // px from the left edge where a drag counts as a back gesture
const DIRECTION_LOCK = 10;    // px of travel before we decide horizontal vs. vertical
const COMMIT_RATIO = 0.3;     // fraction of the screen that commits on distance alone
const COMMIT_VELOCITY = 0.5;  // px/ms flick that commits regardless of distance
const EXIT_MS = 170;
const RETURN_MS = 220;
const ENTER_MS = 200;
const EASE = 'cubic-bezier(.22,.61,.36,1)';

const findSurface = () => document.querySelector<HTMLElement>('[data-swipe-surface]');

const resetSurface = (element: HTMLElement | null) => {
  if (!element) return;
  element.style.transition = '';
  element.style.transform = '';
  element.style.willChange = '';
};

export function SwipeBackGesture() {
  useEffect(() => {
    // Touch input only: on a desktop pointer this would fight with text selection, and there is a
    // real browser back button there anyway.
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;
    const stillMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let surface: HTMLElement | null = null;
    let tracking = false;
    let dragging = false;
    let settling = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastTime = 0;
    let prevX = 0;
    let prevTime = 0;

    const onTouchStart = (event: TouchEvent) => {
      if (settling || !activeHandler || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX > EDGE_ZONE) return;
      // Full-screen overlays (photo viewer, message popover, paywall) opt out: they cover the edge
      // and own their own dismissal.
      if ((event.target as Element | null)?.closest?.('[data-swipe-block]')) return;
      surface = findSurface();
      if (!surface) return;
      tracking = true;
      dragging = false;
      startX = prevX = lastX = touch.clientX;
      startY = touch.clientY;
      prevTime = lastTime = event.timeStamp;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking || !surface) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!dragging) {
        if (Math.abs(dy) > DIRECTION_LOCK && Math.abs(dy) >= Math.abs(dx)) {
          tracking = false;
          return;
        }
        if (dx < DIRECTION_LOCK) return;
        dragging = true;
        surface.style.transition = 'none';
        surface.style.willChange = 'transform';
      }

      // Owning the gesture from here on — otherwise the page scrolls under the drag.
      if (event.cancelable) event.preventDefault();
      prevX = lastX;
      prevTime = lastTime;
      lastX = touch.clientX;
      lastTime = event.timeStamp;
      const travel = Math.max(0, Math.min(dx, window.innerWidth));
      surface.style.transform = `translate3d(${travel}px,0,0)`;
    };

    const finish = (element: HTMLElement, handler: BackHandler) => {
      settling = true;
      const width = window.innerWidth;

      const enter = () => {
        // The screen we land on may be a different DOM node (a chat thread and the inbox live in
        // different layouts), so the incoming surface is looked up after the handler has run.
        const next = findSurface();
        if (next && next !== element) resetSurface(element);
        const target = next ?? element;
        if (stillMotion) {
          resetSurface(target);
          settling = false;
          return;
        }
        target.style.transition = 'none';
        target.style.transform = 'translate3d(-14%,0,0)';
        requestAnimationFrame(() => {
          target.style.transition = `transform ${ENTER_MS}ms ${EASE}`;
          target.style.transform = 'translate3d(0,0,0)';
          window.setTimeout(() => {
            resetSurface(target);
            settling = false;
          }, ENTER_MS + 30);
        });
      };

      if (stillMotion) {
        resetSurface(element);
        handler();
        requestAnimationFrame(enter);
        return;
      }

      element.style.transition = `transform ${EXIT_MS}ms ${EASE}`;
      element.style.transform = `translate3d(${width}px,0,0)`;
      window.setTimeout(() => {
        handler();
        requestAnimationFrame(enter);
      }, EXIT_MS);
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const element = surface;
      surface = null;
      if (!dragging || !element) return;
      dragging = false;

      const width = window.innerWidth || 1;
      const travel = Math.max(0, lastX - startX);
      const elapsed = Math.max(1, lastTime - prevTime);
      const velocity = (lastX - prevX) / elapsed;
      const handler = activeHandler;
      const commit = !!handler && (travel > width * COMMIT_RATIO || (velocity > COMMIT_VELOCITY && travel > 40));

      if (commit && handler) {
        finish(element, handler);
        return;
      }
      if (event.type === 'touchcancel' || stillMotion) {
        resetSurface(element);
        return;
      }
      element.style.transition = `transform ${RETURN_MS}ms ${EASE}`;
      element.style.transform = 'translate3d(0,0,0)';
      window.setTimeout(() => resetSurface(element), RETURN_MS + 30);
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  return null;
}
