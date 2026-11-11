import {dom} from "./helpers/dom";
import {test} from "node:test";
import assert from "node:assert/strict";
import {act} from "react";
import {
  PublishingHarness, pending, pendingKey, returnKey, publication, job, design,
  element, clickText, until, settle,
  historyKey, storageAreas, storageMethods,
} from "./helpers/publishing-harness";

async function confirmUpload(h: PublishingHarness) {
  await until(() => assert.equal((element("select-cli-product-mode") as HTMLSelectElement).value, "source"));
  await act(async () => { (element("checkbox-cli-upload") as HTMLInputElement).click(); });
  await until(() => assert.equal((element("button-cli-confirm-upload") as HTMLButtonElement).disabled, false));
  await act(async () => { element("button-cli-confirm-upload").click(); });
  await until(() => assert.ok(element("publishing-progress")));
  assert.equal(h.uploadPosts.length, 1);
}

async function exerciseHistory(h: PublishingHarness) {
  const receiptId = `cli-upload-${publication.id}`, jobId = `publishing-job-${job.id}`;
  await until(() => assert.ok(element(receiptId)));
  await act(async () => {
    document.querySelector<HTMLButtonElement>(`[aria-label="Hide publication ${publication.id}"]`)!.click();
  });
  assert.equal(document.querySelector(`[data-testid="${receiptId}"]`), null);
  assert.ok(element(jobId));
  await act(async () => {
    document.querySelector<HTMLButtonElement>(`[aria-label="Hide job ${job.id}"]`)!.click();
  });
  assert.equal(document.querySelector(`[data-testid="${jobId}"]`), null);
  await clickText("Show hidden records");
  assert.ok(element(receiptId));
  assert.ok(element(jobId));
  await clickText("Hide history");
  assert.equal(element("button-hide-publication-history").getAttribute("aria-expanded"), "false");
  assert.equal(document.querySelector(`[data-testid="${receiptId}"]`), null);
  await clickText("Show history");
  assert.ok(element(receiptId));
  const checksBefore = h.checks.length;
  await act(async () => { element(`button-cli-check-${publication.id}`).click(); });
  await until(() => assert.equal(h.checks.length, checksBefore + 1));
  assert.deepEqual(h.checks.at(-1)?.body, {expectedShop: pending.shop, runAudit: true});
  await h.poll();
  assert.ok(element(receiptId));
  assert.ok(element(jobId));
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
      await until(() => assert.ok(element(`cli-upload-${publication.id}`)));
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
        // History updates use setItem, never removeItem: deletion of local
        // preferences must not be required for hide/show to keep working.
        const calls = h.storageCalls.filter(call => call.area === area && call.method === method);
        // The restoration effect reads local history first, so its exception
        // also skips session reads when both stores are unavailable.
        if (failure === "localStorage.removeItem" || (fault === "all" && failure === "sessionStorage.getItem")) {
          assert.equal(calls.length, 0);
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
    assert.ok(element("publication-history"));
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
    assert.equal(element("button-hide-publication-history").getAttribute("aria-expanded"), "true");
    if (name === "mixed hidden records") {
      assert.equal(document.querySelector(`[data-testid="cli-upload-${publication.id}"]`), null);
      await clickText("Show hidden records");
    }
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
  await until(() => assert.ok(element(`cli-upload-${publication.id}`)));
  assert.equal(h.redirects.length, 0);
  await h.unmount();
  await h.mount();
  await h.poll();
  assert.ok(element(`cli-upload-${publication.id}`));
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

for (const state of ["failed", "attention"] as const) {
  test(`${state} job stops progress, explains the problem, and preserves the saved record`, async t => {
    const h = new PublishingHarness(); t.after(() => h.dispose());
    h.savePending();
    await h.mount();
    h.jobs = [{...job, status: state, phase: "verifying", error: state === "failed" ? "Files could not be verified." : "The upload may exist. Check Shopify before trying again."}];
    await h.poll();
    await until(() => assert.match(document.body.textContent!, /Upload needs attention/));
    assert.match(document.body.textContent!, /Your existing store theme has not been replaced/);
    assert.match(element(`publishing-job-${job.id}`).textContent!, new RegExp(h.jobs[0].error!));
    assert.equal(sessionStorage.getItem(pendingKey), null);
    assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
    await clickText("Close");
    assert.ok(element(`publishing-job-${job.id}`));
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
  assert.ok(element("publication-history"));
  assert.equal(document.querySelector('[data-testid="publishing-progress"]'), null);
  assert.equal(h.redirects.length, 0);
  assert.equal(h.uploadPosts.length, 0);
});
