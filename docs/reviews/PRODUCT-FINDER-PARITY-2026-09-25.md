# Product Finder Parity Review — 2026-09-25

Status: REVIEW EVIDENCE / latest business meaning is owned by `docs/WORK-INBOX.md` and `docs/DECISIONS.md`.

## User-confirmed target

White Label product search is the outward-facing form of Admin product search. The two surfaces may differ in visibility and administrator-only controls, but they should not own different meanings for the same customer product condition.

Target:

```text
ERP5 Canonical Product / Offer / Policy
          ↓
Common Product Finder Contract
      ↙                 ↘
Admin Finder         White Label Finder
+ internal axes      + brand/customer projection
```

## Compared sources

White Label / ERP4:
- `lib/shop/query.ts`
- `components/shop/ShopFilters.tsx`
- `components/shop/ShopFilterSheet.tsx`
- `app/(shop)/shop/ShopView.tsx`
- `lib/server/whitelabel-erp5-catalog.ts`

Admin:
- `src/app/products/workspace.tsx`
- `src/app/products/workspace-config.ts`
- `src/app/_design/FilterSheet.tsx`
- `src/domain/search/search-products.ts`
- `src/domain/search/match-product.ts`
- `src/domain/search/types.ts`
- `src/adapters/erp5/product-repository.ts`

## Already aligned

| Meaning | White Label | Admin | Result |
| --- | --- | --- | --- |
| same-axis multi-select | OR | OR | aligned |
| different axes | AND | AND | aligned |
| price conditions | same price row | same Offer | aligned |
| matched price/Offer continuity | selected price row drives card | matched Offer drives detail/intake | aligned in principle |
| filter state | URL | URL | aligned |
| facet counts | cross-count with current axis omitted | cross-count with current axis omitted | aligned |
| unknown deposit | not treated as zero | not treated as zero | aligned |
| source | ERP5 canonical products/policy | ERP5 canonical products/policy | same source family |

These are the important semantic invariants. They should move toward one reusable contract instead of remaining duplicated implementations.

## Current functional drift

### 1. `mile` means different things

White Label `mile`:
- current/actual vehicle mileage
- source: vehicle fact

Admin `mile`:
- annual contract mileage `Offer.annualMileageKm`
- source: Offer condition

This is not a cosmetic difference. A single axis name currently represents two different facts. They must be separated before commonization, for example:
- vehicle mileage
- annual contracted mileage

Do not silently reinterpret existing URLs.

### 2. Customer-facing axes are not at parity

White Label currently includes customer search axes such as:
- broad vehicle category
- product type
- vehicle class
- manufacturer
- term
- monthly rent
- deposit
- credit/review condition
- model year
- actual mileage
- fuel
- perks

Admin currently exposes:
- delivery status
- product kind
- perk
- term
- monthly rent
- deposit
- annual contracted mileage
- supplier
- vehicle class
- fuel

Admin-only `delivery status` and `supplier` are legitimate internal extensions. The missing customer axes are parity gaps, not reasons to fork search meaning.

### 3. Sorting is different

White Label has explicit sort meanings including:
- popularity
- lower/higher monthly rent
- lower deposit
- newer model year
- shorter mileage
- more units of same model

Admin currently prioritizes delivery status and then lower matched Offer rent.

Admin may have an internal default ordering, but when it exposes the same sorting choice as White Label the meaning should be shared.

### 4. Filter-sheet behavior is not currently identical

The Admin detailed filter was copied from the White Label concept, but implementation behavior has diverged. White Label mobile filter currently has a draft + explicit `N대 보기` apply step. Admin currently mutates URL conditions immediately.

This is a surface interaction difference, not necessarily a search-engine difference. It should be decided in UI/UX authority, while the underlying filter result must remain identical for the same committed selection.

### 5. Separate implementations can drift again

White Label `lib/shop/query.ts` and Admin `workspace.tsx/workspace-config.ts` independently encode overlapping search rules. The current overlap is strong, but there is no structural guarantee that a future fix lands in both.

## Recommended convergence

1. Define one canonical finder query/result contract over Canonical Product + Offer + Policy.
2. Keep customer-visible axes and Offer semantics in that common contract.
3. Add Admin-only axes as an extension layer, not a second search engine.
4. Separate actual vehicle mileage from annual contracted mileage.
5. Add parity fixtures: the same canonical fixture + same committed filters must produce the same product ids and matched Offer ids on both surfaces.
6. Keep brand, layout, quick-filter presets and internal diagnostic fields outside the common semantic contract.

## Workflow context

The finder is the front of the Admin workflow, not the Admin's final purpose:

```text
Product Finder
→ Intake
→ Performance
→ Supplier Claim / Collection
→ Sales-channel Pay
```

Pre-delivery cancellation ends the intake. Post-delivery termination creates a clawback review target; it does not rewrite historical claim/pay facts and does not automatically calculate a clawback amount.
