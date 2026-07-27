import type { ButtonHTMLAttributes, CSSProperties, FocusEvent, InputHTMLAttributes, ReactNode } from 'react';
import { MoreHorizontal, Plus, X } from 'lucide-react';
import { cn } from '../ui/utils';
import { colorForMember } from '../../lib/memberColors';

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
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M6 14.2 16 5l10 9.2V26H6V14.2Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="m12 16 4-4 4 4v6h-8v-6Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
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

export function VibeRing({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, score));
  return (
    <div className="vibe-ring shrink-0" style={{ '--vibe': `${value}%` } as CSSProperties}>
      <div className="text-center leading-none">
        <strong className="font-display text-xl">{value}</strong>
        <span className="block mt-1 text-[8px] font-bold tracking-[.14em] text-muted-foreground">VIBE</span>
      </div>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function AddSheet({ title, onClose, children, className }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  // Keep the focused field visible above the on-screen keyboard, which otherwise covers the
  // lower inputs of the sheet. Runs after the keyboard's ~250ms show animation settles.
  const scrollFocusedIntoView = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.matches('input, textarea, select')) {
      window.setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  };
  return (
    <div onFocusCapture={scrollFocusedIntoView} className={cn('glass w-full max-w-full space-y-3 overflow-hidden rounded-xl p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <button onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full" aria-label={title}>
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      {children}
    </div>
  );
}

export function Avatar({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  return <span style={{ backgroundColor: colorForMember(name, color) }} className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold text-white', className)}>{name[0]?.toUpperCase()}</span>;
}

export function AvatarStack({ members, max = 4 }: { members: Array<{ name: string; color?: string | null }>; max?: number }) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((member) => (
        <Avatar key={member.name} name={member.name} color={member.color} className="border-2 border-card" />
      ))}
      {extra > 0 && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-card bg-secondary text-xs font-bold text-secondary-foreground">
          +{extra}
        </span>
      )}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return <div className={cn('h-2 overflow-hidden rounded-full bg-muted', className)}><div className="h-full rounded-full bg-secondary transition-[width]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
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

export function Fab({ label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button aria-label={label} style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6.5rem)' }} className={cn('fixed right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-secondary text-secondary-foreground shadow-[0_12px_28px_rgba(16,32,25,.24)]', className)} {...props}><Plus className="h-6 w-6" /></button>;
}
