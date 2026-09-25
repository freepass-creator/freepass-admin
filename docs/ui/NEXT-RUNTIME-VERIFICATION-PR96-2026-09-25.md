# PR #96 — Next production runtime verification (2026-09-25)

## Status

**ACTUAL NEXT PRODUCTION RUNTIME / NO-DATA BOUNDARY VERIFIED.**

This receipt runs the real Next.js production server (`next start`) and real proxy/error components. It deliberately supplies no ERP5/Auth Firebase credentials and never enables writes. It is not a production-data or real-user-login verification.

Verified code HEAD: `2e72e9d1cc1f8dd5709ea3ca3feb3a144a2ff21d`.

Workflow: https://github.com/freepass-creator/freepass-admin/actions/runs/36125609611

Browser: Chromium `140.0.7339.16`.

## Test boundary

Environment:
- `ERP5_WRITE=off`
- no ERP5 service-account JSON/path
- no Auth Firebase service-account JSON/path
- no Firebase Web API key
- no Google OAuth client ID/secret
- no production public base/storage bucket

To cross the real production proxy without external Google/Firebase calls, the test creates a short-lived synthetic cookie using the repository's existing `g1.<payload>.<HMAC>` Google-session format, with a test-only secret and `runtime.invalid` workspace domain.

The application code has no test bypass flag.

## Verified behavior

### Unauthenticated production boundary
- GET `/products?q=sample` redirects to `/login?next=/products?q=sample`.
- The actual login UI renders.
- The login form preserves the protected destination.
- Unauthenticated POST to a protected route returns **401** with generic `로그인이 필요합니다`.
- Unauthenticated private API request returns **401**.
- No client page errors were observed.

### Authenticated/no-data failure boundary
At both **390px** and **1440px**, with the synthetic valid session and no ERP5 credential:

- `/products` → user-safe `상품찾기` fatal error boundary
- `/intake` → user-safe `계약접수` fatal error boundary
- `/settlement` → user-safe `정산관리` fatal error boundary
- `/esign` → user-safe `전자계약` fatal error boundary
- no DOM text exposes `ERP5_FIREBASE_SERVICE_ACCOUNT_JSON`, `ERP5_SERVICE_ACCOUNT_PATH`, `private_key`, or the raw credential error
- authenticated `/` redirects to canonical `/intake`
- redirected intake remains fail-closed without credentials
- browser emitted no external requests

Eight protected route/viewport checks were **8/8 PASS**.

## Retry defect found and fixed

Baseline runtime run:
https://github.com/freepass-creator/freepass-admin/actions/runs/36125052622

On baseline code `ccd43ede33f748cfb4203af4b30ffe1cf7602524`:

- 33/35 runtime assertions passed.
- The only failures were the `다시 시도` assertions at 390px and 1440px.
- The error UI stayed visible, but clicking the button generated **0 new requests**.

Cause: the shared fatal route action used only the App Router error-boundary `reset()`. In the measured production server-error case that did not re-request the route.

Fix:
- shared `RouteError` now calls `reset()` and then `window.location.reload()`.
- fatal-route retry therefore performs a real request while preserving the current URL.

Final runtime receipt:
- **35/35 checks PASS**
- 390px retry: **2 matching Next requests**
- 1440px retry: **2 matching Next requests**
- client page errors: 0
- external browser requests: 0

The full reload is intentional only for the fatal route boundary. It is not the pattern for ordinary inline validation or recoverable partial errors.

## Artifact

Artifact ID: `10859667563`

Artifact name: `next-runtime-2e72e9d1cc1f8dd5709ea3ca3feb3a144a2ff21d`

ZIP SHA-256: `6c2fcdc33c89c4cbd1e021fde094a195edb04bc2233032d4bdf87499cc5cfea0`

Expires: 2026-10-02.

Contents:
- `receipt.json`
- `server.log`
- 390px login redirect screenshot
- 390px products error/retry screenshot
- 390px root→intake error screenshot
- 1440px products error/retry screenshot
- 1440px root→intake error screenshot

The screenshots were manually inspected after artifact download.

## Separate workflows

Runtime smoke is intentionally separate from the component browser suite:

- `UI browser check`: geometry, responsive components, FilterSheet
- `Next runtime check`: production Next server, auth/proxy/error/retry boundaries

This avoids one long concurrency slot hiding which class of failure occurred.

## Not verified here

- a real Workspace/Firebase login
- real ERP5 Firestore/IAM access
- successful data-loaded versions of the protected routes
- real server actions that write intake/settlement/e-sign data
- production deployment/rollback
- physical Galaxy soft keyboard/safe-area behavior
- RTL/multi-locale runtime
- cross-browser runtime

No customer data, contract, invoice, settlement, or production deployment was created by this test.
