# Five-product showcase

A collection of five analysed products, original landing-page designs and research-backed results. Snapshot: 2026-11-11T19:18:05.893Z (UTC).

![Wishluck dashboard](dashboard-overview.jpg)

## Saved design scores

All five products completed analysis and design generation. Percentages below are the **latest saved design's local page-check coverage**, matching the dashboard's Overall/SEO/AEO/GEO circles. Each product page includes the individual scores for four captured designs.

| Product | Category | Saved designs | Research sources | Captures | Overall | SEO | AEO | GEO |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| [Large Waterproof Gold-Plated Hoop Earrings](large-waterproof-gold-plated-hoop-earrings/README.md) | Accessories | 4 | 8 | 12 | 61% | 78% | 80% | 17% |
| [Sunbeam Yellow Ceramic Treat Bowl](sunbeam-yellow-ceramic-treat-bowl/README.md) | Pet Accessories | 9 | 8 | 12 | 61% | 78% | 80% | 17% |
| [Glass Bottle Facial Cleanser](glass-bottle-facial-cleanser/README.md) | Beauty | 5 | 12 | 12 | 61% | 89% | 80% | 17% |
| [Chestnut Ceramic Mug](chestnut-ceramic-mug/README.md) | Home & Kitchen | 14 | 10 | 12 | 61% | 89% | 80% | 17% |
| [Men's Tree Runner - Jet Black (White Sole)](mens-tree-runners/README.md) | Shoes | 16 | 11 | 12 | 61% | 89% | 60% | 17% |

## Measured Shopify Lighthouse reports

These archived storefront measurements are presented separately from the five-product local design scores above.

| Product | Performance | SEO | Accessibility | Evidence |
|---|---:|---:|---:|---|
| [Large Waterproof Gold-Plated Hoop Earrings](large-waterproof-gold-plated-hoop-earrings/README.md) | 93 | 69 | 97 | [Report](large-waterproof-gold-plated-hoop-earrings/lighthouse-1.html) · [Screenshot](large-waterproof-gold-plated-hoop-earrings/lighthouse-1.jpg) |
| [Chestnut Ceramic Mug](chestnut-ceramic-mug/README.md) | 95 | 69 | 97 | [Report](chestnut-ceramic-mug/lighthouse-1.html) · [Screenshot](chestnut-ceramic-mug/lighthouse-1.jpg) |
| [Men's Tree Runner - Jet Black (White Sole)](mens-tree-runners/README.md) | 86 | 69 | 93 | [Report](mens-tree-runners/lighthouse-1.html) · [Screenshot](mens-tree-runners/lighthouse-1.jpg) |

## Showcase contents

- **60 responsive screenshots:** four design directions × five products × three viewport widths.
- Product and brand analysis, source-linked competitor research and category learnings.
- Complete saved layout fingerprints and per-design local scores.
- Structured-data JSON and local parsing/shape checks for the captured designs.
- Recorded Shopify measurements, screenshots and interactive reports.
- [Development-store access](../REVIEWER_ACCESS.md) and [test verification](verification.json).

## Reproduce the showcase

```sh
node scripts/package-submission.mjs --origin https://YOUR_RUNNING_PREVIEW
node scripts/index-submission.mjs
```

The exporter reads saved product runs and existing reports. Capture measurements and timestamps are included in the product data files.
