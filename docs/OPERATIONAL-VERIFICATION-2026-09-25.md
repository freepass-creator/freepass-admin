# Admin operational integration verification — 2026-09-25

## Single integrated candidate

PR #106 / `release/admin-operational-20260925` integrates UI #96, the workflow stack through #102, Claude electronic-contract #104 and fixture privacy #105. Original source branches were not rewritten. Temporary branch-mutating assembly and dependency workflows were removed after use.

## Data ownership — WORK-INBOX 0-AA remains authoritative

Admin owns business commands and workflow semantics, NOT a second persistence authority. All catalog/intake/contract/settlement/e-sign persistence enters `src/server/freepass-data.ts`. `src/server/erp5.ts` is a deprecated re-export only: it constructs no repository and holds no independent state. The e-sign service obtains its persistence ports through the same Data gateway; the renderer remains the existing Claude implementation.

This corrects the intermediate integration that separated the catalog and workflow persistence composition. Its old boundary assertion was inconsistent with the owner's explicit read-and-write-through-FreePass-Data instruction. Five boundary regressions now enforce one gateway, shared instance identity, and no App/Service/server-helper direct adapter access.

Catalog OBSERVE remains the explicit transitional legacy reader. This is not proof that the final dedicated FreePass Data Admin API and ACTIVE catalog cutover are deployed.

## Inspected evidence before final gateway correction

Revision `78d187cffadc1a782b07426443cb6867ced65435`, run 36135213725: typecheck, 561/561 tests, UI/Data checks, build, Firestore 7/7, real Chromium/Storage PDF seal and concurrency tests, Next runtime 35/35, responsive UI 24 layout + 2 interaction cases and filter 5 widths passed. Raw logs and representative screenshots were inspected. A separate audit found high 6 / moderate 2, preventing release promotion.

Dependency-corrected revision `89bd36f9e2e6e805b0dc9bf37241f80914e5c95a`, run 36136416818: raw code and persistence artifacts confirm typecheck, 561/561 tests, UI/Data checks, production build, Firestore 7/7 and E2E PDF emulator PASS. Audit run 36136421427 on that exact SHA reports high 0 / critical 0 / moderate 2 (existing gaxios/uuid exceptions only). No security exception was added. The fail-closed audit evidence validator has ten regression tests.

These results do not automatically approve the subsequent gateway correction. Final exact-revision code/persistence/browser/audit checks and inspected artifact IDs are recorded in PR #106's release receipt after this checkpoint. A merge is code integration, not production activation.

## Invalid previous badge

Run 36134238491 is NOT a passing release receipt. Piped commands masked type errors, a failing test and failed build. The permanent operational workflow now specifies Bash pipefail and probes failure propagation. Audit evidence errors, missing fields or inconsistent counts fail closed instead of appearing clean.

## Real operations remain separate

The connected Vercel team listed zero projects; the exposed deploy action failed schema validation. Presence-only repository checks found no Vercel token/project/org, ERP5 credential, session secret or complete Google OAuth pair in that checked context. Other accounts/environments are not ruled out. No secret values were read or copied and no live Admin deployment URL was established.

Use `.env.example` and `docs/OPERATIONS-FIRST-USE.md`: bind the approved deployment/auth/Data environment, start read-only, verify authorized/unauthorized accounts and live persistence before enabling writes. Mixed-clawback allocation is still guarded; a ledger record is not proof of external tax-invoice issuance or a bank transfer. Galaxy hardware acceptance remains unverified.

No actual customer contract, production financial record, outbound claim or payment was changed during integration.
