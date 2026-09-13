# FreePassERP.com ADMIN UI Profile v0.1

Status: **CANDIDATE / REVIEW ONLY / HOLD**

This profile applies DevCenter design evidence to FreePassERP.com without copying another project's business rules or creating a second upstream SSOT. It is not implementation, Firebase, merge, or deployment approval.

## Evidence chain

`public web/accessibility baseline → DevCenter design sources → WORK-ERP candidate token source → FreePassERP adapter profile → screen mockups`

### Internal source pins

| Scope | Source | Blob SHA | Status |
|---|---|---|---|
| DevCenter baseline | `devcenter/docs/BASELINE.md` | `2560955c0336842dc4143126f5f1e5be7cbdaca4` | reference |
| responsive work shell | `devcenter/design/patterns/RESPONSIVE-SHELL.md` | `0ac012a4a9379e6e8712cc823e97ce5d91636b2f` | adopted pattern in DevCenter only |
| component/style catalog | `devcenter/design/components/CATALOG.md` | `b0188f3e05180dbf5b375f3db51763cda3970211` | reference |
| registry ownership/status | `devcenter/registry.json` | `24fe006532dc21573d1a3e65da0b43428d2f4006` | WORK-ERP token is candidate |
| WORK-ERP token code | `teamjpkwork/lib/erp/화면규격.ts` | `b6a6371e8145f3e30a20ac745ba902d7c98df3ad` | candidate source |
| WORK-ERP prose specification | `teamjpkwork/docs/erp-design/SPEC-UI.md` | `dc212041f1fa461baeda99e734248b695604429f` | reference; code wins on numeric conflicts |

The WORK-ERP source/copy ownership conflict is unresolved. FreePassERP.com references immutable source revisions and stores only this application profile and project-specific exceptions.

## Public baseline

- WCAG 2.2 AA Target Size Minimum: at least 24×24 CSS px or sufficient spacing.
- Project operational target: at least 44×44 CSS px for every mobile control and the full list row.
- WCAG 2.2 AA normal-text contrast: at least 4.5:1.
- Reflow: no two-dimensional scrolling at 320 CSS px except essential content.
- Sticky headers/actions must not obscure keyboard focus.
- Status is never conveyed by color alone; text or shape is included.

## FreePass mobile profile

| Token / rule | Candidate value |
|---|---|
| reference viewport | 390 CSS px; verify 320, 360, 390, 411, 430 |
| page horizontal gutter | 14px |
| card gap | 8px |
| card inner padding | 14px |
| card radius | 8px |
| control / small-label radius | 4px |
| application header | 64px |
| search/input | 48px, input text 16px |
| chip / icon target | minimum 44×44px |
| list row target | minimum 64px; the entire row opens detail |
| bottom primary action | minimum 52px plus safe-area inset |
| page title | 20px / 700–800 |
| section title | 17px / 650–800 |
| list primary text | 16px / 600–700 |
| body / field | 14–15px |
| metadata | 13px minimum |
| status label | 12px minimum |
| numbers | tabular numerals |

The larger FreePass type scale intentionally differs from the denser WORK-ERP candidate because prior user review found the mobile text too small.

## Color and interaction grammar

- Default surfaces and text are neutral.
- Navy `#16314d`: primary action and active selection.
- Green `#15916b`: completed/confirmed only.
- Amber `#b9821a`: scheduled/waiting only.
- Red `#c0392b`: cancellation, failure, or actual operational problem only.
- Button = performs an action.
- Chip/segment = changes a selection or view.
- Full row + chevron = opens detail.
- Back is left; the one primary action is right.
- Small labels use 4px radius and never become decorative pills.
- Permanent help sentences are excluded from daily work screens; show changing values and concise labels.

## Responsive structure

| Width | FreePass behavior |
|---|---|
| 1101px and wider | equal `1fr 1fr 1fr`: product list, product detail, work panel |
| 768–1100px | one active full screen; do not squeeze three panels |
| 767px and narrower | independent mobile list → detail → work navigation |

The DevCenter 4-column WORK-ERP layout is not copied. The user's FreePass 1:1:1 desktop requirement is the project source.

## Mobile information architecture

1. `상품 목록 → 상품 상세 → 신규 접수`
2. `접수 목록 → 접수 상세`
3. `실적 목록 → 실적 상세`
4. `청구·지급 목록 → 청구 | 지급 → 건별 상세`

Every back action restores query, filter, sort, scroll position, selected ID, and finance tab. The list row receives restored focus.

Initial application intake contains exactly four required values: vehicle, sales channel, assignee, customer name. Product-detail entry prefills the vehicle.

## Explicit non-adoptions

Do not copy WORK-ERP-specific business rules: four root tabs, four work depths, phone/SMS recording, employee/AI badges, delinquency intervals, payment-rate calculations, recovery deadlines, or its four-column desktop layout.

Do not infer performance recognition, billing formulas, tax, commission, settlement cycle, approval level, or edit permission from review images.

## Verification gate

- Measure actual CSS values; an image is not evidence of size, contrast, focus, or state restoration.
- Verify 320/360/390/411/430 and 767/768/1100/1101 boundaries.
- Verify 200% zoom, keyboard-only flow, focus visibility/restoration, screen-reader names and states.
- Verify loading, empty, error, unauthorized, saving, duplicate-submit, and unsaved-exit states.
- Any changed token or image creates a new review revision.
- User approval and named independent CLI reviews remain required. Until then: `HOLD / execution_authorized:false`.