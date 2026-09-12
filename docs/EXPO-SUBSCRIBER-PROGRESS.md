# Subscriber integration progress

## Scope of this pass

Extended the existing Expo subscriber journey, preserving Cairo, the current navy/cyan
tokens, and the existing `MealCard` artwork. No visual-system replacement or backend
changes were made.

- `SubscriberPhoneGate` uses the existing bounded `customers.findPublicByPhone` query,
  including no-match, multiple-match, invalid-number and connection-error states.
  This is the existing public phone lookup, not a new authenticated login mechanism.
- `SubscriberMealPlanner` provides native manual meal selection: subscription days in
  sequence, cooking-week availability, main-meal/snack counts, and explicit confirmations
  for restrictions/allergies, duplicate meals and a second breakfast.
- `subscriberSelection.ts` orchestrates the existing shared rules; eligibility and
  cooking-week policy were not redefined.
- Review supports removing individual copies and flags stale days or unavailable meals.
  Submission is wired to the existing `customerOrders.create` mutation for nutritionist
  review, not direct daily-plan or kitchen writes. Unknown submission failures retain the
  same in-memory payload and idempotency key for retry; known validation failures permit
  correction. This submission path has not been exercised against live customer data.
- Draft selections exist only in component memory. Exit warns about discarding a draft;
  closing/reloading the app does not preserve it durably.

The existing account extension remains: a read-only saved-plan date navigator using
`dailyPlans.getByDateAndCustomer`, plus skipped dates, loyalty points/credit and referral
code from `customerAuth.getProfile`.

## Verification

- Mobile TypeScript check passed.
- Expo export succeeded for web, iOS and Android; output is in
  `output/expo-subscriber-check`. This verifies bundling, not device behavior.
- Existing 13 shared-rule checks and 15 native-selection fixture assertions passed;
  these are not end-to-end integration tests.
- Live Expo web inspection, limited to read-only phone lookup, matched a known subscriber
  with a 14-day subscription and 3 main meals + 2 snacks per day. No meals were selected
  and no order was sent during that inspection.
- No production mutations, payments, deployment, or customer-data edits performed.
- The reviewer scored both reported recovery fixes resolved in code (invalid-pick
  removal and definitive-rejection recovery). This is not a visual/native certification.
- Actual iOS/Android behavior, authenticated account rendering, offline recovery and
  end-to-end order submission remain unverified.

## Remaining work

English and AI-plan parity, durable draft persistence, actual Android/iOS testing, and
controlled end-to-end submission validation remain outstanding. Existing server
enforcement remains authoritative. Registration/reset, subscription changes,
legal/help/calculator and staff flows still use existing website destinations.
There was no production deployment. Do not label Expo feature-complete.

Menu artwork: 139/140 mapped; Lemon Shrimp deliberately has no image per user request.
