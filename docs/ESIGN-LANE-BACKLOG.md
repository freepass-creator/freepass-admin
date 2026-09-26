# E-sign Lane Salvage Backlog

This file records useful behavior found during the final audit of retired historical branches. Historical branches are not canonical and must not be resurrected or merged wholesale.

## Source: historical PR #103

PR #103 was a combined verification lane and was intentionally not merged. Most of its renderer/finalization checks are already present in `work/esign`, including complete-PDF validation, Storage hash/read-back validation, required signature/document checks, deterministic PDF handling, and finalization transaction guards.

The following #103 hardening is **not fully represented in the current `work/esign` implementation** and must be selectively replayed with current architecture/tests:

### E1 — Atomic issue boundary
Historical #103 replaced the three-step:
`createSession -> updateContract -> appendEvent`
with one repository-level `issueSession(...)` transaction.

Current `work/esign` still performs those three writes separately. Rebuild an atomic issue boundary so a session cannot exist while the contract/event state is only partially updated.

### E2 — CAS transitions for public open/progress
Historical #103 used `transitionSession` for:
- sent -> opened
- sent/opened/in_progress/rejected -> in_progress

Current `work/esign` still uses unconditional `updateSession` in these paths. Reapply compare-and-set semantics so concurrent/revoked state changes cannot be overwritten by a stale request.

### E3 — Public document revoked/expiry guard
Historical #103 explicitly blocked `publicDocument(token)` for revoked or expired pre-sign sessions.

Current `publicView` checks revocation/expiry, but `publicDocument` does not perform the same guard before returning draft HTML. Apply one shared link-validity rule to both surfaces.

### E4 — Cancellation / e-sign claim coordination
Historical #103 proved:
- fresh `approving` / `submitting` claims block cancellation,
- stale claims may be recovered,
- a cancellation retry repairs an accidentally still-active signing session,
- stale e-sign writes cannot revive a cancelled contract.

This crosses the `work/function` and `work/esign` ownership boundary. Implement only after defining the integration contract between ContractLifecycle and E-sign; do not create a bridge branch.

## Already recovered / no action required

- Complete PDF bytes validation.
- Storage upload hash and read-back verification.
- Missing verified signature fail-closed.
- Missing required document fail-closed.
- Admin asset SHA verification.
- Finalization claim ownership release guard.
- Contract/intake link validation.
- Cancellation reason drift rejection is already enforced in the current contract cancellation domain.

## Rule

Replay behavior and regression tests only. Do not merge PR #103 or any historical branch wholesale.
