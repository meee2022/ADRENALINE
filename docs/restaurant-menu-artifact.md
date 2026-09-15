# Restaurant menu artifact

## Scope and direction contract

This is a standalone, branded HTML/PDF catalog extending the established Adrenaline identity, not a redesign or a production application change. It follows `PRODUCT.md` by making a large menu easy to scan and filter. `DESIGN.md` and `.impeccable/design.json` remain unchanged.

The direction is a readable, categorized food catalog: Arabic-first RTL layout, English dish names where available, honest photo availability, and clear ordering-channel labels. Brand cyan `#3CC4F0`, steel blue `#47759C`, ink text, white cards, and a slate canvas preserve the existing identity. Tahoma with Arial/sans-serif fallbacks and flat, bordered 16px-radius screen cards are artifact-specific departures from the global Cairo typography and elevated premium-card pattern; they do not establish new application defaults.

The HTML supports Arabic/English name search, category selection, channel filtering, result counts, and an empty state. Its grid uses three columns on desktop and two at mobile widths, falling back to one at 360px and below. The A4 PDF uses two columns and up to six dishes per page, retaining category boundaries; the current export is 43 pages.

## Content and asset provenance

The current catalog contains 230 dishes: 141 with matched new photos and 89 without photos. Missing images receive an explicit placeholder, not a substituted dish image. Nutrition is shown only when recorded; unavailable values are labeled rather than invented.

The builder excludes inactive rows, gram-priced items, weight variations identified by a numeric gram suffix, and component categories (`SAUCE`, `SPRINKLES`, `SALSA`, `CARBS`, `SIDES`, `PROTEIN`), plus the explicit sundried-tomato and balsamic-dressing exclusions. Deduplication uses exact equality after lowercase/alphanumeric name normalization, not fuzzy matching; ordering channels are combined for matching records. The catalog is not a cafe menu.

Inputs are the existing `output/restaurant-menu/source.json` snapshot, `shared/menuArtwork.json`, the approved local new-design-samples/wide image directory, and `client/public/adrenaline-logo-full.png`. Artwork mappings take priority; fallback filenames must uniquely match the normalized English dish name, and explicit empty mappings suppress that fallback. The source snapshot and production data are not modified by the build.

`output/restaurant-menu/audit.json` records the included count, photographed count, excluded source IDs, missing-photo dishes and source IDs, and each generated image's source path. Consult this file when checking coverage or replacing assets. Images are resized without enlargement and exported as WebP; the copied logo and images travel with the HTML in its `assets` directory.

## Rebuild and outputs

From the repository root:

```sh
node scripts/build-restaurant-menu.mjs
```

This CLI reads its source inputs without changing them and writes only generated artifact outputs. It does not query or mutate production data, deploy the site, or change application routes. The script currently resolves `sharp` and Playwright from the machine-specific Codex runtime at `C:/Users/M/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`, requires Microsoft Edge for rendering, and references a machine-specific image directory. A compatible Node runtime and those dependencies, source snapshot, and image assets must be available; this is not yet a portable npm build command.

Outputs include `output/restaurant-menu/index.html`, its `assets` directory, `audit.json`, desktop/mobile QA screenshots, and `output/pdf/adrenaline-menu.pdf`. Preserve the relative `output/restaurant-menu` and `output/pdf` layout so the HTML's PDF download link continues to work. The script checks mobile overflow, broken images, empty search results, and channel filtering; review rendered pages after content changes because counts and pagination can change.
