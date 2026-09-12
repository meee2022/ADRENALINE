# Expo parity with the official customer site

## Scope and source of truth

Preserve the website's customer tasks, pricing, identity, backend contracts and
subscriber/cooking-cycle rules. Improve presentation, not business behavior.
Reference: `client/src/App.tsx`, public pages, customer pages and Convex handlers.
This is a source inventory, NOT a claim of a complete live-site audit or native parity.

| Website capability | Expo status | Remaining work |
| --- | --- | --- |
| Home | Native, partial | Match all official sections, navigation and content; verify claims against supplied source |
| Public plans | Native selection; official PayLater/WhatsApp handoff | Verify every duration/option and payment return on devices, without real charges |
| Menu + meal details | Native | Images 139/140; Lemon Shrimp intentionally without image; verify nutrition and modifiers |
| Subscriber phone entry/manual plan/review | Native, partial | Draft persistence, offline recovery and controlled order submission testing |
| Smart plan day/week | Explicit official-site link from home/menu/account | Native generation/profile/preferences/results; same ai actions and validation; not implemented |
| Smart fill of empty subscriber slots | Missing in native planner | Preserve selected slots, cooking cycle, locked dates, categories and limits |
| Login/profile | Native, partial | Authenticated device testing and full account-action parity |
| Registration/password reset | Official-site handoff | Native forms using existing auth contracts |
| Subscription edits, loyalty/referral actions | Mostly read-only/official handoff | Inventory CustomerProfile actions individually before implementation |
| Calorie calculator | Native screen from home/account; approved plan images, monthly emphasis, savings and duration navigation | 90 calculation comparisons, 2 recommendation checks, 6 savings checks passed; browser input/goal/output and monthly navigation verified. Actual device testing and English remain |
| About/contact/how-to-subscribe/privacy/terms | Official-site links in account | Native screens/content parity |
| Track order and shared plan token routes | Not yet audited in Expo | Safe deep-link routing without exposing tokens |
| Staff/kitchen | Existing official-site handoff | Keep separate role protection; do not rebuild staff logic implicitly |
| Arabic/English | Arabic native; English incomplete | Language and direction parity |

## Acceptance for each row

- Inspect the full original screen and its loading/error/empty/success states.
- Document queries/actions/mutations and all constraints before implementing.
- Reuse existing server enforcement and shared pure rules; never weaken them.
- Verify navigation, RTL/layout, long values and supported widths.
- Typecheck and rule fixtures; mock AI/results/errors before controlled live tests.
- No production deployment, actual payment, generated order or customer edits as a UI test.
- A website link is a temporary handoff, not native feature completion. Do not pass
  account tokens, phone numbers, or draft data in handoff URLs.

Next implementation priority: native SmartPlan and subscriber smart-fill, followed
by account actions and remaining customer pages. Record evidence per feature rather
than waiting for the user to identify omissions.
