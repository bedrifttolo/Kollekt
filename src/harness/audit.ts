/**
 * Layout audit that runs inside the harness page and writes its result into the DOM, so a headless
 * Chrome `--dump-dom` can read it without a DevTools-protocol driver (the repo has no puppeteer).
 *
 * The touch-target check has to be done from the live layout rather than by grepping classNames:
 * `.pressable-tight` and `.btn-sm` deliver their 44px through an invisible ::after, so an element
 * that greps as 28px tall is fine and an element that greps as fine may not be.
 */

/** Elements whose hit area is grown by a pseudo-element rather than their own box. */
const TIGHT = '.pressable-tight, .btn-sm';

export interface AuditResult {
  page: string;
  smallTargets: Array<{ h: number; w: number; label: string }>;
  overlappingTight: Array<{ a: string; b: string; gap: number }>;
  tinyText: Array<{ px: number; text: string }>;
  overflowing: Array<{ by: number; label: string; within: string }>;
  gutters: number[];
}

function label(el: Element): string {
  return (
    el.getAttribute('aria-label') ||
    (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) ||
    el.className.toString().slice(0, 40)
  );
}

export function runAudit(page: string): AuditResult {
  const interactive = [...document.querySelectorAll<HTMLElement>('button, [role="tab"], [role="button"], a, input, select, textarea')]
    .filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);

  // 1. Anything a thumb aims at that is under 44px and is not opting into a grown hit area.
  //
  // Two exemptions, both cases where the measured box is not the real target:
  //   - a link inside a paragraph of prose (the Terms/Privacy links in the legal line). An inline
  //     link cannot be given a 44px box without breaking the line it sits in; WCAG 2.5.8 exempts it.
  //   - a form control whose <label> wraps it and is itself >=44px — tapping the label focuses the
  //     control, so the label is the target. This is what `.field` does.
  const exempt = (el: HTMLElement) => {
    if (el.tagName === 'A' && el.closest('p')) return true;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
      const wrapper = el.closest('label, .field');
      if (wrapper && wrapper.getBoundingClientRect().height >= 43.5) return true;
    }
    return false;
  };

  // Measured with offsetHeight/offsetWidth rather than getBoundingClientRect: the latter includes
  // transforms, so a button that is a full 44px in layout but animates to scale(.88) while it has
  // nothing to do (the chat send button) reads as 39px and looks like a defect it isn't. The layout
  // box is what the browser actually hit-tests against for a scaled element's centre.
  const smallTargets = interactive
    .filter((el) => !el.matches(TIGHT) && !el.closest(TIGHT) && !exempt(el))
    .filter((el) => el.offsetHeight > 0 && el.offsetHeight < 43.5)
    .map((el) => ({ h: el.offsetHeight, w: el.offsetWidth, label: label(el) }));

  // 2. Two grown hit areas closer than 44px apart overlap, and the later one in DOM order swallows
  //    the tap on the shared strip — a bug you cannot see in a screenshot.
  const tight = [...document.querySelectorAll<HTMLElement>(TIGHT)];
  const overlappingTight: AuditResult['overlappingTight'] = [];
  for (let i = 0; i < tight.length; i++) {
    for (let j = i + 1; j < tight.length; j++) {
      const a = tight[i].getBoundingClientRect();
      const b = tight[j].getBoundingClientRect();
      const verticallyClose = Math.abs(a.top - b.top) < 24;
      if (!verticallyClose) continue;
      const gap = b.left > a.left ? b.left - a.right : a.left - b.right;
      if (gap >= 0 && gap < 12) {
        overlappingTight.push({ a: label(tight[i]), b: label(tight[j]), gap: Math.round(gap) });
      }
    }
  }

  // 3. Text under 11px that is inside something interactive — a button label or a form value, not a
  //    decorative eyebrow. Eyebrows and badge counters are allowed to stay at 10px.
  const tinyText: AuditResult['tinyText'] = [];
  for (const el of document.querySelectorAll<HTMLElement>('*')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent || '').trim());
    if (!own) continue;
    if (el.closest('.eyebrow')) continue;
    // The bottom nav is a documented exception: six tabs with Nordic compound labels do not fit at
    // 11px on a 393pt dock (see BottomNav). Flagging it on every page would make this check noise.
    if (el.closest('.app-bottom-nav')) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px && px < 10.5 && el.closest('button, a, [role="button"], input, textarea, select')) {
      tinyText.push({ px: Math.round(px * 10) / 10, text: (el.textContent || '').trim().slice(0, 30) });
    }
  }

  // 4. Content wider than the box that is supposed to contain it.
  //
  // This is the check that was missing when a bottom-nav label bumped from 10px to 11px: the tabs
  // are flex-1 without min-w-0, so a label too wide for its share overflowed the rounded dock
  // instead of shrinking. Nothing else in the audit could see it — the target was still 44px, the
  // text was still legible, and the page still measured clean.
  const overflowing: AuditResult['overflowing'] = [];
  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    const parent = el.parentElement;
    if (!parent || parent === document.body) continue;

    // Skip containers that are *meant* to be scrolled or clipped: a horizontally scrollable strip
    // (the month picker, a chip row) legitimately holds content wider than itself, and anything
    // under overflow:hidden is deliberately cropped rather than spilling onto the screen.
    const pstyle = getComputedStyle(parent);
    if (pstyle.overflowX !== 'visible' || pstyle.overflowY !== 'visible') continue;
    // Absolutely positioned decoration (the chat wallpaper, progress-bar fills, the nav's active
    // pill) is placed against a containing block rather than flowing inside the parent's box.
    const style = getComputedStyle(el);
    if (style.position === 'absolute' || style.position === 'fixed') continue;
    // Deliberate outdents: `.app-screen`'s negative bottom margin, optically-aligned back links.
    if (parseFloat(style.marginLeft) < 0 || parseFloat(style.marginRight) < 0) continue;

    const a = el.getBoundingClientRect();
    const b = parent.getBoundingClientRect();
    if (a.width === 0 || b.width === 0) continue;
    const spill = Math.max(b.left - a.left, a.right - b.right);
    // 1px of tolerance for subpixel rounding at fractional device pixel ratios.
    if (spill > 1) overflowing.push({ by: Math.round(spill), label: label(el), within: label(parent).slice(0, 20) });
  }

  // 5. Distinct left edges of the page's top-level blocks. They should share one gutter.
  //
  // Elements with a negative left margin are skipped: outdenting a text button so its *glyph* lines
  // up with the text below it is deliberate optical alignment, and its box legitimately starts left
  // of the gutter. Flagging those trains you to ignore the check.
  const main = document.querySelector('main');
  const gutters = main
    ? [...new Set([...main.querySelectorAll<HTMLElement>(':scope > * > *')]
        .filter((el) => parseFloat(getComputedStyle(el).marginLeft) >= 0)
        .map((el) => Math.round(el.getBoundingClientRect().left))
        .filter((x) => x > 0 && x < 60))].sort((a, b) => a - b)
    : [];

  return { page, smallTargets, overlappingTight, tinyText, overflowing, gutters };
}

/** Renders the result into a <pre> so `--dump-dom` can pick it up. */
export function mountAudit(page: string, delayMs = 2500) {
  window.setTimeout(() => {
    const node = document.createElement('pre');
    node.id = 'harness-audit';
    node.style.display = 'none';
    try {
      node.textContent = JSON.stringify(runAudit(page), null, 1);
    } catch (error) {
      node.textContent = 'AUDIT_FAILED ' + String(error);
    }
    document.body.appendChild(node);
  }, delayMs);
}
