# FreePass Admin Live Data Runtime — 2026-09-25 authority correction

Status: **FREEPASS DATA CONSUMER BOUNDARY CODED / ADMIN CATALOG CUTOVER HOLD**

## Authority

상품 Catalog의 정본 권한은 **FreePass Data**다.

현재 FreePass Data 중앙 스위치보드 기준 Admin Catalog 단계는 **OBSERVE**이며,
Admin 전용 consumer contract, non-empty ACTIVE Release, policy parity, 인증/운영 persistence 증거가
모두 준비되기 전에는 `FREEPASS_DATA_READ`를 활성화하지 않는다.

현재 `freepasserp5` 상품 read는 **legacy bridge**다. Firestore `products/policy` collection shape는
Admin public contract가 아니며 UI/use case가 직접 의존하지 않는다.

## Actual screen chain

```
/products + /intake product panels
  -> AdminCatalogReader (authority: FreePass Data)
      -> OBSERVE
          -> Legacy ERP5 product bridge (temporary read-only)
      -> SHADOW_READ / PARITY_VERIFIED / FREEPASS_DATA_READ
          -> HOLD until Admin-specific FreePass Data contract exists

/intake workflow
  -> Erp5SettlementRepository -> settlement_rows + events

/settlement workflow
  -> Erp5SettlementRepository -> rows/clawbacks/invoices/cash events

/esign
  -> Erp5ContractRepository + EsignService -> contract/session/private/assets
```

Catalog read cutover and Admin workflow persistence/writer cutover are separate operations.

## Read-mode switch

```bash
FREEPASS_DATA_ADMIN_CATALOG_READ_MODE=OBSERVE
```

Allowed values:
- `LEGACY_DIRECT`
- `OBSERVE` — current default
- `SHADOW_READ`
- `PARITY_VERIFIED`
- `FREEPASS_DATA_READ`

Unknown values fail. Until the real Admin consumer adapter exists, requesting SHADOW_READ or later also fails
instead of silently returning legacy data and pretending the requested stage is active.

This follows the central FreePass Data switchboard:
`LEGACY_DIRECT -> OBSERVE -> SHADOW_READ -> PARITY_VERIFIED -> FREEPASS_DATA_READ`.

## Transitional physical binding

The legacy Catalog bridge and current Admin workflow adapters use the `freepasserp5` Firebase project.

Read credential:
- `ERP5_FIREBASE_SERVICE_ACCOUNT_JSON`, or
- `ERP5_SERVICE_ACCOUNT_PATH`

Write gate for Admin workflow adapters:
- `ERP5_WRITE=on`

These keys do **not** make freepasserp5 the Catalog authority.

## Runtime proof

Internal route: `/system/data-status`

It reports separately:
- data authority: FreePass Data
- Admin Catalog read mode
- current Catalog serving path (legacy bridge vs FreePass Data)
- Catalog HOLD reasons
- transitional Firebase project/credential state
- Admin workflow write gate
- product/intake/clawback/cash/contract read probes

## Regression guard

`npm run data:check`

It fails if:
- product workspace bypasses `server/freepass-data`
- Catalog server loses `AdminCatalogReader`
- current switch key diverges from `FREEPASS_DATA_ADMIN_CATALOG_READ_MODE`
- premature post-OBSERVE modes silently fallback to ERP5
- ERP5 workflow server again owns the Product reader
- intake/settlement/e-sign live wiring disappears
- runtime fake arrays are introduced

## Current HOLD

FreePass Data currently records:
- FreePass Admin Catalog: **OBSERVE**
- Admin Catalog read cutover: HOLD
- Admin-specific projection/contract: not active
- policy parity / auth / operational persistence evidence: incomplete
- current Canonical ACTIVE Catalog release: not available for Admin cutover

Therefore this repository must not claim `FREEPASS_DATA_READ` or production Catalog cutover yet.

The next cross-repository step belongs first in `freepass-creator/freepass-data`: complete the Admin-specific
Catalog consumer contract/release evidence. After that, this repository can add the server-side FreePass Data adapter,
run SHADOW_READ parity while still returning the legacy result, and only then advance the read switch.
