# FreePass Admin Branch Lanes

## Canonical rule

`main` is the only source of truth. Development uses exactly three reusable work lanes. Do not create child branches for normal AI-driven development.

| Lane | Branch | Owns |
|---|---|---|
| Function | `work/function` | Product/search, intake, contract state, delivery, performance, billing/collection/payout, settlement, auth/actor/audit, Admin-side FreePass Data integration |
| UI/UX | `work/uiux` | UI + UX together: layout, responsive behavior, components, typography, spacing, visual states, accessibility, interaction presentation |
| E-sign | `work/esign` | Electronic contract domain, signing, finalization, PDF rendering/sealing, private document storage and e-sign verification |

## Session assignment

Every new coding chat/session must begin with one explicit assignment:

- `너는 work/function 담당. 새 브랜치 만들지 말고 이 브랜치만 계속 고도화해.`
- `너는 work/uiux 담당. 새 브랜치 만들지 말고 UI/UX만 이 브랜치에서 고도화해.`
- `너는 work/esign 담당. 새 브랜치 만들지 말고 전자계약만 이 브랜치에서 고도화해.`

If no lane is assigned, do not start code changes.

## Meaning of “고도화”

“고도화”, “다음”, “계속”, “오류 잡아”, “더 개선해” means continue on the currently assigned fixed lane. It never authorizes creating a new feature/fix/model-specific branch.

## Merge cycle

1. Start from the assigned fixed lane.
2. Sync/reconcile with latest `main` before substantial work.
3. Keep all work for that concern on the same lane.
4. Validate.
5. Merge the lane PR to `main`.
6. Reset/sync that same fixed lane to latest `main`.
7. Continue the next cycle on the same lane name.

## Boundary rule

- UI/UX does not change business rules.
- Function does not invent visual design authority.
- E-sign stays isolated from general Admin runtime unless an explicit integration decision is made.
- Cross-lane dependency: merge the owning lane to `main` first, then sync the dependent lane. Do not create a bridge branch.

## Historical migration

The former hold branch `feat/intake-contract-condition-choices-20260923` was retired. Its unmerged functional intent was copied into `work/function/docs/FUNCTION-LANE-BACKLOG.md` for selective implementation against the current architecture.
