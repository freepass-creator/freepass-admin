# AI Core 규격 적합 — freepass-admin

| | |
|---|---|
| 상위 규격 | `ai-core` `docs/SCREEN_DESIGN_STANDARD.md` @`9b96007` |
| 공통 토큰 | `ai-core` `design-system/tokens.css` @`fde10bc` |
| 계약 | [DEV-CHANGE-ESIGN-001.json](DEV-CHANGE-ESIGN-001.json) — `npm run form:validate` **PASS** |
| 적용 대상 | `docs/ui/mockups/admin-shell.*` (시안 계층) |

AI Core 규격은 이렇게 못박아 뒀다:

> 「Product pages may **extend** tokens but do not hard-code **a second competing system**.」

**우리가 갖고 있던 것이 바로 그 「두 번째 체계」였다.** 그래서 이름을 저쪽 것으로 바꾸고,
값이 다른 항목은 아래에 **전부** 까닭과 함께 적는다. 규범(WCAG·APG·상태·용어)은 **깎지 않는다**.

## 1. 토큰 — 이름은 저쪽 것, 값은 우리 밀도

`:root` 에 AI Core 이름을 그대로 선언하고 우리 값에 잇는다. AI Core 토큰으로 쓰인
컴포넌트를 그대로 가져와도 여기서 돈다.

```css
--color-surface : var(--card);   --color-text    : var(--ink);
--color-primary : var(--key);    --color-muted   : var(--ink-2);
--space-2 : var(--sp);           --radius-sm : var(--r-ctl);
--control-height : var(--h-act);
```

### 1-1. 값이 «다른» 것 — 여덟

| 토큰 | AI Core | freepass-admin | 왜 다른가 |
|---|---|---|---|
| `--control-height` | **44px** | **38px** (폰 **44px**) | AI Core 문장 자체가 44 를 「**for touch** usability」라 적고 「WCAG's minimum target-size requirement remains the **compliance floor**」라 덧붙인다. 그 바닥은 **24×24**(2.5.8 AA)다. 데스크는 마우스이고 하루 여덟 시간 표를 훑는다 — 44 로 잡으면 한 화면에 줄이 절반만 들어간다. **손이 닿는 폰에서는 44 를 지킨다.** |
| `--font-size-md` | 16px | **12px** | 같은 까닭. 16px 은 읽는 문서의 값이다. 표 여덟 칸을 360px 안에서 훑는 판은 12px 가 실측 밀도다. **대비로 보전한다** (아래 2절) |
| `--font-size-sm` | 14px | 10.5px | 위와 같다 |
| `--content-max` | 1200px | **none** | ★전체화면 데스크다. 1200 으로 가두면 목록 7 : 상세 3 이 안 선다 |
| `--color-primary` | `#155eef` | `#2f6289` | 대표(2026-09-16): 「**b2c가 아니라 내부 관리 프로그램으로 질림이 없는 색깔 눈아픔도 없고**」. `#155eef` 는 채도가 높아 초점을 계속 당긴다. 대비 6.7:1 로 **규격선 위**다 |
| `--color-bg` | `#f6f8fb` | `#dee2e6` | 판(`--card`)을 띄우려면 바닥이 한 단 어두워야 한다 |
| `--color-surface` | `#ffffff` | `#fcfdfe` | 순백을 크게 깔면 오후에 반사광이 세다. 대비는 15.9:1 로 더 높다 |
| `--color-focus` | `#dc6803` | `#a8571a` | 같은 주황 계열을 **한 단 낮춰** 흰 바탕에서 3:1 을 넘기게 했다 |

### 1-2. 그대로 쓰는 것

`--space-*` 눈금 · `--radius-*` · `--shadow-sm` · `--line-height:1.5` ·
`--color-danger` / `--color-success` / `--color-*-surface` 의 **역할 구분**.

## 2. 규범 — 깎지 않는다

| 규격 항목 | 어떻게 지켰나 | 실측 |
|---|---|---|
| 본문 대비 **4.5:1** | 세 단(`--ink` / `--ink-2` / `--ink-3`)을 **가장 밝은 바탕(`--tint`)** 기준으로 다시 잡았다 | 전자계약 6건 · 다른 4판 전부 **4.5 미만 0건** |
| 경계·포커스 **3:1** | `:focus-visible` 을 **실선 2px + offset** 으로 바꿨다 — box-shadow 만 쓰면 겹친 판이 덮는다 (2.4.11/2.4.13) | — |
| **색만으로 말하지 않기** | 단계는 늘 **이름과 함께** 선다. 플래그도 글자(`확인 필요`·`만료`·`보완 2차`) | 1.4.1 |
| 표 의미 | `caption`(시각적으로 감춤) + `th scope="col"` | 목록·제출서류·이력 3표 |
| 단계 의미 | 스테퍼를 `ol`/`li` 로, 현재 단계에 `aria-current="step"` | — |
| **상태 넷을 따로** | 빈 상태가 **두 가지로 갈린다** — 「아직 계약이 없다」(→ 계약서 만들기) 와 「이 **조건**에 맞는 계약이 없다」(→ 조건 지우기). 막힘은 `role="alert"` | 규격 §Feedback |
| 비활성 단추는 **까닭을 곁에** | `링크 만들기`가 disabled 일 때 바로 옆에 「발송 전 확인 2건이 막고 있다」 | 규격 §Button |
| 동작 줄이기 | `prefers-reduced-motion` 에서 transition·animation·scroll 전부 정지 | — |
| 반응형 | 1100px 아래는 폰 페이지 스택으로 갈린다. 폰은 컨트롤 44 | 규격 §Responsive |

### 2-1. 아직 «안» 지킨 것 — 숨기지 않는다

| 항목 | 지금 | 언제 |
|---|---|---|
| `LOADING` 상태 | **없다.** 시안은 고정 표본을 동기로 그린다 | 실데이터 조회를 붙일 때 |
| 키보드 전용 통과 시험 | 안 돌렸다 | 시안이 아니라 `src/app` 에 올릴 때 |
| 200% 확대 시험 | 안 돌렸다 | 위와 같음 |
| 대화상자 포커스 반환 | 환수 고르기 창은 Escape 로 닫히나, 부른 자리로 **되돌리지 않는다** | 다음 차례 |
| `ui-*` 컴포넌트 클래스 | 안 썼다 — 우리 `.pane/.card/.st` 가 먼저 있었다 | 이름 통합은 별건 |

★이 표가 비면 그때 「적합」이라고 쓴다. 지금은 **부분 적합**이다.

## 3. 용어 — freepasserp4 용어표가 이긴다

전자계약 화면의 말은 AI Core 가 아니라 `freepasserp4` 정본을 따른다
(§2-3 용어표, [ESIGN-AS-IS.md](../ui/ESIGN-AS-IS.md) §6). 두 규격이 겹치지 않는다 —
AI Core 는 **어떻게 말할지**(동사 먼저, 위치 지시어 금지)를 정하고,
fp4 용어표는 **어떤 낱말을 쓸지**를 정한다.
