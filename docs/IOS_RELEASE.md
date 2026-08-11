# iOS release setup

The iOS app is a Capacitor shell around the existing React customer experience.
It uses the same Convex functions and therefore does not duplicate or alter any
subscriber-plan rules.

## Fixed identifiers

- App name: `Adrenaline Healthy`
- Bundle ID: `com.adrenalinehealthy.app`
- Web output: `dist/public`
- Minimum iOS version: iOS 15

## Environment safety

The normal web development environment currently points to a Convex development
deployment. A release build must never silently inherit that value.

1. Copy `config/ios.env.example` to `.env.ios.local`.
2. Put the verified production Convex URL in `VITE_CONVEX_URL`.
3. Set `IOS_RELEASE_CONFIRMED=true` only after confirming the deployment.
4. Run `npm run build:ios`.

For local native development only, use `npm run build:ios:dev`.

## On a Mac

1. Install Xcode 26 or later.
2. Run `npm ci` and `npm run build:ios`.
3. Run `npm run ios:open`.
4. In Xcode, select the Apple Developer team and verify signing.
5. Test on a physical iPhone and then upload a TestFlight archive.

## Public App Store links

- Privacy policy: `https://adrenalinehealthy.com/privacy`
- Support: `https://adrenalinehealthy.com/support`
- Terms: `https://adrenalinehealthy.com/terms`

Do not add camera, location, tracking, or notification permissions until the
corresponding feature is implemented and its purpose text is ready.
