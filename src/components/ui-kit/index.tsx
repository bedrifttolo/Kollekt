import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Plus } from 'lucide-react';
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

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...props} />;
}

type Tone = 'pine' | 'sky' | 'lemon' | 'berry';
const pillTones: Record<Tone, string> = {
  pine: 'bg-primary/15 text-primary',
  sky: 'bg-accent/20 text-accent-foreground',
  lemon: 'bg-secondary/25 text-secondary-foreground',
  berry: 'bg-destructive/15 text-destructive',
};

export function Pill({ tone = 'pine', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn('pill', pillTones[tone], className)} {...props} />;
}

type ButtonVariant = 'pine' | 'lemon' | 'ghost';
export function Button({ variant = 'pine', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={cn(`btn-${variant}`, className)} {...props} />;
}

export function Segmented({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('seg', className)} {...props} />;
}

export function StatTile({ value, label, className }: { value: ReactNode; label: ReactNode; className?: string }) {
  return (
    <div className={cn('stat-tile text-center', className)}>
      <p className="font-display text-xl font-extrabold">{value}</p>
      <p className="mt-1 text-[10px] text-current/65">{label}</p>
    </div>
  );
}

export function Avatar({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  return <span style={{ backgroundColor: colorForMember(name, color) }} className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold text-white', className)}>{name[0]?.toUpperCase()}</span>;
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((name) => (
        <Avatar key={name} name={name} className="border-2 border-card" />
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
  return <button aria-label={label} className={cn('fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-secondary text-secondary-foreground shadow-[0_12px_28px_rgba(16,32,25,.24)]', className)} {...props}><Plus className="h-6 w-6" /></button>;
}
