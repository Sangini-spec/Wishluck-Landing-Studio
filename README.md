# Wishluck Landing Studio

An AI-assisted Shopify landing-page studio: analyse a real product and its brand, review the facts, research competitors, create four original landing-page directions, then upload an editable native Shopify theme.

**Repository:** https://github.com/Sangini-spec/Wishluck-Landing-Studio

**Evidence:** [five-product results](docs/results/README.md) · [requirement traceability](HR_REQUIREMENTS_TRACEABILITY.md) · [submission checklist](docs/SUBMISSION.md)

## Submission status

Five actual products across five categories have saved analysis, competitor research and generated designs. The evidence package includes four designs per product at **360, 768 and 1440px**, category/layout fingerprints, source-linked research, local schema results and the available real Shopify Lighthouse reports.

**Important:** this is not a claim that every HR acceptance gate passed. Three products have archived Shopify Lighthouse reports; two have no storefront audit. Some measured SEO results are below 95. Google's Rich Results Test and comprehensive five-product/all-variant native cart/editor acceptance remain unverified. The owner requested **existing evidence only** and excluded the video. See the [results matrix](docs/results/README.md) for exact outcomes rather than assuming that screenshots certify live Shopify behavior.

## Stack and repository structure

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js 24, Express, TypeScript | Required Node stack; validated requests and clear service boundaries |
| Dashboard | React, Vite, React Query | Required React stack; live progress, editable analysis, responsive previews |
| Shopify pages | Native OS 2.0 Liquid sections, JSON templates, CSS, minimal JS | Editable in Shopify; no React dependency in storefront output |
| AI | GPT-5.4 planning; GPT-5.4-mini copy, research assistance and vision | Stronger composition reasoning without upgrading every call |
| Search/crawling | Tavily, Playwright, Cheerio | Real discovery, screenshots/computed styles and structured HTML extraction |
| Persistence | PostgreSQL/Drizzle, JSONB snapshots | Category learnings, versioned designs, feedback, history and job recovery |
| Files | Replit App Storage | Durable screenshots, captured HTML and actual audit reports |
| Contracts | OpenAPI, generated Zod/React Query clients | One API contract across backend and dashboard |

```text
backend/                    -> artifacts/api-server/ (tracked directory symlink)
frontend/                   -> artifacts/wishluck/   (tracked directory symlink)
shopify/                       Native Liquid sections and lightweight assets
artifacts/api-server/src/       Express routes, analysis, research, generation, publisher
artifacts/wishluck/src/         React dashboard and UI tests
lib/api-spec/openapi.yaml       API source of truth
lib/db/src/schema/              Persistent database schema
docs/results/                   Five-product screenshots, reports and fingerprints
scripts/package-submission.mjs  Reproducible read-only evidence exporter
```

The separate `backend/`, `frontend/` and `shopify/` entry points satisfy the layer separation without duplicating source or breaking this workspace's artifact routing. Preserve Git symlinks when cloning. On GitHub, the canonical backend/frontend source is also directly browsable under `artifacts/`.

## Setup

### Prerequisites

- Node.js **24**, pnpm **10**, PostgreSQL.
- Chromium for crawling, render regressions and Lighthouse. The verified environment provides `/repl/tools/bin/chromium`; otherwise install Playwright Chromium and set `CHROMIUM_PATH`.
- OpenAI-compatible AI access, Tavily access and authorized Shopify development-store credentials.
- **Full evidence storage currently requires Replit App Storage and its runtime credential sidecar.** The storage adapter is not portable to an arbitrary local GCS account without adaptation. A plain local Node/Postgres installation does not provide that service automatically.

```sh
git clone https://github.com/Sangini-spec/Wishluck-Landing-Studio.git
cd Wishluck-Landing-Studio
pnpm install --frozen-lockfile
cp .env.example .env
# Fill placeholders privately. Do not commit .env.
set -a; . ./.env; set +a
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-spec run codegen
```

Run in two terminals with the configured environment:

```sh
# Backend
PORT=8080 pnpm --filter @workspace/api-server run dev

# Dashboard; open http://localhost:5173
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/wishluck run dev
```

Vite proxies `/api` to the local backend; `API_PROXY_TARGET` can override that development-only target. In the existing Replit workspace use the managed **API Server** and **Wishluck** workflows, not duplicate servers. Browser API URLs remain same-origin.

Environment variables are supplied by the process; the backend does not implicitly load `.env`. Replit Secrets supplies them in the verified workspace. Never put a real key, Theme Access password, storefront password, cookie or signed preview token in the repository.

### Configuration

- `DATABASE_URL`: PostgreSQL connection; never commit the real value.
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`: existing AI integration/compatible provider.
- `DESIGN_MODEL=gpt-5.4`; `TEXT_MODEL` and `VISION_MODEL=gpt-5.4-mini`.
- `TAVILY_API_KEY`, `SEARCH_PROVIDER=tavily`: competitor discovery. Brave is not required.
- `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`: the existing installed app. Client-credentials authentication requires an app/store relationship supported by Shopify.
- `SHOPIFY_CLI_THEME_TOKEN_<STORE_SLUG>`: separate Theme Access credential for each store. For this development store the name is `SHOPIFY_CLI_THEME_TOKEN_WISHLUCK_AI_BUILDER`.
- `SHOPIFY_FLAG_STORE` binds an optional generic CLI token to one exact store; it is never reused indiscriminately.
- `SHOPIFY_STOREFRONT_PASSWORD_<STORE_SLUG>`: optional authorized storefront viewing password; not a staff login.
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR`: provisioned storage configuration.

All values in [.env.example](.env.example) are placeholders or non-secret defaults.

## Architecture and workflow

```text
Product/store URL
  -> discover and explicitly select a product when needed
  -> public product facts + desktop/mobile capture + computed styles/vision
  -> merchant reviews and corrects product/brand facts
  -> mandatory category/keyword competitor search and capture
  -> source-linked learnings + category feedback + previous fingerprints
  -> original factual copy, then independently composed visual plans
  -> factual/layout/schema preparation checks
  -> four responsive HTML previews
  -> chosen design compiled to native Liquid/JSON/CSS/JS
  -> new unpublished Shopify theme + verified file readback
  -> Shopify editor, where the merchant makes the final live-publish decision
  -> refreshed remote status and real storefront Lighthouse
```

Analysis/research/generation run through the backend job queue with progress events. Uploads/audits have durable job records, content identity and read-only restart reconciliation. Ambiguous uploads are **not** blindly repeated. Regeneration creates a new design version rather than erasing the original.

### Product and brand analysis

The extractor combines classic Shopify Ajax/public JSON, structured Product data, inert embedded JSON and observed Hydrogen purchase-form variant GIDs. A missing classic `.js` endpoint does not automatically mean a headless product is unavailable. Price units are normalized; missing prices are not invented as zero and SKUs are not guessed as variant IDs.

Playwright captures 1440px/360px evidence and computed heading/body/button styles. CSS supplies hex colours, sizes, weights, corner radius and spacing. Vision adds visual tone/image-style observations. Heading/body families are conservatively mapped to Shopify font-picker identifiers. Product and brand panels allow corrections before research and generation; unavailable facts remain explicit.

### Competitor selection and learnings

Tavily queries combine product/category terms with commercial and Indian D2C intent. Candidates are actual search results, deduplicated and screened for relevance; the source brand and unsuitable marketplace/social results are excluded. Each candidate includes a selection reason.

Crawling respects robots.txt, per-origin pacing and access failures. Successful captures include desktop/mobile screenshots and HTML; analysis records section order, headlines, pricing/offer treatment, trust, cart placement, FAQs, media, urgency and unusual patterns. Learnings cite their actual captured sources. Generation requires at least eight successful relevant captures; a search failure is not replaced by invented research.

Competitor text, code, logos and imagery are not reused as page assets. Product-source images are used for the selected product; arbitrary competitor conversion performance is not claimed.

### Category memory and non-repetition

PostgreSQL stores category learnings, design snapshots/fingerprints and approval/rejection/publication signals. These influence subsequent copy and planning. The chosen direction is not selected from four fixed finished templates.

Current native plans independently choose hero composition, surfaces, media placement/ratio/share, widths, typography, spacing and each section's composition. The same plan is interpreted by both preview and Liquid renderers. Fingerprints record those actual choices; legacy plans are compared using what their renderer actually displays.

Difference is `100 × (1 − closest structural similarity)`, with a **38% minimum** and bounded repair attempts. This is a structural heuristic, **not** a perceptual uniqueness certificate. Two consecutive four-design bowl batches were verified against populated history without lowering the threshold. Their fingerprints are in the results package.

### SEO, AEO and GEO

- **SEO:** one H1, heading structure, editable title/description, canonical, alt text, collection links and Product JSON-LD with real price/availability and genuine ratings only.
- **AEO:** visible direct-answer FAQs and matching FAQPage JSON-LD; question depth is checked, not just schema presence.
- **GEO:** concise source-backed specifications, materials/dimensions/contents/audience when actually known, and consistent brand naming. Missing facts are not invented to inflate scores.
- Circular Overall/SEO/AEO/GEO values mean **local checklist coverage**, not rankings or measured AI-answer inclusion.
- Lighthouse is a separate actual mobile audit. Password, login and setup pages are rejected rather than assigned attractive scores.
- Local schema parsing/shape checks are **not** Google Rich Results Test certification. FAQ rich-result eligibility and indexing are separate questions.

HR targets are Performance **85**, SEO **95**, Accessibility **90**. Actual results—including failures—are linked in [docs/results](docs/results/README.md).

## Native Shopify editing and publishing

Sections expose native colour/font/image pickers, editable headings/rich text/buttons, show/hide toggles and layout settings. Benefits, FAQs and sourced repeated content are editable blocks. Native forms bind the destination product's actual variants, prices, availability and quantity; sticky mobile purchase controls use lightweight JavaScript.

**Intentional HR workflow change:** theme files upload via **Shopify CLI + Theme Access**, not the blocked `themeFilesUpsert` path. The existing app lacks protected theme-file API access; real CLI authentication, new unpublished upload and remote readback were verified. Product reads, explicit draft imports and authorized template/SEO assignment still use the Admin API. This does not pretend the app received Shopify's exemption.

The primary button validates/uploads a new unpublished theme, shows progress in Wishluck, and navigates to Shopify's editor after verified completion. It does not open a blank waiting tab or silently activate the live theme. Importing source products/images requires explicit rights/assignment consent; imported products stay draft. A completed design version cannot be uploaded repeatedly.

**Uploaded** means an existing non-live theme; **Published** means Shopify currently reports it live. There is one live theme per store. Deleted themes are excluded from active totals and retained as Deleted history. Counts deduplicate theme identities and refresh on return/focus and every 30 seconds.

The ZIP download is a complete merchant-preview theme with layout, settings schema/data/preset, templates, sections, assets and locales. Upload it through **Online Store → Themes → Import theme**, not the Partner Theme Store submission form. ZIPs do not import products or grant rights to source assets.

### Reviewer store access

- Development store: https://wishluck-ai-builder.myshopify.com
- Theme editor: https://admin.shopify.com/store/wishluck-ai-builder/themes
- Unsigned per-theme preview/editor links: [reviewer access](docs/REVIEWER_ACCESS.md).

The store remains protected. Reviewer staff/collaborator access or any viewing password must be provided **privately by the owner**. No password, signed preview key or login session is included here.

## Tests and evidence

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/wishluck test
pnpm run test:render
```

Rendering regressions use isolated synthetic assigned-product media, deny external network/cart writes, and check native/preview parity, contrast, geometry and responsive purchase controls. They do not certify a live Shopify checkout or replace the real five-product results.

To regenerate read-only screenshots/research/fingerprints/schema checks and download **existing** audit reports:

```sh
node scripts/package-submission.mjs --origin https://YOUR_RUNNING_PREVIEW
node scripts/index-submission.mjs
```

No Shopify uploads, carts or purchases are triggered by that exporter. `--reports-only` refreshes archived reports without redoing screenshots.

The public repository preserves the real development history but omits the owner's private assignment attachments and internal workspace context. `bash scripts/export-public-history.sh` creates an isolated sanitized copy; `node scripts/check-public-export.mjs` scans its reachable history before an explicit `main` push. Never mirror the private working repository.

## Known issues and next steps

1. **External acceptance:** complete missing storefront audits for two products; remediate measured SEO failures; perform Google Rich Results Test validation and all-variant native cart/editor acceptance. Existing reports are not silently replaced by local benchmark results.
2. **Owner access:** staff/editor login and protected-store review access remain separate from successful upload credentials.
3. **Source coverage:** thin product descriptions and blocked competitor pages constrain factual content; font mapping and widget-only reviews are not exhaustive.
4. **Production security:** this is an owner-operated development tool, not a multi-tenant public SaaS. Add authenticated merchant authorization and per-workspace access before public deployment; do not remove the production safety lock.
5. **Reliability/portability:** analysis/generation jobs are in-process; improve restart resumption and replace the Replit-specific storage adapter for non-Replit hosting.
6. **Optional extras:** A/B attribution, generated campaign imagery and Docker setup are not claimed. The video is excluded at the owner's request, not represented by a fabricated recording.

Third-party source assets remain their owners' property. Evidence screenshots are evaluation records, not a licence to resell or redistribute product photography.
