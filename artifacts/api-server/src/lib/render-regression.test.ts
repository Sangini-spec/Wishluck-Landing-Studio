import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { preview } from "./preview";
import { rootDir } from "./compiler";
import { designFamilies, visualPlanSchema } from "./design-plan";
import { fingerprint, similarity } from "./fingerprints";
import { resolvePlan, planSections } from "./render-plan";
import { axes, brand, content, design, fixtures, imageShapes, legacyFamilies, product } from "./render-regression/fixtures";
import { nativeHtml } from "./render-regression/native";
import { checkContracts } from "./render-regression/contracts";
import { layoutProblems } from "./render-regression/layout";

const output = path.join(rootDir, "generated-artifacts/render-regression");
const evidence = path.join(output, "failures");
let browser: Browser;
let context: BrowserContext;
let page: Page;
const requests: string[] = [];
let errors: string[] = [];

before(async () => {
  await rm(evidence, { recursive: true, force: true });
  await mkdir(evidence, { recursive: true });
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROMIUM_PATH || (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined),
    args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  context = await browser.newContext({ reducedMotion: "reduce", serviceWorkers: "block" });
  // Default-deny networking. Only in-memory fixture images can be loaded;
  // even a mistakenly submitted native form can never reach a real store.
  await context.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    const index = product.images.indexOf(req.url());
    if (req.method() === "GET" && url.hostname === "fixtures.invalid" && index >= 0 && req.resourceType() === "image") {
      const [w, h] = imageShapes[index]!;
      await route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="#d6b77a" stroke="#202521" stroke-width="2"/><path d="M0 0L${w} ${h}M${w} 0L0 ${h}" stroke="#202521"/></svg>` });
    } else {
      requests.push(`${req.method()} ${req.url()}`);
      await route.abort("blockedbyclient");
    }
  });
  page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
});
after(async () => { await context?.close(); await browser?.close(); });

test("fixtures cover every family, all axis values per family, and legacy projections", () => {
  for (const family of designFamilies) {
    const plans = fixtures.filter(f => f.c.visualPlan?.family === family).map(f => visualPlanSchema.parse(f.c.visualPlan));
    for (const [axis, options] of Object.entries(axes)) {
      assert.deepEqual([...new Set(plans.map(p => p[axis as keyof typeof axes]))].sort(), [...options].sort(), `${family}/${axis}`);
    }
  }
  const original = fixtures[0]!.c;
  for (const [axis, options] of Object.entries(axes)) {
    for (const value of options) {
      if (value === original.visualPlan![axis as keyof typeof axes]) continue;
      const changed = { ...original, visualPlan: { ...original.visualPlan!, [axis]: value } };
      assert.ok(similarity(fingerprint(original, brand), fingerprint(changed, brand)) < 1, `Fingerprint ignores ${axis}`);
    }
  }
  for (const [composition, family] of Object.entries(legacyFamilies)) {
    const c = fixtures.find(f => f.id === `legacy-${composition}`)!.c;
    const plan = resolvePlan(c);
    assert.equal(plan.family, family);
    assert.equal(similarity(fingerprint({ ...c, visualPlan: plan }, brand), fingerprint(c, brand)), 1, composition);
  }
  const c = content();
  const plan = { ...resolvePlan(c), sections: ["purchase", "hero", "hero", "story", "benefits", "specs", "faq"] } as ReturnType<typeof resolvePlan>;
  assert.deepEqual(planSections(plan, { ...c, story: "", benefits: [], specs: {}, faqs: [] }), ["hero", "purchase"]);
});

// Per-fixture tests make failures identify family, axes, viewport and renderer.
// Native files are ALWAYS compiled with imported p.images=[] and then executed
// against the assigned product's runtime images, not preview-generated markup.
for (const fixture of fixtures) {
  test(`render ${fixture.id}: preview/native contracts and 360/768/1440 geometry`, async () => {
    const html = preview(design, fixture.c, fixture.p, brand);
    const native = await nativeHtml(fixture.c, { ...fixture.p, images: [] }, fixture.p, brand);
    checkContracts(fixture, html, native);
    const failures: string[] = [];
    for (const width of [360, 768, 1440]) {
      for (const [renderer, markup] of [["preview", html], ["native", native]]) {
        errors = [];
        await page.setViewportSize({ width: Number(width), height: 900 });
        await page.setContent(markup!, { waitUntil: "load" });
        await page.evaluate(async () => {
          document.querySelectorAll("img").forEach(img => img.loading = "eager");
          await Promise.all([...document.images].map(img => img.decode()));
          await document.fonts.ready;
          document.querySelectorAll("details").forEach(el => el.open = true);
        });
        let issues = await layoutProblems(page);
        if (width < 900) {
          // Initial viewport must expose either the inline price + cart or the
          // sticky fallback, even with a long headline and description.
          await page.waitForFunction(() => {
            const inside = (selector: string) => {
              const el = document.querySelector(selector);
              if (!el) return false;
              const r = el.getBoundingClientRect(), s = getComputedStyle(el);
              return s.visibility === "visible" && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight;
            };
            return inside(".wl-price [data-wl-price]") && inside(".wl-form button") ||
              inside(".wl-sticky.is-visible [data-wl-price]") && inside(".wl-sticky.is-visible button");
          }, undefined, { timeout: 2000 });
        }
        const submit = page.locator(".wl-form button[type=submit]");
        await submit.scrollIntoViewIfNeeded();
        assert.ok(await submit.isVisible(), `${renderer}/${width}: cart hidden`);
        assert.ok(await page.locator(".wl-price [data-wl-price]").isVisible(), `${renderer}/${width}: price hidden`);
        const available = fixture.p.variants.some(v => v.available);
        assert.equal(await submit.isEnabled(), available);
        // The sticky controls must remain usable after scrolling past the hero.
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        if (width < 900) {
          await page.waitForFunction(() => document.querySelector(".wl-sticky")?.classList.contains("is-visible"));
          const sticky = page.locator(".wl-sticky");
          assert.ok(await sticky.isVisible(), `${renderer}/${width}: sticky hidden`);
          const hit = await sticky.locator("button").evaluate(el => {
            const r = el.getBoundingClientRect();
            return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight &&
              el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          });
          assert.ok(hit, `${renderer}/${width}: sticky cart clipped or obscured`);
          assert.equal(await sticky.locator("button").isEnabled(), available);
          assert.match(await sticky.locator("[data-wl-price]").innerText(), /\$79\.00/);
        } else assert.equal(await page.locator(".wl-sticky").isVisible(), false);
        issues = [...issues, ...errors.map(e => `script error: ${e}`)];
        if (issues.length) {
          const stem = `${fixture.id}-${renderer}-${width}`;
          await page.screenshot({ path: path.join(evidence, `${stem}.png`) });
          await writeFile(path.join(evidence, `${stem}.json`), JSON.stringify({ fixture: fixture.id, plan: resolvePlan(fixture.c), renderer, width, issues }, null, 2));
          failures.push(`${renderer}/${width}:\n${issues.join("\n")}`);
        }
      }
    }
    assert.deepEqual(requests, [], "Unexpected network request (blocked)");
    assert.equal(failures.length, 0, failures.join("\n\n"));
  });
}

test("native/preview variants update price, compare and mobile availability without any cart request", async () => {
  const c = fixtures[0]!.c;
  for (const html of [preview(design, c, product, brand), await nativeHtml(c, { ...product, images: [] }, product, brand)]) {
    await page.setContent(html);
    await page.selectOption(".wl-form select", "1002");
    assert.match(await page.locator(".wl-price [data-wl-price]").innerText(), /\$89\.00/);
    assert.equal(await page.locator("[data-wl-compare]").innerText(), "");
    await page.selectOption(".wl-form select", "1003");
    assert.equal(await page.locator(".wl-form button").isDisabled(), true);
    assert.equal(await page.locator(".wl-sticky button").isDisabled(), true);
    await page.selectOption(".wl-form select", "1001");
    assert.equal(await page.locator(".wl-form button").isEnabled(), true);
    assert.match(await page.locator("[data-wl-compare]").innerText(), /\$99\.00/);
    // Do NOT click submit: this suite is rendering-only, never checkout.
  }
  assert.deepEqual(requests, []);
});

test("geometry guards reject injected crop, overflow, overlap and hidden purchase controls", async () => {
  const html = preview(design, fixtures[0]!.c, product, brand);
  await page.setViewportSize({ width: 360, height: 900 });
  await page.setContent(html);
  await page.evaluate(async () => {
    document.querySelectorAll("img").forEach(img => img.loading = "eager");
    await Promise.all([...document.images].map(img => img.decode()));
  });
  await page.addStyleTag({ content: ".wl-fig img{object-fit:cover!important}.wl-copy h1{width:900px!important}.wl-copy .wl-price{position:absolute;top:0;left:0}.wl-form{display:none!important}" });
  const issues = await layoutProblems(page);
  assert.ok(issues.some(x => x.includes("contain")));
  assert.ok(issues.some(x => x.includes("clipping") || x.includes("overflow")));
  assert.ok(issues.some(x => x.includes("overlapping")));
  assert.ok(issues.some(x => x.includes("hidden purchase control")));
  assert.equal(await page.locator(".wl-form button").isVisible(), false);
  await page.setContent(html);
  await page.addStyleTag({ content: ".wl-copy h1{color:var(--wl-bg)!important}" });
  assert.ok((await layoutProblems(page)).some(x => x.includes("unreadable contrast")));
});

test("gallery hover and thumbnail swaps keep the complete runtime product image visible", async () => {
  const fixture = fixtures.find(f => f.c.visualPlan?.family === "catalogue")!;
  for (const html of [preview(design, fixture.c, product, brand), await nativeHtml(fixture.c, { ...product, images: [] }, product, brand)]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.setContent(html);
    await page.evaluate(async () => {
      document.querySelectorAll("img").forEach(img => img.loading = "eager");
      await Promise.all([...document.images].map(img => img.decode()));
    });
    await page.locator(".wl-thumb").first().click();
    await page.locator(".wl-fig-1 img").evaluate(async (el: HTMLImageElement) => el.decode());
    assert.equal(await page.locator(".wl-fig-1 img").getAttribute("src"), product.images[1]);
    await page.locator(".wl-gfig").first().hover();
    assert.deepEqual(await layoutProblems(page), []);
  }
  assert.deepEqual(requests, []);
});

test("family compositions do not silently collapse into the same rendered layout", async () => {
  const signatures = new Map<string, string>();
  for (const family of designFamilies) {
    const c = { ...fixtures[0]!.c, visualPlan: { ...fixtures[0]!.c.visualPlan!, family } };
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.setContent(preview(design, c, product, brand));
    const signature = await page.evaluate(() => JSON.stringify(
      [".wl-hero-grid", ".wl-media", ".wl-fig-1", ".wl-copy", ".wl-mark", ".wl-copy h1"].map(selector => {
        const el = document.querySelector(selector)!, r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), s.display, s.gridTemplateColumns];
      })));
    assert.ok(!signatures.has(signature), `${family} collapsed into ${signatures.get(signature)}`);
    signatures.set(signature, family);
  }
});

test("contract guards reject preview/native child class drift", async () => {
  const fixture = fixtures[0]!;
  const html = preview(design, fixture.c, fixture.p, brand);
  const native = await nativeHtml(fixture.c, { ...fixture.p, images: [] }, fixture.p, brand);
  assert.throws(() => checkContracts(fixture, html, native.replace('class="wl-price"', 'class="wl-cost"')), /child class drift/);
});
