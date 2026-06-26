import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
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
  return (
    <div className={cn('glass space-y-3 rounded-xl p-4', className)}>
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

export function Fab({ label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button aria-label={label} style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6.5rem)' }} className={cn('fixed right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-secondary text-secondary-foreground shadow-[0_12px_28px_rgba(16,32,25,.24)]', className)} {...props}><Plus className="h-6 w-6" /></button>;
}
