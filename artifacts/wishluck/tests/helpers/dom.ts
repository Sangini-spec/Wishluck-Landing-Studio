import {Window} from "happy-dom";

// Imported before React DOM / React Query so they see a browser environment.
// No server, credentials, real navigation, scripts, or external assets are used.
// The runner preloads this before external packages are evaluated. Bundled test
// imports reuse that window rather than creating a second document.
export const dom: Window = (globalThis as unknown as {window?: Window}).window ?? new Window({
  url: "https://wishluck.test/designs/design-1",
  settings: {
    disableJavaScriptFileLoading: true,
    enableCSSFileLoading: false,
    enableImageFileLoading: false,
    enableIframePageLoading: false,
    navigation: {
      disableMainFrameNavigation: true,
      disableChildFrameNavigation: true,
      disableChildPageNavigation: true,
    },
  },
});
for (const name of [
  "window", "document", "navigator", "localStorage", "sessionStorage",
  "HTMLElement", "Element", "Node", "NodeFilter", "DocumentFragment",
  "MutationObserver", "CustomEvent", "Event", "MouseEvent", "FocusEvent",
  "HTMLInputElement", "HTMLSelectElement", "HTMLButtonElement",
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true, writable: true,
    value: name === "window" ? dom : dom[name as keyof Window],
  });
}
Object.defineProperty(globalThis, "getComputedStyle", {configurable: true, value: dom.getComputedStyle.bind(dom)});
Object.defineProperty(globalThis, "requestAnimationFrame", {configurable: true, value: dom.requestAnimationFrame.bind(dom)});
Object.defineProperty(globalThis, "cancelAnimationFrame", {configurable: true, value: dom.cancelAnimationFrame.bind(dom)});
Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

// Deny by default even before a fixture mounts or after it has been disposed.
export const denyFetch: typeof fetch = async () => { throw new Error("Unmocked network request in offline UI test"); };
export function setOfflineFetch(fetcher: typeof fetch) {
  globalThis.fetch = fetcher;
  // Happy DOM and Node use separate Response types. The generated client reads
  // only the standard Fetch API, so keep both entry points on the same mock.
  Object.defineProperty(dom, "fetch", {configurable: true, writable: true, value: fetcher});
}
setOfflineFetch(denyFetch);
