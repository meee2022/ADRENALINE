# Native smart planning — 2026-09-12

Supersedes the temporary website handoff described in earlier parity notes.

- Menu subscriber lookup selects the exact subscriber, then manual or smart mode.
- Smart mode explicitly invokes the existing `ai.generateWeeklyPlan` action with customer ID, phone, restaurant and remaining date range. No generation on mount.
- Suggestions merge into the same native manual draft and review/order path. They do not overwrite manual picks or submit automatically.
- Canonical catalog IDs, matching date/rotation/day, sequential days, counts, duplicates, breakfast and restriction checks gate automatic additions. Incomplete results remain editable and are reported as incomplete.
- Mode switching inside the planner retains the draft. Draft persistence across app closure remains unimplemented.
- Existing backend actions, rate limits and fallback engine are unchanged. No backend deployment.

Verification: mobile TypeScript, 11 smart merge fixtures, 15 manual-selection fixtures, 13 shared rule checks, and 10 plan-choice fixtures pass. No live generation, real orders or payments were performed. Real-device and live AI end-to-end verification remain pending.

Visual refinement: plan names/duration before artwork, existing-subscriber shortcut, clearer subscriber/date/progress hierarchy using existing brand tokens.

## Full-plan presentation and manual progression

- Compared `PublicMenu.tsx` completion effect (900 ms, incomplete → complete on the same day) and `SmartPlan.tsx` weekly day/image list.
- Native manual selection now advances after 900 ms only on a new completion. Navigation, review, generation and changes to completion cancel the timer. Completing the last day opens review, not submission.
- `PlanOverview` presents all subscription days, every selected copy with approved menu artwork, totals, missing days, and invalid/orphan picks. Shared by inline smart mode and final review.
- Smart mode no longer shows the day picker/catalog. Edit-day switches to manual while retaining the draft; review/send rules remain unchanged.
- `plan-preview` is a development-only visual fixture with no backend calls. Visually inspected at desktop width; real-device and live-generation testing still pending.
