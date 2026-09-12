# Subscriber result presentation

- Reference: the weekly result renderer in client/src/pages/public/SmartPlan.tsx (day/date navy strip, compact image cards, integrated swap action).
- The live smart-plan route was inspected but requires a subscriber phone; no live plan was generated or submitted.
- PlanOverview keeps day view and offers full chronological review. Both smart and manual-review entry points share it.
- PlanMealCard is deliberately denser than menu browsing cards. Approved menu artwork and existing brand tokens are reused.
- Swaps still use replacePick; no order payload, generation, subscription, or kitchen rule changes in this presentation pass.
- Verified locally: TypeScript, selection fixtures, swap fixtures, browser day/full-plan rendering. Native device rendering and real subscriber submission were not tested.
