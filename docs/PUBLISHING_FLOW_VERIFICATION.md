# Shopify publishing workflow verification

The original HR assignment supplied privately by the owner remains authoritative; its attachment is not republished. Its embedded diagram specifies generated designs → SEO/AEO/GEO + QA → dashboard pick → Shopify template. This document tracks the publishing continuation, not completion of the entire assignment.

## Intentional adapter change

The user approved investigating Shopify CLI + Theme Access after the custom app's `themeFilesUpsert` operation was denied. Theme file uploads now use this separately authorized CLI route. Product lookup/optional draft import and explicit global template/SEO assignment still use the installed Admin app. This distinction does not imply the custom app received the protected exemption.

## Offline progress-screen regressions

Run `pnpm --filter @workspace/wishluck test` for the focused suite. It also runs
as part of root `pnpm test`; root `pnpm run typecheck` checks its TypeScript.
The suite mounts the real `CliPublishing` component, Radix dialog and generated
React Query hooks in Happy DOM, replacing HTTP with explicit in-memory
jobs/receipt/context responses. Unexpected requests fail the test, external asset
loading is disabled, and navigation is captured instead of followed. No API
server, database, credentials, Shopify themes or real Shopify writes are used.

Coverage includes:

- A queued job restored from tab storage, real polling, phase changes and
  navigation only after a verified matching receipt; intent is cleared **before**
  navigation.
- One confirmed upload POST, then reload recovery with no second upload POST.
- Temporary jobs or receipt polling failures, a visible reconnection message,
  preserved intent and successful recovery without another upload.
- “Stay in Wishluck” cancelling automatic navigation, with completed receipts
  still visible after polling and reload.
- Back restoration with both a retained component and a document remount:
  recheck the receipt once, consume the return marker, and never redirect again.
- Unrelated stores/designs/jobs/receipts never triggering automatic navigation;
  a store switch explaining how to find the original upload.
- Failed/attention jobs stopping progress with useful messages and saved
  history retained; malformed or mismatched saved intent is ignored safely.

These are repeatable component integration tests, not a real browser history,
layout, Shopify editor, or live-store verification. The Back tests reproduce the
two restoration states (same component plus focus, or remount plus surviving
session storage); they do not claim to exercise a browser's back/forward cache.
Test bundles are written only to ignored `generated-artifacts/publishing-ui/`.

## Requirement traceability

| Requirement | Implementation | Backend API | Frontend | Persisted entity | Verification |
|---|---|---|---|---|---|
| Select/approve then publish | CLI publisher, feedback routes | feedback; CLI uploads | Design header; CLI dialog | Design, Feedback | Existing approved design selected for the browser journey |
| Correct selected store and credentials | store lock; isolated CLI environment | CLI status/uploads | Connected domain; destination dialog | Store preference; no tokens in DB | Real CLI authentication and store-bound checks |
| Validate files before writing | standalone compiler; CLI strict check | CLI uploads | Upload progress/error | Publication | Package tests plus real Shopify CLI checks |
| Actual new unpublished upload | CLI push with unpublished/new-name and no-delete | CLI uploads | Publish & open Shopify | Publication theme ID, role, URLs | Real upload and independent readback; never a mock |
| Correct product/native variant IDs | publication-product mapping | CLI uploads; publishing context | Store-product or explicit draft selection | Publication product ID | Fixture unit tests and real selected-store product |
| Assign template to product when authorized | Admin productUpdate, separate consent and readback | CLI uploads | Global assignment checkbox | Publication suffix/previous suffix/assignment flag | Runtime request checks and selected dev-product browser test |
| Persist success and positive memory | saveDesign; published feedback | CLI uploads | Published status; History | Design, Publication, Feedback | Reload and database evidence |
| Open Shopify automatically without an empty waiting tab | In-app phase/spinner; same-tab navigation only after verified receipt; saved pending intent survives reload | Jobs and publication status | Publish progress dialog; history links | Publication editor/preview URLs; tab-local pending intent | Browser journey and redirect-correlation unit checks |
| Edit fonts/colors/images/text/blocks | Native generated schema settings/blocks | Shopify native editor | Open theme editor | Shopify theme | Requires authorized Shopify editor access; never infer from schemas alone |
| Merchant chooses final live Publish | Native Shopify action; app activation remains disabled | Read-only CLI role checks | Shopify editor; app status refresh | Publication live/remote status | Do not activate the store during automated tests |
| Real responsive variant/cart behavior | Native Liquid/product runtime and cart JS | Shopify cart | Shopify preview at 360/768/1440 | Shopify cart only | Requires authorized storefront access; no purchase is allowed |
| Lighthouse after publication/return | Reserved background queue; product-form/access preflight; real CLI | quality; CLI publication check | Live audit status, actual score/report link | Design.lighthouse/checks; report in App Storage | No scoring password, setup or login pages |
| History and failed-record cleanup | Existing scoped deletion service | DELETE publications/:id | History | Publication only | Four failed records deleted; original successful upload retained |

## Evidence and limitations

- The earlier CLI probe created a genuine unpublished theme and verified all 23 generated files by readback.
- All 31 backend unit checks passed after integrating product mapping, explicit consent and automatic audit orchestration; web/shared type checks passed.
- A real browser journey submitted once through the main Publish button. Shopify created unpublished theme `167127318626`; publication `f8e5823a-650a-4310-8666-f05cdfc5e9a9` was persisted with verified files and verified template assignment to the seed development-store Inventory Not Tracked Snowboard product.
- The synchronous placeholder tab automatically navigated to official Shopify login after verified upload. Reload preserved the success; History showed the new upload and original verified upload, with the four old failures absent. A misleading History "PUBLISHED" label was corrected to distinguish uploaded from live.
- The native editor stopped at official Shopify login/hCaptcha. No credentials were entered or protection bypassed. Font/color/block edits, native responsive/variant/cart acceptance remain blocked pending merchant sign-in.
- The public storefront independently returned HTTP 200 at `/password`, with a password form and no product schema/cart form. Automatic Lighthouse rejected that page and saved an honest access error; no target scores or report were fabricated. Backend Lighthouse also requires authorized storefront access, separate from Theme Access upload credentials.
- Existing live theme `167122272354` remained live, and application-controlled live activation stayed disabled. Neither native Shopify Publish nor the CLI live-publish command was run.
- Do not claim a completed native editor/cart/Lighthouse test without authorized storefront/editor access and actual results.
- Five products across two categories, Google Rich Results evidence, repeated-product generation evidence and the submission recording are separate original-assignment gates; this publishing check alone does not satisfy them.

## Authorized storefront continuation — 2026-11-11

The merchant supplied the store-specific storefront-viewing password through Secrets. Authorized requests now reach the actual product route with its native cart form and Product schema, without disabling protection or using Theme Access/staff credentials as a storefront password.

- Real mobile Lighthouse: **Performance 96, SEO 100, Accessibility 96**. All exceeded the assignment targets.
- Persisted report: `/api/evidence/be35db1d-67b6-421b-afd8-97a99d6da4af`.
- Native markup: one H1, no Liquid error, Product and FAQPage JSON-LD parsed without errors.
- The selected seed product has one available variant. Shopify accepted its real variant ID through `/cart/add.js` with HTTP 200. The isolated test cart was subsequently cleared and verified empty.
- Sanitized HTTP evidence: `generated-artifacts/storefront-verification/167127318626.json`. The verification script is opt-in, uses its own ephemeral session, and never purchases or changes products/themes.
- All 34 backend unit checks passed, including per-store credential isolation and cross-origin cookie protections. Native Chrome cookies are origin scoped; global Cookie extra headers are not used.
- Staff/editor authentication remains separate. Font/color/image/block editing and interactive cart/responsive acceptance in the native editor have not been verified. No live theme activation or Google Rich Results validation is claimed.

## Single-tab handoff and hide controls — 2026-11-11

A real browser pass verified the refined product flow:

- Only the main **Publish to Shopify** trigger remains. The ZIP description and redundant publishing panel are absent; the optional ZIP download is retained.
- One real unpublished upload showed the in-app spinner and actual preparation/verification phases, then navigated the same tab to the official Shopify editor/sign-in chain. No blank or additional tab was opened.
- Verified publication `4ffd31bf-f86e-4440-956b-29c2631260ca` created theme `167128760418`. The existing seed product was selected, with no import, global template/SEO assignment or live activation.
- Returning to Wishluck did not redirect back to Shopify again.
- Hiding a publication survived reload; **Show hidden records** restored it. Collapsing the entire history also survived reload, and **Show history** restored it. No records were deleted.
- Frontend type checks and four focused regression tests passed, including verified-receipt correlation and store/design isolation.

The browser remained at Shopify's staff login/hCaptcha, without attempting authentication. This verifies the application handoff, not native editor controls after sign-in. Local visibility preferences apply to the current browser; server-side receipts and recovery state are unchanged.
