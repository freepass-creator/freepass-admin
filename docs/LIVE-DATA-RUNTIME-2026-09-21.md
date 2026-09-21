# FreePass Admin Live Data Runtime — 2026-09-21

Status: **LIVE DATA CODED / DEPLOYMENT ENV REQUIRED**

## Actual screen chain

```
/intake
  ├ Product list       -> Erp5ProductRepository -> Firestore products
  ├ Product detail     -> same Canonical Product + matched Offers
  └ Work panel
       ├ Intake list   -> Erp5SettlementRepository -> settlement_rows
       ├ New intake    -> createIntakeAction -> settlement_rows + settlement_events
       └ Intake detail -> settlement_rows + lifecycle/progress/money actions

/settlement
  ├ Claim/Pay groups   -> settlement_rows + settlement_clawbacks
  ├ Performance lines -> derived ledgers from same rows
  └ Intake detail     -> same IntakeDetailPanel
       ├ confirm/correct
       ├ collect/pay
       ├ hold
       ├ bill month
       ├ tax invoice state
       └ clawback

/esign
  ├ Contract list      -> Erp5ContractRepository -> contract
  └ Contract detail    -> same contract document projection
```

No runtime mock/fixture fallback is permitted on these routes.

## Required deployment environment

Read:
- `ERP5_FIREBASE_SERVICE_ACCOUNT_JSON` for hosted runtime, or
- `ERP5_SERVICE_ACCOUNT_PATH` for local development.

The credential must have `project_id=freepasserp5`. A different Firebase project fails closed.

Write:
- `ERP5_WRITE=on`

Without it, read screens work but all ERP5 writes fail closed with a visible error.

Optional:
- `CLAIM_LINK_BASE` for external claim/confirmation links.

## Runtime proof

Internal admin route:
- `/system/data-status`

It probes:
- products
- settlement_rows
- settlement_clawbacks
- contract

and shows real repository counts or exact read errors.

Admin chrome also displays:
- ERP5 project
- read credential state
- write gate state

## Regression guard

`npm run data:check`

It fails if:
- products route stops calling `productList()`
- intake stops calling `settlements.list()`
- settlement stops using rows/clawbacks/invoices
- esign stops using `contracts.list()`
- server repository instances stop being ERP5 adapters
- runtime fake arrays are reintroduced into core routes
- ERP5 write gate disappears

## Current remaining runtime blocker

There is no connected Vercel project in the current team, and the available deployment connector cannot create/deploy a new project from this chat session.

Therefore production/preview runtime still needs a host with the environment above. This does **not** block the code/data wiring work in this repository.
