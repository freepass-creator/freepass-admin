# FreePass Admin Existing UI → AI Core Adoption Map

Date: 2026-09-21
Status: **EXISTING USER-APPROVED UI IS THE VISUAL SOURCE OF TRUTH**

## Rule

AI Core does **not** redesign FreePass Admin.

The existing FreePass Admin UI remains the source of truth:

- `docs/ui/UI-SPEC.md`
- `docs/ui/PRODUCT-EXPERIENCE-PRINCIPLES.md`
- `docs/ui/mockups/admin-shell.html`
- `docs/ui/mockups/admin-shell.app.js`
- `docs/ui/mockups/admin-shell.data.js`
- `docs/ui/mockups/admin-shell.mobile.js`

AI Core is applied by mapping existing behavior/components to canonical feature IDs.
Visual layout, density, mobile flow, button placement and task language are not replaced merely to resemble a generic design system.

## Existing UI → AI Core

| Existing FreePass UI | Existing selector/module | AI Core feature | Adoption rule |
|---|---|---|---|
| PC search field | `.fd` | `form.search` | preserve existing 250/190 search width and token row |
| Product search + conditions | `.bar`, search parser, tokens | `data.search-discovery` | existing search + detailed filter behavior is canonical consumer |
| Detailed filter sheet | existing sheet UI | `data.filter` | keep axis/value two-column interaction and immediate apply |
| Product/Offer direct choice | Offer rows / `.mopt` | `data.variant-selector` | source-derived Offer/term only; no fabricated fixed periods |
| PC list tables | `table.g` | `data.table` | keep 34px rows, fixed header, numeric alignment |
| Mobile list rows | `.mrow` | `data.list` | keep 64px touch row and full-row tap |
| Product/detail view | detail shell / `.dwrap` | `data.detail` | keep existing detail hierarchy |
| Mobile list → detail → work | `M.tab / M.view / M.hist` | `data.master-detail` + `navigation.restore` | preserve one-task mobile pages and back context |
| PC action area | `.dact` / `actBar()` | `navigation.bottom-action` | preserve memo → overflow/sub → one primary |
| Mobile action strip | `.mact` | `navigation.bottom-action` | preserve contextual action strip above tabs |
| Mobile bottom tabs | `.mtabs` | `navigation.bottom-nav` | keep **상품 · 접수 · 실적 · 설정** |
| Step state | `stepper()`, timeline | `navigation.stepper` | reuse existing stage semantics |
| Status marks | `.st` | `data.badge` | preserve border/text state style; no pastel badge proliferation |
| Empty states | `.empty / .mempty` | `feedback.empty` | preserve domain-specific explanation |
| Errors/retry | existing error blocks | `feedback.inline-error / retry` | retain input and work context |

## Mobile baseline

Existing approved mobile structure:

```
상품 목록 → 상품 상세 → 신규접수 → 접수 목록
접수 목록 → 접수 상세
실적 목록 → 실적 상세
설정
```

Persistent bottom structure:

```
[ contextual action strip (.mact) — when the page has an action ]
[ 상품 | 접수 | 실적 | 설정 (.mtabs) ]
```

Do not replace this with a newly invented 5-tab or 5-button navigation.

## Buttons

Existing FreePass Admin action grammar is retained:

- Product detail: `공유 | 이 조건으로 접수`
- New intake: `그만두기 | 접수 저장`
- Intake detail: `취소 | 다음 단계 완료`
- Performance detail: `이견 | 확인 / 정산 확정`
- Billing: `계산서 처리 | 수금 등록`
- Payout: `지급 보류 | 지급 등록`

PC `actBar()` remains the higher-density equivalent:
- optional memo
- overflow for rare/danger actions
- secondary actions
- exactly one filled primary

## Product periods

One business-rule correction is applied without changing the visual design:

- contract term is source data, not a fixed enum
- filter options are generated from actual Product Offer `termMonths`
- arbitrary periods such as 13/27/39 months are valid
- same term can contain multiple Offer variants for mileage/deposit/price/policy

## Data baseline already present

Existing Admin implementation and mockup data already cover:

```
Product
→ Application
→ Performance
→ Settlement
→ Billing
→ Collection
→ Payout
```

The design migration must connect these existing data/domain layers into the approved UI.
It must not recreate fake parallel demo data as a new product architecture.

## Migration principle

1. Read existing approved UI first.
2. Reuse the existing visual/interaction structure.
3. Bind current real Domain/Repository data.
4. Apply AI Core feature IDs/contracts to the reused UI.
5. Change visuals only when the user explicitly changes the FreePass design baseline.

