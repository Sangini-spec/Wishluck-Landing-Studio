# Research and publishing workflow verification

This supplements, rather than replaces, the original HR traceability register.

| Requirement | Implementation / API | Frontend | Entity | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| Correct product/brand before research and generation | `generation-workflow.ts`; POST `/runs/:id/generate` | Run review and confirmation | Run research key and timestamp | Ordered orchestration, changed-input, forced-refresh and insufficient-evidence tests | Implemented; fresh complete live pipeline not accepted |
| Capture at least eight competitors before generating | `research.ts`, `generation-workflow.ts` | Run progress and research sources | Competitors, learnings, crawl evidence | Generation blocked with seven captures | Implemented |
| Apply actual research, not fabricated references | `research-evidence.ts`, `generation.ts` | Research applied panel | Design research influences | Source membership and two-distinct-source tests; provider-enforced output schema | Implemented; creative outcome not accepted |
| Genuinely different designs in populated categories | `generation.ts`, shared render plan | Design previews | Design fingerprint | Live attempts used real saved evidence but remained below existing novelty threshold | **Partial / blocked by repetitive AI proposals** |
| Never upload one version repeatedly by changing destination | `shopify-cli.ts`; POST `/shopify/cli/uploads` | Disabled uploaded/published button | Durable upload identity and publication | Offline changed-option retry; real requests with existing/import choices returned the same receipt and theme; job count stayed 14 | Verified |
| Avoid empty theme-only editor startup | Upload route requires product mode; existing product or draft import | Product destination dialog; no theme-only option | Product binding, publication URLs | Existing native binding path retained; new theme-only admission rejected | Implemented; no new merchant upload performed in this change |
| Remove technical job history from design page | `cli-publishing.tsx` | Simple result, editor/preview links and audit | Recovery records preserved | 57 frontend checks, including recovery with unavailable storage | Verified |
| Distinguish uploaded, edited, published and failed | `publication-status.ts`, `checkCliPublication`, dashboard role refresh | History statuses and event timestamps | Publication timeline and semantic file hashes | Pure state/hash tests; actual current store role refresh | Implemented; no merchant edit or live activation performed by agent |

## Important limits

- Only Shopify's actual main/live role is presented as published. The legacy internal upload machine status is not a trustworthy display label.
- Shopify edit/publication timestamps are detection times, not invented historical event times.
- Existing receipts without a baseline establish one on their first edit check. Earlier edits cannot be reconstructed reliably.
- Read-only file checks do not rewrite Shopify themes. Existing merchant themes, edits and active storefront were not changed.
- Two real read-only checks of an existing unpublished theme tracked 23 files. The first established the legacy baseline; the second correctly remained Uploaded with `edited: false`. No merchant edit was simulated.
- A successful schema check, structural score or render regression is not proof of perceptual design quality.
- The live creative-generation blocker must be resolved and a fresh research-to-four-design run accepted before declaring this request or the HR assignment complete.
