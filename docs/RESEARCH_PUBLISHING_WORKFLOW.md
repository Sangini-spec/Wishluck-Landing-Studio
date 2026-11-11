# Research and publishing workflow verification

This supplements, rather than replaces, the original HR traceability register.

| Requirement | Implementation / API | Frontend | Entity | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| Correct product/brand before research and generation | `generation-workflow.ts`; POST `/runs/:id/generate` | Run review and confirmation | Run research key and timestamp | Ordered orchestration, changed-input, forced-refresh and insufficient-evidence tests | Implemented; fresh complete live pipeline not accepted |
| Capture at least eight competitors before generating | `research.ts`, `generation-workflow.ts` | Run progress and research sources | Competitors, learnings, crawl evidence | Generation blocked with seven captures | Implemented |
| Apply actual research, not fabricated references | `research-evidence.ts`, `creative-generation.ts`, `generation.ts` | Research applied panel | Design research influences | Source membership and two-distinct-source tests; provider-enforced output schema; five live drafts retained source-linked decisions | Implemented; source validation verified, visual acceptance pending |
| Genuinely different designs in populated categories | Independent `composition-plan.ts`, `creative-generation.ts`, `composition-fingerprint.ts`; shared preview/native interpretation | Design previews | Design fingerprint schema 3 and composition | Five drafts accepted against the existing category; additional full-batch attempts still stopped on repetitive proposals | **Partial: expanded engine works, reliable repeated four-design batches remain blocked** |
| Retain native editing while expanding layout freedom | `render-plan.ts`, `render-html.ts`, `compiler.ts`, native Liquid sections and composition stylesheet | Preview and theme ZIP | Independent hero/section decisions inside design content | Five hero modes and six content modes, preview/native class and schema agreement, assigned-product runtime media, 360/768/1440 geometry; long-copy stack first-screen imagery | Verified locally; no new Shopify upload performed |
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
- The expanded engine no longer chooses finished page families: it independently composes hero geometry, image presentation and each section's layout, surface, heading position, width and spacing. Legacy designs remain supported.
- Verification after the expansion: 71 backend tests, 62 legacy render regressions and seven new composed-render checks passed; API typecheck passed and the application screenshots were inspected.
- Live evidence used the existing mug category and its eight successful captured sources. Four new drafts were obtained after repairing the first batch's fourth concept. Later repeat tests produced one more accepted draft but still could not reliably finish another batch of four, even with explicit closest-layout feedback. No novelty threshold was relaxed and no preset fallback was substituted.
- The mug source has pre-existing unverified variant IDs and missing product facts. These remain disclosed; the local design exercise is not proof of a working real Shopify cart for that source.
- The live creative-generation blocker must be resolved and a fresh research-to-four-design run accepted before declaring this request or the HR assignment complete.
