# FPERP-UI-P2-001 — 4-AI UI Review Packet

Status: **HOLD — user UI approval and named 4-AI review pending**

This packet fixes one shared review input for Claude Code, Codex, Cursor Agent, Gemini CLI, AI Core, AI Ops, and DevCenter. It does not authorize implementation, Firebase connection, merge, or deployment.

## Goal

Approve the fastest practical ADMIN workflow before implementation.

- Desktop: `Product List 1/3 | Product Detail 1/3 | Work Panel 1/3`
- Mobile: independent full-screen list/detail pairs, not a compressed desktop layout
- A list row opens its detail with one tap
- Back restores search, filters, sort, scroll, selected row, and the current finance tab
- Required intake items: exactly `vehicle selection`, `sales channel`, `assignee`, and `customer name`
- Vehicle and matched Offer are prefilled from product detail; sales channel and assignee are selected; product version, Policy, IDs, status, and timestamps are system-generated or read-only Snapshot

## Mobile screen map

1. `상품 목록 → 상품 상세 → 신규 접수`
2. `접수 목록 → 접수 상세`
3. `실적 목록 → 실적 상세`
4. `청구·지급 목록 → 건별 상세`

Mobile navigation invariants:

- Product-detail entry prefills the vehicle; direct new-application entry requires vehicle selection.
- Initial application intake contains only four required items: vehicle, sales channel, assignee, customer name.
- Sales channel and assignee may be prefilled from the signed-in user or recent value, but remain visible and editable.
- Save is idempotent; repeated taps cannot create duplicate applications.
- Performance is a read-oriented record derived from the application, not a second manual-entry document.
- Billing and payment share one menu but use separate `청구 | 지급` tabs; their rows and statuses are never mixed.
- Performance and finance details inherit the same application ID plus customer/vehicle Snapshot; employees do not re-enter them.
- Every list and detail must define loading, empty, error, and unauthorized states.

## Fixed source revisions

| Source | Revision |
|---|---|
| freepasserp.com project base commit | `7dc793f4fc6f1d5b53a119f1bc4c1e410794ae4c` |
| `AGENTS.md` blob | `35be38870e75eb3ceb7516b22bcff95d5dcc11f0` |
| `docs/MASTER-v1.md` blob | `290b040350b0dec56fc24cc09a78b5dd7d49a366` |
| AI Ops `docs/CONTROL_PLANE.md` blob | `3205dd17d093eee5606000e41b5d1d1b0a7d0389` |
| DevCenter `docs/BASELINE.md` blob | `2560955c0336842dc4143126f5f1e5be7cbdaca4` |
| DevCenter inspection policy blob | `31975569dd0b9151dc1275e95dc06f62addb72b2` |

Existing ERP assets are `REFERENCE_ONLY`. Automatic code, DB, Firebase, API, sheet, auth, environment, or fallback import is `FORBIDDEN`.

## Review images

| Review target | Repository path | SHA-256 |
|---|---|---|
| Desktop minimal application | `docs/ui/review-p2/admin-application-desktop.webp` | `b81ca8cc638792d7284f979d640dabcc742be164c8ea135ac11c36cccf883788` |
| Mobile product → application | `docs/ui/review-p2/mobile-product-application.webp` | `86c90350b4d9ee87aaa93b5dc9e67ef48282675793822d6b74ec0b844f797cb4` |
| Mobile application list → detail | `docs/ui/review-p2/mobile-application-list-detail.webp` | `11949f87bb447eb25cefdb99263ce60fc04bc0119610ee34053c7dd067402e07` |
| Mobile performance list → detail | `docs/ui/review-p2/mobile-performance-list-detail.webp` | `51774ffabd04d9062ca94ef07bc7179d49204ec20828519fc5f1f3dafcabd2c2` |
| Mobile billing/payment list → detail | `docs/ui/review-p2/mobile-billing-payment-list-detail.webp` | `f44c540656c18b762cb0d5e0c698ef3cc31ff0090978e180f5ddf8f540bab65e` |

The performance and billing/payment images validate information architecture only. Performance recognition rules, amount formulas, taxes, fees, settlement cycles, approval levels, and edit permissions remain undecided and must not be inferred from sample values.

## Performance intent

1. After selecting a product, no repeated product/condition entry.
2. Intake order: vehicle selection → sales channel → assignee → customer name → save. Product-flow entry prefills the vehicle.
3. Save is idempotent; repeated taps cannot create duplicate applications.
4. Successful save opens the created application detail immediately.
5. Application detail shows `접수 당시 조건 / Snapshot`, not mutable current-product values.
6. The detail page emphasizes one next action; cancellation is separate.
7. Mobile back navigation preserves the exact list context.
8. Error, saving, save-failed, duplicate-warning, and unsaved-exit states require a behavior table or clickable prototype because a static image cannot prove them.

## Current conflicts / required decisions

- `MASTER-v1.md` says double-click to open application detail. The user's latest instruction says click/tap. Latest user instruction wins; the document change must record reason and impact after approval.
- Physical Firebase project, Auth, region, Rules, indexes, and writer boundary remain undecided.
- Current Application Snapshot lacks required `productVersionId`; nested Policy arrays are not fully cloned.
- The repository currently has only `dev`, `build`, `start`, and `typecheck` scripts. Do not claim lint/test/e2e/performance evidence before those checks exist.
- The rejected `ERP5` name must not appear in new task IDs or UI copy.
- The four required intake items are vehicle selection, sales channel, assignee, and customer name. Phone is not a required intake field.
- `청구·지급 목록 → 건별 상세` is the current interpretation of the user's latest message; finance policy and action controls remain unapproved.

## Named independent reviews

Each reviewer must inspect this same branch commit and all five image SHA-256 values before responding. First reviews are independent.

| Role | Required output | Status |
|---|---|---|
| Claude Code / PM | scope, conflicts, counterexamples, gate | PENDING |
| Codex | implementation feasibility, reproduction, integration evidence | PENDING |
| Cursor Agent | reusable assets, actual consumption paths, static/regression gaps | PENDING |
| Gemini CLI | data/reference/copy ownership and duplication | PENDING |

Required response fields:

`reviewer_product / reviewer_version / reviewed_commit / reviewed_image_hashes / scope / findings / counterexample / verdict(APPROVE|CHANGES_REQUIRED|HOLD)`

Internal advisory agents are not evidence for Claude Code, Cursor Agent, or Gemini CLI.

## AI Core

Current applicable Core result remains:

- status: `HOLD`
- reason: `EVIDENCE_MISSING`
- `execution_authorized: false`

AI Core resolves pointers, revisions, conflicts, and gates. It does not approve, merge, deploy, or replace the user.

## Provisional acceptance targets

- Required intake items: exactly 4 — vehicle selection, sales channel, assignee, customer name
- Product-detail entry → save: vehicle prefilled; select sales channel and assignee, enter customer name; no repeated product/Offer condition entry
- Median application completion time: ≤ 30 seconds in employee pilot
- Back-state restoration: 100% across product, application, performance, and billing/payment
- Duplicate save under repeated tap/retry: 0 duplicates
- Matched Offer continuity: 100% across list/detail/application
- Snapshot invariance after product change: 100%
- Panel transition p95: ≤ 200 ms
- Search/filter response p95: ≤ 500 ms
- LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms under a fixed test profile
- Required application/state transition console and request errors: 0

These are provisional gates. They may be changed only with measured evidence and the change reason; they are not proof of current performance.

## Gate

`User latest instruction / approved source > reproducible test > execution log > AI opinion`.

Missing named reviewer, different reviewed revision, unresolved high-impact conflict, or missing user UI approval keeps the task at `HOLD`.
