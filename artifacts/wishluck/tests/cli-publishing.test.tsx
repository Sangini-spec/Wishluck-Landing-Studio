import {dom} from "./helpers/dom";
import {test, type TestContext} from "node:test";
import assert from "node:assert/strict";
import {act} from "react";
import {
  PublishingHarness, pending, pendingKey, returnKey, publication, job, design,
  element, clickText, until, settle,
  historyKey, storageAreas, storageMethods,
} from "./helpers/publishing-harness";

// Control only the return flow's four-second delay. Query notifications and DOM
// settling keep their real timers, so advancing this clock cannot mask a poll.
async function confirmUpload(h: PublishingHarness) {
  await until(() => assert.equal((element("select-cli-product-mode") as HTMLSelectElement).value, "source"));
  await act(async () => { (element("checkbox-cli-upload") as HTMLInputElement).click(); });
  await until(() => assert.equal((element("button-cli-confirm-upload") as HTMLButtonElement).disabled, false));
  await act(async () => { element("button-cli-confirm-upload").click(); });
  await until(() => assert.ok(element("publishing-progress")));
  assert.equal(h.uploadPosts.length, 1);
}

async function exerciseHistory(h: PublishingHarness) {
  await until(() => assert.ok(element("shopify-result")));
  assert.equal(document.querySelector('[data-testid="publication-history"]'),null);
  assert.equal(document.querySelector(`[data-testid="publishing-job-${job.id}"]`),null);
  const summary=element("shopify-result");
  assert.doesNotMatch(summary.textContent!,/CLI|Job |Theme \d|Publication history/);
  assert.ok(summary.querySelector(`a[href="${publication.editorUrl}"]`));
  const checksBefore = h.checks.length;
  await act(async () => { element(`button-cli-check-${publication.id}`).click(); });
  await until(() => assert.equal(h.checks.length, checksBefore + 1));
  assert.deepEqual(h.checks.at(-1)?.body, {expectedShop: pending.shop, runAudit: true});
  await h.poll();
  assert.ok(element("shopify-result"));
}

function returnCheckClock(t: TestContext) {
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  type Handle = ReturnType<typeof setTimeout>;
  const scheduled = new Map<Handle, {at: number; run: () => void}>();
  let now = 0, sequence = 0;
  t.mock.method(globalThis, "setTimeout", (callback: () => void, delay?: number, ...args: unknown[]) => {
    if (delay !== 4000) return realSetTimeout(callback, delay, ...args);
    const handle = {returnCheckTimer: ++sequence} as unknown as Handle;
    scheduled.set(handle, {at: now + delay, run: callback});
    return handle;
  });
  t.mock.method(globalThis, "clearTimeout", (handle: Handle) => {
    if (!scheduled.delete(handle)) realClearTimeout(handle);
  });
  return {
    async advance(ms: number) {
      const end = now + ms;
      await act(async () => {
        while (true) {
          const next = [...scheduled].filter(([, timer]) => timer.at <= end)
            .sort((a, b) => a[1].at - b[1].at)[0];
          if (!next) break;
          const [handle, timer] = next;
          now = timer.at;
          scheduled.delete(handle);
          timer.run();
        }
        now = end;
      });
      await settle();
    },
  };
}

const storageFaults = storageAreas.flatMap(area => storageMethods.map(method => `${area}.${method}` as const));
for (const fault of [...storageFaults, "all"] as const) {
  for (const dismiss of [false, true]) {
    test(`${fault} throws: confirmed upload ${dismiss ? "can stay in Wishluck" : "still opens after verification"} and history works`, async t => {
      const h = new PublishingHarness(); t.after(() => h.dispose());
      if (fault === "localStorage.getItem" || fault === "all") {
        localStorage.setItem(historyKey, JSON.stringify({collapsed: true, hidden: [`publication:${publication.id}`]}));
      }
      for (const failure of fault === "all" ? storageFaults : [fault]) h.storageFailures.add(failure);
      h.jobs = [];
      await h.mount(true);
      assert.equal(h.uploadPosts.length, 0, "Storage failures never start an upload");
      await confirmUpload(h);
      h.status.uploads = [{...publication, verified: false, status: "uploading"}];
      h.jobs = [{...job, status: "running", phase: "verifying"}];
      await h.poll();
      await until(() => assert.match(element("publishing-progress").textContent!, /Verifying uploaded files/));
      assert.equal(h.redirects.length, 0, "Unverified uploads must not navigate");
      if (dismiss) {
        await clickText("Stay in Wishluck");
        assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
      }
      h.complete();
      await h.poll();
      await until(() => assert.ok(element("shopify-result")));
      assert.equal(h.redirects.length, dismiss ? 0 : 1);
      if (!dismiss) {
        assert.equal(h.redirects[0].url, publication.editorUrl);
        // Even if return-marker writes/removals throw, this visit retains a
        // read-only check in memory. No restoration/remount guarantee is implied.
        await act(async () => { dom.dispatchEvent(new dom.Event("focus")); });
        await until(() => assert.equal(h.checks.length, 1));
      }
      await exerciseHistory(h);
      await h.poll();
      assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
      assert.equal(h.redirects.length, dismiss ? 0 : 1);
      assert.equal(h.uploadPosts.length, 1, "History and polling never duplicate the confirmed upload");
      for (const failure of fault === "all" ? storageFaults : [fault]) {
        const [area, method] = failure.split(".");
        // Technical history was removed from this view. Local history
        // preferences are no longer read or written by publishing.
        const calls = h.storageCalls.filter(call => call.area === area && call.method === method);
        if (area === "localStorage") {
          assert.equal(calls.filter(call=>call.failed).length, 0);
        }
        else assert.ok(calls.some(call => call.failed), `${failure} exception branch was exercised`);
      }
    });
  }
}

test("A failed pending-marker removal cancels auto-open for this visit despite stale storage", async t => {
  const h = new PublishingHarness(); t.after(() => h.dispose());
  h.savePending();
  h.storageFailures.add("sessionStorage.removeItem");
  await h.mount();
  assert.ok(element("publishing-progress"));
  await clickText("Stay in Wishluck");
  assert.deepEqual(JSON.parse(sessionStorage.getItem(pendingKey)!), pending, "The failed removal leaves backing storage untouched");
  h.complete();
  await h.poll();
  await exerciseHistory(h);
  assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
  assert.equal(h.redirects.length, 0);
  assert.equal(h.uploadPosts.length, 0);
});

const malformedRecords = [
  {name: "null", value: null},
  {name: "boolean", value: true},
  {name: "number", value: 42},
  {name: "string", value: "not a record"},
  {name: "array", value: []},
  {name: "empty object", value: {}},
  {name: "missing receipt identity", value: {shop: pending.shop, designId: design.id}},
  {name: "missing store", value: {id: pending.id, designId: design.id}},
  {name: "empty identity", value: {...pending, id: ""}},
  {name: "empty store", value: {...pending, shop: ""}},
];
for (const {name, value} of malformedRecords) {
  test(`Valid JSON with ${name} is ignored as saved upload/return intent`, async t => {
    const h = new PublishingHarness(); t.after(() => h.dispose());
    h.savePending(value);
    h.savePending(value, returnKey);
    h.complete();
    await h.mount();
    await act(async () => { dom.dispatchEvent(new dom.Event("focus")); });
    await h.poll();
    assert.equal(document.querySelector('[data-testid="publication-history"]'),null);
    assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
    assert.equal(h.redirects.length, 0);
    assert.equal(h.checks.length, 0);
    await exerciseHistory(h);
    assert.equal(h.uploadPosts.length, 0);
    assert.equal(h.redirects.length, 0);
  });
}

for (const {name, value} of [
  ...malformedRecords.slice(0, 6),
  {name: "non-array hidden records", value: {collapsed: "true", hidden: {length: 2}}},
  {name: "mixed hidden records", value: {collapsed: 1, hidden: [null, 42, {}, `publication:${publication.id}`]}},
]) {
  test(`History with ${name} remains usable without changing server receipts`, async t => {
    const h = new PublishingHarness(); t.after(() => h.dispose());
    localStorage.setItem(historyKey, JSON.stringify(value));
    h.complete();
    await h.mount();
    assert.ok(element("shopify-result"));
    assert.equal(document.querySelector('[data-testid="publication-history"]'),null);
    await exerciseHistory(h);
    assert.equal(h.uploadPosts.length, 0);
    assert.equal(h.redirects.length, 0);
    assert.deepEqual(h.status.uploads, [publication]);
    assert.deepEqual(h.requests.filter(r => r.method !== "GET").map(r => r.path), [`/api/shopify/cli/uploads/${publication.id}/check`]);
  });
}


test("Reload restores a queued upload, polls it, and redirects only after verification", async t => {
  const h = new PublishingHarness(); t.after(() => h.dispose());
  h.savePending();
  await h.mount();
  assert.match(element("publishing-progress").textContent!, /Waiting to start/);
  assert.deepEqual(JSON.parse(sessionStorage.getItem(pendingKey)!), pending);
  assert.equal(h.uploadPosts.length, 0);
  h.status.uploads = [{...publication, status: "uploading", verified: false}];
  h.jobs = [{...job, phase: "verifying", status: "running"}];
  await h.poll();
  await until(() => assert.match(element("publishing-progress").textContent!, /Verifying uploaded files/));
  assert.equal(h.redirects.length, 0);
  h.complete();
  // Exercise the real interval once, rather than only manually refetching.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 2600)); });
  await until(() => assert.equal(h.redirects.length, 1));
  assert.deepEqual(h.redirects[0], {
    url: publication.editorUrl, savedPending: null,
    savedReturn: JSON.stringify({id: publication.id, shop: publication.shop}),
  });
  assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
  assert.equal(h.uploadPosts.length, 0);
});

test("A newly confirmed upload makes one POST; reloading resumes it without another POST", async t => {
  const h = new PublishingHarness(); t.after(() => h.dispose());
  h.jobs = [];
  await h.mount(true);
  await until(() => assert.equal((element("select-cli-product-mode") as HTMLSelectElement).value, "source"));
  await act(async () => { (element("checkbox-cli-upload") as HTMLInputElement).click(); });
  await until(() => assert.equal((element("button-cli-confirm-upload") as HTMLButtonElement).disabled, false));
  await act(async () => { element("button-cli-confirm-upload").click(); });
  await until(() => assert.ok(element("publishing-progress")));
  assert.equal(h.uploadPosts.length, 1);
  assert.deepEqual(h.uploadPosts[0].body, {
    designId: design.id, expectedShop: pending.shop, confirmUnpublishedUpload: true,
    productMode: "source", confirmTemplateAssignment: false,
    confirmProductImport: false, confirmCurrencyMismatch: false,
  });
  h.jobs = [{...job}];
  await h.unmount();
  await h.mount();
  assert.match(element("publishing-progress").textContent!, /Waiting to start/);
  await h.poll();
  assert.equal(h.uploadPosts.length, 1);
  assert.equal(h.redirects.length, 0);
});

for (const endpoint of ["/api/shopify/jobs", "/api/shopify/cli"]) {
  test(`Temporary ${endpoint} poll failure retains intent and recovers without re-upload`, async t => {
    const h = new PublishingHarness(); t.after(() => h.dispose());
    h.savePending();
    await h.mount();
    h.failures.add(endpoint);
    await h.poll();
    await until(() => assert.match(element("publishing-progress").textContent!, /Reconnecting to your saved upload/));
    assert.deepEqual(JSON.parse(sessionStorage.getItem(pendingKey)!), pending);
    assert.equal(h.redirects.length, 0);
    assert.equal(h.uploadPosts.length, 0);
    h.failures.clear();
    await h.poll();
    await until(() => assert.doesNotMatch(element("publishing-progress").textContent!, /Reconnecting/));
    h.complete();
    await h.poll();
    await until(() => assert.equal(h.redirects.length, 1));
    assert.equal(h.uploadPosts.length, 0);
  });
}

test("Stay in Wishluck clears auto-open intent, preserves receipts, and survives reload", async t => {
  const h = new PublishingHarness(); t.after(() => h.dispose());
  h.savePending();
  await h.mount();
  await clickText("Stay in Wishluck");
  assert.equal(sessionStorage.getItem(pendingKey), null);
  assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
  h.complete();
  await h.poll();
  await until(() => assert.ok(element("shopify-result")));
  assert.equal(h.redirects.length, 0);
  await h.unmount();
  await h.mount();
  await h.poll();
  assert.ok(element("shopify-result"));
  assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
  assert.equal(h.redirects.length, 0);
  assert.equal(h.uploadPosts.length, 0);
});

test("Browser Back restoration checks the saved receipt once without a redirect loop", async t => {
  const h = new PublishingHarness(); t.after(() => h.dispose());
  h.savePending();
  await h.mount();
  h.complete();
  await h.poll();
  await until(() => assert.equal(h.redirects.length, 1));
  await h.unmount();
  // Model Back's document restoration using the same tab's surviving storage,
  // a fresh component, and an empty QueryClient (not cached test data).
  await h.mount();
  await until(() => assert.equal(h.checks.length, 1));
  assert.deepEqual(h.checks[0].body, {expectedShop: pending.shop, runAudit: true});
  assert.equal(sessionStorage.getItem(returnKey), null);
  await act(async () => { dom.dispatchEvent(new dom.Event("focus")); dom.dispatchEvent(new dom.Event("focus")); });
  await h.poll();
  assert.equal(h.checks.length, 1);
  assert.equal(h.redirects.length, 1);
  assert.equal(h.uploadPosts.length, 0);
  assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
  await h.unmount();
  await h.mount();
  assert.equal(h.checks.length, 1);
  assert.equal(h.redirects.length, 1);
});

test("Back with a retained page checks once on focus and never reopens the editor", async t => {
  const h = new PublishingHarness(); t.after(() => h.dispose());
  h.savePending();
  await h.mount();
  h.complete();
  await h.poll();
  await until(() => assert.equal(h.redirects.length, 1));
  assert.equal(h.checks.length, 0);
  // A cached Back restoration keeps the component and its returnCheck ref.
  // The other Back test covers a document remount with surviving tab storage.
  await act(async () => { dom.dispatchEvent(new dom.Event("focus")); });
  await until(() => assert.equal(h.checks.length, 1));
  assert.deepEqual(h.checks[0].body, {expectedShop: pending.shop, runAudit: true});
  assert.equal(sessionStorage.getItem(returnKey), null);
  await act(async () => { dom.dispatchEvent(new dom.Event("focus")); });
  await h.poll();
  assert.equal(h.checks.length, 1);
  assert.equal(h.redirects.length, 1);
  assert.equal(h.uploadPosts.length, 0);
  assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
});

test("A hidden Back restoration waits for visible focus, then checks the saved receipt only once", async t => {
  const clock = returnCheckClock(t);
  const h = new PublishingHarness(); t.after(() => h.dispose());
  let hidden = true;
  const previous = Object.getOwnPropertyDescriptor(document, "hidden");
  Object.defineProperty(document, "hidden", {configurable: true, get: () => hidden});
  t.after(() => {
    if (previous) Object.defineProperty(document, "hidden", previous);
    else Reflect.deleteProperty(document, "hidden");
  });
  h.complete();
  const savedReturn = JSON.stringify({id: publication.id, shop: publication.shop});
  sessionStorage.setItem(returnKey, savedReturn);
  await h.mount();
  await act(async () => { dom.dispatchEvent(new dom.Event("focus")); });
  await clock.advance(12000);
  assert.equal(h.checks.length, 0);
  assert.equal(sessionStorage.getItem(returnKey), savedReturn);
  assert.equal(h.uploadPosts.length, 0);
  assert.equal(h.redirects.length, 0);

  hidden = false;
  await act(async () => { dom.dispatchEvent(new dom.Event("focus")); });
  await until(() => assert.equal(h.checks.length, 1));
  assert.deepEqual(h.checks[0], {
    method: "POST", path: `/api/shopify/cli/uploads/${publication.id}/check`,
    body: {expectedShop: publication.shop, runAudit: true},
  });
  assert.equal(sessionStorage.getItem(returnKey), null);
  await act(async () => {
    dom.dispatchEvent(new dom.Event("focus"));
    dom.dispatchEvent(new dom.Event("focus"));
  });
  await clock.advance(12000);
  await h.poll();
  assert.equal(h.checks.length, 1);
  assert.equal(h.uploadPosts.length, 0);
  assert.equal(h.redirects.length, 0);
  assert.equal(sessionStorage.getItem(pendingKey), null);
});

test("Returning during a Lighthouse audit waits and checks once when the audit finishes without another focus", async t => {
  const clock = returnCheckClock(t);
  const h = new PublishingHarness(); t.after(() => h.dispose());
  h.complete();
  const savedReturn = JSON.stringify({id: publication.id, shop: publication.shop});
  sessionStorage.setItem(returnKey, savedReturn);
  await h.mount(false, {...design, lighthouse: {status: "running"}});
  await act(async () => {
    dom.dispatchEvent(new dom.Event("focus"));
    dom.dispatchEvent(new dom.Event("focus"));
  });
  await clock.advance(8000);
  assert.equal(h.checks.length, 0);
  assert.equal(sessionStorage.getItem(returnKey), savedReturn);
  assert.equal(h.uploadPosts.length, 0);
  assert.equal(h.redirects.length, 0);
  await act(async () => { h.updateDesign(design); });
  await clock.advance(3999);
  assert.equal(h.checks.length, 0);
  await clock.advance(1);
  await until(() => assert.equal(h.checks.length, 1));
  assert.deepEqual(h.checks[0].body, {expectedShop: publication.shop, runAudit: true});
  assert.equal(sessionStorage.getItem(returnKey), null);
  await act(async () => { dom.dispatchEvent(new dom.Event("focus")); });
  await clock.advance(12000);
  await h.poll();
  assert.equal(h.checks.length, 1);
  assert.equal(h.uploadPosts.length, 0);
  assert.equal(h.redirects.length, 0);
  assert.equal(sessionStorage.getItem(pendingKey), null);
});

test("A failed return check explains the failure without retrying, uploading, or reopening Shopify", async t => {
  const clock = returnCheckClock(t);
  const h = new PublishingHarness(); t.after(() => h.dispose());
  h.complete();
  h.failures.add(`/api/shopify/cli/uploads/${publication.id}/check`);
  sessionStorage.setItem(returnKey, JSON.stringify({id: publication.id, shop: publication.shop}));
  await h.mount();
  await until(() => assert.match(document.body.textContent!, /Shopify check needs attention/));
  assert.match(document.body.textContent!, /Temporary offline polling failure/);
  assert.equal(h.checks.length, 1);
  assert.deepEqual(h.checks[0].body, {expectedShop: publication.shop, runAudit: true});
  assert.equal(sessionStorage.getItem(returnKey), null);
  assert.ok(element("shopify-result"));
  assert.equal((element(`button-cli-check-${publication.id}`) as HTMLButtonElement).disabled, false);
  await act(async () => {
    dom.dispatchEvent(new dom.Event("focus"));
    dom.dispatchEvent(new dom.Event("focus"));
  });
  await clock.advance(12000);
  await h.poll();
  await h.unmount();
  await h.mount();
  assert.equal(h.checks.length, 1);
  assert.equal(h.uploadPosts.length, 0);
  assert.equal(h.redirects.length, 0);
  assert.equal(sessionStorage.getItem(pendingKey), null);
  assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
});

for (const state of ["failed", "attention"] as const) {
  test(`${state} job stops progress, explains the problem, and preserves the saved record`, async t => {
    const h = new PublishingHarness(); t.after(() => h.dispose());
    h.savePending();
    await h.mount();
    h.jobs = [{...job, status: state, phase: "verifying", error: state === "failed" ? "Files could not be verified." : "The upload may exist. Check Shopify before trying again."}];
    await h.poll();
    await until(() => assert.match(document.body.textContent!, /Upload needs attention/));
    assert.match(document.body.textContent!, /Your existing store theme has not been replaced/);
    assert.match(document.body.textContent!, new RegExp(h.jobs[0].error!));
    assert.equal(sessionStorage.getItem(pendingKey), null);
    assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
    await clickText("Close");
    assert.equal(document.querySelector(`[data-testid="publishing-job-${job.id}"]`),null);
    assert.equal(h.redirects.length, 0);
    assert.equal(h.uploadPosts.length, 0);
  });
}

test("An attention job without an error still gives a useful explanation", async t => {
  const h = new PublishingHarness(); t.after(() => h.dispose());
  h.savePending();
  h.jobs = [{...job, status: "attention"}];
  await h.mount();
  await until(() => assert.match(document.body.textContent!, /Your saved record is available below/));
  assert.equal(h.uploadPosts.length, 0);
  assert.equal(h.redirects.length, 0);
});

for (const mismatch of ["store", "design", "receipt", "job"] as const) {
  test(`A completed unrelated ${mismatch} cannot auto-open an editor`, async t => {
    const h = new PublishingHarness(); t.after(() => h.dispose());
    h.savePending();
    await h.mount();
    h.complete();
    if (mismatch === "store") h.status.uploads = [{...publication, shop: "store-b.myshopify.com"}];
    if (mismatch === "design") h.status.uploads = [{...publication, designId: "design-other"}];
    if (mismatch === "receipt") h.status.uploads = [{...publication, id: "receipt-other", jobId: "job-other"}];
    if (mismatch === "job") {
      h.status.uploads = [{...publication, jobId: undefined}];
      h.jobs = [{...h.jobs[0], designId: "design-other"}];
    }
    await h.poll();
    assert.ok(element("publishing-progress"));
    assert.equal(h.redirects.length, 0);
    assert.equal(h.uploadPosts.length, 0);
  });
}

test("Switching connected stores cancels auto-open and explains how to find the upload", async t => {
  const h = new PublishingHarness(); t.after(() => h.dispose());
  h.savePending();
  await h.mount();
  h.complete();
  h.status.shop = "store-b.myshopify.com";
  await h.poll();
  await until(() => assert.match(document.body.textContent!, /connected store changed/));
  assert.equal(sessionStorage.getItem(pendingKey), null);
  assert.equal(h.redirects.length, 0);
  assert.equal(h.uploadPosts.length, 0);
});

test("An intent saved for a different design is ignored on reload", async t => {
  const h = new PublishingHarness(); t.after(() => h.dispose());
  h.savePending({...pending, designId: "design-other"});
  h.complete();
  await h.mount();
  await h.poll();
  assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
  assert.equal(h.redirects.length, 0);
  assert.equal(h.uploadPosts.length, 0);
});

test("Malformed saved intent does not crash the screen or start an upload", async t => {
  const h = new PublishingHarness(); t.after(() => h.dispose());
  sessionStorage.setItem(pendingKey, "{broken");
  await h.mount();
  await settle();
  assert.equal(document.querySelector('[data-testid="publication-history"]'),null);
  assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
  assert.equal(h.redirects.length, 0);
  assert.equal(h.uploadPosts.length, 0);
});
