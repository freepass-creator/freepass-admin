# Contract termination hardening — 2026-09-25

## Scope and ownership

Repository: `freepass-creator/freepass-admin`.
Existing branch / PR: `backend/contract-termination` / #102, stacked on #98.
Inspected source revision: `09550a5c091225d43e96057918bbb2e5978442b8`.
Code and test revision after this pass: `bc01a44c689dbfea6fa3c0c09a65a7a6184b6681`.

This pass changes contract termination validation and its tests only. It does not change UI/UX, the e-sign service/renderer/session implementation, PDF/Storage, settlement calculations, Firebase rules, deployment or live records. Electronic signature work remains with the separate Claude session.

The existing business boundary remains unchanged:
- Before delivery: contract cancellation; no claim, settlement or clawback is created.
- After delivery: contract termination; existing claim/pay/invoice/cash facts are retained.
- Termination never infers or creates a clawback automatically.

## Confirmed defects and fixes

### 1. Calendar and delivery-date validation

The previous `YYYY-MM-DD` regular expression checked shape only. For example, `2026-02-30` was accepted as an effective date with an earlier delivery date, and as a delivered date with a later effective date.

`src/domain/contracts/termination.ts` now:
- validates a real calendar date by UTC round-trip, including leap-year and month-end boundaries;
- rejects invalid server timestamps with an explicit failure result instead of throwing from `toISOString()`;
- preserves the Korean-time today boundary;
- distinguishes an undelivered contract from a delivered record with an invalid/missing date;
- requires correction of the delivery record in the latter case, rather than directing it to cancellation.

No financial field or signed evidence is added to either patch.

### 2. Contract/intake ownership check

`cancelContract` already called `contractIntakeLinkError`, but `terminateContract` did not.

`src/adapters/erp5/contract-repository.ts` now calls the same helper after transaction reads and before planning, idempotent success, or any write. An intake explicitly linked to a different contract is rejected with zero writes. Legacy records without a reverse link retain the existing helper policy; this pass does not silently invent a stricter legacy-migration rule.

## Regression coverage and execution evidence

The two focused test files contain 39 tests: 33 domain tests and 6 isolated adapter tests.

- New tests against the inspected pre-fix production files: 16 PASS / 23 FAIL.
- Same tests after both fixes: 39 PASS / 0 FAIL.
- Repeated with process timezone `Asia/Seoul`: 39 PASS / 0 FAIL.
- Repeated with process timezone `America/Los_Angeles`: 39 PASS / 0 FAIL.
- Focused strict typecheck of the domain modules and both test files: PASS.

Local execution used Node 22.16.0 and the available TypeScript 5.8.3 compiler. The source/test modules were transpiled to CommonJS for `node --test`. This is not a claim that the repository's locked dependency install or full `npm test`/Next build ran.

The adapter tests execute the actual `contract-repository.ts` source with controlled transaction doubles. They verify write calls and guard ordering, including conflicting-link retries and zero writes on invalid delivery dates. They do NOT prove Firestore transaction concurrency, atomic commit, security rules, emulator behavior or production persistence.

Normal repository focused command, after installing the repository dependencies:

```sh
npx tsx --test src/domain/contracts/termination.test.ts src/adapters/erp5/__tests__/contract-termination-boundary.test.ts
```

### Source identity

The local pre-fix copies matched the fetched Git blob hashes before testing. Written production/test contents also matched the connector's returned/read-back blob hashes:

| File | Git blob SHA |
| --- | --- |
| `src/domain/contracts/termination.ts` | `f063457323e7f8072039b6b9d1b58974f076a502` |
| `src/domain/contracts/termination.test.ts` | `7440add41ba61b6c7f13378d9f689e4cead6e151` |
| `src/adapters/erp5/contract-repository.ts` | `f964a52229f0353123873b1aac8988ae9c43045d` |
| `src/adapters/erp5/__tests__/contract-termination-boundary.test.ts` | `585065da87804b84ce3fdfa1a7b6f9ab8b794649` |

## Verification boundaries and next handoff

- CODED: PASS for this delta.
- STATIC CHECKED: focused modules/tests PASS; whole repository typecheck NOT VERIFIED in this pass.
- TESTED: focused local 39/39 PASS; whole repository suite NOT VERIFIED in this pass.
- PERSISTENCE / DEPLOYMENT VERIFIED: NOT VERIFIED.
- No main merge, production deployment or live-data mutation was performed.

At the code/test HEAD above, the connector's pull-request-triggered workflow query returned no runs. This is not proof about workflows triggered by other events and is not a CI PASS.

GitHub PR #102 remains Draft/open/unmerged. The raw PR API reports `mergeable=false`, `rebaseable=false`, `mergeable_state=dirty`. Earlier immutable-commit comparison of `d911636bbf9243006429ebeb160bc1452353581e` to the inspected source reported ahead 71 / behind 0, so mergeability metadata and ancestry evidence require reconciliation. Do not invent a conflict resolution, force-push, retarget the PR or merge on the basis of the focused tests.

Next: reconcile the stacked functional PRs and their CI against the actual current refs without changing the separate e-sign implementation; then run the full repository checks and Firestore transaction/concurrency coverage before promotion.


---

## Follow-up — mirrored idempotency + real Firestore persistence gate

This section supersedes the earlier persistence/concurrency boundary for the follow-up code-bearing revision
`44b1ce1660eb71df581983a1c093a9e9a6b3982a`.

### Mirrored termination invariant

A termination is persisted as one logical fact mirrored across:
- `contract`
- its source `settlement_rows` intake
- append/audit evidence

Idempotent success no longer trusts the intake record alone. If either side already contains termination evidence, the contract and intake must agree on:
- terminated timestamp
- operation/idempotency id
- effective date
- reason
- contract status = `계약해지`

One-sided or mismatched legacy/manual state fails closed and requires data inspection instead of being silently overwritten.

### Firestore Emulator integration evidence

A dedicated GitHub Actions gate now runs the real `firebase-admin` repository against the Cloud Firestore Emulator:
- workflow: `.github/workflows/contract-persistence.yml`
- run: `36121701761`
- job: `firestore-contract-termination`
- Firebase CLI: `firebase-tools@15.30.2`
- Java: 21
- project id: `freepasserp5`
- production service-account credentials are not loaded in emulator mode

Result: **4 PASS / 0 FAIL**.

Verified cases:
1. two concurrent identical termination requests result in exactly one committed termination and one idempotent retry result;
2. two concurrent conflicting termination requests result in exactly one winner and one rejected request;
3. a forced immutable `contract_event` create collision rolls back contract, intake, and settlement-audit writes atomically;
4. one-sided partial termination state is rejected without repair/overwrite.

The general repository TypeScript gate at the same code revision reports no new contract/settlement diagnostics. It remains blocked only by the separately owned e-sign diagnostics already recorded on PR #102.

### Updated evidence status

- CODED: PASS for termination hardening.
- STATIC CHECKED: contract/settlement delta introduces no TypeScript diagnostic in full CI typecheck.
- TESTED: focused domain/adapter coverage PASS; Firestore integration 4/4 PASS.
- PERSISTENCE VERIFIED: **PASS for the tested Firestore Emulator transaction/concurrency/idempotency/rollback scenarios.**
- PRODUCTION PERSISTENCE VERIFIED: NOT VERIFIED; emulator evidence does not prove production IAM, network, quota or live data behavior.
- DEPLOYMENT VERIFIED: NOT VERIFIED.
- USER APPROVED: not claimed.
- No production data write, main merge, or deployment was performed.
