import {dom} from "./helpers/dom";
import {test} from "node:test";
import assert from "node:assert/strict";
import {act} from "react";
import {
  PublishingHarness, pending, pendingKey, returnKey, publication, job, design,
  element, clickText, until, settle,
} from "./helpers/publishing-harness";

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
