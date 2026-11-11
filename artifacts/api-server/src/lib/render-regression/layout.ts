import type { Page } from "playwright";

/** Geometry assertions, not screenshot approval. No golden images are committed. */
export async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const failures: string[] = [];
    const viewport = innerWidth;
    const label = (el: Element) => `${el.tagName.toLowerCase()}.${el.className}`;
    const shown = (el: Element) => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0 || r.width <= 0 || r.height <= 0) return false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.visibility === "hidden" || Number(ps.opacity) === 0) return false;
      }
      return true;
    };
    for (const selector of [".wl-price [data-wl-price]", ".wl-form select", ".wl-form input", ".wl-form button"]) {
      const el = document.querySelector(selector);
      if (!el || !shown(el)) failures.push(`hidden purchase control: ${selector}`);
    }
    if (document.documentElement.scrollWidth > viewport + 1) failures.push(`document overflow: ${document.documentElement.scrollWidth} > ${viewport}`);
    // Check actual fitted image contents, including scale AND independent rotate.
    // An object's full box may intentionally exceed a contain-fit product's bounds.
    for (const img of document.querySelectorAll<HTMLImageElement>("figure img")) {
      if (!shown(img)) continue;
      if (!img.complete || !img.naturalWidth) { failures.push(`image not loaded: ${img.src}`); continue; }
      const s = getComputedStyle(img), figure = img.closest("figure")!, fr = figure.getBoundingClientRect();
      const w = img.clientWidth, h = img.clientHeight;
      if (s.objectFit !== "contain") failures.push(`product image must use contain: ${label(figure)}`);
      const fit = Math.min(w / img.naturalWidth, h / img.naturalHeight);
      const matrix = new DOMMatrix(s.transform === "none" ? undefined : s.transform);
      const rotate = (parseFloat(s.rotate) || 0) * Math.PI / 180;
      const fw = img.naturalWidth * fit * Math.hypot(matrix.a, matrix.b);
      const fh = img.naturalHeight * fit * Math.hypot(matrix.c, matrix.d);
      const bw = Math.abs(Math.cos(rotate)) * fw + Math.abs(Math.sin(rotate)) * fh;
      const bh = Math.abs(Math.sin(rotate)) * fw + Math.abs(Math.cos(rotate)) * fh;
      const ir = img.getBoundingClientRect(), cx = ir.x + ir.width / 2, cy = ir.y + ir.height / 2;
      if (cx - bw / 2 < fr.left - 2 || cx + bw / 2 > fr.right + 2 || cy - bh / 2 < fr.top - 2 || cy + bh / 2 > fr.bottom + 2)
        failures.push(`cropped product contents: ${label(figure)} (${bw.toFixed(1)}×${bh.toFixed(1)} in ${fr.width.toFixed(1)}×${fr.height.toFixed(1)})`);
    }
    // Visible text and controls may not be clipped by the section or viewport.
    // Decorative wordmarks, deliberate gallery scroll rails, and captions excluded.
    for (const el of document.querySelectorAll<HTMLElement>(".wl h1,.wl h2,.wl h3,.wl p,.wl dt,.wl dd,.wl summary,.wl select,.wl input,.wl button,.wl .wl-btn")) {
      if (!shown(el) || el.closest(".wl-mark,.wl-sticky,.wl-thumb")) continue;
      if (el.closest("details:not([open])") && !el.closest("summary")) continue;
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.right > viewport + 1) failures.push(`horizontal text/control clipping: ${label(el)}`);
      if (el.scrollWidth > el.clientWidth + 2 && !["SELECT", "INPUT"].includes(el.tagName)) failures.push(`text overflow: ${label(el)}`);
      let parent = el.parentElement;
      while (parent && !parent.matches("body")) {
        const ps = getComputedStyle(parent), pr = parent.getBoundingClientRect();
        if (/(hidden|clip)/.test(ps.overflowX) && (r.left < pr.left - 2 || r.right > pr.right + 2))
          failures.push(`ancestor clips ${label(el)}`);
        if (/(hidden|clip)/.test(ps.overflowY) && (r.top < pr.top - 2 || r.bottom > pr.bottom + 2))
          failures.push(`ancestor vertically clips ${label(el)}`);
        parent = parent.parentElement;
      }
    }
    // Sibling content blocks must not collide. Ancestor boxes are deliberately
    // not compared; figures/captions and decorative wordmarks can overlap.
    for (const parent of document.querySelectorAll(".wl-copy,.wl-form,.wl-head,.wl-item,.wl-buy,.wl-story-grid,.wl-inner")) {
      const kids = [...parent.children].filter(shown);
      for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i]!, b = kids[j]!, ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        if (Math.min(ar.right, br.right) - Math.max(ar.left, br.left) > 2 && Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top) > 2)
          failures.push(`overlapping content: ${label(a)} / ${label(b)}`);
      }
    }
    // Resolve the painted surface rather than assuming the section background:
    // accent panels and bento cells override it locally.
    const ctx = document.createElement("canvas").getContext("2d")!;
    const pixels = (value: string) => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const lum = (rgb: number[]) => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i]!, 0);
    for (const el of document.querySelectorAll<HTMLElement>(".wl h1,.wl h2,.wl h3,.wl p,.wl dt,.wl dd,.wl summary,.wl-form button,.wl .wl-btn,.wl-kicker span,.wl-price [data-wl-price],.wl-description,.wl-item-b,.wl-trust,.wl-form label,.wl-form select,.wl-form input")) {
      if (!shown(el) || !el.textContent?.trim() || el.closest("details:not([open])") && !el.closest("summary")) continue;
      if (el.closest(".wl-mark") || (el instanceof HTMLButtonElement && el.disabled)) continue;
      const s = getComputedStyle(el);
      let painted: Element | null = el;
      while (painted && pixels(getComputedStyle(painted).backgroundColor)[3] === 0) painted = painted.parentElement;
      if (!painted) continue;
      const foreground = pixels(s.color), background = pixels(getComputedStyle(painted).backgroundColor);
      const a = lum(foreground), b = lum(background);
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const large = parseFloat(s.fontSize) >= 24 || parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700;
      if (ratio < (large ? 3 : 4.5) - .05) failures.push(`unreadable contrast: ${label(el)} (${ratio.toFixed(2)}; ${s.color} on ${getComputedStyle(painted).backgroundColor}; ${el.textContent?.slice(0, 45)})`);
    }
    return [...new Set(failures)];
  });
}
