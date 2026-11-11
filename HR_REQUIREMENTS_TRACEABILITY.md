# Wishluck — HR assignment requirements and verification

## Authority and current status

**Implementation update:** Actual source locations, APIs, UI components, database storage and completion states now live in [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md). The table below remains the original pre-implementation baseline and must not be read as verified completion.

The complete attached `Wishluck_AI_Landing_Page_Builder_Assignment_1794389299897.docx`, including its embedded workflow diagram, is the primary source of truth. The attached master prompt supplies additional implementation requirements only where consistent with the HR document. Both were read in full before implementation.

This is the initial traceability baseline, not a completion report. All modules, routes, components, and entities below are proposed implementation targets, not claims that code exists. Every item is **Pending** unless stated otherwise. Replace Pending with Implemented/unverified, Verified (with evidence), Blocked (with reason), or Not applicable (with justification). Implementation alone does not satisfy a runtime or submission requirement.

HR workflow: product URL → product and brand analysis → competitor research → generator with learning/layout memory read-and-save → SEO/AEO/GEO and QA → dashboard preview and selection → Shopify page template. Explain any workflow change in README.

## Functional and technical traceability

| ID | HR requirement | Implementation module | Backend API | Frontend component | Database entity | Testing method | Status |
|---|---|---|---|---|---|---|---|
| H01 | Node.js backend; React dashboard; justify remaining stack choices and workflow changes | backend/, frontend/, README | /api/health | App | — | Start app; inspect stack and architecture rationale | Pending |
| H02 | Liquid/CSS/minimal-JS OS 2.0 sections plus JSON templates; Dawn or free OS 2.0 compatibility | shopify/compiler | /api/designs/:id/download | PreviewStudio | GeneratedDesign, DesignSection | Shopify Theme Check; upload/render in Dawn | Pending |
| H03 | Any LLM plus vision model; justify choice and rough cost/run | backend/providers/ai | /api/settings/readiness | Settings | GenerationRun | Real provider call; cost estimate with token/model assumptions | Pending |
| H04 | Browser crawler or scraping API; robots.txt compliance and rate limits | backend/crawler | /api/products/analyse | RunProgress | CrawlArtifact | robots allow/deny, retry, rate-limit and browser tests | Pending |
| H05 | Actual search API for competitor discovery | backend/providers/search | /api/competitors/research | CompetitorPanel | Competitor | Provider integration test; source audit | Pending |
| H06 | Persistent learnings, designs and run history | backend/db | /api/memory; /api/history | MemoryPanel, History | CategoryMemory, GeneratedDesign, GenerationRun | Restart app and verify persisted records | Pending |
| H07 | Free development store; provide collaborator or preview access | backend/shopify; submission | /api/shopify/status | ShopifySettings | ShopifyStore | Verify access and theme-editor access separately | Pending |
| H08 | All keys in environment variables; no committed secrets or store passwords | backend/config; .env.example | /api/settings/readiness | Settings | — | Secret scan; redacted logs; no secrets in browser bundles | Pending |
| H09 | Accept dev-store/public Shopify product URL | backend/products | POST /api/products/analyse | ProductInput | Product | Valid/invalid URLs; public/dev-store end-to-end extraction | Pending |
| H10 | Extract title, price, compare-at price, variants and actual cart variant IDs | backend/products | /api/products/:id | ProductAnalysis | Product, ProductVariant | Compare source and extracted fields; currency and variant tests | Pending |
| H11 | Extract images, description, specs, genuine reviews/rating when shown | backend/products | /api/products/:id | ProductAnalysis | Product, SourceFact | Source provenance and missing-field tests | Pending |
| H12 | Primary/secondary/background/text/button palette with hex codes using both CSS and screenshot | backend/brand | /api/products/:id/brand | BrandPanel | BrandProfile, CrawlArtifact | Inspect computed styles and screenshot/vision evidence | Pending |
| H13 | Computed heading/body fonts, sizes and weights; closest Shopify font-library mapping | backend/brand/fonts | /api/products/:id/brand | BrandPanel | BrandProfile | Computed-style extraction; valid font picker identifiers | Pending |
| H14 | Tone, imagery/button style, corner radius and spacing | backend/brand | /api/products/:id/brand | BrandPanel | BrandProfile | Source comparison and editable field checks | Pending |
| H15 | Show all extracted product/brand analysis; allow correction before generation | backend/products; backend/brand | PATCH /api/products/:id; PATCH /api/products/:id/brand | ProductAnalysis, BrandPanel | Product, BrandProfile | Edit/save/reload; generated output uses corrections | Pending |
| H16 | At least eight relevant competitors using category/keywords; prefer Indian D2C where possible; reason for each selection | backend/research | /api/competitors/research; /api/competitors/:runId | CompetitorPanel | Competitor, GenerationRun | Eight successfully researched relevant sources; inspect selection rationale | Pending |
| H17 | Crawl each competitor: desktop and mobile screenshots plus HTML | backend/crawler | /api/competitors/:runId | CompetitorEvidence | Competitor, CrawlArtifact | Open both screenshots and HTML evidence for each source | Pending |
| H18 | Analyse section order, headlines, offers/pricing and trust via reviews/badges/guarantees | backend/research/analyser | /api/competitors/:runId | CompetitorBreakdown | CompetitorAnalysis | Compare analysis with captured source evidence | Pending |
| H19 | Analyse ATC placement, FAQ, image/video, urgency and unusual elements | backend/research/analyser | /api/competitors/:runId | CompetitorBreakdown | CompetitorAnalysis | Evidence-backed structured extraction tests | Pending |
| H20 | Concise aggregate learnings with source links; quantified observations use actual coverage | backend/research/learnings | /api/competitors/:runId | LearningsPanel | CompetitorLearning | Recompute counts; follow citations; disclose crawl failures | Pending |
| H21 | Never copy competitor text, images, logos or code; use patterns and original content | backend/generation/provenance | /api/generations | LearningsPanel, DesignCard | SourceFact, GeneratedDesign | Asset provenance review; copy-similarity checks and manual audit | Pending |
| H22 | Save and reuse learnings by product category | backend/memory | /api/memory | MemoryPanel | CategoryMemory, CompetitorLearning | Two same-category products reuse recorded learnings | Pending |
| H23 | Save every layout fingerprint: section order, hero type, colour usage, ATC placement, etc. | backend/memory/fingerprints | /api/designs/:id | FingerprintPanel | LayoutFingerprint | Deterministic fingerprint persistence tests | Pending |
| H24 | New category designs differ clearly from prior designs; explain metric and show check | backend/memory/similarity | /api/designs/:id | UniquenessPanel | LayoutFingerprint, QualityCheckResult | Same product twice and same-category second product; nearest-match evidence | Pending |
| H25 | Publication stores positive signal; rejection stores negative signal and optional reason; use signals next run | backend/feedback | /api/designs/:id/approve; /reject; /api/shopify/publish | DesignActions | DesignFeedback, PublishingHistory | Feedback persistence; next-generation input includes signals | Pending |
| H26 | Generate at least three, ideally four, genuinely different directions; not merely reordered sections | backend/generation | POST /api/generations | DesignGallery | GeneratedDesign | Four-output generation; visual and structural comparison | Pending |
| H27 | Story-led, benefit-grid, social-proof-heavy, offer-led are suggested, not mandatory; grounded content in product tone, colours and fonts | backend/generation | /api/generations/:id | DesignGallery | GeneratedDesign, BrandProfile | Distinct hero/composition; brand and source-fact checks | Pending |
| H28 | Real cart POST with selected variant ID, price, quantity and variant selector | shopify/sections/product; shopify/assets/cart | Shopify storefront /cart/add.js | Storefront product form; PreviewStudio | ProductVariant | All available variants on real mobile/desktop storefront; verify cart contents | Pending |
| H29 | Mobile ATC in first viewport and sticky ATC after scrolling | shopify/assets/cart; shopify/sections/product | Shopify storefront /cart/add.js | Storefront hero, StickyCart | — | 360px viewport visibility and scroll tests; selected-variant synchronization | Pending |
| H30 | Trust near purchase button: rating, delivery, COD, returns only when supported by real source data | backend/facts; shopify/sections/product | /api/products/:id | ProductAnalysis; StorefrontTrust | SourceFact | Provenance checks; unknown values omitted/flagged, not invented | Pending |
| H31 | No layout breaks at 360, 768 and 1440px | shopify/assets/styles | /api/designs/:id/preview | PreviewStudio | QualityCheckResult | Browser screenshots, overflow and element visibility checks at all widths | Pending |
| H32 | Fast loading, lazy below-fold images, correct image sizes, no heavy JS | shopify/compiler/assets | /api/designs/:id/quality | QualityPanel | QualityCheckResult | Network/image audit; Lighthouse on actual rendered storefront | Pending |
| H33 | SEO: one H1, heading order, title/description, all image alt text | backend/quality; shopify/compiler | /api/designs/:id/quality | QualityPanel | QualityCheckResult | DOM/meta checks on final Shopify page, including theme contributions | Pending |
| H34 | SEO: canonical, readable handle, collection links | backend/quality; backend/shopify | /api/designs/:id/quality | QualityPanel | QualityCheckResult, PublishingHistory | Resolve rendered canonical and links; inspect assigned handle | Pending |
| H35 | Product JSON-LD with price/availability and rating only if genuine | shopify/sections/schema | /api/designs/:id/quality | QualityPanel | SourceFact, QualityCheckResult | Parse JSON-LD; variant data checks; Rich Results Test evidence | Pending |
| H36 | FAQ: short standalone answers to actual size/material/delivery/returns/care questions, where factual | backend/generation/faqs | /api/designs/:id | FAQ preview | SourceFact, DesignSection | Source-backed answer review; flag unknown policy/spec facts | Pending |
| H37 | FAQPage schema and Google Rich Results Test validation | shopify/sections/faq; backend/quality | /api/designs/:id/quality | QualityPanel | QualityCheckResult | Schema validation plus external Rich Results Test evidence; distinguish eligibility from validity | Pending |
| H38 | GEO: specs table, materials, dimensions, audience, box contents, consistent brand; no unsupported vague claims | backend/generation/facts | /api/designs/:id | Specs preview, QualityPanel | SourceFact, DesignSection | Fact provenance and consistent brand checks; disclose missing facts | Pending |
| H39 | Per-design SEO/AEO/GEO score with passed checks and fixes needed | backend/quality | /api/designs/:id/quality | QualityPanel | QualityCheckResult | Scores computed from actual checks; skipped/blocked checks not passed | Pending |
| H40 | Export each design as Liquid sections and JSON product or page template | shopify/compiler | /api/designs/:id/download | DownloadAction | GeneratedDesign, DesignSection | ZIP structure; JSON parse; Theme Check; template references | Pending |
| H41 | Every section: colour/font/image pickers, editable headings/text/richtext/buttons and show/hide toggles | shopify/sections | /api/designs/:id/download | Shopify native theme editor | DesignSection | Edit each setting in Dawn; verify visible result and font loading | Pending |
| H42 | Repeating benefits, FAQs and reviews are add/remove/reorder blocks | shopify/sections | /api/designs/:id/download | Shopify native theme editor | DesignSection | Add/delete/reorder blocks in theme editor; no hardcoded editable content | Pending |
| H43 | Publish button uploads via Admin API and assigns template to product or new page; duplicate/unpublished theme acceptable | backend/shopify/publisher | POST /api/shopify/publish; /api/shopify/publish/:id/status | PublishDialog | ShopifyPublishingJob, PublishingHistory | Verify API file writes, template assignment, final preview; no unapproved live-theme write | Pending |
| H44 | Download generated section files as ZIP for manual upload | backend/export | /api/designs/:id/download | DownloadAction | GeneratedDesign | Download, unzip and manually validate expected assets/folders | Pending |
| H45 | Dashboard URL input with live analysis/research/generation/check progress | backend/jobs; backend/events | /api/generations/:id/progress | ProductInput, RunProgress | GenerationRun | Real job events; failure/retry tests; no fictitious completion | Pending |
| H46 | Dashboard editable brand and competitor screenshots/learnings | backend/brand; backend/research | /api/products/:id/brand; /api/competitors/:runId | BrandPanel, CompetitorPanel | BrandProfile, CompetitorLearning | UI-to-API integration; edits persist and sources open | Pending |
| H47 | All designs previewable with mobile/tablet/desktop switch | backend/preview | /api/designs/:id/preview | PreviewStudio | GeneratedDesign | Switch actual 360/768/1440 viewport sizes; compare with Liquid storefront | Pending |
| H48 | Dashboard SEO/AEO/GEO and Lighthouse scores for each design | backend/quality/lighthouse | /api/designs/:id/quality | QualityPanel | QualityCheckResult | Real report attached to design; unavailable audit clearly marked | Pending |
| H49 | Approve, reject with reason, regenerate one design, publish | backend/designs | /api/designs/:id/approve; /reject; /regenerate; /api/shopify/publish | DesignActions | DesignFeedback, GeneratedDesign | Each action changes backend state; regeneration affects chosen design only | Pending |
| H50 | Past runs and published-history dashboard | backend/history | /api/history | History | GenerationRun, PublishingHistory | Reload/restart persistence; preview and publishing links | Pending |
| H51 | Lighthouse mobile performance ≥85, SEO ≥95, accessibility ≥90 | backend/quality/lighthouse | /api/designs/:id/quality | QualityPanel | QualityCheckResult | Actual mobile Lighthouse reports and screenshots; targets not assumed results | Pending |
| H52 | ATC works for all variants on mobile/desktop; schema valid; no breakpoints broken; repeat run visibly different | backend/quality/e2e | /api/designs/:id/quality | QualityPanel | QualityCheckResult, LayoutFingerprint | Real-store variant cart matrix; breakpoint captures; schema evidence; repeat-run comparison | Pending |
| H53 | At least five distinct products across at least two categories; include results | tests/acceptance; docs/results | /api/history | History, QualityPanel | GenerationRun, QualityCheckResult | Five-product matrix, category evidence, repeat-run fingerprints and screenshots | Pending |
| H54 | Test only own dev store or public pages; no real keys/passwords/tokens in repo or video | backend/security; submission | — | — | — | Source allow-policy; repository/artifact/video secret review | Pending |

## Deliverables, constraints and evaluation

| ID | HR requirement | Implementation module | Backend API | Frontend component | Database entity | Testing method | Status |
|---|---|---|---|---|---|---|---|
| D01 | GitHub/GitLab submission with proper commit history, separate backend/, frontend/, shopify/, .env.example | repository; submission | — | — | — | Inspect repository URL, meaningful commits, folders, example configuration | Pending |
| D02 | Store preview or collaborator access; reviewers can see published pages and edit in theme editor | docs/submission | /api/shopify/status | PublishDialog | ShopifyStore, PublishingHistory | Open preview and verify theme-editor access; preview access alone may not authorize editing | Pending |
| D03 | README setup, architecture, brand analysis and competitor-selection method | README | — | — | — | Clean-start walkthrough and implementation cross-check | Pending |
| D04 | README learning/layout memory, nonrepeat metric, SEO/AEO/GEO, known issues and next steps | README | — | — | — | Cross-check actual algorithms and unresolved limitations | Pending |
| D05 | README stack/AI choice and rough AI cost per run; explain workflow changes | README | — | — | GenerationRun | Document provider/model costs and estimates honestly | Pending |
| D06 | Real 5–7 minute screen recording: URL, analysis, learnings, 3–4 mobile/desktop designs, publish, theme font/colour edit, real ATC, second product with different designs | docs/demo; recording | Existing workflow APIs | Actual app and Shopify theme editor | — | Time recording; review every demonstrated operation; redact secrets | Pending |
| D07 | Five-product results include Lighthouse screenshots, schema-test results and fingerprints | docs/results | /api/designs/:id/quality | QualityPanel | QualityCheckResult, LayoutFingerprint | Evidence bundle with real reports, timestamps, tested URLs and outcomes | Pending |
| D08 | 24-hour assignment time limit | execution plan; README | — | — | — | Record actual work timing; deadline start is unspecified, do not invent it | Pending |
| D09 | Final audit against original HR document before claiming completion | docs/acceptance; this checklist | — | — | — | Re-read original; every mandatory row has evidence or explicit blocker | Pending |
| E01 | Design quality: 20/100; brand fit and genuinely different directions | generation; visual acceptance | /api/designs/:id | DesignGallery | GeneratedDesign | Human visual review plus structural comparisons | Pending |
| E02 | Shopify/theme editor: 20/100; publish, editability and working ATC | shopify; acceptance | /api/shopify/publish | Shopify editor and storefront | PublishingHistory | Actual publish/edit/cart demonstration | Pending |
| E03 | SEO/AEO/GEO: 15/100; correct schema/structure, useful FAQs, facts, honest checklist | quality; acceptance | /api/designs/:id/quality | QualityPanel | QualityCheckResult | Rendered-page checks and external validation | Pending |
| E04 | Competitors/learnings: 15/100; relevance, usefulness, influence on designs, no copying | research; generation | /api/competitors/:runId | LearningsPanel | CompetitorLearning, GeneratedDesign | Trace source → learning → generated design decision | Pending |
| E05 | Memory/no repeats: 10/100; persistence, reuse and different second run | memory; acceptance | /api/memory | UniquenessPanel | CategoryMemory, LayoutFingerprint | Restart and second-run evidence | Pending |
| E06 | Mobile/speed/ATC: 10/100; Lighthouse, sticky cart, no layout breaks | quality; storefront | /api/designs/:id/quality | QualityPanel | QualityCheckResult | Actual mobile audits and cart/breakpoint tests | Pending |
| E07 | Code/README/video: 10/100; clean backend, clear docs, honest limitations | repository; docs; recording | — | — | — | Submission checklist and runnable setup | Pending |
| X01 | Optional extra: A/B testing between two designs | optional experiments | /api/experiments | ExperimentsPanel | Experiment | Variant routing and event attribution tests | Optional, pending |
| X02 | Optional extra: generated branded product images/banners | optional media pipeline | /api/designs/:id/assets | AssetPanel | GeneratedAsset | Brand fit and product-fidelity review; distinguish generated imagery from genuine UGC | Optional, pending |
| X03 | Optional extra: one-command Docker setup | Dockerfile; compose.yaml | /api/health | App | — | Clean Docker Compose startup with required services | Optional, pending |

## HR requirements absent or insufficiently explicit in the master prompt

- The **5–7 minute actual screen recording**, including font/colour editing inside the native theme editor and a second-product demonstration. The master asks for documentation/demo preparation but does not specify this timed recording.
- **Shareable collaborator/preview access**, with actual theme-editor access for reviewers; published examples alone are not sufficient evidence of editing access.
- **Lighthouse screenshots and schema-test evidence** for the five-product results, not only scores or general validation.
- The **24-hour limit** and **100-point evaluation weights** above.
- Optional **A/B tests, AI-generated branded images/banners and one-command Docker setup**.
- The HR explicitly requests **FAQPage schema and Google's Rich Results Test**, whereas the master qualifies FAQ schema as “when eligible” and permits appropriate validation tools. Implement factual FAQPage markup but distinguish schema validity, Google's reporting, rich-result eligibility and indexing. Do not promise Google FAQ rich-result eligibility for an ordinary commerce site.

## Ambiguities, dependencies and safety gates

1. No existing project/editor URL or repository was provided in this conversation. Inspect the actual project once created/attached before assuming it is empty or overwriting code.
2. The master reports an installed custom app on `wishluck-ai-builder.myshopify.com` with read/write products/themes scopes and client-credentials auth. This is a user-provided configuration claim, not verified access. Check required environment-variable presence without printing values and validate current Shopify documentation before implementing grant and theme mutations.
3. Theme-file writes may require Shopify approval or additional permission beyond nominal scopes. Probe and report exact restrictions; do not fake publishing success. Use ZIP export as a transparent fallback, not as fulfillment of API publishing.
4. Client-credentials availability depends on the app/store relationship. Verify supported grant for the installed app before assuming the described grant works.
5. Product template assignment on an unpublished theme can also affect the product's global template suffix. Explain that consequence and require explicit confirmation before any assignment that would alter live storefront behavior. Never overwrite or publish a live theme without explicit approval.
6. Missing reviews, delivery/COD/returns data, dimensions, materials, box contents or genuine social proof cannot be invented to satisfy a layout. Show gaps to the user and generate only sourced facts. Direction names are examples, not permission to fabricate.
7. Eight search results are not eight successfully researched pages. Persist individual crawl status, robots decisions and evidence; replace inaccessible sources where possible and disclose remaining coverage gaps.
8. FAQPage validity is not a guarantee of Google FAQ rich-result eligibility; Google's tooling and external validation may impose restrictions. Record actual output, never turn an unavailable external check into “passed.”
9. Competitor discovery, LLM/vision, Shopify publishing, external Rich Results verification and full recording each need real access/tooling. Track unavailable dependencies separately from implemented code. Never label demo/fixture output live.
10. HR requires ATC in the first mobile screen, but specifies width rather than height. Use a documented mobile viewport height, state it in results, and keep purchase controls immediately reachable without hiding required information.
11. The assignment says 24 hours but provides no start time. Do not infer a submission deadline from document timestamps.
12. A narrated explainer or generated animation is not evidence of the required real screen recording. Supply a capture checklist if actual recording is blocked and explicitly leave D06 incomplete.

## Implementation order

1. Inspect workspace, establish Node/React/Postgres structure, presence-only configuration checks, Shopify connectivity and current API documentation.
2. Build real product/brand extraction, editable correction, search/crawl evidence and linked learnings.
3. Implement persistent category memory, feedback, measured fingerprints and four distinct generators.
4. Compile editable Dawn-compatible Liquid/JSON, real variant cart and ZIP; build previews and safe publishing.
5. Connect progress/history/quality dashboard; test actual pages, variants, all breakpoints and repeat generations.
6. Run five-product/two-category acceptance matrix, collect evidence, finish README and submission/recording checklist, audit original HR assignment again.

At every stage keep the app runnable. Never mark a phase complete before relevant tests pass. Mandatory HR requirements outrank optional extras; verified end-to-end behavior outranks superficial dashboard coverage.
