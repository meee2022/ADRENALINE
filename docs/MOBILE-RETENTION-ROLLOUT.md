# Mobile retention rollout — staged, not production sign-off

## Local implementation
- Drafts are serialized per subscriber and subscription period in device storage.
- Only meal IDs and schedule slots are stored normally. An uncertain send additionally retains the exact existing order payload/idempotency key before transmission; session tokens are never stored here.
- Restoration uses the current catalog and retains unavailable items for correction.
- Native account sessions already use SecureStore. Menu now reuses the authenticated account's linked subscriber; phone lookup remains a public lookup, not authentication.
- Authenticated users land on Today. Delivery statuses include out-for-delivery, failed and cancelled; existing registered meals have approved artwork.
- Owner-scoped overview backend is added. Client overview stays disabled until deployed and verified (extra.subscriberOverviewEnabled).
- Push registration, generic customer notification delivery, and allowlisted notification links are implemented behind MOBILE_PUSH_ENABLED and extra.subscriberPushEnabled.

## Not yet enabled / not verified
- Push requires EAS project ID, APNs/FCM credentials, native development build, opt-in, deployed functions/schema and device testing. Ticket acceptance is not proof of delivery; receipt processing and retry/deduplication hardening remain required before enabling production.
- HTTPS association requires actual iOS Team ID and Android signing fingerprints, website association files, iOS associatedDomains and Android intentFilters. Custom-scheme routing exists but universal links are NOT live.
- Reminder cutoff X is not a verified shared rule. No reminder scheduler was added or activated. It must check server-owned date coverage, pending orders, approvals and paused/skipped dates before sending.
- The conservative overview suppresses new-plan CTA while any linked pending/active order exists, even if submitted before the subscription began. Old unreconciled orders can also suppress this CTA. Per-period/per-date reconciliation needs follow-up before enabling the overview or offering incomplete-day reminders.
- Web preview does not persist account tokens. Native session restoration needs device validation.
- Today auth/network error and push permission flows require integrated device testing.
- No production deployment command, order submission, or push send was intentionally run.

## Verification, 2026-09-12
- Root `npm run check`: passed (0 errors, 46 warnings).
- Expo TypeScript check: passed.
- Browser draft roundtrip with authorized subscriber: selected one Cordon Bleu, fully reloaded, re-entered phone lookup, reopened manual selection; restored 1/3 meals and quantity 1. No order submitted. Test selection remains a local draft.
- Phone-only lookup intentionally asks for the phone again; it is not an authenticated persistent account session.
