# HR requirement traceability — actual initial-build status

The original assignment requirements and exact wording are indexed by H/D/E/X identifiers in [the authoritative baseline](../HR_REQUIREMENTS_TRACEABILITY.md). This register replaces the baseline's **proposed** implementation mappings with actual source locations. It does not replace or narrow any HR requirement.

**No row is assumed accepted just because code exists.** “Implemented / unverified” means the code path exists and TypeScript passes, but the specified acceptance evidence is not yet available. “Partial” means a requirement still has known functional gaps. “Blocked” means real external access or verification is needed. No mandatory pending row has been silently dropped.

## Source-location and entity legend

All backend modules below are under `backend/src/lib/` (the `backend` symlink resolves to `artifacts/api-server`). All routes are in `backend/src/routes/wishluck.ts`. UI components below are under `frontend/src/` (the `frontend` symlink resolves to `artifacts/wishluck`).

Database schema: `lib/db/src/schema/{runs,designs,intelligence,publications}.ts`.

- **Run** = `generation_runs`; its JSONB data contains product/brand snapshots, competitors, source fields and events. Product, BrandProfile and Competitor are **not separate SQL tables** in this initial build.
- **Design** = `generated_designs`; its versioned JSONB contains fingerprints/checks/scores, with content stored in a separate JSONB column.
- **Feedback** = `design_feedback`; **Learning** = `competitor_learnings`.
- **Evidence** = `crawl_artifacts`, with bytes in App Storage, not the database.
- **Publication** = `publishing_history`, also storing job/error state.

Schema normalization beyond these six tables remains an implementation-prompt gap, although HR permits a database of our choice.

## Mandatory functional and technical requirements

User-requested input extension: store and collection links are accepted through `product-discovery.ts` and `POST /api/products/discover`, exposed in `pages/create.tsx` as a product selector. No Run is created until the user selects a real product; existing `POST /api/runs` analysis remains product-specific. Seven offline discovery tests and the full 55-test backend suite passed. Live read-only checks found eight products at the user's example store and eighteen in the connected store. Frontend/backend type checks passed. This verifies discovery, not a new complete AI generation run or final HR acceptance.

| ID | Actual module | Actual backend API | Actual frontend | Database entity | Testing method / evidence needed | Completion status |
|---|---|---|---|---|---|---|
| H01 | Node/Express service; React/Vite app; README | GET /api/healthz | App.tsx | — | Workspace typecheck and both workflows passed; rationale documented | Verified foundation |
| H02 | compiler.ts; shopify/sections/* and assets/* | GET /api/designs/:id/download | pages/design.tsx | Design | Native Dawn upload/render and Theme Check still needed | Implemented / unverified |
| H03 | ai.ts; Replit AI server adapter; README cost assumptions | GET /api/settings; POST /api/runs | pages/settings.tsx, run.tsx | Run.aiCost | AI configured; actual text/vision outputs and costs need a completed run | Implemented / unverified |
| H04 | network.ts; crawler.ts | POST /api/runs; POST /api/runs/:id/research | run.tsx Activity | Evidence, Run | Real robots/deny/rate-limit capture cases; storefront returned HTTP 429 during access check | Implemented / unverified |
| H05 | research.ts Brave/SerpAPI adapters | POST /api/runs/:id/research | run.tsx Research | Run.competitors | Live search key missing; actual provider query still needed | Blocked |
| H06 | store.ts; Drizzle schema | GET /api/runs; GET /api/memory | history.tsx, memory.tsx | Run, Design, Learning | Database connection verified; restart persistence with real runs still needed | Partial verification |
| H07 | shopify-auth.ts; shopify.ts; submission docs | GET /api/shopify/status; POST /api/shopify/connect | settings.tsx | Publication; store env configuration | Existing dev-store custom-app auth verified; reviewer access not arranged | Partial |
| H08 | Server-only env adapters; .env.example; logger; gitignore | GET /api/settings (redacted) | settings.tsx | No credentials in DB | Presence-only setup, no exposed credential responses; final repo/video secret audit pending | Implemented / unverified final audit |
| H09 | analysis.ts; network.ts | POST /api/runs; GET /api/runs/:id | create.tsx | Run.product | URL checks implemented; full real extraction run still pending | Implemented / unverified |
| H10 | analysis.ts; authorised own-store fallback | GET /api/shopify/products; POST /api/runs | run.tsx Product | Run.product | Admin variants/IDs/images read successfully; price/variant extraction comparison pending | Partial verification |
| H11 | analysis.ts JSON-LD, spec table, review and image parsing | POST /api/runs | run.tsx Product | Run.product | Genuine JSON-LD review bodies/authors/ratings and additional properties are supported; unstructured widget reviews remain unsupported | Partial |
| H12 | crawler.ts computed CSS; analysis.ts vision | POST /api/runs | run.tsx Brand and Activity | Run.brand, Evidence | Actual CSS+screenshot colour comparison required; Admin fallback explicitly unmeasured | Implemented / unverified |
| H13 | crawler.ts font mapping; compiler settings | POST /api/runs; PATCH /api/runs/:id/brand | run.tsx Brand | Run.brand | Computed styles and picker identifiers need native editor verification; font mapping is limited | Partial |
| H14 | crawler.ts; analysis.ts | POST /api/runs | run.tsx Brand | Run.brand | Actual visual-tone/style comparison and correction required | Implemented / unverified |
| H15 | Full product/brand correction routes | PATCH /api/runs/:id/brand; PATCH /api/runs/:id/product | run.tsx Brand/Product | Run.product/brand | Brand and all extracted product fields have correction contracts; verify save/reload and generated snapshot use | Implemented / unverified |
| H16 | research.ts real search, optional relevance ranking | POST /api/runs/:id/research | run.tsx Research | Run.competitors | Need ≥8 relevant successful sources with reasons; no fallback fixture list | Blocked on search |
| H17 | crawler.ts; assets.ts | POST /api/runs/:id/research; GET /api/evidence/:id | run.tsx Research/Activity | Evidence, Run.competitors | Open both screenshots and HTML for each of ≥8 sources | Implemented / unverified |
| H18 | research.ts source text/vision breakdown | POST /api/runs/:id/research | run.tsx Research | Run.competitors[].analysis | Compare order/headline/pricing/trust findings against actual evidence | Implemented / unverified |
| H19 | research.ts source text/vision breakdown | POST /api/runs/:id/research | run.tsx Research | Run.competitors[].analysis | Compare observed cart/FAQ/media/urgency/unusual findings; missing details remain unknown | Implemented / unverified |
| H20 | research.ts quantified learning aggregation | POST /api/runs/:id/research; GET /api/memory | run.tsx Research; memory.tsx | Learning | Recompute successful-page denominators and follow source links | Implemented / unverified |
| H21 | AI evidence-bound prompts; generated asset/source separation | POST /api/runs/:id/generate | run.tsx Research/Designs | Design.content, Learning | Manual copy/provenance audit; automatic plagiarism detection not implemented | Partial |
| H22 | store.ts categoryContext; generation.ts | GET /api/memory; POST /api/runs/:id/generate | memory.tsx | Learning, Design, Feedback | Two same-category products and restart proof | Implemented / unverified |
| H23 | fingerprints.ts; saveDesign | POST /api/runs/:id/generate | design.tsx fingerprint display | Design.fingerprint | Deterministic fingerprint calculation and stored version checks | Implemented / unverified |
| H24 | fingerprints.ts weighted similarity; generation novelty search | POST /api/runs/:id/generate; POST /api/designs/:id/regenerate | design.tsx; run.tsx Designs | Design.fingerprint | Same-product-twice visual and nearest-match evidence; low scores currently warn, not hard reject | Partial |
| H25 | Feedback route, shopify.ts publication signal, categoryContext | POST /api/designs/:id/feedback; POST /api/shopify/publish | design.tsx feedback/publish | Feedback, Publication | Approval/rejection reason persistence and next-run prompt evidence | Implemented / unverified |
| H26 | generation.ts four directions; compiler/preview compositions | POST /api/runs/:id/generate | run.tsx Designs; design.tsx | Design | Complete real four-design run and visual comparison required | Implemented / unverified |
| H27 | generation.ts; compiler.ts; preview.ts | POST /api/runs/:id/generate | design.tsx | Design.content, Run.brand | Check source-grounded copy, brand fit and actual direction differences | Implemented / unverified |
| H28 | shopify/sections/wishluck-hero.liquid; wishluck-cart.js | Native Shopify /cart/add.js | Actual storefront; local preview explicitly non-cart | Source ProductVariant IDs; native product | All purchasable variants/quantities on real Shopify mobile+desktop; selling plans unsupported | Partial / unverified |
| H29 | Storefront CSS; IntersectionObserver cart script | Native Shopify /cart/add.js | Storefront purchase/sticky bar | — | First mobile viewport, scroll visibility and variant sync not yet browser-verified | Implemented / unverified |
| H30 | facts.ts source/merchant-confirmed trust text near purchase | POST /api/runs; generated template | run.tsx Product; native storefront | Run.product.specs | Rating and supplied delivery/COD/return/guarantee facts propagate; policy extraction outside tables remains limited | Partial |
| H31 | wishluck.css; responsive preview frames | GET /api/designs/:id/preview | design.tsx Preview | Design.checks | 360/768/1440 real rendered screenshots and overflow acceptance still needed | Implemented / unverified |
| H32 | Responsive Liquid image_tag; lazy content images; minimal cart JS | Download and publish endpoints | design.tsx quality area | Design.checks | Network/image audits and actual mobile Lighthouse not run | Implemented / unverified |
| H33 | quality.ts; compiler.ts; preview.ts; publish SEO fields | GET preview; POST quality; POST publish | design.tsx scores/checks | Design.checks/scores | Local preparation only; final theme can add headings/meta and needs DOM inspection | Partial |
| H34 | Source canonical/collection extraction; safe product template assignment | GET preview; POST publish | design.tsx | Run.product, Publication | Canonical/collection/handle inspection on final Shopify page pending | Implemented / unverified |
| H35 | Native Product JSON-LD; preview schema | GET preview; POST publish | design.tsx checks | Run.product, Design.checks | Real price/availability/rating source checks plus external Rich Results Test | Implemented / externally unverified |
| H36 | AI factual FAQ prompt; editable native FAQ blocks | POST generation; GET preview | design.tsx | Design.content.faqs | Standalone factual answers and actual query relevance need review | Implemented / unverified |
| H37 | Native FAQ JSON-LD generated from visible blocks | GET preview; POST publish | design.tsx checks | Design.checks | Google test not run; eligibility is not promised | Blocked on published verification |
| H38 | Sourced spec tables and original copy; quality.ts facts checklist | POST generation | design.tsx checks | Run.product.specs, Design.content | Material/dimensions/audience/box facts often absent; extraction is limited and facts omitted honestly | Partial |
| H39 | quality.ts weighted pass-count report | GET run/designs; POST quality | design.tsx | Design.checks/scores | Actual inspection-based SEO/brand/fact checks need expansion; current preparation scores clearly scoped | Partial |
| H40 | compiler.ts | GET /api/designs/:id/download | design.tsx ZIP | Design.content | ZIP/Liquid/template validation and native load pending | Implemented / unverified |
| H41 | Both section schemas; compiler common settings | GET download; POST publish | Native Shopify theme editor | Design.content | Change actual font, colours, image, headings/text/buttons/toggles in native editor | Implemented / unverified |
| H42 | Content section item blocks, including genuine source reviews | GET download; POST publish | Native Shopify theme editor | Design.content, Run.product.reviews | Add/delete/reorder benefits/specs/FAQ/review blocks in actual native editor | Implemented / unverified |
| H43 | shopify-cli.ts; publication-product.ts; native readback and Admin suffix assignment | POST /api/shopify/cli/uploads; POST /api/shopify/cli/uploads/:id/check | Design header; CliPublishing dialog | Publication, Design, Feedback | Real frontend submission created an unpublished theme, verified files/product assignment, opened Shopify, and survived reload; CLI adapter deviation explained in README | CLI path verified; native editor requires merchant sign-in |
| H44 | compiler.ts zipDesign | GET /api/designs/:id/download | design.tsx ZIP | Design.content | Download/unzip/native manual upload still needed | Implemented / unverified |
| H45 | jobs.ts; durable events in store.ts; SSE and polling | GET /api/runs/:id; GET /api/runs/:id/progress | run.tsx activity/status | Run.events/status | Real stage events implemented, no random percentages; interruptions become explicit failures | Implemented / unverified full run |
| H46 | Brand correction and competitor evidence routes | PATCH brand; GET run; GET evidence | run.tsx Brand/Research | Run, Evidence, Learning | Save/reload and inspect actual source screenshots; live research blocked | Implemented / unverified |
| H47 | preview.ts; 360/768/1440 scaled iframe | GET /api/designs/:id/preview | design.tsx Preview | Design.content | Actual previews need generated data; HTML approximation is labelled, not Liquid execution | Implemented / unverified |
| H48 | audit.ts; storefront-access.ts; storefront-lighthouse.ts | POST /api/designs/:id/quality; CLI upload/check auto-trigger | Design live quality state/report link | Design.lighthouse/checks; report in App Storage | Real authorized mobile audit reached the product page: performance 96, SEO 100, accessibility 96; password protection retained | Verified for one published dev-store example |
| H49 | feedback routes, retained-version regeneration, CLI publisher | POST feedback; POST regenerate; POST CLI uploads | design.tsx actions | Feedback, Design, Publication | Publish transition persisted after reload; positive publication signal saved. Native editing and cart acceptance require access | Publishing verified; remaining native checks blocked |
| H50 | store.ts listRuns/publications | GET /api/runs; GET /api/dashboard | history.tsx | Run, Design, Publication | Real empty history verified through API; populated persistence acceptance pending | Partial verification |
| H51 | audit.ts; native Lighthouse and target checks | POST /api/designs/:id/quality | Design scores and actual report | Design.lighthouse | 96/100/96 exceeded the 85/95/90 targets on one real unpublished Shopify product preview | One-product targets verified; five-product evidence remains |
| H52 | Native cart/compiler; verify-storefront.ts | Native product/cart and audit endpoints | Actual Shopify storefront | Design.checks, Publication | Actual HTTP add accepted the one available variant; isolated cart cleared; one H1 and validly parsed Product/FAQ JSON-LD. Interactive width/cart, Google validation and repeat-run acceptance remain | Partial native verification |
| H53 | docs/SUBMISSION.md evidence matrix | Existing run/quality endpoints | History and quality UI | Run, Design, Publication | At least five products/two real categories; no completed tests yet | Pending |
| H54 | public URL guard; authorised own-store scope check; env-only credentials | All relevant routes | No secret inputs | No credential values stored | Final repository and actual recording audit pending; source access rules implemented | Partial verification |

## Deliverables and evaluation criteria

| ID | Actual module / deliverable | Backend API | Frontend component | Database entity | Testing method / evidence | Status |
|---|---|---|---|---|---|---|
| D01 | backend/frontend source symlinks; shopify/; .env.example; pnpm repo | — | — | — | Repository hosting link and proper submission commit history not arranged | Partial |
| D02 | shopify.ts preview/editor links; docs/SUBMISSION.md | POST publish | design.tsx | Publication | Reviewer collaborator/theme-editor access not arranged | Pending |
| D03 | README setup, architecture, brand and competitor explanations | — | settings.tsx docs links | — | README exists; clean-clone setup not independently exercised | Implemented / unverified setup |
| D04 | README memory/novelty/SEO/limitations/next steps | — | settings.tsx | — | Actual algorithms documented; remaining gaps disclosed | Documented |
| D05 | README stack/model choice, cost assumptions and workflow pause | — | settings.tsx | Run.aiCost | Estimates explained, actual full-run cost pending | Documented / partially unverified |
| D06 | docs/SUBMISSION.md timed recording plan | Existing workflow routes | App + native Shopify editor | — | Actual 5–7 minute screen recording does not exist | Pending |
| D07 | docs/SUBMISSION.md five-product evidence matrix | Audit and run routes | History, quality results | Run, Design | No Lighthouse screenshots/Google results/fingerprint bundle yet | Pending |
| D08 | README and submission time-limit acknowledgement | — | — | — | 24 hours preserved; start/deadline not supplied | Documented / deadline unspecified |
| D09 | Original DOCX plus baseline and this actual status register | GET /api/requirements; GET /api/submission | settings.tsx links | — | Final full original-document acceptance audit not yet possible; no completion claimed | Pending |
| E01 | Four directions and distinct composition compiler | POST generation | Designs/Preview | Design | 20-point design criterion: visual review of actual outputs pending | Pending evaluation |
| E02 | Custom auth, publisher, native schemas/cart | POST publish | Native Shopify | Publication | 20-point Shopify/editor criterion: auth reads passed, publish/edit/cart pending | Partial foundation |
| E03 | Factual copy and honest local/unknown checks | POST quality | Quality results | Design.checks | 15-point SEO/AEO/GEO criterion: external validation pending | Pending evaluation |
| E04 | Real search/crawl/learnings and source IDs in design content | POST research/generation | Research | Learning, Design | 15-point criterion: live sources, design-use review and no-copy audit pending | Blocked on search |
| E05 | Persistent context, feedback, fingerprint heuristic | GET memory; POST generation | Memory/Uniqueness | Design, Learning, Feedback | 10-point criterion: repeat-run evidence pending | Pending evaluation |
| E06 | Responsive Liquid, sticky cart and audit CLI | Native cart; POST quality | Actual storefront | Design.checks | 10-point criterion: real mobile score/layout/cart matrix pending | Pending evaluation |
| E07 | Typed modular source, README, capture script | — | — | — | 10-point criterion: TypeScript passed; actual video and final repository still pending | Partial |
| X01 | A/B testing extra | — | — | — | No experiment routing/attribution code or tests | Optional / not implemented |
| X02 | Branded generated images/banners extra | — | — | — | No product-image generation workflow | Optional / not implemented |
| X03 | Docker extra | — | — | — | No one-command Docker setup; not needed for Replit runtime | Optional / not implemented |

## Additional implementation-prompt gaps

These are preserved even though the HR document takes precedence:

- Arbitrary configurable LLM-provider adapters and AI tool/function calling are not implemented.
- No managed dashboard authentication yet; production API is locked.
- No independent normalized SQL entities for every conceptual model in the prompt; snapshots are documented above.
- No new Shopify page assignment path; product template assignment is the supported HR “product **or** page” path.
- Search uses three diversified queries; actual relevance/coverage is unverified. Stronger source-fact validation, comprehensive competitor positional analysis and automatic low-novelty rejection need improvement.
- No automatic image import into the connected store, durable distributed worker queue or content-hash upload readback.
- No proper external schema-validation service integration or completed five-product acceptance evidence.

## Verification record

2026-11-11: full TypeScript check passed; backend and frontend workflows running; dashboard screenshot reviewed; health/settings/dashboard API responses succeeded; custom-app authentication, actual theme list and actual product/variant/image reads succeeded. The store's public product URL returned HTTP 429 during a simple access check. No store writes or real cart operations were performed.

This record is intentionally narrower than “all requirements complete.”

## Product-facing scope correction

Assignment checklists, submission guidance and integration readiness are developer-side material only. The readiness page, sidebar status/checklist panel, and document download endpoints have been removed from the product. Shopify connection is available inside publishing instead. References above to the former settings page or document endpoints describe the earlier build and no longer represent active product routes.

Search now uses Tavily basic REST search with automatic upgrades disabled; Brave and SerpAPI adapters are removed. On 2026-11-11, one real basic search returned 20 results and the restarted API reported search configured. This verifies authentication and result retrieval, not competitor relevance, eight successful crawls or the full research-to-generation workflow. Google Custom Search JSON API is closed to new customers and is scheduled to end on January 1, 2027, so it was not selected as the default. Six mocked search unit tests separately verify request shape, result mapping and failure behavior.
