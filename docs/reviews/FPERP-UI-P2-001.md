# FPERP-UI-P2-001 — 4-AI UI Review Packet

Status: **HOLD — user UI approval and named 4-AI review pending**

This packet fixes one shared review input for Claude Code, Codex, Cursor Agent, Gemini CLI, AI Core, AI Ops, and DevCenter. It does not authorize implementation, Firebase connection, merge, or deployment.

## Goal

Approve the fastest practical ADMIN product-to-application workflow before implementation.

- Desktop: `Product List 1/3 | Product Detail 1/3 | Work Panel 1/3`
- Mobile: `LIST → DETAIL → WORK`
- Application list row: one click/tap opens application detail
- Back: restore search, filters, sort, scroll, and selected row
- Employee manual input: exactly `customer name` and `phone`
- Product, matched Offer, Policy, product version, IDs, status, timestamps, and source/channel: system-generated or read-only Snapshot

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
| Desktop minimal application | `docs/ui/review-p2/admin-application-desktop.webp` | `dc52dceb2be548c7a7e6c0458e22b57f02937b4b3ed7291585cd53b6309852d9` |
| Mobile product → application | `docs/ui/review-p2/mobile-product-application.webp` | `7c27c321d63795a13a6870e2ba7d54ab74035caf1b9e4161b0bc7f3dbeb08c5a` |
| Mobile application list → detail | `docs/ui/review-p2/mobile-application-list-detail.webp` | `11949f87bb447eb25cefdb99263ce60fc04bc0119610ee34053c7dd067402e07` |

## Performance intent

1. After selecting a product, no repeated product/condition entry.
2. Keyboard order: customer name → phone → save.
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

## Named independent reviews

Each reviewer must inspect this same branch commit and the three image SHA-256 values before responding. First reviews are independent.

| Role | Required output | Status |
|---|---|---|
| Claude Code / PM | scope, conflicts, counterexamples, gate | PENDING |
| Codex | implementation feasibility, reproduction, integration evidence | PENDING |
| Cursor Agent | reusable assets, actual consumption paths, static/regression gaps | PENDING |
| Gemini CLI | data/reference/copy ownership and duplication | PENDING |

Required response fields:

`reviewer_product / reviewer_version / reviewed_commit / reviewed_image_hashes / scope / findings / counterexample / verdict(APPROVE|CHANGES_REQUIRED|HOLD)`

A Codex sub-agent is not evidence for Claude Code, Cursor Agent, or Gemini CLI.

## AI Core

Current applicable Core result remains:

- status: `HOLD`
- reason: `EVIDENCE_MISSING`
- `execution_authorized: false`

AI Core resolves pointers, revisions, conflicts, and gates. It does not approve, merge, deploy, or replace the user.

## Provisional acceptance targets

- Manual fields: exactly 2
- Product selection → save: no extra selection after product/Offer choice
- Median application completion time: ≤ 30 seconds in employee pilot
- Back-state restoration: 100%
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
