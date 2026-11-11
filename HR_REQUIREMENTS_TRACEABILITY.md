# HR requirement traceability

The original HR assignment supplied privately by the owner is authoritative. It was reread for this package. This matrix replaces the earlier proposed/pending baseline with actual modules and honest verification states. `backend/` and `frontend/` are directory aliases to the canonical `artifacts/` packages.

**Status meanings:** **Evidence** = implementation plus recorded tests/results; **Partial** = implemented but some requested external acceptance remains open; **Open** = not certified; **Excluded** = owner explicitly excluded the video. None of these labels awards evaluation marks.

## Functional and technical requirements

| ID | HR requirement | Implementation module | Backend API | Frontend component | Database entity | Testing method | Status |
|---|---|---|---|---|---|---|---|
| H01 | Node backend, React dashboard; explain stack/workflow choices | backend/Express; frontend/React; README | GET /api/dashboard | Dashboard | — | Typechecks, runtime and README | Evidence |
| H02 | Liquid/CSS/minimal-JS OS 2.0 sections/JSON; free-theme compatibility | compiler.ts, theme-package.ts; shopify/ | GET /api/designs/:id/download | Design preview / ZIP | designsTable | Package/native regression checks; actual Shopify uploads | Partial: complete Dawn/editor acceptance open |
| H03 | LLM and vision; justify models and rough cost | ai.ts, creative-generation.ts | POST /api/runs; generate | Run progress / AI estimate | runsTable.aiCost | Actual calls; per-product estimates | Evidence |
| H04 | Browser crawling, robots and rate limits | crawler/network services | POST /api/runs; research | Run progress | artifactsTable | Network/robots tests and real captures | Evidence |
| H05 | Actual search API | search.ts; research.ts | POST /api/runs/:id/research | Research | runsTable.competitors | Real Tavily results and source URLs | Evidence |
| H06 | Durable learnings, designs and run history | store.ts; DB schema | GET /api/runs; memory | History / Memory | runs/designs/learnings tables | Persistence and saved five-product records | Evidence |
| H07 | Development store and preview/collaborator access | Shopify adapters; reviewer guide | GET /api/shopify/status | Connected store / editor links | publicationsTable | Real authentication and preview links | Partial: owner must grant reviewer login |
| H08 | Environment-only keys; no committed passwords/tokens | config/auth; .env.example | GET /api/settings (readiness only) | Sidebar readiness | No credential storage | Export/history secret scan | Evidence; never publish actual credentials |
| H09 | Public/dev Shopify product URLs | product-discovery.ts; analysis.ts | POST /api/products/discover; /api/runs | Create / product selection | runsTable | Five saved URLs and parser tests | Evidence |
| H10 | Title, price/compare-at, variants and real IDs | product-source.ts; analysis.ts | GET /api/runs/:id; PATCH /api/runs/:id/product | Product panel | runsTable.data.product | Classic/headless/currency/source-ID tests | Evidence; not all-variant cart certification |
| H11 | Images, description, specs and genuine reviews/rating | analysis.ts; facts.ts | GET /api/runs/:id | Product panel | runsTable.data.product | Source comparison and factual guards | Partial: widget-only reviews limited |
| H12 | Five palette colours/hex, CSS plus screenshot | analysis.ts; crawler/vision | GET /api/runs/:id; PATCH /api/runs/:id/brand | Brand panel | runsTable.data.brand; artifactsTable | Brand JSON and captured evidence | Evidence |
| H13 | Computed fonts, sizes/weights; Shopify mapping | analysis/font mapping | GET /api/runs/:id; PATCH /api/runs/:id/brand | Brand panel | runsTable.data.brand | Computed styles; picker identifiers | Partial: conservative font mapping |
| H14 | Tone, images/buttons, radius and spacing | analysis.ts | GET /api/runs/:id; PATCH /api/runs/:id/brand | Brand panel | runsTable.data.brand | Source/vision and editable saved values | Evidence |
| H15 | Correct all product/brand data before generation | wishluck routes; review workflow | PATCH /api/runs/:id/product; brand | Run product/brand editors | runsTable | Validation and workflow tests | Evidence |
| H16 | At least 8 relevant pages, prefer Indian D2C; selection reasons | search/research services | POST /api/runs/:id/research | Research disclosures | runsTable.competitors | All five exports have >=8 crawled competitors | Evidence; relevance remains human-reviewable |
| H17 | Competitor desktop/mobile screenshots and HTML | crawler; assets | GET /api/evidence/:id | Research screenshots / capture links | artifactsTable + App Storage | Real capture records | Evidence; not every capture copied into Git |
| H18 | Section/headline/offer/pricing/trust analysis | research analysis | GET /api/runs/:id | Conversion breakdown | runsTable.competitors.analysis | Per-product research JSON | Evidence |
| H19 | ATC, FAQs, images/video, urgency, unusual patterns | research analysis | GET /api/runs/:id | Research details | runsTable.competitors.analysis | Captured-source observations | Evidence |
| H20 | Aggregate learnings with linked sources and actual denominators | research/learnings | GET /api/runs/:id | Sourced learnings | learningsTable | Citation/coverage checks and exports | Evidence |
| H21 | Do not copy competitor copy/assets/code | campaign-brief, creative-generation, copy guards | POST /api/runs/:id/generate | Design previews | designsTable; source influences | Grounding checks, distinct task contexts | Evidence of safeguards; not plagiarism certification |
| H22 | Reuse learnings by category | categoryContext; generation | GET /api/memory | Memory disclosures | learnings/designs/feedback tables | Category context tests and repeat batch | Evidence |
| H23 | Save actual layout fingerprints | fingerprints.ts | GET /api/runs/:id | Design gallery / difference | designsTable | Full fingerprints exported for all saved designs | Evidence |
| H24 | Fresh category designs; explain/display metric | native composition similarity; generation | POST generate/regenerate | Design gallery | designsTable.fingerprint | Two four-design bowl batches, threshold retained | Evidence; structural metric is not perceptual proof |
| H25 | Positive publication/approval and negative rejection/reason; reuse | feedback routes; generation | POST /api/designs/:id/feedback | Approve/reject/reason | feedbackTable | Feedback and generation-context tests | Evidence |
| H26 | At least 3, ideally 4 genuinely different landing pages | creative-generation.ts; composer | POST /api/runs/:id/generate | Designs tab | designsTable | Four designs/product, three widths, repeat evidence | Evidence; visual quality subject to review |
| H27 | Suggested directions, branded factual product copy | copywriter and independent native plans | POST generate | Design preview | design snapshots | Copy guards, brand checks, source influences | Evidence; directions not hardcoded templates |
| H28 | Real variant/price/quantity and Shopify cart POST | shopify/sections; minimal cart JS | Shopify /cart/add.js | Native storefront | Shopify product/cart | Existing cart proof; native unit regressions | Partial: all five/all variants not certified |
| H29 | First-screen and sticky mobile ATC | native sections/assets | Shopify cart | Native product + sticky controls | — | Isolated render/geometry checks | Partial: comprehensive native acceptance open |
| H30 | Genuine trust near CTA; no invented reviews/policies | facts.ts; native renderer | GET run / preview | Product correction / native CTA | Product snapshots | Factual omission/rating guards | Evidence; unknown facts omitted |
| H31 | 360/768/1440 responsive, no breaks | shared preview/native CSS | GET /api/designs/:id/preview | Viewport controls | — | 60 screenshots; overflow/image checks; regressions | Evidence locally; not exhaustive live certification |
| H32 | Lazy below-fold images, correct sizing, little JS, fast loading | compiler/native assets | POST /api/designs/:id/quality | Lighthouse panel | design.lighthouse; artifactsTable | Actual reports and isolated image tests | Partial: only three products audited |
| H33 | H1/headings/meta/alt | quality.ts; compiler | Preview / quality | Scores | design.checks | Local checks and archived Lighthouse | Partial: some native SEO scores below target |
| H34 | Canonical, readable handle and collection links | compiler/theme package; Shopify product adapter | Publishing / preview | Preview / publishing dialog | publication product/template mapping | Local checks, native reports | Partial: external preview crawlability matters |
| H35 | Product JSON-LD, real offers/availability/rating | compiler/native product sections | Preview / ZIP | Scores / preview | Product snapshots | Extracted JSON-LD results and native fixtures | Partial: Google validation unverified |
| H36 | Direct standalone factual FAQs on relevant questions | copywriter; FAQ blocks | Generate / preview | FAQ preview | Design content snapshots | FAQ-depth and factual tests | Evidence; missing policies not fabricated |
| H37 | FAQPage schema valid in Google Rich Results Test | compiler/FAQ sections | Preview / quality | Scores | design.checks | Local parse/shape results | Open external Google test |
| H38 | Quotable facts/specs/materials/dimensions/audience/box/brand | campaign brief, facts, spec blocks | Product correction / preview | Product/spec panels | Product/design snapshots | Grounding and fact-depth checks | Partial: source facts sparse for some products |
| H39 | Dashboard checklist score and pass/fix detail | quality.ts; evidence panels | GET /api/runs/:id | Percentage circles; evidence | design.checks/scores | Coverage tests; report distinctions | Evidence; detailed checks retained in exported JSON |
| H40 | Liquid sections plus JSON page/product template | compiler.ts; shopify/ | GET /api/designs/:id/download | Theme ZIP | designsTable | Archive/package/native tests | Evidence |
| H41 | Native colour/font/image/text/richtext/button/toggle settings | native section schemas | ZIP / CLI upload | Shopify theme editor | Shopify theme files | Schema validation and native readback | Partial: staff-authorized full editor acceptance open |
| H42 | Repeating benefits/FAQs/reviews editable as blocks | native block schemas | ZIP / CLI upload | Native editor blocks | Shopify theme files | Block/compiler regressions | Partial: full interactive reorder acceptance open |
| H43 | Publish upload and product/page assignment | shopify-cli.ts; publication-product.ts | POST /api/shopify/cli/uploads | Publish dialog | publicationsTable; jobs | Real upload/readback/assignment receipts | Adapted: CLI files + Admin product ops, not denied Asset API |
| H44 | Manual ZIP download | theme-package.ts; compiler | GET /api/designs/:id/download | Theme ZIP | Generated design | Archive and configuration validation | Evidence; merchant upload, not Theme Store certification |
| H45 | URL input and live stage progress | jobs; progress endpoint | POST /api/runs; GET /api/runs/:id/progress | Create / Run progress | runsTable.events | UI/queue tests and actual runs | Evidence |
| H46 | Editable brand plus competitor screenshots/learnings | analysis/research routes | Run/brand/research APIs | Brand + Research | runsTable; artifacts/learnings | Saved outputs and UI | Evidence; full details collapse by default |
| H47 | All designs mobile/tablet/desktop | preview renderer | GET preview | Design viewport switch | designsTable | Four designs each, all three widths | Evidence locally |
| H48 | SEO/AEO/GEO and Lighthouse per design | quality/audit services | GET run; POST quality | Scores / Lighthouse | checks + lighthouse | Coverage tests and real archived audits | Partial: not every design has a real audit |
| H49 | Approve, reject/reason, regenerate one, publish | feedback/generation/CLI services | Feedback; regenerate; CLI uploads | Design actions | feedback/designs/publications | UI and service regressions | Evidence |
| H50 | Past runs and accurate publication history | store; publication-status | GET /api/runs; dashboard | Dashboard / History | runs/publications | Role reconciliation/dedup/deletion tests | Evidence; Published means currently live |
| H51 | Mobile Lighthouse >=85 performance, >=95 SEO, >=90 accessibility | storefront-lighthouse.ts | POST quality | Lighthouse | design.lighthouse | Actual report-specific scores | Partial: some SEO 69; two products unaudited |
| H52 | All-variant native cart, valid Google schema, intact widths, different repeat | Native QA; fingerprints | Quality / Shopify cart | Preview/editor | Checks/fingerprints | Isolated tests + available native evidence | Partial: external/all-variant gates remain |
| H53 | >=5 products, >=2 categories; results | package-submission.mjs | Read-only saved runs/evidence | Product previews | Five saved runs | Five categories, 60 captures, JSON manifests | Evidence; incomplete external checks explicitly shown |
| H54 | Own/public source pages only; no real credentials in public outputs | public network guards; export scrub | Read-only public analysis | — | No credential persistence | URL provenance, history/current-file scans | Evidence |

## Deliverables and evaluation

| ID | Requirement | Module / API / frontend / database | Verification | Status |
|---|---|---|---|---|
| D01 | GitHub history, backend/frontend/shopify, env example | Repository, aliases, .env.example; no API/DB | Actual development history and public package | Included |
| D02 | Development preview/editor access | docs/REVIEWER_ACCESS.md; Shopify links; publicationsTable | Unsigned links; owner supplies private access | Partial |
| D03 | README setup, architecture, brand and competitor method | README; actual service implementations | Cross-check code and setup commands | Included |
| D04 | Memory/nonrepeat/SEO/AEO/GEO/issues/next steps | README; exported results | Algorithms and limits documented | Included |
| D05 | Models, approximate cost, workflow changes | ai.ts; README/results | Actual cumulative run estimates, not billing guarantees | Included |
| D06 | 5–7 minute recording of full journey | No recording produced; no API/DB | Owner explicitly excluded video | Excluded |
| D07 | Five-product Lighthouse screenshots, schemas, fingerprints | docs/results; package exporter | Actual reports for three, Not-run captures for two; local schema results | Partial, not fabricated |
| D08 | 24-hour deadline | Owner's assignment timing; no API/DB | Start/deadline not independently established | Not attested |
| D09 | Final audit against original document | This matrix + SUBMISSION + original read | Every mandatory item mapped with remaining gates | Included, not a completion certificate |
| E01 | Design quality 20/100 | Native plans, saved previews/fingerprints | Human visual evaluation required | Not self-awarded |
| E02 | Shopify/editor/ATC 20/100 | CLI/Admin/native sections | Uploaded receipts; comprehensive editor/cart acceptance open | Not self-awarded |
| E03 | SEO/AEO/GEO 15/100 | Local checks + native reports | Actual failures/unverified external results retained | Not self-awarded |
| E04 | Research/learnings 15/100 | Research and source influences | Eight-plus actual captures/product, linked observations | Not self-awarded |
| E05 | Memory/nonrepeat 10/100 | Category context/fingerprints/feedback | Persistence and repeated bowl generation | Not self-awarded |
| E06 | Mobile/speed/ATC 10/100 | Native assets + audits | Local width evidence; incomplete native acceptance | Not self-awarded |
| E07 | Code/README/video 10/100 | Source/history/docs | Docs supplied; video excluded by owner | Not self-awarded |

Optional A/B routing, generated campaign imagery and Docker are not implemented or claimed. They are extra credit, not substitutes for mandatory evidence.

## Clarifications and constraints

- Review is followed automatically by research, then generation. Manual re-research remains possible but research is not postponed until after designs.
- Native theme uploads use separately authorized Theme Access because protected `themeFilesUpsert` access is denied. The README documents this deviation; the denied API is not labelled successful.
- A theme upload is not live publication or proof of native cart/editor behavior. Store passwords remain enabled; staff access must be granted privately.
- Source data cannot support invented delivery/COD/returns/reviews/material claims. Missing factual coverage remains visible in checks.
- Structural novelty and local checklist percentages are heuristics, not perceptual uniqueness, rankings, Google rich-result eligibility or AI-answer-inclusion guarantees.
- The owner chose existing evidence only for packaging, so missing storefront audits remain explicit instead of creating additional themes or products.
