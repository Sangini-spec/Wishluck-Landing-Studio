import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutGrid, Plus, BookMarked, History, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {ConnectedStore} from "./connected-store";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/create", label: "New analysis", icon: Plus },
  { href: "/memory", label: "Category memory", icon: BookMarked },
  { href: "/history", label: "History", icon: History },
];

function Mark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-8 w-8 place-items-center rounded-[9px] bg-[hsl(var(--seal))] text-white shadow-[0_6px_16px_-8px_hsl(var(--seal))]">
        <span className="font-display text-[19px] leading-none italic">W</span>
      </div>
      <div className="leading-tight">
        <div className="font-display text-[21px]">Wishluck</div>
        <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">Landing studio</div>
      </div>
    </div>
  );
}

function Nav({ onNav }: { onNav?: () => void }) {
  const [loc] = useLocation();
  const active = (h: string) => (h === "/" ? loc === "/" : loc.startsWith(h)) || (h === "/" && (loc.startsWith("/runs") || loc.startsWith("/designs")));
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-5"><Mark /></div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} onClick={onNav} data-testid={`link-nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
            className={cn("group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors",
              active(n.href) ? "bg-card font-medium text-foreground shadow-[0_1px_2px_hsl(24_20%_20%/0.06)] ring-1 ring-border" : "text-foreground/65 hover:bg-sidebar-accent hover:text-foreground")}>
            {active(n.href) && <span className="absolute -left-3 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-[hsl(var(--seal))]" />}
            <n.icon className="h-4 w-4 opacity-80" strokeWidth={1.75} />
            {n.label}
          </Link>
        ))}
        <ConnectedStore/>
      </nav>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="paper-grain min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-sidebar-border bg-sidebar lg:block"><Nav /></aside>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Mark />
        <button data-testid="button-menu" onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-muted"><Menu className="h-5 w-5" /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setOpen(false)} />
          <aside className="rise absolute inset-y-0 left-0 w-[260px] border-r border-sidebar-border bg-sidebar">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            <Nav onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <main className="lg:pl-[248px]">
        <div className="mx-auto max-w-[1240px] px-5 py-8 md:px-10 md:py-12">{children}</div>
      </main>
    </div>
  );
}
