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


---

## Implementation follow-up — parity phase 1

Implemented on the Admin branch after this review:

- Added explicit separation between:
  - current vehicle mileage: Product/Vehicle fact
  - annual contracted mileage: Offer fact
- Kept the existing Admin URL axis `mile` as annual contracted mileage for backward compatibility.
- Added `vmile` as current vehicle mileage instead of silently changing the meaning of old URLs.
- Natural search now distinguishes:
  - `연 2만km` → annual contracted mileage
  - `주행 5만km`, `5만km 이하` → current vehicle mileage
- Added common finder facts to Domain Search Contract:
  - product kind
  - credit/review condition
  - model year
  - fuel
  - current vehicle mileage
- Added Admin facets already present in White Label semantics:
  - manufacturer
  - model year
  - credit/review condition
  - current vehicle mileage
- Ported White Label's exact customer vehicle-class projection:
  - 승용
  - SUV
  - 승합
  - 화물·픽업
- Ambiguous detailed class values are left unclassified rather than guessed.

Current remaining parity gaps:
1. sorting choices/semantics;
2. one structural finder engine instead of overlapping Admin workspace logic + Domain Search logic;
3. model/submodel/trim navigation exposure in Admin filter UI;
4. parity fixtures that can be replayed against both deployed surfaces from the same canonical snapshot.

Do not solve the remaining gaps by copying another independent filtering implementation.


---

## Implementation follow-up — parity phase 2

The Admin product workspace no longer owns a second product-filtering engine.

New authoritative runtime:
- `src/domain/search/match-product.ts` — canonical Search Contract primitives
- `src/domain/search/finder.ts` — surface-facing Finder selection, bands, cross-facet skip-axis, exact limits and sorting
- `src/app/products/workspace-config.ts` — URL/natural-language parsing + labels only
- `src/app/products/workspace.tsx` — projection/rendering only

Removed from the workspace path:
- local product-axis match table
- local Offer-axis match table
- local same-Offer filtering loop
- local free-text result filtering
- local exact-limit filtering

The Admin workspace now calls `findProducts()` for both visible results and per-axis cross counts.

### Sorting parity

Common sort meanings now live in Domain Finder:
- popular
- lower/higher matched monthly rent
- lower matched deposit
- newer model year
- shorter current vehicle mileage
- more inventory of the same manufacturer+model

Admin keeps its existing operational default (delivery status first), but selecting one of the common keys uses the same meaning as White Label.

### Vehicle hierarchy

Added confirmed `model` facet in addition to manufacturer.

Important non-shortcut:
- sub-model and trim are **not** exposed as global flat facets yet.
- Search Contract intentionally allows a MODEL-confirmed product to remain PARTIAL when a deeper sub-model/trim is queried.
- A flat global sub-model filter without parent model context can therefore make unrelated MODEL-only inventory appear as partial candidates.
- Next implementation must preserve manufacturer → model → sub-model → trim context instead of guessing.

This is an intentional safety boundary, not a missing checkbox.
