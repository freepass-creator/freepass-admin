# ERP 표준 v1.1 승격 기록 — 2026-09-25

대표 2026-09-25 「공통 규격을 만들어야 … 우리 이제 표준 UI UX거든」. 분담: 공통 규격 승격 · shell.css 정리 · 검증 게이트는 Claude,
화면 기능 · 폼 · 접근성 · 문구 · 업무 흐름은 GPT.

## 한 일

| 어디 | 전 | 후 |
|---|---|---|
| ai-core `design/erp-standard/tokens.json` | 1.0.0 · 토큰 76 | **1.1.0 · 토큰 116** — 글자 24/20/18/16/14/12, 컨트롤 32/36/36, 섹션 간격 16, 표면 위계, 높이 4단, 선 역할, 패널·카드 골격, 움직임, halo |
| ai-core `design/erp-standard/erp.css` | v1 규칙 | 끝에 **«v1.1» PC(≥901) 구역** — shell.css 의 공통 규칙 569 선언을 날짜 머리글째 옮김 |
| `src/app/_erp/shell.css` | 2,262줄 (공통 + 앱이 섞임, 덮어쓰기 40겹) | **약 450줄 — 앱 고유층만**: `dz-*` · `fn-*` · `erp-embed` · `erp-screen`/`.erp-content` · 브랜드 navy · `--fp-workspace-*` |
| `--fp-*` 변수 | 45개 | 3개(`--fp-workspace-gutter-x/y`, `--fp-workspace-gap` — 폭 구간별이라 앱에 남김). 나머지는 `--erp-*` 토큰 |
| `scripts/check-ui-ssot.mts` | shell.css 만 읽음 | `erp-standard.css + shell.css` 두 겹을 합쳐 검사(`DESKTOP_CSS`). 새 값 금지(off-scale)는 v1.1 구역 + shell.css 에만 |
| `docs/ui/admin-ui-ux-ssot.json` | "consumer override" 부채 | 부채 항목 삭제, 정본 위치를 ai-core v1.1 로 |

`--fp-*` → `--erp-*` 이름 대응 (값은 그대로):
`elevation-*`·`press-y`·`line-card`·`line-control`·`focus-halo`·`sp-7`·`panel-head-h`·`query-row-h`·`quick-row-h`·`panel-foot-h`·`row-*-min-h`·`section-rhythm`·`motion-*`·`busy-opacity`·`card-gap`·`card-line-h/gap`·`detail-row-h` 는 이름 그대로,
`canvas`→`color-canvas`, `surface`→`color-surface`, `surface-soft`·`component-surface`→`color-surface-soft`, `surface-hover`→`color-surface-hover`, `selected`→`color-selected`,
`text-strong`→`color-text`, `text-secondary`→`color-text-2`, `text-muted`→`color-text-muted`, `nav-text/muted/active`→`color-nav-text/muted/active`,
`line-input`→`color-line-strong`, `icon-sm`→`icon`, `icon-md`→`icon-nav`, `icon-lg`→`icon-lg`, `icon-action-hit`→`icon-hit`.

## 검증

- 계산된 스타일 비교(15개 장면: 5화면 × 1440/1280/390 + retro 2 + hover/focus 3, 보이는 요소 전부 ~70개 속성):
  - **classic PC: 좌상단 사용자 보조글(`.erp-user small`) 한 곳만 바뀜** — 규격 `color-nav-muted` 가 결정값 `#8492A6` 으로 올라가서(전 `#6B7A91`).
  - **폰(390): 변화 0.**
  - **retro: 바뀜(의도)** — 앱이 박아 두던 classic 색(`#101828` 등)·모서리(999px·6px)가 테마를 덮고 있었다. 이제 retro 토큰이 적용된다(퀵 필터가 retro 에서 네모, 글자색이 먹색).
- ai-core `npm run erp:check` 통과(토큰 116 · 테마 2 · 템플릿 14).
- freepass-admin `tsc --noEmit` · `npm test` 412/412 · `next build` 통과.
- `npm run ui:check` — 승격 전과 **같은 5건**만 실패(아래 «남음»), 새로 생긴 실패 0.

## 앞으로의 규칙 (GPT 포함 모두)

1. **어느 ERP 화면에나 같은 규칙은 shell.css 에 쌓지 않는다.** ai-core `design/erp-standard/erp.css`(값은 `tokens.json` 먼저)에 올리고
   `node scripts/sync-erp-standard.mjs` 로 가져온다. shell.css 에는 `dz-*`/`fn-*`/`erp-embed`/`erp-screen`/브랜드/작업판 여백만.
2. 새 값은 토큰으로. `:root` 에 `--fp-*` 를 새로 만들지 않는다.
3. «고쳤다»는 실제 화면 캡처 + `npm run ui:check` 가 같이 있어야 한다.

## 남음

- `ui:check` 기존 실패 5건(승격 전부터): parts.tsx row card flexible extra lines · SettlementScreen line fees exact ·
  products/workspace.tsx mobile product key line · offer-list 계약 머리글(`Embedded offer selection list`) 없음 ·
  SSOT JSON elevation levels 0/base/hover/float — GPT 진행 중인 항목으로 보고 손대지 않았다.
- 퀵 필터 알약(`erp-facet-opt` `r-pill`, 2e6e02a) — 대표 「원래 알약 안 하기로 했는데」, 되돌릴지 답 대기. 모양은 안 바꿨다.
- 고른 것 안쪽 그림자가 .10/.11/.12/.14 네 벌(`shadow-pressed-*`) — 화면 확인과 함께 두 벌로 합칠 것.
- 폰 상품 가격 잘림(`docs/reviews/ADMIN-UI-CHECKUP-2026-09-25.md` §1) — 여전히 열려 있음.
- ai-core `images/erp-main.png` 등 템플릿 캡처는 v1.1 척도 전 그림.
