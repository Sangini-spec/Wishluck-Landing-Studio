# Submission checklist

Primary authority: the original HR assignment provided by the owner. The private source attachment is intentionally not republished in this public repository.

| Requested item | Included | Location / limitation |
|---|---|---|
| GitHub repository and real commit history | Yes | https://github.com/Sangini-spec/Wishluck-Landing-Studio — original development history, filtered only for private/internal paths |
| Separate backend, frontend, Shopify layers | Yes | `backend/`, `frontend/` directory aliases; canonical source in `artifacts/`; actual Liquid in `shopify/` |
| Environment example, no real credentials | Yes | `.env.example`; actual secrets/cookies/signed preview keys excluded |
| Dev-store preview and editor access instructions | Yes, owner access still required | [REVIEWER_ACCESS.md](REVIEWER_ACCESS.md); credentials must be shared privately |
| Setup, architecture, stack choices | Yes | Root README |
| Brand analysis and competitor selection | Yes | README plus per-product brand/research JSON |
| Category/layout memory and non-repeat method | Yes | README, exported fingerprints, repeat-batch evidence |
| SEO/AEO/GEO approach | Yes | README; local checks clearly separate from actual Lighthouse and Google testing |
| Known issues and next steps | Yes | README and results matrix; failing/unverified acceptance gates retained |
| Five test products, at least two categories | Yes | [Five-product results](results/README.md); five categories |
| Design screenshots / fingerprints | Yes | Four designs per product, 360/768/1440px; full saved fingerprints |
| Lighthouse screenshots | Partial, honestly labelled | Real archived reports for three products; two Not-run status captures. Owner declined new Shopify uploads |
| Schema test results | Local results included; external gate open | Each product's `schema-results.json`; not Google Rich Results Test certification |
| 5–7 minute recording | Excluded | Owner explicitly requested all packaging except video |

## Acceptance is not packaging

The repository and evidence package can be submitted, but missing or failed checks must not be called passes:

- Some actual native SEO audits are below the target of 95.
- Two products have no actual Shopify Lighthouse report.
- Google's Rich Results Test is not verified.
- Comprehensive all-variant native cart testing and staff-editor changes are not certified for all five products.
- Reviewer store access still needs the owner's private authorization.

No new Shopify uploads, product changes or live-theme activations were performed while preparing this existing-evidence package.
