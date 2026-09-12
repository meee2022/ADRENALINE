# About profile — local review, 2026-09-12

- Route: `/public/about`, preview at http://127.0.0.1:5001/public/about.
- User requested a calm, polished restaurant profile retaining website identity.
- Retained original logo, Cairo, cyan/navy palette, story, vision/mission, nutrition and preparation features, three existing meal photos, real school-event photo, catering services, three locations, delivery platforms, commercial registration, contact and print action.
- Consolidated repeated philosophy/value/why sections; replaced embedded menu and plan catalogues with links to their existing routes. Removed prominent statistics, long numbered contents, decorative gradients and repeated testimonial blocks from this profile.
- Scoped changes: `client/src/pages/public/AboutPage.tsx` and `about.css`. No subscription, payment, meal-selection or backend changes.
- ESLint for the page and project TypeScript check passed. Browser inspected Arabic at desktop and 390px, English desktop, all six images loaded, no horizontal page overflow. WhatsApp destinations inspected without sending. Print dialog/native printing not exercised.
- Not published. Expo `/information/about` is unchanged; linking it to the official website is deferred until user approves this profile and publication.
