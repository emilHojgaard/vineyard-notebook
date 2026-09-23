# Release dependency and emulator validation

## Dependency audit

- `npm audit --omit=dev --audit-level=moderate`: 0 vulnerabilities.
- `npm --prefix functions audit --audit-level=moderate`: 0 vulnerabilities.
- Functions dependencies were upgraded to `firebase-admin` 13.10.x and
  `firebase-functions` 7.4.x. The Functions package pins patched compatible
  `uuid` 11.1.1 and `gaxios` 7.3.1 through npm overrides.
- A full root `npm audit` still reports seven moderate advisories in the
  `firebase-tools` development dependency chain (`@opentelemetry/core`,
  `csv-parse`, `stream-json`, `uuid`, and related packages). npm's only full
  audit fix currently proposes the incompatible downgrade to
  `firebase-tools@10.1.1`; the application and Functions production graphs are
  clean. Firebase CLI is used only as a local/deployment tool, so the residual
  is isolated from deployed runtime traffic. Keep `firebase-tools` at the
  latest release and revisit when its upstream dependency ranges are patched.

## Emulator and security checks

- `npm test`: 21 tests passed.
- `npm run test:rules`: 9 Firestore/Storage rules tests passed.
- `npm run test:functions`: 3 callable emulator tests passed with Auth,
  Firestore, and Functions emulators. Coverage includes unauthenticated calls,
  authenticated token lifecycle calls, and non-member denial.
- `npm run build` and `npm --prefix functions run build`: passed.

The callable failure was reproduced before the fix: the Auth emulator was not
configured, so the authenticated harness could not create an emulator user.
`firebase.json` now configures Auth, Firestore, Functions, and fixed emulator
ports; the regression command starts all required services together.
