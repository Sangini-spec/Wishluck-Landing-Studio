# Shopify native source

Editable OS 2.0 Liquid sections and lightweight assets used by the theme compiler.

The backend compiles each chosen visual plan into a **complete theme ZIP**: layout, JSON product/home templates, native section settings/blocks, settings schema/data/preset, assets and locales. The preview and Liquid outputs interpret the same plan.

Do not ZIP this source folder alone and expect a complete theme. Use the design's **Theme ZIP** download or the authorized CLI publisher. Merchant ZIP uploads belong in **Online Store → Themes → Import theme**, not the Theme Store submission portal.

Theme/product bindings come from the destination store. ZIP downloads do not import products. Font, colour, image, copy, block and visibility settings remain native to Shopify's editor; the storefront has no React dependency.

See [root setup and workflow](../README.md), [reviewer access](../docs/REVIEWER_ACCESS.md) and [five-product evidence](../docs/results/README.md). No live-theme activation is performed by the submission packaging tools.
