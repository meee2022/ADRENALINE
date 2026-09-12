# Subscriber pre-release audit — 2026-09-12

## Release decision: HOLD

This is a source/fixture audit, not proof of production end-to-end correctness.
No deployment, customer order, approval, payment or customer record was written.

## Reviewed paths

- Website public menu and Expo use shared subscription slot/category/count/schedule rules.
- Expo sends customerOrders.create; server independently validates identity, subscription and selections.
- Smart suggestions pass date/week/day matching and current meal constraints; they do not create dailyPlans.
- Approval is staff-controlled in customerOrders and maps kitchen rotation/day to actual dates.
- Expo complete-plan checks, atomic swaps, ordered-day navigation, draft retry/idempotency and plan option selection were inspected.

## Executed checks

- 97 Vitest tests passed (dates, order selection, authorization, passwords, payroll).
- 13 shared-rule checks passed.
- 1008 calendar comparisons passed after local Friday-start correction.
- 364 mobile/server selection comparisons passed.
- 11 navigation checks, 15 selection checks, 11 smart-merge checks passed.
- Atomic swap checks passed.
- 10 plan-choice checks; 90 calculator comparisons, 2 recommendation and 6 savings checks passed.
- Caller scan reports session tokens present.
- Guard scanner flags nine handlers; its output is not proof of missing authorization:
  several flagged handlers start with requireRole or validateSession. Do not mark this scan clean without reviewing each handler.

## Unresolved before release

1. Resolved policy: user explicitly confirmed that nutritionists may move meals across weekdays and cooking weeks.
   Removed the extra local weekday/rotation restriction from staff date overrides.
   Friday delivery remains blocked. Subscriber selection restrictions remain unchanged.
   Staff approval integration testing is still pending.
2. Updated inspection: slotBlockDate has a separate Friday-start path, but no executable callers were found in client/apps/mobile/convex/shared (only definition and comments). This is a latent helper issue, not evidence of a current display failure.
3. The selection model identifies slots by rotation week + weekday and de-duplicates repeated slots.
   Subscriptions spanning more than one four-week cycle require dedicated coverage; the calendar audit currently spans 21 calendar days per fixture.
4. No isolated full order -> nutritionist approval -> dailyPlans -> kitchen -> delivery integration scenario has been run.
5. Live deployment version equivalence has not been verified. Local source parity is not a claim that deployed code is identical.

Do not publish all workspace changes on the strength of passing unit/fixture checks.

## Fresh release checks, 2026-09-12 (HEAD 9cb1cc3 plus dirty worktree)

- npm test: 97/97 passed.
- npm run check: exit 0, 47 warnings, no errors. Warnings are not certified harmless.
- Mobile npm run typecheck: exit 0.
- All ten fixture scripts passed: shared rules, calendar, mobile/server parity, day navigation, selection, smart merge, swaps, plan choice, calculator, i18n.
- Vite production frontend build passed in output/release-audit-20260912/public without deleting dist. Large chunk and stale Browserslist warnings remain. This is a compile artifact, NOT an isolated backend preview, and has not been launched for order writes.
- New scripts/audit-plan-cycle-coverage.ts reports a release HOLD (exit 1): 30 calendar days -> 26 delivery slots -> 24 distinct week/day keys and resolved dates; 56 days -> 48 slots -> 24 distinct keys. This proves representation ambiguity, not that every production subscription is affected. Confirm repeating-cycle policy and real supported durations before changing the shared contract.
- Mobile app.json explicitly references the existing Convex deployment and official site. A local URL does not isolate data. No create/approve/payment/delivery mutation was tested against it.

## Release partition (proposal, not staged or published)

1. Presentation candidate: About/profile CSS, public layout, plan artwork and artwork resolver. Review exact hunks and include every imported asset. Do not include all HomePage/PublicMenu changes blindly: those files also contain behavioral changes.
2. Subscriber logic: shared/rules/subscription.ts, customerOrders approval, mobile selection and plan modules. HOLD until long-cycle policy and isolated approval-to-delivery tests pass.
3. New backend capabilities: mobileSubscriber, mobilePush, schema, crons, generated API and publicMeals. Deploy only as a compatible, independently tested backend release. Keep push and overview feature flags disabled. Do not activate scheduled push as a side effect of a UI release.
4. Driver entry: Login plus native admin/root layout. Needs expired-session, logout, denied-permission and physical-device reopen tests. Native admin loads the published website, so local Login changes are not automatically available there. Saved native marker only observes /driver, not custom /delivery; root restoration may override a deep link. Do not sign off this feature yet.
5. Exclude unrelated attendance bridge archives/scripts, local settings, import utilities, scratch outputs and design artifacts unless separately reviewed.

## Isolated integration prerequisites / rollback

- Obtain a confirmed non-production Convex deployment and synthetic customer/nutritionist/kitchen/driver accounts. Do not copy customer data by default. Configure both web and Expo to that deployment and a staging website before testing writes.
- Cover weekly/28-day/30-day/multi-cycle periods, Friday start/override, skips, incomplete days, swaps, duplicate sends, approval overrides, kitchen date/rotation and delivery-only access.
- Identify the actual last published website artifact AND backend revision (local HEAD is not proof of either). Preserve those artifacts and take a provider-backed data backup before an approved production release.
- Publish additive backend changes separately from frontend/native changes, smoke-test each stage, and retain the previous frontend/native artifact. Backend rollback must account for new data/schema; restoring frontend alone cannot undo incorrect orders.
- No remote staging provisioned, backup claimed, production deploy, push message or production data mutation performed in this audit. Next integration stage is blocked on confirmed isolated deployment/access and recurring-cycle policy.

## Existing development deployment verified

- User authorized testing the existing development deployment. `.env.local` selects `dev:rightful-parakeet-660`; explicit CLI `--deployment-name rightful-parakeet-660` used for all remote checks.
- Table listing and function metadata retrieval succeeded. customerOrders functions and mobileSubscriber:overview are already deployed there.
- Read-only publicMeals:listMeals succeeded: 140 records, 140 with imageUrl. restaurantSettings:get succeeded.
- Official website's currently referenced main-Dn2Dip9A.js contains laudable-mongoose-958 (and happy-otter-123), not the configured development hostname. This is frontend bundle evidence, not an audit of every integration.
- Expo app.json still selects laudable-mongoose-958. Do not submit test plans from the current Expo preview until explicitly configured for development.
- MOBILE_PUSH_ENABLED is absent in the development environment. No environment variables, remote code or customer records were changed in these checks.
- Full synthetic order/approval/delivery integration remains pending; connectivity and read-only function checks are not end-to-end sign-off.

## Attempted isolated Expo run

- Added opt-in apps/mobile/app.config.js development profile, fixed to rightful-parakeet-660 with an explicitly required loopback website URL; normal app.json configuration remains unchanged. Push and overview remain disabled in this profile.
- Tool execution policy rejected the command launching the profile on port 8095. No claim that a new test preview is running. Current 8082 preview is not authorized for test writes.
- Invoked development customers:create with a synthetic name/00000000 and no staff session. Server rejected with authentication error at requireStaff, before insertion. This is a negative authentication check, not successful fixture creation.
- Blocker: authenticated development staff session is required to create fixtures and perform the real approval/delivery workflow. Do not extract stored session tokens, bypass authentication, or weaken guards to complete the test.

## Authenticated development scenario completed through preparation

- User signed into the local website. Served `/src/lib/convex.ts` confirmed rightful-parakeet-660 at runtime, not just in .env.
- Created synthetic customer TEST RELEASE 20260912 / 00000001, id j574jb0c2yv89kk4rmsdchbcws8e8yz4. Period 2026-09-13 only, one main meal, zero snacks. Existing customers untouched.
- Public menu correctly showed Sunday 13 September, kitchen rotation 2. Selected Cordon Bleu; further additions disabled at one meal. Review displayed image/date/rotation correctly.
- User submitted after terms confirmation. Order ORD-260912-2519 (m572462x96gejfy15rxb11t5bh8e9k0a) verified pending, one meal, 297 calories. Stored totalPrice 45 is order metadata, not a payment; no payment action occurred.
- Approved this order through local staff UI with explicit development-only note. Verified order confirmed and exactly one new dailyPlan j9732gy528fvyv1jm7gk66yw658e9e1h for 2026-09-13, CONFIRMED.
- Kitchen default tomorrow view displayed the synthetic customer and Cordon Bleu. Prepared that individual plan (not bulk). UI showed waiting for delivery and stored plan status became PREPARED, date unchanged.
- Delivery view is today-only (2026-09-12), correctly excludes tomorrow's plan. End-to-end DELIVERED and role-specific driver login/device restoration remain untested. No clock/date manipulation or assignment to a real driver was performed.
- Test customer/order/prepared daily plan remain in DEVELOPMENT for continuation. No records were deleted; no production deployment or writes occurred. Do not interpret this one-day website/admin scenario as Expo/native or multi-week certification.
- Browser accessibility/value snapshots reported empty phone while screenshot showed input. Corrected visually to eight digits and verified persisted customer through the development query. Prior claim that input did not persist was an automation-observation issue, not a confirmed application bug.
