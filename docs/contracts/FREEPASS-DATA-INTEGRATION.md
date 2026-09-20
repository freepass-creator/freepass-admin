# FreePass Data Integration Contract — Admin

Status: PREPARED / SHADOW CUTOVER NOT ACTIVE
Date: 2026-09-21

## Goal

FreePass Admin이 앞으로 FreePass Data를 중앙 Catalog SSOT consumer로 사용해도 UI/Application/Settlement Domain을 다시 뜯지 않게 한다.

## Runtime split

Operational persistence:
- `FPA_REPOSITORY_MODE=file|erp5`

Catalog read source:
- `FPA_PRODUCT_SOURCE=file|erp5|freepass-data`

따라서 migration 중에는:

```text
Catalog read        -> FreePass Data
Application write   -> Admin ERP5 namespace
Performance write   -> Admin ERP5 namespace
Settlement write    -> Admin ERP5 namespace
```

가 가능하다.

## Data consumer contract

Required schema:
`freepass-data.admin-catalog/v1`

Target endpoint:
`GET /v1/views/admin-catalog/products`

Data-side contract PR:
`freepass-creator/freepass-data#8`

Admin adapter:
`src/adapters/freepass-data/product-repository.ts`

## Domain compatibility decisions

### Supplier
Supplier authority is selected-Offer level.
Legacy `product.supplierId` is fallback only.

### PriceTerm flattening
FreePass Data:
`Product -> Offer -> PriceTerm[]`

Admin runtime search:
`Product -> searchable Offer[]`

Admin may flatten each PriceTerm, but preserves:
- `sourceOfferId`
- `sourceOfferRevision`
- `sourcePriceTermKey`

Application Snapshot therefore remains reversible to the Data canonical Offer/PriceTerm.

### Deposit
Admin Offer preserves both:
- `deposit?: number`
- `depositState?: KNOWN | ZERO | UNKNOWN | NOT_APPLICABLE`

`UNKNOWN` and `NOT_APPLICABLE` must never become zero.

### Policy
Data cutover requires typed `policyValues`.
Admin must not read or reinterpret Data internal Policy documents after cutover.

## Shadow parity

Command:
`npm run admin:data-shadow`

Optional strict mode:
`FPA_DATA_SHADOW_STRICT=on npm run admin:data-shadow`

Comparator checks consumer semantics:
- product identity
- vehicle axes/specs
- plate/VIN
- supplier per Offer
- term
- monthly rent
- deposit + deposit state
- mileage
- effective policy values

Source-specific revisions/ids are intentionally not compared when they do not change consumer semantics.

## Cutover gate

Do not set production `FPA_PRODUCT_SOURCE=freepass-data` until all are true:

1. Data `admin-catalog/v1` ACTIVE Release exists
2. service authentication/IAM is active
3. Policy parity is complete
4. Shadow parity evidence is reviewed
5. release freshness is observable
6. rollback to ERP5 read is documented

Then:
`OBSERVE -> SHADOW_READ -> PARITY_VERIFIED -> DATA_GATEWAY_READ`

Operational command/write migration happens later and independently.

## Forbidden

- Admin direct access to FreePass Data Firestore collections
- Data endpoint URL hardcoded in UI
- Product read cutover automatically switching Application/Settlement writer
- converting unknown deposit to zero
- assuming Product has only one supplier
- dropping upstream Offer/PriceTerm provenance from Application Snapshot
