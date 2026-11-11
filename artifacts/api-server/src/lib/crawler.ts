import { chromium, type Browser } from "playwright";
import { load } from "cheerio";
import { existsSync } from "node:fs";
import { permitted, publicUrl, userAgent } from "./network";
import { saveArtifact } from "./assets";
import type { Brand } from "./domain";

let browserPromise: Promise<Browser> | undefined;
export function browser() {
  if (!browserPromise) {
    const executablePath = process.env.CHROMIUM_PATH || (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);
    browserPromise = chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] }).catch(e => { browserPromise = undefined; throw e; });
  }
  return browserPromise;
}
function hex(rgb: string, fallback: string) {
  if(rgb==="transparent"||/rgba\([^)]*,\s*0(?:\.0+)?\s*\)/.test(rgb))return fallback;
  const match = rgb.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return match ? `#${match.slice(1,4).map(v => Math.min(255,Number(v)).toString(16).padStart(2,"0")).join("")}` : fallback;
}
export function shopifyFont(font: string) {
  const name = font.toLowerCase();
  if (name.includes("montserrat")) return "montserrat_n4";
  if (name.includes("poppins")) return "poppins_n4";
  if (name.includes("lato")) return "lato_n4";
  if (name.includes("roboto")) return "roboto_n4";
  if (name.includes("georgia") || name.includes("serif") && !name.includes("sans")) return "libre_baskerville_n4";
  return "assistant_n4";
}
export async function crawl(url: string, runId: string) {
  await permitted(url);
  const b = await browser();
  const context = await b.newContext({ userAgent, viewport: { width: 1440, height: 1000 }, serviceWorkers: "block", acceptDownloads: false });
  await context.route("**/*", async route => {
    try {
      await publicUrl(route.request().url());
      if (route.request().isNavigationRequest() && route.request().frame() === route.request().frame().page().mainFrame() && route.request().redirectedFrom()) await permitted(route.request().url());
      await route.continue();
    } catch { await route.abort(); }
  });
  try {
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    if (!response || !response.ok()) throw new Error(`Page returned HTTP ${response?.status() ?? "no response"}`);
    await page.waitForTimeout(1200);
    const html = await page.content();
    const style = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const heading = document.querySelector("h1") || document.body;
      const h = getComputedStyle(heading);
      const button = document.querySelector('button[name="add"],button[type="submit"],.product-form__submit,button') || document.body;
      const btn = getComputedStyle(button);
      const link = getComputedStyle(document.querySelector("a") || document.body);
      return { background: body.backgroundColor, text: body.color, primary: link.color, button: btn.backgroundColor, headingFont: h.fontFamily, bodyFont: body.fontFamily, headingSize: h.fontSize, bodySize: body.fontSize, headingWeight: h.fontWeight, bodyWeight: body.fontWeight, radius: btn.borderRadius, spacing: body.padding, buttonStyle: `${btn.borderWidth} ${btn.borderStyle}; ${btn.textTransform}` };
    });
    const screenshotBytes = await page.screenshot({ type: "jpeg", quality: 65, fullPage: false });
    const screenshot = await saveArtifact(runId,url,screenshotBytes,"image/jpeg");
    await page.setViewportSize({ width: 360, height: 800 });
    await page.waitForTimeout(400);
    const mobileScreenshot = await saveArtifact(runId,url,await page.screenshot({ type: "jpeg",quality:65,fullPage:false }),"image/jpeg");
    const htmlUrl = await saveArtifact(runId,url,html,"text/html");
    const $ = load(html);
    $("script,style,noscript,nav,footer").remove();
    const text = $("body").text().replace(/\s+/g," ").slice(0,24000);
    const sections = $("h1,h2,h3").toArray().map(e => $(e).text().trim()).filter(Boolean).slice(0,40);
    const brand: Brand = {
      primary: hex(style.primary,"#222222"), secondary: hex(style.background,"#f5f5f5"), background: hex(style.background,"#ffffff"), text: hex(style.text,"#222222"), button: hex(style.button,"#222222"),
      headingFont: style.headingFont, bodyFont: style.bodyFont, headingSize: style.headingSize, bodySize: style.bodySize, headingWeight: style.headingWeight, bodyWeight: style.bodyWeight,
      shopifyHeadingFont: shopifyFont(style.headingFont), shopifyBodyFont: shopifyFont(style.bodyFont),
      radius: style.radius, spacing: style.spacing, buttonStyle: style.buttonStyle,
      tone: "Needs review", imageStyle: "Needs visual review",
      evidence: "Computed browser styles. Secondary colour is a proposed neutral; review before generation. Visual analysis pending.",
    };
    return { html, text, sections, screenshot, mobileScreenshot, htmlUrl, brand, screenshotBytes };
  } finally { await context.close(); }
}
