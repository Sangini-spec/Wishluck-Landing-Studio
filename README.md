# Wishluck — AI Landing Page Studio

A Node.js / React application for analysing Shopify products, reviewing brand evidence, researching competitors, generating distinct storefront directions and exporting editable Online Store 2.0 Liquid templates.

**This is a working initial build, not a completed HR submission.** Read [implementation status](docs/IMPLEMENTATION_STATUS.md), [submission gates](docs/SUBMISSION.md), and the complete [HR requirements baseline](HR_REQUIREMENTS_TRACEABILITY.md). No passing Lighthouse scores, live research, cart results or Google validation results are fabricated.

## Source of truth

The original HR document is in `docs/source/`. It overrides the accompanying implementation prompt. The embedded diagram was read: URL → product/brand → competitor research → generator with learning/layout memory → QA → preview/pick → Shopify template.

The application deliberately pauses after analysis for corrections. Research and generation are separate actions so a failed external integration cannot masquerade as a completed stage. This is the only intended workflow refinement.

## Architecture

```text
React + Vite dashboard
  ├── generated React Query client
  └── Express API
       ├── URL validation / public-network guard / robots / browser crawler
       ├── Shopify product JSON + structured data
       ├── authorised own-store Admin fallback (clearly labelled)
       ├── OpenAI text + screenshot vision
       ├── Tavily basic search → competitor capture → linked learnings
       ├── PostgreSQL run history, evidence metadata, designs, feedback
       ├── category context → original copy → layout novelty search
       ├── Liquid / JSON / CSS / JS compiler → ZIP
       └── approved-design publisher → non-live theme → product assignment
```

### Repository layout

- `backend/` → symlink to `artifacts/api-server/`: Node.js / Express / TypeScript source.
- `frontend/` → symlink to `artifacts/wishluck/`: React / Vite / TypeScript source.
- `shopify/`: actual Liquid sections and minimal CSS/JS, separate from React.
- `lib/api-spec/openapi.yaml`: API contract; client hooks and Zod schemas are generated.
- `lib/db/src/schema/`: PostgreSQL / Drizzle schema.
- `lib/integrations-openai-ai-server/`: Replit AI SDK adapter.
- `docs/`: authoritative sources, submission instructions and honest verification status.

The symlinks provide the HR folder entry points without duplicating source or breaking the platform's artifact routing. Clone the repository with symlinks preserved.

### Stack rationale

Node and React meet mandatory HR requirements. TypeScript and generated contracts reduce frontend/backend mismatch. PostgreSQL provides durable relational history; JSONB snapshots retain versioned analysis and design data without storing image/file bytes in the database. Playwright gives computed browser styles and real screenshots. App Storage persists screenshot/HTML evidence. Liquid is used for actual native storefront output, not React embedded in Shopify.

## Setup

1. Use Node.js 24 and pnpm 10.
2. `pnpm install`.
3. Configure environment variables using `.env.example` as a list of names. On Replit, enter credentials only in Secrets. Local execution must supply environment variables to the process; the application does not auto-load `.env`.
4. Replit has PostgreSQL already configured. For a non-Replit local environment supply your own PostgreSQL URL.
5. `pnpm --filter @workspace/db run push` applies the development schema.
6. `pnpm --filter @workspace/api-spec run codegen` regenerates API hooks and validators.
7. In Replit start the existing **API Server** and **Wishluck** workflows. Routing is `/api` for Express and `/` for React. Do not start duplicate servers.
8. For a local non-proxied setup, run the backend with `PORT=8080` and the frontend with `PORT=5173 BASE_PATH=/`, then supply a same-origin reverse proxy forwarding `/api` to the backend. There is deliberately no hardcoded localhost backend URL in browser code.

Commands:

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
```

The frontend build and dev commands need the workflow-provided `PORT` and `BASE_PATH`. In a local shell provide those explicitly.

## Configuration and real integration readiness

### Shopify

This assignment supplies an existing custom app and dev store. No replacement store is provisioned. With `SHOPIFY_CONNECTOR_NAME` blank, the backend exchanges `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` using Shopify's documented client-credentials grant. The token is cached only in server memory, refreshes before expiry and retries authentication once on a 401. Concurrent renewals share one promise. The browser never sees secrets or access tokens.

This grant requires app and store to belong to the same Shopify organisation. Credential presence is not authentication success: use **Connect Shopify** inside the publish dialog.

If the user explicitly chooses an already-authorised managed connector, `SHOPIFY_CONNECTOR_NAME=shopify` or `shopify-store` uses the provided server-only proxy helper instead. That path has not been verified in this build.

Current documented API version: `2026-10`. Reference documentation consulted:

- [Client credentials](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant)
- [themeFilesUpsert](https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/themeFilesUpsert)
- [Theme file lookup](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/OnlineStoreTheme)
- [productUpdate and templateSuffix](https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/productUpdate)
- [Asynchronous jobs](https://shopify.dev/docs/api/admin-graphql/2026-10/queries/job)

**Important:** `write_themes` alone may not be enough. Shopify requires a theme-file modification exemption for `themeFilesUpsert`. A permission failure is surfaced, not treated as successful publication.

### AI

Replit AI Integrations provides OpenAI access without a user API key. Text and vision default to `gpt-5.4-mini`, chosen to balance structured extraction, visual reasoning, latency and cost. Calls use structured JSON plus Zod validation, with bounded retry/backoff through the supplied batch utilities.

Text/vision model names are configurable. This build does not yet implement arbitrary non-OpenAI provider adapters or tool calling. `LLM_API_KEY` is a documented placeholder, not an implemented external provider option.

Each run records an estimated cost from actual usage tokens. The default assumptions are $0.75 / million input tokens and $4.50 / million output tokens. **These are configurable planning assumptions, not a current billing quote.** A 25k-input / 6k-output run would estimate ~$0.046; multiple screenshots, longer competitor excerpts and retries can cost more. Search, browser hosting and storage are separate. Replit usage is billed to credits.

AI must return a validated visual plan and source-grounded copy. Generation fails explicitly if AI is unavailable or a sufficiently different plan cannot be produced; it does not silently create another template clone.

### Search

Configure `TAVILY_API_KEY` and `SEARCH_PROVIDER=tavily` (default). `SEARCH_API_KEY` is an optional alias for the same Tavily credential. Brave and SerpAPI adapters have been removed.

[Tavily's official free plan](https://docs.tavily.com/documentation/api-credits) currently includes 1,000 credits/month without a credit card. Basic search costs one credit per request. This app explicitly uses `basic`, disables automatic parameter upgrades and makes three search requests per research run. Stay on the free plan and do not enable pay-as-you-go if zero search spend is required; quotas/rate limits are surfaced rather than triggering a paid-provider fallback. Provider terms can change.

Missing credentials produce a concise product-facing error and zero researched competitors. No fixed competitor list is presented as live research. Assignment/submission documents remain developer materials in the repository; they have no app page, navigation links or download endpoints.

### Storage

Screenshot and captured HTML bytes live in App Storage. PostgreSQL stores object paths and source metadata only. The server-side capture process writes objects; no user upload endpoint is exposed.

## Product and brand analysis

Public Shopify product `.js` data supplies product IDs, variant IDs, availability, images and cents-denominated prices. HTML Product JSON-LD is a fallback for supported fields; prices are not fabricated when absent. Product spec tables and collection links are extracted when present.

Playwright captures desktop (1440px) and mobile (360px) screenshots and computed heading/body/button styles. Hex values are derived from browser CSS; a vision call interprets tone, image style and a visible secondary colour. Common font families map to known Shopify font-picker identifiers. This is a conservative mapping, not an exhaustive Shopify font-library search. Brand values and product title/category/description/specs can be corrected before generation.

If the own-store storefront is unavailable, the authorised Admin API can provide product facts. This **does not** count as successful screenshot/CSS analysis. Brand defaults are labelled unmeasured, and generation is blocked until the user reviews and saves real brand values. Competitor pages never use this own-store fallback.

JSON-LD review bodies/authors/ratings and additional product properties are supported. Widget-only reviews, facts outside structured data/tables and subscription selling plans remain limited. All extracted product fields have a correction contract; merchant-provided trust facts can be entered as labelled specifications and remain distinguishable from automatic source extraction.

## Competitor research

Search uses three diversified queries combining generic product attributes and Indian D2C/commercial intent, rather than the exact source SKU. The source brand, own-store and major marketplace/social results are excluded; candidates are deduplicated by host. AI ranks only URLs actually returned by search and supplies reasons. Up to 24 candidates are considered, crawling until eight succeed or candidates are exhausted.

Crawling checks robots.txt, honors conservative per-origin pacing and captures HTML plus mobile/desktop screenshots. Failed and forbidden sources stay visible. Text heuristics record feature presence; optional screenshot vision describes observed section/headline/offer/trust/cart/FAQ/media/urgency patterns.

Learnings use actual successful-source denominators with clickable URLs. “Reviews mentioned” does not claim verified review location or conversion performance. Discovery can still fall short of eight relevant accessible sources; this is an unresolved acceptance gate, not a silently lowered minimum.

## Persistent memory and novelty

Category memory is assembled from persisted learnings, prior design snapshots and feedback. Each new copy-generation prompt receives category learnings and approval/rejection reasons. Successful publication adds a positive signal; approvals and publication remain distinct events.

Every generated version retains immutable product and brand facts. Regenerate creates a new ID instead of deleting history. Rendering uses the current shared native/preview engine; legacy compositions map to defined visual families. Non-product privacy-table rows are excluded from specifications.

AI selects a complete page plan using captured competitor observations, source-linked learnings, feedback and saved layouts. Eight composition families (atelier, kinetic, gallery, dossier, panorama, mosaic, catalogue and journal) have different hero and page-wide arrangements. Image staging, scale, palette strategy, spacing, typography treatment, detail arrangement, alignment, accents and section order change actual HTML and native Liquid.

Each batch excludes its previous four families where available, then excludes each newly selected family within the batch. Version-two layout similarity uses:

| Feature | Weight |
|---|---:|
| Composition family | 30% |
| Section order (normalised longest common subsequence) | 15% |
| Hero scale | 7% |
| Image staging | 8% |
| Colour strategy | 8% |
| Content rhythm | 6% |
| Typography treatment | 8% |
| Detail arrangement | 8% |
| Alignment | 5% |
| Accent placement | 5% |

Layout difference = `100 × (1 − maximum similarity to stored category designs)`. The generator searches up to 128 independently sampled plans when needed and rejects candidates below 38%. Older fingerprints are projected through the legacy renderer's actual plan for cross-version comparisons. Older-versus-older comparisons retain their original calculation. The dashboard labels this as **layout difference**, and no-history results as a baseline.

This is an interpretable structural heuristic, not perceptual proof or a guarantee of unlimited unique artwork. Same-product repeat generation and visual review remain necessary. Names and copy changes alone do not increase the measured difference.

### Publishing external products into the connected store

The publishing dialog reads the authenticated store identity and product catalogue directly. Foreign-store variant IDs cannot be reused. Merchants can explicitly import a draft copy or select an existing store product; importing requires rights consent and a separate currency-mismatch confirmation where applicable (no invented FX conversion).

Draft imports copy source product facts, images and genuine variant prices into new store IDs. They do not activate products, publish sales channels, copy source inventory, ratings or store policies. A per-run handle plus source-URL metafield prevents duplicate imports. Theme uploads are attempted before automatic import, avoiding orphan products when Shopify refuses theme writes. Existing-product publishing adapts content to the selected product's actual facts.

The configured app authenticated successfully, and an approved draft import was verified with seven new variant IDs and four READY images. A real upload to the unpublished Horizon theme was denied because Shopify requires a theme-file API exemption in addition to the installed `write_themes` scope. The app surfaces the request link and manual ZIP option; it must not claim successful native publishing until that permission is granted and upload/assignment/cart checks pass. The MAIN theme was not modified.

## Liquid generation, editing and carts

Four direction prompts create story-led, benefit-grid, proof-led and purchase-led copy. The compiler selects substantially different hero compositions plus image, colour and benefits presentation variants. Only original/source-grounded copy and actual product images are used. Unknown policies, COD, shipping estimates, materials and reviews are omitted rather than invented.

Each design exports unique section/asset filenames and `templates/product.wl-<id>.json`. Schemas provide colour/font/image pickers, editable headings/rich text, buttons and links, visibility, radius, spacing and layout settings. Benefits, facts, FAQs and genuine sourced reviews use add/remove/reorder blocks. Rating and supplied delivery/COD/return/guarantee facts appear near purchase controls. Missing trust facts are omitted; automatic policy extraction outside structured data/tables remains limited.

The native Liquid form uses `product.variants`, current variant prices/availability, quantity, and same-origin Shopify `/cart/add.js`. It shows actual response/error feedback, has a first-mobile-content purchase region, and shows sticky cart after the primary controls leave view. Subscription selling plans are not supported in this first build.

Dashboard previews are safe server-rendered HTML approximations with working selection/FAQ/viewport inspection, **not Liquid execution**. Their cart deliberately explains that real purchase testing must happen on Shopify. Lighthouse does not audit dashboard approximations.

Images from another store must first be uploaded/selected in the merchant's Shopify files. Publishing rejects products not belonging to the connected store, preventing external variant IDs from being submitted to an unrelated store.

## Safe publishing

1. Approve a design.
2. Select an unpublished or development theme. MAIN themes are rejected by the API, not only hidden in UI.
3. Explicitly confirm that assigning a product template suffix and SEO fields changes global product data and can affect the live theme.
4. Compile namespaced Liquid, CSS/JS and JSON.
5. Reject filename conflicts; never overwrite a pre-existing file silently.
6. Upload through `themeFilesUpsert`; inspect `userErrors`, poll any returned job.
7. Query file existence, then assign `productUpdate` template suffix and SEO fields.
8. Verify the returned suffix; record preview/editor links or actionable errors.

File existence verification is implemented; byte-for-byte file readback and automatic rollback after a partially successful upload are not. A failed job may leave unassigned files on the selected non-live theme. Template assignment is intentionally not performed automatically during this build session.

ZIP export preserves `sections/`, `assets/`, `templates/` for manual upload; it is not falsely counted as API publishing.

## SEO / AEO / GEO and QA

Generated content has one H1, ordered headings, descriptive alt text, source canonical, collection links if sourced, Product JSON-LD, factual FAQ markup and a specification table when data exists. Native Shopify metadata comes from product SEO values and theme layout.

The dashboard reports **local preparation checks**, not a guarantee of final theme correctness. Unverified external schema, cart, breakpoint and performance checks remain unverified. Lighthouse can run against a successfully published Shopify preview URL and stores actual reports. A password/login page is rejected as a product audit.

Google FAQ rich-result eligibility is restricted; FAQPage validity, Rich Results Test reporting, actual eligibility and indexing are different things. No indexing or rich-result promises are made.

Targets: performance ≥85, SEO ≥95, accessibility ≥90 on mobile; layouts at 360, 768, 1440px; every purchasable variant on mobile and desktop. These are targets, not achieved results.

## Security and deployment boundary

URL validation rejects private/reserved IPs, custom ports, embedded credentials and non-HTTPS destinations, including browser subresources and redirects. Captured HTML is downloaded as an attachment with sandbox CSP. Generated previews have restrictive CSP. Inputs use generated Zod validation; API calls are rate limited and browser cross-origin writes are rejected.

This is currently a **private, single-workspace development build**. Managed user authentication/authorisation is not implemented. Production API access is intentionally locked rather than exposing store-admin operations publicly. Do not bypass that lock to deploy. Add managed authentication and per-workspace authorization before public release.

Job status is persistent, but the worker queue is in-process. On restart unfinished jobs become explicitly interrupted/failed rather than hanging forever. Automatic durable job resumption, multi-worker locking and distributed DNS/rate-limit hardening remain future work.

## Verification and submission

Verified so far: full workspace TypeScript checks, workflow startup, running dashboard capture, database-backed summary/settings responses, real custom-app authentication, theme listing and product/variant/image reads.

Not verified: completed product-generation runs, live competitor research, five-product/two-category matrix, actual publishing, native theme-editor edits, all-variant carts, Lighthouse targets, Google tests or screen recording. See [the live status register](docs/IMPLEMENTATION_STATUS.md).

The final HR submission additionally needs a GitHub/GitLab link with meaningful commit history, reviewer theme-editor access, five-product evidence and a genuine 5–7 minute recording. Source code and a demo script alone do not satisfy those obligations.

## Next steps, in order

1. Configure and test live search; complete a public-page product analysis with screenshot evidence.
2. Finish source-fact/review extraction and all requested correction/trust/review-block paths.
3. Collect five product tests across two categories and a repeat run; address uncovered bugs.
4. Publish only after explicit selection/confirmation; verify native editing, every variant, schema and Lighthouse.
5. Add managed auth for public deployment, richer quality checks and durable jobs.
6. Prepare repository link, access and the actual timed recording.

Optional extras are **not implemented**: A/B routing/attribution, AI-generated branded imagery, and Docker one-command setup. These must not displace mandatory HR requirements.
