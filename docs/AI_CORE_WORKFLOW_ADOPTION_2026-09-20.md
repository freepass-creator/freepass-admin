# AI Core Workflow Adoption — FreePass Admin — 2026-09-20

Status: **D SHADOW BINDING / SOURCE-SIDE PARITY**

AI Core authority:
`freepass-creator/ai-core@d47c25a596b7185f2dcb81cc2e88566fd4d7bd45`

Bound contracts:

- workflow: `freepass-admin.application-lifecycle@0.1.0`
- derived projection: `freepass-admin.application.status@0.1.0`

## Authority boundary

This project does **not** route writes through the AI Core Workflow Engine yet.

FreePass Admin domain code remains runtime authority:

- `src/domain/application/update-progress.ts`
- `src/services/applications.ts`

The D binding is SHADOW and checks that the Core model reproduces the source semantics.

## Local mapping

Authoritative lifecycle:

- any non-cancelled application -> `ACTIVE`
- cancelled application -> `CANCELLED`

Facts:

- contractCompleted -> `application.contract-completed`
- documentsCompleted -> `application.documents-completed`
- balanceCompleted -> `application.balance-completed`
- deliveryCompleted -> `application.delivery-completed`
- cancellationReason -> `application.cancellation-reason`

Derived status precedence:

1. CANCELLED
2. DELIVERED
3. CONTRACTED
4. RECEIVED

Documents and balance remain facts and intentionally do not advance status.

## CI proof

`src/adapters/ai-core/__tests__/workflow-shadow.test.ts` runs the real Application Service paths and checks the D shadow after:

- submit
- documents progress
- balance progress
- contract completion
- delivery completion
- cancellation
- cancelled mutation rejection

A mismatch throws `AI_CORE_WORKFLOW_SHADOW_DRIFT`.

## Promotion rule

This source-side parity evidence upgrades the integration from “Core-only source analysis” to “project-side SHADOW consumer”.

It does **not** make D the runtime authority.

Promotion beyond SHADOW requires:

1. an approved runtime binding path from Admin use cases to the D decision contract;
2. stable error mapping during cutover;
3. persistence/audit atomicity preserved;
4. rollback path;
5. exact-revision CI and runtime evidence.
