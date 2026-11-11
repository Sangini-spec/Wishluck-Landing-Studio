(() => {
  const html = document.documentElement;
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window && !html.dataset.wlMotion) {
    html.dataset.wlMotion = "1";
    html.classList.add("wl-motion");
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    const scan = root => root.querySelectorAll(".wl [data-wl-reveal]:not(.is-in)").forEach((el, i) => { el.style.transitionDelay = Math.min(i % 4, 3) * 70 + "ms"; io.observe(el); });
    scan(document);
    document.addEventListener("shopify:section:load", e => scan(e.target));
  }
  if (!html.dataset.wlSwap) {
    html.dataset.wlSwap = "1";
    document.addEventListener("click", e => {
      const btn = e.target.closest && e.target.closest(".wl [data-wl-swap]");
      if (!btn) return;
      const main = btn.closest(".wl-media")?.querySelector(".wl-fig-1 img");
      const img = btn.querySelector("img");
      if (!main || !img) return;
      for (const attr of ["src", "srcset", "alt"]) {
        const a = main.getAttribute(attr), b = img.getAttribute(attr);
        if (b === null) main.removeAttribute(attr); else main.setAttribute(attr, b);
        if (a === null) img.removeAttribute(attr); else img.setAttribute(attr, a);
      }
      if (main.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) main.animate([{ opacity: 0, transform: "scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: "cubic-bezier(.16,.84,.3,1)" });
    });
  }
})();
