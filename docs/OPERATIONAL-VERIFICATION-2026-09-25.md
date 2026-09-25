# Admin operational integration verification — 2026-09-25

## Single operating candidate

PR #106: `release/admin-operational-20260925`.
UI #96, workflow stack through #102, Claude e-contract #104, fixture privacy #105 were merged without rewriting their source branches. Temporary assembly and dependency-bootstrap workflows were removed after use. Catalog authority remains FreePass Data; Admin owns workflow composition. Catalog mode OBSERVE is the explicit transitional read-only legacy bridge, not final Data cutover.

## Inspected baseline evidence

Exact revision `78d187cffadc1a782b07426443cb6867ced65435`, operational run 36135213725; all three downloaded artifacts name and record this exact SHA:
- Typecheck PASS; full test suite 561/561, zero skipped/failed; UI and Data checks PASS; production build PASS.
- Isolated Firestore tests 7/7, zero skipped/failed; idempotent intake, competing Offer conflict, missing snapshot rejection, concurrent termination, audit rollback and partial-state protection.
- Real Chromium final PDF + private Storage emulator: competing approvals have one winner; independent read-back hash matches; retry does not rewrite the PDF; same sealed input reproduces the PDF; cancellation during rendering cannot finish signing. E2E EMULATOR OK.
- Actual Next production runtime (NO production data): 35/35 checks, protected-route auth/error/retry boundaries, 390/1440px; no external browser requests.
- Isolated actual-component UI browser: 24 layout cases + 2 interactions; filter browser: 5 widths. Receipts report failed=false and zero external requests. Representative 390px and 1440px screenshots were visually inspected.

These are not real-account login, live Firestore IAM, customer-contract acceptance or Galaxy hardware evidence.

## Invalid earlier badge

Run 36134238491 was not a passing release receipt despite a green badge: raw logs contained type errors, 560/561 tests and a failed build. The replacement workflow explicitly uses Bash pipefail and probes failure propagation. Do not cite that old run as PASS.

## Dependency closeout and final recheck

The separate baseline audit run 36135217991 found high 6 / moderate 2 / critical 0. This prevented release promotion despite functional PASS. No exception was added.

Dependency correction commit `1045d929380652c749c8ef65a769f6d9ab7cbabf` uses exact puppeteer-core 25.1.0 + @sparticuz/chromium 149.0.0, the upstream Chrome 149.0.7827.22 pairing, and compatible transitive refresh. Refer to the final exact-revision audit rather than assuming the baseline lock remains valid. npm ci and generated PDF fonts are required before renderer tests.

The audit validator now rejects missing/errored/malformed/inconsistent reports; ten validator regression cases preserve the existing reviewed gaxios/uuid moderate exceptions without widening them. An unavailable audit service must not produce a clean result.

FINAL SAME-REVISION CHECK: PENDING for the commit containing this checkpoint. Its CI must cover complete tests/build, the new dependency lock, Firestore/Storage PDF emulator and browser receipts before promotion. Baseline PASS does not automatically apply to new dependencies.

## Operational activation still unverified

The connected Vercel team listed zero projects; the exposed deploy action failed schema validation. Presence-only repository checks found no Vercel token/project/org, ERP5 credential, session secret or complete Google OAuth pair in that checked context. Other accounts/environments are not ruled out. No secrets were read or copied, no real customer/financial record was changed, and no live deployment URL was established.

Use `.env.example` and `docs/OPERATIONS-FIRST-USE.md`: bind the correct approved Admin deployment and authentication/Data environment; start read-only; verify accounts and live read-back before enabling operational writes. Mixed-clawback allocation remains guarded; external tax-invoice issuance and bank transfers are not automatically certified by a ledger record. Keep these explicit scope limits during first use.
