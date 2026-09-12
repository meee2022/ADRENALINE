# Subscriber rules audit — 2026-09-12

## Executed

`npx tsx scripts/check-mobile-server-parity.ts`: 364 direct acceptance comparisons against the actual pure validator imported from `convex/lib/customerOrderRules.ts`, plus invalid-rotation check. No production requests.

Matrix: missing/zero/positive/fractional/negative/NaN counts; complete/missing/excess picks; wrong week/day; inactive/gym/online meals; unknown category; unscheduled meals; paused/expired/future-inactive subscriptions.

Additional checks: existing 15 native-selection fixtures, 11 smart-merge fixtures, shared rule suite, mobile TypeScript.

## Corrections

- Subscriber counts now match server integer normalization: missing/non-positive/non-finite values mean zero. Guest unlimited behavior in shared rules is unchanged.
- Ready rejects invalid meal category/channel, explicit inactivity, >500 picks and invalid rotation.
- Subscriber slots use Qatar day rather than the device timezone. Date resolution has an optional injected day; existing web callers retain their default behavior.
- Deferred meal confirmation resolves the latest catalog entry and subscription before adding; unavailable entries cannot be reinserted from a stale modal. Queued taps also recheck restrictions.

## Preserved intentionally

- Second breakfast and duplicate manual picks require confirmation, not an absolute ban. Server allows them within total counts. Smart merge excludes both automatically.
- Allergy/avoid matches warn for explicit manual choice; smart merge excludes them. This is the existing product policy, not a new dietary policy.
- Same customerOrders.create review path and exact-payload idempotent retry. No dailyPlans or kitchen writes, deployment, payment, or real order.

## Not claimed complete

- Public customer DTO omits isActive/pausedFrom. Server validates pause at submission; native checks use those fields when available but cannot discover pause from the current public response. Exposing a minimal authorized eligibility response and deploying it needs a separate backend change.
- Live AI, network-loss/idempotency end-to-end, real-device behavior and full manual UI timer interaction have not been run in this audit.
- Draft is session-local and not durable across closure; existing screen explicitly says so.

Passing this matrix is evidence for the covered rules, not proof that every possible app state has been verified.
