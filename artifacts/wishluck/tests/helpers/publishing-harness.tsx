import {dom, denyFetch, setOfflineFetch} from "./dom";
import assert from "node:assert/strict";
import {act, useState} from "react";
import {createRoot, type Root} from "react-dom/client";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {CliPublishingStatus, Design, Publication, PublishingJob, PublishingContext} from "@workspace/api-client-react";
import {CliPublishing} from "../../src/components/cli-publishing";

export const shop = "store-a.myshopify.com";
export const pendingKey = "wishluck:pending-upload:design-1";
export const returnKey = "wishluck:editor-return:design-1";
export const pending = {id: "upload-1", designId: "design-1", shop};
const createdAt = "2026-11-11T00:00:00Z";
export const publication: Publication = {
  id: "publication-1", jobId: pending.id, designId: pending.designId, shop,
  title: "Offline product", status: "published", verified: true, createdAt,
  editorUrl: `https://${shop}/admin/themes/123/editor`, themeId: "123",
};
export const job: PublishingJob = {
  id: pending.id, publicationId: publication.id, designId: pending.designId, shop,
  kind: "upload", phase: "queued", status: "queued", contentHash: "offline-fixture",
  createdAt, updatedAt: createdAt,
};
export const design: Design = {
  id: pending.designId, runId: "run-1", name: "Offline design", direction: "test",
  description: "", status: "approved", createdAt, version: 1, uniqueness: 1,
  fingerprint: {}, checks: [], scores: {seo: 0, aeo: 0, geo: 0, overall: 0},
  previewUrl: "", downloadUrl: "", warnings: [],
};

export async function settle() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
}
export async function until(assertion: () => void) {
  for (let i = 0; i < 100; i++) {
    await settle();
    try { assertion(); return; } catch (error) { if (i === 99) throw error; }
  }
}
export function element(testId: string) {
  const result = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  assert.ok(result, `Missing ${testId}. Screen: ${document.body.textContent}`);
  return result;
}
export async function clickText(text: string) {
  const button = [...document.querySelectorAll("button")].find(b => b.textContent === text);
  assert.ok(button, `Missing button: ${text}`);
  await act(async () => { button.click(); });
  await settle();
}

export class PublishingHarness {
  status: CliPublishingStatus = {
    shop, configured: true, authenticated: true, credentialKey: "offline",
    livePublishingEnabled: false, uploads: [],
  };
  jobs: PublishingJob[] = [{...job}];
  context: PublishingContext = {
    shop, name: "Offline store", primaryDomain: shop, currency: "USD",
    sourceHost: shop, sourceCurrency: "USD", sameStore: true, canImport: true, products: [],
  };
  failures = new Set<string>();
  requests: {method: string; path: string; body?: unknown}[] = [];
  unexpected: string[] = [];
  redirects: {url: string; savedPending: string | null; savedReturn: string | null}[] = [];
  client!: QueryClient;
  root?: Root;
  host?: HTMLElement;

  constructor() {
    localStorage.clear();
    sessionStorage.clear();
    dom.location.assign = (url: string) => {
      this.redirects.push({url, savedPending: sessionStorage.getItem(pendingKey), savedReturn: sessionStorage.getItem(returnKey)});
    };
    // The generated hooks and customFetch run unchanged. Only HTTP is replaced.
    setOfflineFetch(async (input, init) => {
      const url = new URL(String(input), dom.location.href);
      const method = init?.method ?? "GET", path = url.pathname;
      this.requests.push({method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined});
      const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
        status, headers: {"Content-Type": "application/json"},
      });
      if (url.origin !== "https://wishluck.test") {
        this.unexpected.push(`${method} ${url}`);
        throw new Error("External requests are forbidden");
      }
      if (this.failures.has(path)) return reply({message: "Temporary offline polling failure"}, 503);
      if (method === "GET" && path === "/api/shopify/cli") return reply(this.status);
      if (method === "GET" && path === "/api/shopify/jobs") return reply(this.jobs);
      if (method === "GET" && path === "/api/designs/design-1/publishing") return reply(this.context);
      if (method === "POST" && path === "/api/shopify/cli/uploads") return reply({
        ...publication, verified: false, status: "uploading",
      });
      if (method === "POST" && path === `/api/shopify/cli/uploads/${publication.id}/check`) return reply(publication);
      this.unexpected.push(`${method} ${url}`);
      throw new Error(`Unmocked API request: ${method} ${path}`);
    });
  }

  get uploadPosts() { return this.requests.filter(r => r.method === "POST" && r.path === "/api/shopify/cli/uploads"); }
  get checks() { return this.requests.filter(r => r.path.endsWith("/check")); }
  savePending(value: unknown = pending, key = pendingKey) { sessionStorage.setItem(key, JSON.stringify(value)); }
  complete() {
    this.status.uploads = [{...publication}];
    this.jobs = [{...job, phase: "completed", status: "completed", updatedAt: "2026-11-11T00:01:00Z"}];
  }
  async mount(initialOpen = false, currentDesign = design) {
    this.client = new QueryClient({defaultOptions: {
      queries: {retry: false, gcTime: Infinity}, mutations: {retry: false, gcTime: Infinity},
    }});
    this.host = document.createElement("div");
    document.body.append(this.host);
    this.root = createRoot(this.host);
    function Screen() {
      const [open, setOpen] = useState(initialOpen);
      return <CliPublishing design={currentDesign} open={open} onOpenChange={setOpen}/>;
    }
    await act(async () => { this.root!.render(<QueryClientProvider client={this.client}><Screen/></QueryClientProvider>); });
    await until(() => {
      // A remount must load from this client's requests, not satisfy readiness
      // using an earlier mount's request log.
      assert.equal(this.client.getQueryState(["/api/shopify/jobs"])?.status, "success");
      assert.equal(this.client.getQueryState(["/api/shopify/cli"])?.status, "success");
    });
  }
  async poll() {
    await act(async () => { await this.client.refetchQueries({type: "active"}); });
    await settle();
  }
  async unmount() {
    if (this.root) {
      await act(async () => { this.root!.unmount(); });
      this.root = undefined;
      this.client.clear();
      this.host?.remove();
    }
  }
  async dispose() {
    await this.unmount();
    setOfflineFetch(denyFetch);
    await dom.happyDOM.abort();
    assert.deepEqual(this.unexpected, [], "Every request must have an explicit offline mock");
  }
}
