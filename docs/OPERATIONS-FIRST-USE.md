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

## First-use sequence

Deploy the verified revision to a preview with ERP5_WRITE=off. Verify the authorized administrator can sign in, an unauthorized account cannot, `/system/data-status` shows fresh probes, and catalog list/detail/selected Offer agree. Configure the approved HTTPS origin for OAuth, electronic-contract and claim links.

Before operational writes, verify least-privilege Firestore/Storage IAM, approved backup/restore and the ability to return to the prior deployment. Record that verification as the non-secret `ERP5_WRITE_APPROVAL_JSON` receipt described in `.env.example`; production runtime stays fail-closed without it. Then explicitly enable `ERP5_WRITE=on` only for the approved production environment. Vercel preview/development deployments remain read-only even if the approval receipt is present. Use a designated non-customer acceptance record; do not test on an actual customer contract, send a real claim, or move money.

### Production write approval receipt

`ERP5_WRITE_APPROVAL_JSON` is an operational receipt, not a substitute for the checks it records. It must identify `freepasserp5`, confirm least-privilege IAM and a real backup/restore verification, carry a traceable `approvalRef`, and record `approvedAt`. Do not set either verification flag from emulator tests, a green CI badge, or the mere existence of a service-account key.

This repository and the current FreePass Data repository do not implement a production Firestore backup/restore job. Until an external Firebase/GCP backup and restore drill is actually verified, production writes must remain off. The application intentionally cannot prove cloud IAM roles from a service-account JSON key; that verification also remains an operator/cloud-control-plane receipt.

Verify save, reload, re-login and retrieval preserve the same record. Check duplicate clicks/concurrent submissions produce one intake and one audited outcome. Complete a normal intake/contract/delivery/settlement-record journey. Pre-delivery cancellation must create no new billing/payment/clawback; post-delivery termination must retain prior facts and track any clawback separately.

## Honest scope limits

- Settlement records do not prove an external tax invoice has been issued or a bank transfer made. Record externally completed actions with evidence; do not mark them completed from UI intent alone.
- Mixed clawback cash allocation remains guarded pending an explicit allocation policy. Do not guess how to allocate money across rows.
- Claude owns electronic-signature implementation. Preserve its guards for image upload size, missing documents, expired/revoked sessions, changed terms and overflowing PDF text. A blocked case must be explained, not silently truncated or signed.
- Missing supplier logos use company-name fallback; final catalog cutover and Galaxy keyboard/hardware acceptance are separate remaining checks.

## Rollback

Keep the prior deployment and exact revision. Switch traffic back to it if acceptance fails and set ERP5_WRITE=off while investigating. Do not delete production rows, reset financial totals, or overwrite immutable signed evidence as a rollback mechanism.
