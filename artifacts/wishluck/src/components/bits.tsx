import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusTone, isActive, type Tone } from "@/lib/run-utils";

const toneCls: Record<Tone, string> = {
  seal: "text-[hsl(var(--seal))] bg-[hsl(var(--seal)/0.08)] border-[hsl(var(--seal)/0.2)]",
  jade: "text-[hsl(var(--jade))] bg-[hsl(var(--jade)/0.08)] border-[hsl(var(--jade)/0.2)]",
  amber: "text-[hsl(var(--amber))] bg-[hsl(var(--amber)/0.08)] border-[hsl(var(--amber)/0.22)]",
  danger: "text-destructive bg-destructive/[0.07] border-destructive/20",
  muted: "text-muted-foreground bg-muted border-border",
};

export function StatusPill({ status, className }: { status?: string; className?: string }) {
  const tone = statusTone(status);
  return (
    <span data-testid={`status-${status}`} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider", toneCls[tone], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", isActive(status) && "pulse-dot")} />
      {status || "unknown"}
    </span>
  );
}

export function Tag({ children, tone = "muted", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium", toneCls[tone], className)}>{children}</span>;
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="rise mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</div>}
        <h1 className="font-display text-4xl leading-[1.05] md:text-[44px]">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[14.5px] text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon: ReactNode; title: string; body: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-dashed border-border px-6 py-12 text-center", className)}>
      <div className="hatch pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto flex max-w-sm flex-col items-center">
        <div className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-muted-foreground">{icon}</div>
        <h3 className="font-display text-2xl">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/[0.04] p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="flex-1">
        <div className="font-medium text-destructive">Something went wrong</div>
        <div className="mt-0.5 break-words text-muted-foreground">{message}</div>
      </div>
      {onRetry && (
        <button data-testid="button-retry" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted">
          <RotateCw className="h-3 w-3" /> Retry
        </button>
      )}
    </div>
  );
}

export function Notice({ tone = "amber", icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed", toneCls[tone])}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="text-foreground/80">{children}</div>
    </div>
  );
}

export function Btn({ variant = "ghost", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "ink" | "seal" | "ghost" | "outline" }) {
  const v = {
    ink: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_1px_0_hsl(0_0%_100%/0.12)_inset,0_4px_12px_-6px_hsl(24_30%_10%/0.5)]",
    seal: "bg-[hsl(var(--seal))] text-white hover:brightness-110 shadow-[0_4px_14px_-6px_hsl(var(--seal)/0.6)]",
    outline: "border border-border bg-card hover:bg-muted",
    ghost: "hover:bg-muted text-foreground/80",
  }[variant];
  return <button {...p} className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45", v, className)} />;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="px-5 py-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-display text-[38px] leading-none tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Sk({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
