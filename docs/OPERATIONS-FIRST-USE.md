# FreePass Admin: first operational release

## Candidate and scope

Release PR #106 / `release/admin-operational-20260925` integrates UI #96, the workflow stack through #102, Claude electronic-contract #104 and fixture privacy #105. Historical feature PRs are not separate operating versions. Use one verified revision for UI, contracts, settlement and deployment.

Product authority remains FreePass Data. Admin owns intake/contract/settlement commands and audit records, persisted in the existing approved Firestore project through repository boundaries. Catalog mode is OBSERVE: this is an explicit legacy bridge, not evidence that the final FreePass Data Admin contract has shipped.

## Verification evidence policy

The original assembly run 36134238491 displayed a green result while its piped command logs contained a type error, one failing test and a failed build. It is NOT a passing release receipt. The follow-up workflow uses explicit Bash pipefail and a failure-propagation probe. Treat raw command results and checked SHA as evidence; never substitute the GitHub badge alone.

`Admin operational verification` checks a single exact revision with three read-only CI jobs:
1. Node 24 locked install, typecheck, complete tests, UI/Data boundary checks and production build.
2. Isolated Firestore/Storage emulators: intake snapshot/read-back/concurrency, cancellation/termination persistence, real PDF sealing, hash verification and retry behavior. No production credential is injected.
3. Production Next runtime authentication/error/retry boundaries and real-component responsive/filter browser checks.

CI is not a production login/IAM receipt. Emulator persistence is not a real Storage receipt. Browser fixtures are not Galaxy hardware acceptance.

## Deployment bindings

As observed on 2026-09-25, the connected Vercel team listed zero projects. The deployment action also returned a schema-validation error. A presence-only Actions check found no VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, ERP5_FIREBASE_SERVICE_ACCOUNT_JSON, SESSION_SECRET or complete Google OAuth pair in the checked repository context. This does not prove another Vercel account/environment lacks them.

Use `.env.example` as the implemented key inventory. Bind the correct existing deployment project or create an explicitly designated project for this repository. Do not copy another app's secrets, weaken authentication, or enable writes merely to make the screen open. An authorized operator must supply the approved bindings; no secret belongs in a PR, issue, document or chat message.

## FreePass Data Admin Catalog cutover

The application implements the same ordered stages as the central FreePass Data consumer switchboard:

`LEGACY_DIRECT → OBSERVE → SHADOW_READ → PARITY_VERIFIED → FREEPASS_DATA_READ`

The Admin runtime does **not** grant itself a stage. `FREEPASS_DATA_ADMIN_CUTOVER_JSON` is only an execution receipt carrying evidence already approved through the FreePass Data consumer process. It is bound to the exact Data HTTPS origin and the SHA-256 of the dedicated Admin consumer token, expires, and cannot skip a stage.

- `OBSERVE`: legacy bridge remains the returned catalog; no cutover receipt is needed.
- `SHADOW_READ`: requires contract/auth/legacy/Data-read evidence; reads both sides and returns legacy while recording MATCH/MISMATCH/HOLD.
- `PARITY_VERIFIED`: additionally requires parity evidence and an approved `admin-catalog` ACTIVE release identity/digests; still returns legacy and continuously rechecks the release and shadow comparison.
- `FREEPASS_DATA_READ`: additionally requires fallback and production-readback evidence with no HOLD reasons. It validates the currently served ACTIVE release against the approved release and then returns FreePass Data directly. It does not silently fall back to ERP5 if Data fails; rollback is an explicit stage/environment change.

SHADOW/PARITY/final stages bypass the 60-second legacy UI cache so expiry, approval changes and release changes are checked immediately.

As of 2026-09-26 the central FreePass Data main registry still records `freepass-admin-catalog` at `OBSERVE` with unresolved HOLD reasons. Therefore this code is cutover capability, **not current cutover authorization**. Do not populate a higher-stage receipt merely because the code supports it.

## First-use sequence

Deploy the verified revision to a preview with ERP5_WRITE=off. Verify the authorized administrator can sign in, an unauthorized account cannot, `/system/data-status` shows fresh probes, and catalog list/detail/selected Offer agree. Configure the approved HTTPS origin for OAuth, electronic-contract and claim links.

Before operational writes, verify least-privilege Firestore/Storage IAM, approved backup/restore and the ability to return to the prior deployment in the FreePass Data control plane. The production Admin does not own Firebase credentials. It enables the delegated path only when `ERP5_WRITE=on`, `FREEPASS_DATA_ADMIN_WORKFLOW_WRITE=on`, an HTTPS gateway origin, the Admin consumer token and the production WIF caller identity are all present; the FreePass Data Admin runtime independently keeps its workflow write gate. A local developer process does not bypass this boundary: unapproved development writes must use the local Firestore emulator. Vercel preview/development deployments remain read-only. Use a designated non-customer acceptance record; do not test on an actual customer contract, send a real claim, or move money.

### Production write authority

`ERP5_WRITE_APPROVAL_JSON` applies only to legacy direct-Firebase or one-off maintenance paths that still own a Firebase credential. It is not an Admin gateway runtime variable. For the delegated production path, IAM and backup/restore evidence is retained by the FreePass Data control plane, while Admin fails closed unless both write gates and the authenticated gateway configuration are valid. Do not infer that evidence from emulator tests, a green CI badge or the mere existence of configuration.

The application cannot prove cloud IAM roles from configuration alone. Backup/restore and minimum-IAM verification therefore remain operator/control-plane evidence even after the runtime gates are enabled.

Verify save, reload, re-login and retrieval preserve the same record. Check duplicate clicks/concurrent submissions produce one intake and one audited outcome. Complete a normal intake/contract/delivery/settlement-record journey. Pre-delivery cancellation must create no new billing/payment/clawback; post-delivery termination must retain prior facts and track any clawback separately.

## Honest scope limits

- Settlement records do not prove an external tax invoice has been issued or a bank transfer made. Record externally completed actions with evidence; do not mark them completed from UI intent alone.
- Mixed clawback cash allocation remains guarded pending an explicit allocation policy. Do not guess how to allocate money across rows.
- Codex remains the single writer for electronic-signature implementation; Claude reviews it read-only. Preserve the existing guards for image upload size, missing documents, expired/revoked sessions, changed terms and overflowing PDF text. A blocked case must be explained, not silently truncated or signed.
- Missing supplier logos use company-name fallback; final catalog cutover and Galaxy keyboard/hardware acceptance are separate remaining checks.

## Rollback

Keep the prior deployment and exact revision. Switch traffic back to it if acceptance fails and set ERP5_WRITE=off while investigating. Do not delete production rows, reset financial totals, or overwrite immutable signed evidence as a rollback mechanism.
