import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { MoreHorizontal, Plus, X } from 'lucide-react';
import { cn } from '../ui/utils';
import brandmarkSrc from '../../assets/brandmark.png';
import { colorForMember } from '../../lib/memberColors';
import { backdropVariants, dialogVariants, pressable, sheetVariants, springPop, springSoft } from '../../lib/motion';
import { tapFeedback } from '../../lib/haptics';
import type { Tone } from '../../lib/tones';
import type { Accent } from '../../lib/pageAccent';

/**
 * The app's button.
 *
 * There was no such component: 255 raw <button> elements each restated their own height, padding,
 * radius and weight, so "the primary action" was `min-h-12` on one screen, `min-h-11` on the next,
 * `py-4` on a third and `.btn-pine` (56px) in the games. The three fills already existed as CSS
 * classes and are unchanged — this only settles *size*, and does it in one place.
 *
 *   size="lg"  56px — a full-width primary action: Save, Continue, Sign in, Confirm. The default,
 *                     because the CTA is what a button usually is here.
 *   size="md"  44px — a normal action sharing a row with other content.
 *   size="sm"  32px visible / 44px to a thumb — row-level actions (accept, decline, edit) where a
 *                     44px pill would break the row's density. See .btn-sm in globals.css.
 *
 * `full` rather than a bare `w-full` className so the layout intent is legible at the call site and
 * the base rule in globals.css (button.w-full) keeps applying.
 */
export function Button({
  variant = 'solid',
  size = 'lg',
  full = false,
  loading = false,
  icon,
  haptic = true,
  className,
  children,
  disabled,
  onClick,
  type = 'button',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'> & {
  variant?: 'solid' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  haptic?: boolean;
}) {
  const variants = {
    solid: 'btn-pine',
    secondary: 'btn-lemon',
    ghost: 'btn-ghost',
    danger: 'btn-ghost text-destructive',
  } as const;
  const sizes = { sm: 'btn-sm', md: 'btn-md', lg: '' } as const;

  return (
    <motion.button
      type={type}
      disabled={disabled || loading}
      onClick={(event) => {
        if (haptic) void tapFeedback();
        onClick?.(event);
      }}
      {...pressable}
      className={cn(
        variants[variant],
        sizes[size],
        full && 'w-full',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {children}
    </motion.button>
  );
}

/**
 * The app's text input. `.input` in globals.css carries the sizing; this exists so a call site can
 * say `<TextInput />` instead of restating eight utility classes and getting one of them wrong —
 * 47 of the 84 inputs in the app had no height at all and rendered ~36px.
 *
 * size="sm" (44px) is for inline controls in a popover or the chat composer. Everything on a form
 * should stay at the default 56px so fields line up with each other and with the submit button.
 */
// `size` is Omit'd from the native attributes first: <input size> is a number (character width),
// which would intersect with the union below to `never` and make the prop unusable.
export function TextInput({ size = 'md', invalid, className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: 'sm' | 'md'; invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn('input', size === 'sm' && 'input-sm', className)}
      {...props}
    />
  );
}

export function Textarea({ rows = 3, invalid, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn('input', className)}
      {...props}
    />
  );
}

/**
 * A loading placeholder. Size it to the content it stands in for — a skeleton that doesn't match
 * what replaces it produces exactly the layout jump it was meant to prevent.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton animate-pulse', className)} />;
}

/**
 * A list row: leading glyph, title (+ optional subtitle or progress bar), trailing value.
 *
 * This shape was independently reimplemented in CategoryBars, BudgetBars and half a dozen page
 * sections, each with its own row height, icon size and bar thickness. Renders a <button> when
 * `onClick` is given — floored to 44px — and a plain <div> otherwise, so a static row and a tappable
 * one are never the same element with a different feel.
 */
export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  progress,
  progressColor,
  onClick,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  /** 0-100. Renders a thin bar under the title block. */
  progress?: number;
  progressColor?: string;
  onClick?: () => void;
  className?: string;
}) {
  const interactive = Boolean(onClick);
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      {...(interactive ? { type: 'button' as const, onClick: () => { void tapFeedback(); onClick?.(); } } : {})}
      className={cn(
        'flex min-h-11 w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors',
        interactive && 'hover:bg-muted/40',
        className,
      )}
    >
      {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
          {trailing && <span className="shrink-0 text-sm font-bold tabular-nums">{trailing}</span>}
        </span>
        {subtitle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>}
        {progress !== undefined && (
          <ProgressBar value={progress} size="sm" className="mt-1.5" fillClassName={progressColor ? undefined : 'bg-secondary'} fillStyle={progressColor ? { backgroundColor: progressColor } : undefined} />
        )}
      </span>
    </Tag>
  );
}

export function Field({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field flex flex-col justify-center gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground">{label}</span>
      <input
        className={cn('w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none', className)}
        {...props}
      />
    </label>
  );
}

export function BrandMark({ className = 'h-7 w-7' }: { className?: string }) {
  // The source PNG is a light silver glyph cut from a black background (transparent everywhere
  // else), so it reads fine on dark surfaces as-is. `invert` flips it to dark-on-transparent for
  // light surfaces; `dark:invert-0` restores the original silver tone in dark mode.
  return <img src={brandmarkSrc} alt="" className={cn('invert dark:invert-0', className)} />;
}

/** Apple's wordless logo, for the Sign in with Apple button. Inherits currentColor, which is what
 *  lets the same button be black-on-light and white-on-dark as Apple's guidelines require. */
export function AppleMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.2-1.25 3.02-.99.98-2.14 1.55-3.34 1.45-.03-1.1.44-2.24 1.24-3.03.9-.9 2.2-1.5 3.35-1.44ZM20.9 17.05c-.6 1.38-.9 2-1.67 3.22-1.08 1.7-2.6 3.82-4.48 3.83-1.67.02-2.1-1.09-4.37-1.08-2.27.01-2.74 1.1-4.41 1.09-1.88-.02-3.32-1.93-4.4-3.63-3.02-4.58-3.34-9.95-1.47-12.8 1.32-2.02 3.4-3.2 5.36-3.2 2 0 3.25 1.09 4.9 1.09 1.6 0 2.58-1.1 4.89-1.1 1.75 0 3.6.95 4.93 2.6-4.33 2.37-3.63 8.55.72 9.98Z" />
    </svg>
  );
}

/** Google's four-colour "G". Fixed brand colours by design — it must not follow the theme. */
export function GoogleMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

/**
 * A single-value progress ring.
 *
 * Replaces the `.vibe-ring` conic-gradient, which could not animate: a conic-gradient stop is not an
 * interpolatable property, so the old ring could only ever snap to its final value. An SVG arc
 * animates its dash offset instead, which is what makes progress read as progress.
 *
 * `size` and `thickness` are in px because this draws to an SVG viewBox; everything else about it
 * follows the theme.
 */
export function ProgressRing({
  value,
  size = 84,
  thickness = 9,
  color = 'var(--primary)',
  trackColor = 'var(--muted)',
  children,
  className,
  delay = 0,
}: {
  /** 0-100. Values outside the range are clamped rather than overdrawing the circle. */
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  className?: string;
  delay?: number;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      {/* -90deg so the arc starts at 12 o'clock, which is where people expect a gauge to begin. */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={thickness} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={{ ...springSoft, delay }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">{children}</div>
    </div>
  );
}

export function VibeRing({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, score));
  return (
    <ProgressRing value={value} size={84} thickness={9} color="var(--secondary)">
      <div>
        <CountUp value={value} className="font-display text-xl font-extrabold" />
        <span className="mt-1 block text-[11px] font-bold tracking-[.14em] text-muted-foreground">VIBE</span>
      </div>
    </ProgressRing>
  );
}

/**
 * A number that counts to its value instead of snapping.
 *
 * Used for balances, XP and month totals. The spring is deliberately slow and non-overshooting —
 * money that bounces past its value and settles back reads as a glitch, not as polish.
 */
export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  /** Defaults to a plain rounded integer; pass formatCurrency for money. */
  format?: (n: number) => string;
  className?: string;
}) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 22, mass: 1 });
  const text = useTransform(spring, (latest) => (format ? format(Math.round(latest)) : String(Math.round(latest))));

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  return <motion.span className={cn('tabular-nums', className)}>{text}</motion.span>;
}

/** The app's one loading indicator — a plain background plus this is the whole "loading" state. */
export function LoadingDot({ className }: { className?: string }) {
  return <div className={cn('h-8 w-8 rounded-full gradient-primary animate-pulse', className)} />;
}

export function Eyebrow({ children, accent }: { children: ReactNode; accent?: Accent }) {
  return <p className={cn('eyebrow', accent && `tone-${accent}`)}>{children}</p>;
}

// Deliberately does NOT scroll its own focused field above the keyboard, though it used to: that
// pass waited 300ms and then smooth-scrolled, so it landed long after bindKeyboardScrollAssist
// (src/lib/nativeBootstrap.ts) had already put the field where it belonged, and the two together
// read as the field being shoved around twice. Keyboard avoidance now has exactly one owner.
export function AddSheet({ title, onClose, children, className }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springSoft}
      className={cn('glass elev-2 w-full max-w-full space-y-3 overflow-hidden rounded-2xl p-4', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <CloseButton onClick={onClose} label={title} />
      </div>
      {children}
    </motion.div>
  );
}

/**
 * The standard icon button: 44px hit area, springy press, optional haptic.
 *
 * Before this existed there were four different close-button treatments across the app (bare
 * rounded-full, rounded-full bg-muted, rounded-xl bg-card, bordered) and inline chip X's as small as
 * 12px. `variant="bare"` keeps a small glyph visually small while `.pressable` still guarantees the
 * hit area, which is what makes it safe to use everywhere.
 */
export function IconButton({
  label,
  icon,
  variant = 'solid',
  size = 'md',
  haptic = true,
  className,
  onClick,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'> & {
  label: string;
  icon: ReactNode;
  variant?: 'solid' | 'bare' | 'muted' | 'danger';
  /**
   * 'md' is a real 44px button. 'sm' draws a 32px one and grows an invisible 44px hit area instead —
   * the migration path for the h-7/h-8/h-9 icon buttons scattered through Profile, Tasks and the
   * chat menus, which cannot be inflated to 44px without wrecking the rows they sit in. Two adjacent
   * 'sm' buttons need >=12px of gap or their hit areas overlap.
   */
  size?: 'sm' | 'md';
  haptic?: boolean;
}) {
  const variants = {
    solid: 'border border-border bg-card text-foreground',
    bare: 'text-muted-foreground',
    muted: 'bg-muted text-foreground',
    danger: 'bg-destructive/12 text-destructive',
  } as const;

  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={(event) => {
        if (haptic) void tapFeedback();
        onClick?.(event);
      }}
      {...pressable}
      className={cn(
        'grid shrink-0 place-items-center rounded-full transition-colors',
        size === 'sm' ? 'pressable-tight h-8 w-8' : 'pressable',
        variants[variant],
        className,
      )}
      {...props}
    >
      {icon}
    </motion.button>
  );
}

/** The one close affordance. Every sheet, modal and dismissible card should use this. */
export function CloseButton({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  return (
    <IconButton
      label={label}
      onClick={onClick}
      variant="muted"
      icon={<X className="h-4 w-4" />}
      className={className}
    />
  );
}

/**
 * A small inline remove affordance — the X on a selected member chip, a filter tag, a room row.
 *
 * These are the targets that were 12-14px across the app. The glyph stays small on purpose (a 44px
 * circle inside a 28px chip looks broken), and `.pressable-tight` grows an invisible hit area out to
 * the 44px minimum instead of inflating what you can see.
 */
export function ChipRemoveButton({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={() => {
        void tapFeedback();
        onClick();
      }}
      {...pressable}
      className={cn('pressable-tight grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground/10 text-current', className)}
    >
      <X className="h-3 w-3" />
    </motion.button>
  );
}

/**
 * `md` (36px) is the inline avatar that sits in a dense list row or a header. `lg` (48px) is the
 * conversation-list avatar: iOS Messages and every list a user compares this screen against use a
 * 48-52px avatar as the thing that sets the row's height.
 */
export type AvatarSize = 'md' | 'lg';

// `md` deliberately sets no font size — it has always inherited the row's, and callers rely on that.
const AVATAR_SIZES: Record<AvatarSize, string> = {
  md: 'h-9 w-9',
  lg: 'h-12 w-12 text-lg',
};

export function Avatar({
  name,
  color,
  size = 'md',
  className,
}: {
  name: string;
  color?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <span
      style={{ backgroundColor: colorForMember(name, color) }}
      className={cn('grid shrink-0 place-items-center rounded-full font-bold leading-none text-white', AVATAR_SIZES[size], className)}
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}

export function AvatarStack({
  members,
  max = 4,
  size = 'md',
}: {
  members: Array<{ name: string; color?: string | null }>;
  max?: number;
  size?: AvatarSize;
}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((member) => (
        <Avatar key={member.name} name={member.name} color={member.color} size={size} className="border-2 border-card" />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            'grid shrink-0 place-items-center rounded-full border-2 border-card bg-secondary font-bold leading-none text-secondary-foreground',
            size === 'lg' ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-xs',
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

/**
 * `size="sm"` (6px) is the bar that belongs inside a dense list row — the charts each had their own
 * h-1.5 copy of this; `size="md"` (8px) is the standalone meter.
 */
export function ProgressBar({
  value,
  size = 'md',
  className,
  fillClassName = 'bg-secondary',
  fillStyle,
  animate = false,
  minWidth = 0,
}: {
  value: number;
  size?: 'sm' | 'md';
  className?: string;
  fillClassName?: string;
  /** For data colours that come from a token at runtime (category hues) rather than a class. */
  fillStyle?: CSSProperties;
  /**
   * Grow from zero on mount instead of snapping. This is what the two expense charts each
   * hand-rolled a copy of this component for — without it they could not animate, so they kept
   * their own markup and their own (different) bar height.
   */
  animate?: boolean;
  /** Floor in %, so a small-but-nonzero value still shows a sliver rather than nothing. */
  minWidth?: number;
}) {
  const pct = Math.max(minWidth, Math.min(100, value));
  const track = cn(size === 'sm' ? 'h-1.5' : 'h-2', 'overflow-hidden rounded-full bg-muted', className);
  const fill = cn('h-full rounded-full', !animate && 'transition-[width]', fillClassName);

  return (
    <div className={track}>
      {animate ? (
        <motion.div className={fill} style={fillStyle} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={springSoft} />
      ) : (
        <div className={fill} style={{ width: `${pct}%`, ...fillStyle }} />
      )}
    </div>
  );
}

export function OverflowMenu({
  label,
  actions,
  className,
}: {
  label: string;
  actions: Array<{
    label: string;
    icon?: ReactNode;
    destructive?: boolean;
    disabled?: boolean;
    onSelect: () => void;
  }>;
  className?: string;
}) {
  return (
    <details className={cn('relative shrink-0', className)}>
      <summary className="grid h-11 w-11 list-none place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden" aria-label={label}>
        <MoreHorizontal className="h-5 w-5" />
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={action.disabled}
            onClick={(event) => {
              event.currentTarget.closest('details')?.removeAttribute('open');
              action.onSelect();
            }}
            className={cn(
              'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/60 disabled:opacity-50',
              action.destructive ? 'text-destructive' : 'text-foreground',
            )}
          >
            {action.icon}
            <span className="min-w-0 flex-1 truncate">{action.label}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

export function Fab({ label, className, onClick, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'> & { label: string }) {
  return (
    <motion.button
      aria-label={label}
      onClick={(event) => {
        void tapFeedback();
        onClick?.(event);
      }}
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6.5rem)' }}
      initial={{ scale: 0, rotate: -90 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ ...springPop, delay: 0.15 }}
      whileTap={{ scale: 0.9, rotate: 90 }}
      data-motion-press
      className={cn(
        // Fixed neutral ink fill everywhere — matte black on light, white/light-gray on dark —
        // the same colour as the bottom nav's active-tab fill and .btn-pine, never the current
        // page's identity tone (that stays on the header only, see AppHeader's pageTones).
        'elev-3 fixed right-5 z-30 grid place-items-center rounded-full bg-ink text-ink-foreground',
        className,
      )}
      {...props}
    >
      <span className="grid place-items-center" style={{ width: 'var(--ctl-xl)', height: 'var(--ctl-xl)' }}>
        <Plus className="h-6 w-6" />
      </span>
    </motion.button>
  );
}

/* There was a `Card` component here. It had zero call sites and its shape (rounded-2xl / p-4)
   disagreed with the `.card` CSS class every page actually uses (--r-xl / 1rem / elev-1), so the app
   carried two different definitions of "a card" — which is most of why card padding had drifted to
   ten distinct values. `.card` plus its `.card-sm` / `.card-lg` / `.card-flush` steps in globals.css
   is now the single source; use `tone-<t> tone-wash tone-edge` alongside it for a colour identity. */

/**
 * A bottom sheet with its backdrop.
 *
 * Consolidates the hand-rolled `fixed inset-0 z-[60]` pattern that appeared in 20-plus places with
 * backdrop opacity drifting between /35, /40 and /50 and slide distances between 24 and 40px.
 * Handles the things each copy got wrong somewhere: Escape to close, backdrop click that ignores
 * clicks originating inside the panel, and scroll lock while open.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  placement = 'bottom',
  size = 'xl',
  hideClose = false,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * 'bottom' is the default and what almost everything wants on a phone. 'center' is for the few
   * short confirmations (delete a task, leave the household) that would read as a full task if they
   * slid up from the bottom edge.
   */
  placement?: 'bottom' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** For panels that already draw their own dismiss control. Prefer letting this one render. */
  hideClose?: boolean;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Without this the page behind the sheet scrolls under it on iOS as soon as the sheet's own
    // content hits its end.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          /* An open sheet owns the screen — the edge-swipe back gesture stands down until it is
             dismissed (see lib/swipeBack.tsx). */
          data-swipe-block
          className={cn(
            'fixed inset-0 z-[60] flex justify-center bg-black/45 backdrop-blur-[2px]',
            placement === 'bottom' ? 'items-end px-2 pb-2' : 'items-center p-4',
          )}
          variants={backdropVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            variants={placement === 'bottom' ? sheetVariants : dialogVariants}
            // Stop a click that started on the panel (a drag across a slider, a text selection that
            // ends outside) from being read as a backdrop dismissal.
            onClick={(event) => event.stopPropagation()}
            className={cn(
              // The cap applies to both placements: it has to give safe-bottom's keyboard padding
              // room, or a tall sheet would grow past the top of the screen instead of shrinking.
              'elev-3 max-h-[calc(88dvh_-_var(--keyboard-inset,0px))] w-full overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4',
              { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' }[size],
              // safe-bottom grows to the keyboard's height while it is up (see globals.css), which
              // lifts a bottom-docked panel's content clear of it. A centred dialog isn't docked to
              // the bottom edge, so it takes the padding as dead space instead — the max-h cap above
              // is what keeps it clear of the keyboard.
              placement === 'bottom' && 'safe-bottom',
              className,
            )}
          >
            {/* Rendered unless the caller draws its own: a sheet without a visible way out strands
                anyone who dismisses by backdrop tap less readily than by button. Title is optional. */}
            {(!hideClose || title) && (
              <div className="mb-3 flex items-center justify-between gap-3">
                {typeof title === 'string' ? <p className="font-display text-lg font-extrabold">{title}</p> : title}
                {!hideClose && <CloseButton onClick={onClose} label={typeof title === 'string' ? title : 'Close'} className="ml-auto" />}
              </div>
            )}
            {children}
            {footer && <div className="mt-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A labelled number. Replaces the ad-hoc stat grids in Ranks, Profile and Economy. */
export function StatTile({
  label,
  value,
  hint,
  tone,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border p-3',
        tone ? `tone-${tone} tone-wash tone-edge` : 'bg-surface-3 border-transparent',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 font-display text-2xl font-extrabold leading-none tabular-nums">{value}</p>
      {hint && <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * The "nothing here yet" state.
 *
 * A new household previously saw a grey sentence on an empty screen and could not tell an empty list
 * from a broken one. An icon, a reason and a way forward turn the emptiest screens — a fresh
 * calendar, a month with no expenses — into the start of something instead of a dead end.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  tone = 'peri',
  className,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  tone?: Accent;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className={cn('flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-8 text-center', className)}
    >
      <motion.span
        initial={{ scale: 0.8, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ ...springPop, delay: 0.08 }}
        className={cn('tone-tile grid h-14 w-14 place-items-center rounded-2xl', `tone-${tone}`)}
      >
        {icon}
      </motion.span>
      <p className="mt-3 font-display text-lg font-extrabold">{title}</p>
      {body && <p className="mt-1 max-w-[36ch] text-sm text-muted-foreground">{body}</p>}
      {action && (
        <motion.button type="button" onClick={action.onClick} {...pressable} className="btn-pine mt-4 px-5">
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}

/**
 * Segmented control with a sliding thumb.
 *
 * The `.seg` CSS class swapped background colours between options, so switching tabs was an instant
 * repaint with nothing connecting the two states. A shared `layoutId` makes the thumb travel, which
 * is what tells you the two tabs are the same control.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  className,
}: {
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  /** Must be unique per mounted control — two controls sharing an id animate into each other. */
  layoutId: string;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('seg', className)}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => {
              if (isActive) return;
              void tapFeedback();
              onChange(option.value);
            }}
            className="relative flex flex-1 items-center justify-center rounded-[.85rem] px-3 text-center text-sm font-bold"
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                transition={springSoft}
                // The active pill stays a plain white/near-black-text tab in both themes — this is
                // a track-and-thumb switcher, not an "ink" action surface, so it doesn't follow the
                // FAB/nav/CTA convention of flipping black-on-light / white-on-dark.
                className="elev-1 absolute inset-0 rounded-[.85rem] bg-white"
              />
            )}
            <span className={cn('relative z-10 transition-colors', isActive ? 'text-neutral-900' : 'text-muted-foreground')}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A filter/category pill. One shape for the chips in Tasks, Games, Social and Economy. */
export function Chip({
  label,
  active = false,
  onClick,
  icon,
  tone,
  className,
}: {
  label: ReactNode;
  active?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const interactive = Boolean(onClick);
  const Tag = interactive ? motion.button : motion.span;
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      aria-pressed={interactive ? active : undefined}
      onClick={
        interactive
          ? () => {
              void tapFeedback();
              onClick?.();
            }
          : undefined
      }
      {...(interactive ? pressable : {})}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold transition-colors',
        interactive && 'pressable',
        !interactive && 'py-1.5',
        active
          ? 'border-transparent bg-ink text-ink-foreground'
          : tone
            ? `tone-${tone} tone-wash tone-edge`
            : 'border-border bg-card text-foreground',
        className,
      )}
    >
      {icon}
      {label}
    </Tag>
  );
}

/**
 * The "+20 XP" chip that flies off a completed task toward the XP meter.
 *
 * Purely decorative and self-cleaning: mount it with a key, it removes itself when the flight ends.
 * This is the routine-completion reward — the one that fires many times a day and therefore must
 * stay quiet enough not to wear out.
 */
export function XpBurst({ amount, onDone }: { amount: number; onDone?: () => void }) {
  const [visible, setVisible] = useState(true);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
      doneRef.current?.();
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ opacity: 0, y: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], y: -46, scale: [0.6, 1.15, 1, 0.95] }}
          transition={{ duration: 0.9, times: [0, 0.18, 0.7, 1], ease: 'easeOut' }}
          className="pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-xs font-extrabold text-secondary-foreground"
        >
          +{amount} XP
        </motion.span>
      )}
    </AnimatePresence>
  );
}
