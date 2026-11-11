import type { Check, LighthouseResult } from "@workspace/api-client-react";

export type Lane = "content" | "internal" | "external" | "other";
export const INTERNAL_CATS = ["SEO", "AEO", "GEO"] as const;
export const LH_TARGETS = { performance: 85, seo: 95, accessibility: 90 } as const;

export function laneOf(category: string): Lane {
  const c = category.trim().toUpperCase();
  if (c === "CONTENT") return "content";
  if (c === "EXTERNAL") return "external";
  if ((INTERNAL_CATS as readonly string[]).includes(c)) return "internal";
  return "other";
}

export type Tally = { passed: number; failed: number; unverified: number; total: number };
export function tally(checks: Check[]): Tally {
  const t = { passed: 0, failed: 0, unverified: 0, total: checks.length };
  for (const c of checks) t[c.status] += 1;
  return t;
}

export function groupByLane(checks: Check[]) {
  const out: Record<Lane, Check[]> = { content: [], internal: [], external: [], other: [] };
  for (const c of checks) out[laneOf(c.category)].push(c);
  return out;
}

/** Failed first, then pending, then passed. */
export function sortChecks(checks: Check[]) {
  const rank = { failed: 0, unverified: 1, passed: 2 } as const;
  return [...checks].sort((a, b) => rank[a.status] - rank[b.status]);
}

export function readinessLabel(v: number) {
  return `Content readiness ${Math.round(v)}/100`;
}

export type LhMetric = { key: keyof typeof LH_TARGETS; label: string; value: number | null; target: number; meets: boolean | null };
export type LhState = "none" | "running" | "failed" | "complete";

export function lighthouseState(lh?: LighthouseResult): LhState {
  if (!lh) return "none";
  const s = lh.status.toLowerCase();
  if (lh.error || s === "failed" || s === "error") return "failed";
  if (["running", "queued", "pending"].includes(s)) return "running";
  const has = [lh.performance, lh.seo, lh.accessibility].some((v) => typeof v === "number");
  return has ? "complete" : "none";
}

/** Only genuine numbers are compared with targets; missing numbers stay null, never inferred. */
export function lighthouseMetrics(lh?: LighthouseResult): LhMetric[] {
  const real = lighthouseState(lh) === "complete";
  return ([["performance", "Performance"], ["seo", "SEO"], ["accessibility", "Accessibility"]] as const).map(([key, label]) => {
    const raw = real ? lh?.[key] : undefined;
    const value = typeof raw === "number" ? raw : null;
    return { key, label, value, target: LH_TARGETS[key], meets: value == null ? null : value >= LH_TARGETS[key] };
  });
}
