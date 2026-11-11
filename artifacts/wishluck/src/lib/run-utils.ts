import type { QueryClient } from "@tanstack/react-query";
import {
  getGetDashboardQueryKey,
  getListRunsQueryKey,
  getGetRunQueryKey,
  getGetMemoryQueryKey,
} from "@workspace/api-client-react";
import { formatDistanceToNowStrict, format } from "date-fns";

export const ACTIVE_STATUSES = ["queued", "analysing", "analyzing", "researching", "generating", "running", "pending"];
export const isActive = (s?: string) => !!s && ACTIVE_STATUSES.includes(s.toLowerCase());

export function invalidateRun(qc: QueryClient, id?: string) {
  qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  qc.invalidateQueries({ queryKey: getListRunsQueryKey() });
  qc.invalidateQueries({ queryKey: getGetMemoryQueryKey() });
  if (id) qc.invalidateQueries({ queryKey: getGetRunQueryKey(id) });
}

export function errMsg(e: unknown): string {
  if (!e) return "Unknown error";
  const anyE = e as { message?: string; data?: { error?: string; message?: string } };
  return anyE.data?.error || anyE.data?.message || anyE.message || String(e);
}

export function ago(d?: string) {
  if (!d) return "";
  try { return formatDistanceToNowStrict(new Date(d), { addSuffix: true }); } catch { return d; }
}
export function stamp(d?: string) {
  if (!d) return "";
  try { return format(new Date(d), "MMM d, HH:mm:ss"); } catch { return d; }
}
export function host(u?: string) {
  if (!u) return "";
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}
export function money(n?: number | null, cur = "USD") {
  if (n === undefined || n === null) return "—";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD" }).format(n); } catch { return `${n} ${cur}`; }
}

export type Tone = "seal" | "jade" | "amber" | "muted" | "danger";
export function statusTone(s?: string): Tone {
  const v = (s || "").toLowerCase();
  if (isActive(v)) return "seal";
  if (["failed", "error", "rejected", "blocked"].includes(v)) return "danger";
  if (["complete", "completed", "generated", "approved", "published", "passed", "done", "analysed", "analyzed", "researched", "ready"].includes(v)) return "jade";
  if (["unverified", "skipped", "partial", "warning", "unavailable"].includes(v)) return "amber";
  return "muted";
}
