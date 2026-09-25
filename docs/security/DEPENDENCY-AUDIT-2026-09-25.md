# Dependency security audit — 2026-09-25

## Status

PR #96 dependency gate: **HIGH / CRITICAL CLEARED; 2 REVIEWED MODERATE TRANSITIVE FINDINGS REMAIN.**

This document records a temporary risk disposition, not a statement that the remaining advisories are fixed or harmless.

## Baseline

Observed on Next.js 16.1.6 using both full and production-only `npm audit`:

- moderate: 2
- high: 2
- critical: 1
- total: 5

Affected package nodes were `next`, `postcss`, `sharp`, `gaxios`, and `uuid`.

Baseline audit run: https://github.com/freepass-creator/freepass-admin/actions/runs/36120618137

## Applied upgrade

`next` was upgraded from **16.1.6 → 16.3.6** using the exact candidate produced by the dependency-upgrade probe.

The candidate passed before application:

- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run ui:check`
- `npm run data:check`
- `npm run build`

Probe run: https://github.com/freepass-creator/freepass-admin/actions/runs/36120811496

The resulting lock resolves:

- Next.js: 16.3.6
- PostCSS: 8.5.23
- sharp: 0.35.4

The critical/high findings from the baseline are no longer present in the candidate production audit.

## Applied-state verification

Verified repository HEAD: `ffda8f8da2d34d8c22afc711d333b76cc8cd8351`.

On that actual branch state:

- CI: PASS
- tests: PASS
- UI SSOT: PASS
- live data wiring: PASS
- backend production build: PASS
- UI browser geometry/interactions: PASS
- production dependency audit gate: PASS

Final production audit counts:

- info: 0
- low: 0
- moderate: 2
- high: 0
- critical: 0
- total: 2

Permanent audit run: https://github.com/freepass-creator/freepass-admin/actions/runs/36121662346

Audit artifact:
- ID: `10858426524`
- name: `dependency-audit-ffda8f8da2d34d8c22afc711d333b76cc8cd8351`
- SHA-256: `0973a2a0f8305fdd5e2c7249fa6af2679df58f062ca5d0afe334c5a8ce8aa669`
- expires: 2026-10-02

The permanent gate accepted exactly the two reviewed temporary findings: `gaxios` and `uuid`.


## Remaining reviewed findings

### 1. gaxios 6.7.1 — moderate, transitive

Production dependency path:

`firebase-admin 14.4.0 → @google-cloud/storage 8.1.0 → gaxios 6.7.1`

Storage is genuinely reachable in this repository: `src/adapters/erp5/esign-repository.ts` uses `firebase-admin/storage` to save/download e-sign assets.

The project does **not** force a newer gaxios major outside `@google-cloud/storage`'s declared `gaxios ^6.0.2` range. A forced major override would move compatibility risk into a storage/auth path and is not justified merely to obtain an empty audit report.

### 2. uuid 9.0.1 — moderate, transitive

Dependency path:

`@google-cloud/storage 8.1.0 → gaxios 6.7.1 → uuid 9.0.1`

Advisory: GHSA-w5hq-g745-h8pq.

The advisory concerns missing buffer bounds checks in uuid **v3/v5/v6 when an output buffer is supplied**. Source inspection of tagged upstream `googleapis/gaxios v6.7.1` shows that it imports `v4` and calls `v4()` only to generate a multipart boundary. No v3/v5/v6 call or caller-provided uuid output buffer was found in that code path.

This lowers observed reachability for the specific uuid advisory through gaxios; it does **not** remove the vulnerable package from the production dependency tree.

Upstream source inspected:
- https://github.com/googleapis/gaxios/blob/v6.7.1/src/gaxios.ts
- https://github.com/googleapis/gaxios/blob/v6.7.1/package.json

## Machine gate

Permanent workflow: `.github/workflows/dependency-audit.yml`

Parser/gate: `scripts/check-dependency-audit.mjs`

Policy:

1. Any new vulnerability package is a failure.
2. Any change in severity, affected range, direct/transitive status, or advisory path for the reviewed exceptions is a failure.
3. The two reviewed findings may disappear without failing the gate.
4. The only currently accepted findings are:
   - `gaxios`: moderate, transitive, range `6.4.0 - 6.7.1`, via uuid
   - `uuid`: moderate, transitive, range `<11.1.1`, advisory GHSA-w5hq-g745-h8pq
5. High/critical findings are therefore not accepted by construction.

## Re-review triggers

Re-review this exception when any of the following occurs:

- `firebase-admin` changes its Storage dependency;
- `@google-cloud/storage` moves off the gaxios 6.x line;
- gaxios changes its uuid use;
- npm/GitHub advisory metadata changes;
- package-lock changes;
- before production deployment if the exception still exists.

Do not label the repository “zero vulnerabilities” while these two findings remain.
