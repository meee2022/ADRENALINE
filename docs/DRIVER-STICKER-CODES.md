# Driver codes on box stickers

Backend deployed to laudable-mongoose-958 on 2026-09-14; frontend included in this release following approval of the small outlined D01 preview.

- Only box stickers change. The customer name remains the only person's name on the label.
- Codes are persisted in `driverLabelCodes` and allocated transactionally when the existing sticker-number preparation runs. Removed/inactive drivers keep reserved codes; numbers are not recycled.
- A same-date, same-shift daily assignment takes precedence over the customer's default, matching the delivery fallback. Conflicting assignments or inactive/missing drivers produce no code rather than a guessed one.
- Template-only customers use their default driver unless a relevant daily plan overrides it.
- Driver screen shows the authenticated driver's code. Delivery assignment selectors show the same mapping. No assignment or delivery status logic changes.
- Code uses the approved position: right 1.2mm, top 2mm; black 9px outlined text. Existing sequence marker, customer number, name, dates and plan remain intact.
- Reassigning after a physical label was printed requires reprinting; a bilingual reminder is shown in Stickers. There is no claim to remotely update a printed label.

Release: backend schema/functions must precede frontend. Code allocation occurs on opening Stickers through `ensureBoxNumbers`; before allocation the driver's code is absent. Do not substitute a mock code. Verify a physical 58×39mm test label before a batch run. The earlier browser preview could not be visually verified by the agent because local-file browsing was blocked; the user approved it independently.

Tests: `tests/driver-label-code.test.ts` covers allocation, daily/default priority, shift isolation, cancelled plans, missing assignment and conflicting plans. No real assignments or labels were created by this implementation task.
