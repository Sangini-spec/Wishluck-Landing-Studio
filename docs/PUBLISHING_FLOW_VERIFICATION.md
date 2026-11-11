# Shopify publishing workflow verification

The original HR assignment in `docs/source` remains authoritative. Its embedded diagram specifies generated designs → SEO/AEO/GEO + QA → dashboard pick → Shopify template. This document tracks the publishing continuation, not completion of the entire assignment.

## Intentional adapter change

The user approved investigating Shopify CLI + Theme Access after the custom app's `themeFilesUpsert` operation was denied. Theme file uploads now use this separately authorized CLI route. Product lookup/optional draft import and explicit global template/SEO assignment still use the installed Admin app. This distinction does not imply the custom app received the protected exemption.

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
| Open Shopify automatically, not a blocked async popup | Synchronous placeholder tab, navigation only after verification | Returned editor URL | Publish dialog; fallback links | Publication editor/preview URLs | Browser journey |
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
