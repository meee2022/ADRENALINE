# Menu presentation alignment — local only

## Implemented
- Adrenaline catalogue is visible by default, with optional inline subscriber phone entry.
- Existing phone lookup, identity selection, reset and single-result auto-selection callbacks are reused.
- Existing subscriber manual/smart routes and selection handlers are retained.
- Guest cards open details; guest details do not expose add-to-cart. Guest cart-review CTA is hidden without deleting saved picks.
- Brand-tinted cards, cyan calorie badge, three-column macro row, simpler category metadata and keyboard-accessible details buttons.
- Search/category labels, 44px touch targets, no-results recovery button, compact header and narrow-screen single-column fallback.
- Existing full-menu/day filter remains available to visitors.

## Verification
- Root TypeScript: passed after final code patch.
- Vitest: 97 passed (5 files).
- check:rules: 13 passed.
- Targeted ESLint: zero errors, two existing exhaustive-deps warnings in PublicMenu (limits/dayCompleteInWeek).
- Source review by independent reviewer: no concrete subscriber-path regression found; shared rule calls retained.
- Browser: 140 cards visible without phone gate, details dialog displays nutrition and subscription enquiry instead of add action, search no-results and clear button restore catalogue.
- Desktop and 390px mobile screenshots inspected; mobile two-column grid, document scrollWidth 375 at innerWidth 390 (no horizontal page overflow).

## Limitations / release hold
- Browser text input / interaction verification was unreliable and delayed. Do not infer that phone 30296555 is genuinely absent from data from this run. Subscriber end-to-end login/selection and English runtime interaction remain unverified.
- No real order, approval, payment or backend deployment performed.
- This is not a certification of all existing application constraints. Existing SUBSCRIBER-RELEASE-AUDIT hold still applies.
- Shared card/search presentation refinements also affect Nutri Reset; its original phone gate and subscription behavior are retained.
