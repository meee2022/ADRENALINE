# Restaurant catalog in the application

Route: `/public/restaurant-menu`. Extends Adrenaline's existing cyan, steel blue, Cairo typography and light surfaces. The public navigation links here; `/public/menu` remains the subscription workflow and is linked from the catalog header.

The user requested the complete restaurant menu with compact cards, inspired by https://www.leannfit.qa/west-bay-menu. The catalog uses horizontal category controls, Arabic/English search, channel filters, full dish images and recorded macros. Two columns on mobile, four on desktop; images are contained without cropping. Unknown photos and nutritional values are explicit, never synthesized. Matching-photo items appear first within each category.

Data is a **bundled snapshot**, not a live database subscription. Refresh using `node scripts/export-app-catalog.mjs` after refreshing the existing `output/restaurant-menu/source.json` collection. The exporter explicitly allowlists consumer-facing fields and excludes component/gram-priced rows. Exact normalized names merge channels. Current snapshot contains 230 dishes, 141 with matched images; prices are not present in the source snapshot and are not invented. No backend or production deployment was changed.

Image provenance: `shared/menuArtwork.json` points to the existing approved assets. For additional matches the exporter uses `output/restaurant-menu/assets/<id>.webp`, whose original sources are recorded in `output/restaurant-menu/audit.json`. No new generated food images were used for this UI.

Validation: browser checks at 1440px and 390px; 230 cards, search empty-state/reset, online filter, no mobile overflow. Mechanical design detector reports no findings. Screenshots under output/catalog-desktop.png and output/catalog-mobile.png.

Visual refinement: navy-to-steel hero with cyan title emphasis and three existing dish photographs linking to their categories. Coordinated one-shot entrance, restrained hover motion, and prefers-reduced-motion support. Mobile and desktop screenshots checked; search, reset and online filters pass with no horizontal overflow. Existing content and snapshot data unchanged.


Same-page menu tabs: all (230) and subscriptions (140), plus online/outlets. The menu query parameter persists the selected channel for copying links. Search reset and featured category selection retain that channel. PublicMenu.tsx and the subscriber ordering route are untouched. Cards use navy/cyan; 64 subscription dishes have ingredients from the public publicMeals:list response, stored in shared/menuIngredients.json. Missing ingredients are omitted. Verified TypeScript, lint, 390px overflow, channel reload and clipboard. Preview remains local; public sharing requires deployment.
