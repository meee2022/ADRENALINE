# Expo customer app: Arabic / English

## Implemented (2026-09-12)

- One persisted language preference and a visible Arabic / English selector across the four customer tabs. Changing language does not remount the subscriber planner or alter its draft.
- Localised home, meal menu/details, plans and option labels, account, calculator, subscriber phone gate, manual/smart planning, full/day review, replacement dialogs, loading/empty/error states, rating UI and notification setup UI. Existing information and tracking screens share the same preference.
- Published English names/descriptions are selected from the existing records. A read-only public catalog check found 140 meals, with no missing English names or descriptions where an Arabic description exists.
- Ingredient/tag labels are translated through an exact display dictionary. Original meal objects, ingredient strings, restrictions, category keys, dates, prices and mutation payloads are retained for business logic.
- Text/input direction follows language. Phone/email/numeric inputs stay LTR. Web document language/direction updates; native root and review-modal layout direction is explicit, without forcing a reload. Buttons can grow for longer English copy.
- Unknown customer-authored names, addresses and free text remain as entered. Branding printed into product photos is intentionally unchanged.
- WhatsApp subscription-message drafts follow the selected language; messages are not sent automatically.

## Verification

- Mobile TypeScript check passed.
- `scripts/check-mobile-i18n.ts`: 675 exact translations, 30 message templates, 501 source strings; Arabic identity, interpolation spacing, personal-data passthrough and template precedence checked.
- Selection checks: 15 assertions. Plan-option checks: 10 assertions.
- 364 mobile/server acceptance comparisons plus invalid rotation check.
- Smart merge: 11 checks. Atomic swap/category/day/week/duplicate/pause checks passed.
- Calculator: 90 website comparisons, 2 recommendation checks and 6 savings checks.
- Browser inspection: English menu, plans, account, calculator, full-plan/day-plan sample and replacement UI; Arabic switch updates the account validation message as well as page labels. Desktop plan screenshot and 390px replacement-screen screenshot reviewed.
- Confirmed English remains after full reload. Selected the second weekly weight-loss option (3 meals + 2 snacks, QAR 750) locally: switching to Arabic kept that same option and price. No checkout was opened. Final 390px plans screenshot reviewed and temporary viewport override reset.
- No real order, payment, review, AI generation, subscription edit or push notification was submitted during these checks.

## Release boundary

- Device testing on actual iOS/Android remains required for native navigation direction, accessibility and larger system text. Browser preview is not a native-device test.
- External pages (PayLater, staff dashboard, official policies) remain external pages; this change does not replace their flows or deploy the website/backend.
- Private-link delivery testing and embedded native maps remain in `docs/TRACKING-HANDOFF.md`.
- Re-run the catalog coverage check after adding Arabic UI strings; extend exact translations for new ingredient/tag labels. Never feed translated records back into allergy or selection rules.
