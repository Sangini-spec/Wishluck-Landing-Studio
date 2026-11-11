import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import robotsParser from "robots-parser";
import { AppError } from "./domain";

const dnsCache = new Map<string, number>();
const robotsCache = new Map<string, { text: string; expires: number }>();
const nextRequest = new Map<string, number>();
export const userAgent = "WishluckResearchBot/1.0";
export async function publicUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new AppError(400, "Enter a complete https:// product URL."); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new AppError(400, "Only public HTTPS URLs without credentials or custom ports are allowed.");
  }
  const host = url.hostname;
  if (host === "localhost" || !host.includes(".") || host.endsWith(".local") || host.endsWith(".internal")) throw new AppError(400, "Private addresses are not allowed.");
  if ((dnsCache.get(host) ?? 0) < Date.now()) {
    const records = await lookup(host, { all: true }).catch(() => { throw new AppError(400, "The website hostname could not be resolved."); });
    if (!records.length || records.some(r => ipaddr.process(r.address).range() !== "unicast")) throw new AppError(400, "Private and reserved addresses are not allowed.");
    dnsCache.set(host, Date.now() + 30000);
  }
  return url;
}
export async function safeFetch(raw: string, init: RequestInit = {}, redirects = 0): Promise<Response> {
  const url = await publicUrl(raw);
  const response = await fetch(url, { ...init, headers: { "User-Agent": userAgent, ...init.headers }, redirect: "manual", signal: AbortSignal.timeout(25000) });
  if ([301,302,303,307,308].includes(response.status)) {
    if (redirects >= 4) throw new AppError(400, "Too many redirects.");
    const location = response.headers.get("location");
    if (!location) throw new AppError(400, "Redirect missing destination.");
    return safeFetch(new URL(location, url).href, init, redirects + 1);
  }
  return response;
}
export async function permitted(raw: string) {
  const url = await publicUrl(raw);
  let entry = robotsCache.get(url.origin);
  if (!entry || entry.expires < Date.now()) {
    const response = await safeFetch(`${url.origin}/robots.txt`);
    if ([401,403,429].includes(response.status) || response.status >= 500) throw new AppError(422, `robots.txt unavailable (${response.status}); crawling skipped.`);
    const text = response.ok ? (await response.text()).slice(0,500000) : "";
    entry = { text, expires: Date.now() + 600000 };
    robotsCache.set(url.origin, entry);
  }
  const robots = robotsParser(`${url.origin}/robots.txt`, entry.text);
  if (robots.isAllowed(url.href, userAgent) === false) throw new AppError(422, "Crawling is disallowed by robots.txt.");
  const delay = Math.max(1200, (robots.getCrawlDelay(userAgent) ?? 0) * 1000);
  const wait = Math.max(0, (nextRequest.get(url.origin) ?? 0) - Date.now());
  nextRequest.set(url.origin, Date.now() + wait + delay);
  if (wait) await new Promise(resolve => setTimeout(resolve, Math.min(wait, 30000)));
}
