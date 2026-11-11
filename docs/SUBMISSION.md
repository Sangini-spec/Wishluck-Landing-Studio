# Wishluck — submission gates and demonstration

**Assignment incomplete. This is an initial implementation with live-integration and acceptance gates outstanding.**

Primary reference: the original HR DOCX in `docs/source/`, including its diagram. Full baseline: `HR_REQUIREMENTS_TRACEABILITY.md`. Actual mappings and current status: `docs/IMPLEMENTATION_STATUS.md`.

## Verified in this build

- `pnpm run typecheck`: passed across shared libraries, backend, frontend and scripts.
- API and frontend workflows started successfully.
- Running dashboard screenshot reviewed at 1440px.
- API health, PostgreSQL readiness and dashboard/settings responses returned successfully.
- Existing custom app authenticated with the Shopify development store.
- Real Shopify theme, product, variant ID and image retrieval succeeded.

These checks are not a substitute for the HR acceptance suite.

## Current dependencies and blockers

- Tavily authentication is verified: one real basic search returned 20 results. Full competitor relevance/crawling and generation runs remain unverified. Brave is no longer used.
- The development-store public product request returned HTTP 429 with `Retry-After: 60`. Do not bypass rate limits or remove store password protection. Own-store Admin access works but does not supply CSS/screenshot evidence.
- Theme-file write exemption is not verified.
- No actual write, template assignment or theme publication was performed by the agent.
- A Dawn test theme is not established. Available themes include Horizon and other non-live themes; compatibility must be verified in an actual OS 2.0 theme before claiming acceptance.
- No external Rich Results Test evidence, Lighthouse report/screenshot or cart acceptance result exists yet.
- No five-product/two-category matrix, same-product repeat evidence or actual recording is complete.
- Repository hosting link, meaningful submission commit history and reviewer access need to be arranged.
- Public deployment is intentionally locked until managed auth is added.

## Five-product matrix — evidence still required

Use own development-store or genuinely public Shopify product pages. Confirm two real categories; do not relabel the same category to satisfy the count.

| Product | Category | Source/extraction | ≥8 competitors | Four designs/fingerprints | 360/768/1440 | All variants cart | Lighthouse screenshots | Google schema evidence | Publish/edit |
|---|---|---|---|---|---|---|---|---|---|
| Product 1 | To select | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Product 2 | To select | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Product 3 | To select | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Product 4 | To select | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Product 5 | Second category | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run |

Repeat product 1 without deleting memory. Save both runs, nearest-match scores, fingerprints and screenshots that show actual compositional differences. Also demonstrate a second product in the same category reuses learnings but not its last layout.

Store generated evidence outside Git in App Storage or an ignored `generated-artifacts/` directory. Put a lightweight manifest of tested URLs, timestamps, score outcomes and evidence links in the submission. Never put keys, access tokens or passwords in that manifest.

## Actual 5–7 minute recording plan

This is a capture plan, **not a recording**.

| Time | Required actual on-screen evidence |
|---|---|
| 0:00–0:40 | Paste a real product URL; show real live progress. |
| 0:40–1:20 | Product facts, computed palette/fonts and screenshot evidence; correct one value. |
| 1:20–2:00 | Eight successfully researched competitors, selection reasons, desktop/mobile screenshots and linked learnings. |
| 2:00–3:00 | Three–four genuinely distinct designs on mobile and desktop; scores and fingerprint checks. |
| 3:00–4:00 | Approve one; select a non-live theme, confirm assignment impact, publish and open Shopify preview. |
| 4:00–5:00 | Native theme editor: change font and colour; demonstrate image/text/block editing as time permits. |
| 5:00–5:40 | Select real variants/quantity and add to Shopify cart; show confirmation and sticky mobile CTA. |
| 5:40–6:40 | Run a second product and compare to persisted category history; show different compositions. |
| 6:40–7:00 | Evidence summary and honest known limitations. |

Prepare completed research for the second product before recording if necessary, but never edit the video to imply a pending API operation completed when it did not. Keep actual results and run timestamps visible. Hide the Secrets pane, tokens, store passwords and private credential fields.

## Submission package

- [ ] GitHub or GitLab URL and proper commit history.
- [ ] `backend/`, `frontend/`, `shopify/` entry points and `.env.example`.
- [ ] Reproducible setup from a clean clone.
- [ ] Store preview and reviewer collaborator/theme-editor access.
- [ ] README covering every HR documentation topic, model cost assumptions and limitations.
- [ ] Five-product/two-category evidence, Lighthouse screenshots, Google validation and fingerprints.
- [ ] Genuine 5–7 minute screen recording, secret-reviewed.
- [ ] Final requirement-by-requirement re-audit of the original DOCX, not just the master prompt.

HR time limit is 24 hours; the assignment start/deadline was not supplied, so none is invented.

## Evaluation weights

Design 20; Shopify/editor 20; SEO/AEO/GEO 15; competitor learning 15; memory/no repeats 10; mobile/speed/cart 10; code/README/video 10. Total 100.

Extras only after mandatory acceptance: A/B experiments, brand-style generated imagery, one-command Docker setup.
