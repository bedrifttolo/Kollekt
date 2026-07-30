import { useEffect, useRef, type RefObject } from 'react';

// Minimum scroll distance (px) before flipping direction — filters out iOS rubber-banding and
// sub-pixel jitter that would otherwise flicker the nav open/closed.
const THRESHOLD = 8;
// Always shown within this many px of the top, even while "scrolling down" (e.g. a small bounce).
const TOP_GUARD = 8;

/**
 * Toggles `nav-hidden` on the document root as the user scrolls down, and clears it on scroll-up
 * or when back near the top — see the `.app-bottom-nav` rules in globals.css for the actual
 * hide/show animation. Call once per active scroll container: AppLayout uses the window (which
 * covers every page except Chat, whose `.app-screen-full` layout never grows past the viewport),
 * and ChatPage passes a ref to its own internal message-list scroller.
 */
export function useScrollDirection(target?: RefObject<HTMLElement | null>) {
  const lastY = useRef(0);
  const isHidden = useRef(false);

  useEffect(() => {
    const el = target?.current ?? null;
    const node: Window | HTMLElement = el ?? window;
    const getY = () => (el ? el.scrollTop : window.scrollY);

    const setHidden = (next: boolean) => {
      if (isHidden.current === next) return;
      isHidden.current = next;
      document.documentElement.classList.toggle('nav-hidden', next);
    };

    lastY.current = getY();

    const onScroll = () => {
      const y = getY();
      const delta = y - lastY.current;
      if (y <= TOP_GUARD) {
        setHidden(false);
        lastY.current = y;
      } else if (delta > THRESHOLD) {
        setHidden(true);
        lastY.current = y;
      } else if (delta < -THRESHOLD) {
        setHidden(false);
        lastY.current = y;
      }
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      node.removeEventListener('scroll', onScroll);
      setHidden(false);
    };
  }, [target]);
}
