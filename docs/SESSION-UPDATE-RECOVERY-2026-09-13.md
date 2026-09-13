# Staff session and application update recovery

Backend deployed to `laudable-mongoose-958`; frontend included in this release.

- Added read-only `auth.sessionStatus`, using the existing session validator; no session lifetime, role, business rule, or schema changes.
- Login redirects a remembered staff account only after server validation. A failed network check leaves the login form available and preserves the session.
- ErrorBoundary checks session validity for redacted Convex failures. Only an explicit invalid result clears it; a timeout/outage does not.
- The explicit sign-in-again action clears persisted authentication before navigation.
- Recognize structured Convex authentication error data; an administrator-only permission error is not session expiration.
- Existing 60-second/focus/online version polling remains. Background updates are deferred after form input or button-driven choices to avoid losing unsaved work. This is deliberately conservative: no auto-reset of this guard on submit, since saving may fail.
- Removed redundant reload caused solely by another tab changing the shared build marker.

Verification: seven focused recovery tests passed, along with TypeScript, scoped ESLint and Vite production build. Backend deployment and the unauthenticated session-status query were verified. The affected employee's device still needs confirmation after frontend rollout.

Release dependency: deploy the additive Convex `auth.sessionStatus` query before the matching frontend. Do not deploy unrelated local backend changes. Older backends fail safely (login remains usable; error fallback remains available) but cannot provide automatic validity checks.

After release, verify on a test staff account: expired session → login, valid session → authorized landing page, offline → no logout, new build while idle → refresh, new build with an unfinished sale → no forced refresh. Do not use actual sales to test mutations.
