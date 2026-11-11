# Rendering regression checks

Run from the repository root:

```sh
pnpm test                 # Existing unit tests + rendering regressions
pnpm run test:render      # Rendering only, about 35 seconds here
pnpm run typecheck
```

The rendering suite uses the API package's existing Playwright dependency. Set
`CHROMIUM_PATH` to an installed Chromium executable if needed. On Replit it uses
`/repl/tools/bin/chromium`; elsewhere it falls back to Playwright's installed
Chromium. Missing Chromium is a failure, not a skipped/passing rendering check.
For a workstation without a browser, install it with
`pnpm --filter @workspace/api-server exec playwright install chromium`.

## Coverage

- 40 deterministic visual plans: five axis combinations for each of atelier,
  kinetic, gallery, dossier, panorama, mosaic, catalogue and journal. Every value
  of each plan axis is covered **within every family**, with two section orders.
- All 12 legacy composition mappings, including brand-hero and brand-details.
- One-image, no-image, sold-out and long-copy products.
- Each of these 56 fixtures at **360, 768 and 1440 pixels**, in both HTML preview
  and compiled native Liquid: **336 rendered viewport checks**.
- Real compiled templates are always built with **`p.images = []`** and rendered
  with a separate runtime product. Hero, story, gallery and purchase images must
  resolve from that assigned product, without populated image-picker bindings.
- Geometry guards cover cropped contain-fit product contents (including scale
  and rotation), horizontal overflow, clipped text/controls, and overlapping
  sibling content blocks. Synthetic images have visible content to their edges
  and landscape, portrait, square and panoramic aspect ratios.
- Text contrast is checked on the actual painted surfaces, including accent
  panels and detail tiles. Inline price, variant, quantity and cart must remain
  visible. Mobile/tablet must initially show an inline purchase control or the
  sticky fallback; after scrolling, the sticky price/cart must be on-screen,
  unobscured and large enough to use.
- Native/preview section order and class vocabularies (including child classes),
  stylesheet bundles, schema setting references, enum options, ranges/defaults,
  blocks and Product/FAQ JSON-LD are checked for drift.
- Fingerprints must identify identical designs, respond to every rendered axis,
  and project each legacy mapping consistently. With other axes held constant,
  the eight families must not collapse to identical desktop geometry.
- Variant changes update price, compare-at price and availability. Thumbnail
  swapping and gallery hover preserve complete product imagery.
- Injected failures demonstrate that crop, overflow, overlap, hidden controls,
  unreadable contrast and native/preview class drift are rejected.

## Isolation and evidence

No AI, database or Shopify credentials are needed. The suite imports only local
render/compile helpers and uses synthetic fixtures. Browser networking is
default-deny: only four in-memory image responses are allowed. Any other request,
including a cart request, is blocked and fails the run. There are **no Shopify
writes, cart submissions, checkout actions or purchases**.

Large outputs are stored only under the already Git- and deployment-ignored
`generated-artifacts/render-regression/`. Test bundles go under `tests/`.
Failures write viewport screenshots and diagnostic JSON under `failures/`,
including fixture ID, plan axes, renderer, viewport and failing assertions.
That failure directory is cleared at the beginning of each rendering run;
a passing run leaves it empty. Text assertion failures also appear in the test
command's output. No golden screenshot updates or network-dependent images are
required to accept an intentional change.

## Limits and extending coverage

This is bounded axis coverage, not all possible combinations, all languages or
all viewport heights. Chromium uses reduced motion for stable geometry. The
family geometry assertion detects structural collapse, not perceptual novelty.
Contrast/overlap checks are targeted regression guards, not a full accessibility
audit. Unsupported/new Liquid filters fail explicitly.

`render-regression/native.ts` executes the actual compiled Liquid through
LiquidJS, adapting only Shopify-specific style/schema tags and image, font,
asset and money filters. It is **not Shopify's hosted Liquid runtime** and does
not reproduce Dawn's surrounding CSS, theme-editor lifecycle or checkout.
Real Shopify verification remains separate and requires approved theme access.

When extending the plan vocabulary, update the fixture axes and both renderers.
Keep fixture facts synthetic, add relevant image/content edge cases, and update
the native filter adapter only if the production Liquid actually needs it.
Do not weaken an assertion merely to make a new design pass: fix the shared
renderer or explain and narrowly encode an intentional exception.
