# Wishluck Landing Studio

An AI-assisted Shopify landing-page studio that turns product research into distinctive, editable landing pages.

**[Five-product showcase](docs/results/README.md)** · **[Development-store access](docs/REVIEWER_ACCESS.md)** · 
## Product highlights

- Analyse a product URL, extract its brand identity and review editable product facts.
- Research competitors with real search results, source captures and linked design learnings.
- Generate four original landing-page directions informed by product evidence and category memory.
- Preview designs at **360px, 768px and 1440px**.
- Track **Overall, SEO, AEO and GEO percentages** for each saved design.
- Export native Shopify Liquid sections, JSON templates and a complete theme ZIP.
- Upload a selected design to Shopify and open its native theme editor.
- Keep clear Uploaded/Published states and timestamped history.

The showcase includes **five products across five categories, 48 saved designs and 60 responsive design screenshots**, together with brand analysis, research, fingerprints, structured-data results and archived Lighthouse reports.

## Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend | Node.js 24, Express, TypeScript | Analysis, research, generation, publishing and progress APIs |
| Dashboard | React, Vite, React Query | Editable analysis, previews and publishing controls |
| Shopify pages | OS 2.0 Liquid, JSON templates, CSS and lightweight JavaScript | Native theme rendering and merchant editing |
| AI | GPT-5.4 planning; GPT-5.4-mini copy, research assistance and vision | Independent visual planning with efficient supporting calls |
| Search and crawling | Tavily, Playwright, Cheerio | Competitor discovery, screenshots and source extraction |
| Database | PostgreSQL and Drizzle | Runs, designs, learnings, feedback and upload records |
| Evidence storage | Replit App Storage | Durable source captures and audit reports |
| API contracts | OpenAPI, generated Zod and React Query clients | Shared validated contracts |

## Repository structure

```text
backend/                    -> artifacts/api-server/
frontend/                   -> artifacts/wishluck/
shopify/                       Native Liquid sections and lightweight assets
artifacts/api-server/src/       Backend services and workflow APIs
artifacts/wishluck/src/         React dashboard
lib/api-spec/openapi.yaml       API contract
lib/db/src/schema/              Persistent database schema
docs/results/                   Five-product showcase and measured results
```

`backend/` and `frontend/` are tracked directory symlinks to the canonical workspace packages. This provides separate layer entry points while keeping one source of truth. Preserve Git symlinks when cloning; the canonical folders are directly browsable under `artifacts/`.

## Setup

### Environment

- Node.js **24**, pnpm **10** and PostgreSQL.
- Chromium for source capture, rendering checks and Lighthouse. Set `CHROMIUM_PATH` to the installed executable.
- OpenAI-compatible AI access, Tavily and authorized Shopify development-store credentials.
- Provisioned **Replit App Storage**, its runtime credential sidecar and configured bucket paths for durable evidence.

```sh
git clone https://github.com/Sangini-spec/Wishluck-Landing-Studio.git
cd Wishluck-Landing-Studio
pnpm install --frozen-lockfile
cp .env.example .env
# Configure the placeholders privately.
set -a; . ./.env; set +a
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-spec run codegen
```

Start the backend and dashboard in separate terminals:

```sh
PORT=8080 pnpm --filter @workspace/api-server run dev
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/wishluck run dev
```

Open `http://localhost:5173`. Vite forwards `/api` requests to the backend; `API_PROXY_TARGET` configures the development proxy. The existing Replit workspace also provides managed API Server and Wishluck workflows.

### Configuration

All credentials belong in private environment variables. [.env.example](.env.example) provides the configuration names and defaults.

- `DATABASE_URL`: PostgreSQL.
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`: AI provider.
- `DESIGN_MODEL=gpt-5.4`; `TEXT_MODEL` and `VISION_MODEL=gpt-5.4-mini`.
- `SEARCH_PROVIDER=tavily`, `TAVILY_API_KEY`: competitor discovery.
- `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`: installed Shopify app.
- `SHOPIFY_CLI_THEME_TOKEN_<STORE_SLUG>`: store-specific Theme Access credential.
- `SHOPIFY_FLAG_STORE`: exact store binding for an optional generic CLI token.
- `SHOPIFY_STOREFRONT_PASSWORD_<STORE_SLUG>`: authorized protected-store viewing.
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR`: provisioned storage paths.

The backend reads the process environment. The shell setup above loads `.env`; Replit Secrets supplies configuration in the hosted workspace.

## Product workflow

```text
Product/store URL → product selection → product and brand analysis
→ merchant review → competitor research → category learnings
→ original copy and four visual plans → responsive previews and scores
→ native Shopify theme → verified upload → Shopify editor
→ merchant publication → refreshed history and storefront audit
```

### Brand analysis

Product extraction supports classic Shopify public JSON, structured Product data and Hydrogen source evidence. It collects titles, prices, variants, product images and source-backed facts.

Playwright captures desktop/mobile evidence and computed styles. CSS and vision observations inform palette hex values, heading/body typography, button treatment, spacing, corner radius, tone and imagery. Editable product and brand panels let the merchant refine this foundation before generation.

### Competitor research

Tavily discovers category-relevant commercial references, with Indian D2C intent included in search planning. Candidate records carry source links and selection reasons.

Captured HTML and desktop/mobile views inform section order, headlines, pricing, offers, trust, cart placement, FAQs, media and distinctive patterns. Robots-aware crawling and per-origin pacing support responsible collection. Source-linked learnings then guide original copy and visual composition.

### Category memory and design variety

PostgreSQL stores category learnings, feedback and previous layout fingerprints. Each new plan considers that history.

Plans independently compose hero layout, surfaces, media ratio/position/share, typography, content widths, spacing and section treatments. Preview and Liquid renderers interpret the same plan.

The saved structural difference score is `100 × (1 − closest similarity)`, with a **38% minimum** and bounded refinement. Fingerprints expose the underlying choices. Two consecutive four-design bowl batches demonstrate repeat generation against populated memory.

### SEO, AEO and GEO

- **SEO:** heading hierarchy, title/description, alt text, canonical, collection links and Product JSON-LD.
- **AEO:** concise source-grounded answers, visible FAQs and matching FAQPage JSON-LD.
- **GEO:** structured specifications, quotable product facts and consistent brand naming.
- **Overall/SEO/AEO/GEO percentages:** saved local page-check coverage, shown per design.
- **Lighthouse:** separate measured storefront performance, SEO and accessibility reports.

The [showcase](docs/results/README.md) displays saved percentages for all five products and links measured Lighthouse reports in their own section. Structured-data JSON and local validation results accompany each product.

### Native Shopify editing and publishing

Generated sections expose colour/font/image pickers, headings, rich text, buttons, visibility controls and repeatable blocks. Product forms use destination-store variants, prices, availability and quantity; lightweight JavaScript supports sticky mobile purchasing.

Theme files upload through **Shopify CLI + Theme Access**, with isolated store credentials and remote readback. The installed Admin app handles authorized product operations. Upload progress stays inside Wishluck until the verified theme editor opens.

The merchant reviews and edits in Shopify, then chooses the final live publication. Wishluck distinguishes **Uploaded** from **Published**, reconciles remote theme roles and refreshes history on return/focus and polling. Content identity and durable receipts support safe recovery and once-per-version uploads.

The **Theme ZIP** button downloads a complete merchant-preview theme with layout, templates, settings/preset, sections, assets and locales. Use **Online Store → Themes → Import theme** for manual import.

## Development-store access

- Store: https://wishluck-ai-builder.myshopify.com
- Theme editor: https://admin.shopify.com/store/wishluck-ai-builder/themes
- [Reviewer access and per-theme links](docs/REVIEWER_ACCESS.md)

The owner supplies protected-store and staff/collaborator access privately.

## Quality and reproducibility

**232 tests passed**, together with workspace typechecking: 98 backend, 65 frontend and 69 rendering regression tests.

```sh
pnpm run typecheck
pnpm test
```

Rendering checks cover preview/native contracts, responsive geometry, product media, contrast and purchase controls using isolated assigned-product fixtures.

The showcase records actual saved runs, per-design scores, source-linked research, measured reports and timestamped results. Per-run metadata also includes cumulative token-based AI cost estimates; the five saved estimates range from approximately **$0.10 to $0.63**, reflecting their recorded analysis and generation batches.

```sh
node scripts/package-submission.mjs --origin https://YOUR_RUNNING_PREVIEW
node scripts/index-submission.mjs
```

The evidence exporter reads existing runs and reports. `--reports-only` refreshes report exports while preserving design captures. Private credentials remain in the runtime environment, and public exports retain sanitized report links.
