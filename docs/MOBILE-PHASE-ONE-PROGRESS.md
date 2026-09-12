# Mobile phase one — partial implementation

## Implemented
- Native information route: `/information/about`, `/information/how-to-subscribe`, `/information/contact`.
- Account information links now open these routes rather than the website. Privacy and terms remain on the official site.
- Arabic/English content and per-page text direction. Language preference is saved locally for these information pages only, not advertised as whole-app English support.
- Original wordmark and existing Cairo/navy/cyan tokens reused. No new imagery, palette, backend mutations or subscriber rule changes.
- Contact number uses existing restaurant settings and approved fallback. WhatsApp/call launch only upon an explicit tap.

## Verified
- Mobile TypeScript check passed.
- Browser accessibility inspection: subscription instructions in both languages, language retained through full reload, contact page retains English and displays the approved phone.
- No message, call, review submission, order, payment, or subscription mutation executed.

## Still pending
- Full customer UI localization is now implemented; see `MOBILE-ENGLISH-ROLLOUT.md` for coverage and verification. Physical iOS/Android direction testing remains pending.
- Native order/delivery tracking, rating submission interface.
- Visual screenshot review on phone/desktop and native-device validation; no finished design-review verdict claimed.
- Full transfer of the longer official company profile and contact form/location details; current pages are concise factual summaries, not a complete replica.
- Later phases: loyalty redemption, payment return journey, skip-day safeguards and chat.
