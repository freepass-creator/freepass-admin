# FreePass Admin UI/UX SSOT

상태: **NORMATIVE / UI·UX 공통 정본**  
기준일: 2026-09-18  
적용: `freepass-admin` 실제 관리자 화면  
코드 기준: `src/app/globals.css`(base/legacy) · `src/app/_design/admin-final.css`(현행 final) · `src/app/_design/*` · 실제 route workspace

> 이 문서는 화면을 새로 디자인하는 문서가 아니다.  
> **이미 확정된 화면의 눈에 보이는 위계·크기·역할을 한 곳에 고정**해서, 다음 화면과 다음 AI가 같은 규격을 쓰게 하는 문서다.

---

## 1. 정본 우선순위

충돌하면 아래 순서가 이긴다.

1. **사용자의 최신 명시 결정**
2. **이 문서 `ADMIN-UI-UX-SSOT.md`**
3. 실제 공통 구현 — `src/app/_design/*`
4. 실제 최종 CSS — `src/app/globals.css`의 뒤쪽 확정 규칙
5. `docs/ui/UI-SPEC.md`
6. mockup / POLISH-NOTES / 과거 CSS 주석

### 금지
- 과거 `admin-shell.*` 값을 실제 앱보다 우선하지 않는다.
- `globals.css` 파일 위쪽에 남은 옛 값을 보고 새 화면을 만들지 않는다.
- 새 화면마다 버튼·텍스트·라운드·뱃지 규격을 새로 정하지 않는다.
- White Label에서 가져온 뱃지는 **모양만 가져오지 말고 규격 전체**를 쓴다.

---

# 2. 전체 시각 위계

```
L0  Brand / Global navigation
    AdminChrome · desktop TopMenu · mobile MobileTabBar

L1  Workspace
    화면의 업무 배열

L2  Panel
    목록 / 상세 / 업무

L3  Panel section
    PanelHeader · Search/Filter · List · Detail section · Action bar

L4  Item
    ListRow · Summary box · Offer · Form field · Event

L5  Signal
    Badge · Perk · Status tile · Count · Icon · Helper text
```

**아래 단계가 위 단계보다 시각적으로 세면 안 된다.**

예:
- 뱃지가 판 제목보다 커지면 안 됨.
- 필터 버튼이 주 실행 버튼보다 세면 안 됨.
- 카드 안 상자가 패널보다 더 강한 테두리를 가지면 안 됨.

---

# 3. Surface / Panel 위계

## 3-1. 면의 단계

| 단계 | 역할 | 현재 정본 |
|---|---|---|
| Ground | 화면 바닥 | `--바닥 #eef1f4` |
| Panel | 업무 큰 판 | `--판 #fff` |
| Box | 판 안 정보 상자 | `--박스` |
| List card | 목록 한 줄 | `--카드` |
| Hover | 손이 올라간 상태 | `--박스손 / --카드손` |
| Selected | 선택된 값 | `--고름` 옅은 네이비 |

### 선 규칙
**기본적으로 선은 두 군데만 강제한다.**
1. Panel 외곽
2. Search/Input 중 “찾기 시작점” 역할

그 외:
- 버튼: 선 없음
- 목록 카드: 선 없음
- 선택: 선보다 면의 변화
- 정보 상자: 면과 간격으로 구분

## 3-2. Panel 규격

### Desktop
- workspace gap: **12px**
- workspace padding: **12px**
- panel radius: **4px**
- panel border: **1px**
- panel padding: **22px**

### Mobile
- workspace gap: **8px**
- workspace padding: **8px**
- panel padding: **16px**

## 3-3. Panel 역할은 세 종류만

### LIST PANEL
목적: 찾고, 거르고, 훑고, 고른다.

차례:
1. PanelHeader
2. Search
3. Quick filter / facet
4. List
5. 필요하면 count/summary

### DETAIL PANEL
목적: 고른 한 건을 읽고 조건을 확인한다.

차례:
1. PanelHeader
2. Identity / primary value
3. Summary
4. Sections
5. Action bar

### WORK PANEL
목적: 접수·계약·정산 등 실제 상태를 바꾼다.

차례:
1. PanelHeader
2. Current state
3. Required fields / progress
4. History / evidence
5. Action bar

**같은 Panel 안에서 LIST + WORK를 임의 혼합하지 않는다.**

---

# 4. 화면별 Panel 배열

| 화면 | Desktop | Mobile |
|---|---|---|
| 상품찾기 | 목록 **2/3** + 상세 **1/3** | 목록 → 상세 |
| 계약접수 | 상품목록 + 상품상세 + 접수/업무 | depth 전환 |
| 정산관리 | 묶음 + 실적줄 + 접수상세 | 목록 → 실적 → 업무 |
| 전자계약 | 계약목록 **2/3** + 계약상세 **1/3** | 목록 → 상세 |

Panel 비율은 업무 목적이다. 장식 때문에 임의 변경하지 않는다.

---

# 5. Text hierarchy — 세 단계만

## 5-1. 정본

| 위계 | Token | 크기 | 쓰는 곳 |
|---|---|---:|---|
| Title | `--글제목` | **18px** | Panel title, detail title, 주요 금액 |
| Main | `--글메인` | **14px** | 본문, 값, 이름, 버튼, 입력 |
| Support | `--글보조` | **12px** | 설명, 날짜, 코드, 라벨, count |

### 원칙
- **새 13/15/16/17/20px 위계를 만들지 않는다.**
- 굵기로 위계를 만들 수 있으면 크기를 늘리지 않는다.
- 숫자도 같은 3단을 사용한다.
- 큰 금액도 별도 “금액 폰트”를 만들지 않는다.

## 5-2. 승인된 예외

| 예외 | 값 | 이유 |
|---|---:|---|
| CI wordmark | 20px 전후 | BI/CI 규격 |
| Login brand | 24px | 독립 로그인 화면 |
| Mobile text input | **16px** | 모바일 브라우저 자동 확대 방지 |
| White Label Perk detail | 13px | 가져온 공통 규격 그대로 |
| White Label Perk compact | 12px | 가져온 공통 규격 그대로 |

예외를 새로 만들려면 이 표에 먼저 추가한다.

---

# 6. Control hierarchy

## 6-1. 버튼·입력 크기

| 등급 | 높이 | 글자 | 용도 |
|---|---:|---:|---|
| Badge / signal | content based | 12 | 상태·신원 표시 |
| Standard workspace control | **40px** | 14 | 필터, 탭, 기간, 보조 버튼, 업무 입력 |
| Search / field | **40px** | 14 | 검색창, 주요 입력 |
| Primary action | **44px** | 14 bold | 저장, 접수, 발행, 승인 |
| Mobile touch action | **44px 이상** | 14 | 엄지로 누르는 주요 행동 |

### Button radius
- 일반 버튼: **4px**
- 새로운 radius 금지

### Primary
- 한 Panel의 한 시점에 **주 행동 하나**
- FreePass Navy
- 44px
- 우측 또는 하단 action bar

### Secondary
- 같은 action bar에서는 중립 면
- Primary보다 약하게
- action bar에서 둘이 서면 기본 **3 : 7**

### Utility
- 필터·탭·작은 조작
- 업무 workspace에서는 40px
- 평소 투명/중립
- active에서 Navy 면

### Destructive
- 붉은색은 “위험 의미”에만 사용
- 상시 Primary로 띄우지 않는다
- 가능하면 더보기/확인 단계 뒤

## 6-2. Mobile touch
정본: **touch target 44px 이상**

현재 처리:
- `.dz-phone-back`은 보이는 상자 32px를 유지하되 **실제 hit-area 44px**를 확보했다.
- 달 넘기기 등 workspace 조작은 공통 `--ui-control-h` 40px를 사용한다.

승인된 compact 예외:
- Desktop global chrome의 TopMenu는 33px. 업무 Panel 내부 컨트롤과 다른 층이다.
- 검색창 내부 `세부검색` 단추는 32px visual이지만 40px search box 안의 내부 조작이다.

---

# 7. Badge / Status SSOT

뱃지는 **두 얼굴**뿐이다.

## 7-1. Identity Tag — `Tag`
무엇인가를 말한다.
- 상품구분
- 출고상태
- 접수 상태
- 업무 상태

정본: White Label StateChip
- font 12 / weight 600
- padding **5px 10px**
- radius **8px**
- border 없음
- icon + text

Tone:
- plain
- good
- act
- warn

## 7-2. Condition Mark — `PerkMarks`
가능 조건을 말한다.
- 무심사
- 21세
- 소득확인
- 분납가능 등

**박스 없음.**
- icon + bold text
- 상세 13px
- compact 12px

### 금지
- 조건을 Identity Tag 상자로 만들지 않는다.
- 심사 요구를 혜택처럼 초록 체크로 만들지 않는다.

## 7-3. StatusTile
사진이 없는 업무 목록의 썸네일 자리.

- **64 × 64**
- icon + 짧은 상태명
- navy / green / red / grey / amber

---

# 8. List SSOT

모든 업무 목록은 가능하면 **`_design/ListRow`** 를 쓴다.

## 8-1. 구조

```
[thumb/status]  1줄: 제목 + identity badges
                2줄: context / flag
                3줄: main value + aside/perks
```

### 치수
- outer padding: **12px**
- body visual height: **64px**
- 실제 rendered row: **약 88px** (64 + 상하 padding)
- row gap: **8px**
- radius: **4px**
- product thumbnail: **82 × 64**
- status tile: **64 × 64**

**“목록 높이 64”라고 쓸 때는 body 높이인지 실제 row 높이인지 반드시 구분한다.**

## 8-2. 의미 순서
1. 무엇인가
2. 어떤 상태인가
3. 핵심 조건/맥락
4. 얼마인가 / 지금 무엇을 해야 하나

목록에서 제원 전체를 보여주지 않는다. 상세에서 읽는다.

## 8-3. 선택
- border 추가 금지
- `--고름` 면으로 표시
- selected와 status 색을 섞지 않는다.

---

# 9. PanelHeader SSOT

현재 공통 CSS 패턴: `.panel-head`

- height/min-height: **32px**
- title: 18px / 800
- count: 14px / 700, muted
- title + count는 한 덩어리
- 별도 영문 eyebrow 사용하지 않는다.
- Header에 실행 버튼을 남발하지 않는다.
- 실행은 가능하면 하단 action bar.

향후 공통 컴포넌트 추출 후보:
`PanelHeader(title, count, back?)`

---

# 10. Search / Filter SSOT

## Search
- 높이 **40px**
- 검색 icon
- 텍스트
- 필요하면 내부 우측에 “세부검색”
- search border는 허용
- main text 14

## Quick filter
- search 아래
- height **40px** (`--ui-control-h`)
- active = Navy
- 같은 축 선택값은 주소/query SSOT와 연결

## Facet sheet
공통: `FilterSheet`
- 왼쪽 axis
- 오른쪽 values
- 고르면 즉시 반영
- 마지막에 “N대/건 보기”
- 모바일 touch item 44

### 금지
- 같은 화면에 서로 다른 검색 엔진/필터 규격 두 벌
- 적용 버튼을 별도 규칙으로 새로 만들기
- 숨은 필터

---

# 11. Detail information hierarchy

상세는 아래 순서로 고정한다.

1. **Identity**
   - 고객 / 차량 / 계약 / 공급사
2. **Primary value**
   - 월 대여료 / 청구금액 / 지급액 등
3. **Summary**
   - 2~4개의 핵심 값
4. **Sections**
   - 차량정보 / 조건 / 진행 / 원자 / 이력
5. **Warnings**
   - 실제로 손이 필요한 것
6. **Action bar**

Summary box는 `summary-grid` 규격을 사용한다.
새 카드 디자인을 만들지 않는다.

---

# 12. Action bar SSOT

공통 CSS pattern: `.dz-bar > .dz-bar-go`

역할:
- 상세/업무 화면의 마지막 실행 자리
- PC와 Mobile에서 동일한 의미

### 한 개
```
[              PRIMARY              ]
```

### 두 개
```
[ secondary 3 ] [ primary 7 ]
```

- primary 44
- secondary 44
- radius 4
- panel bottom에 정렬
- content 중간에 떠 있지 않는다.

향후 공통 컴포넌트 추출 후보:
`ActionBar(primary, secondary?)`

---

# 13. Navigation SSOT

## Desktop — 업무 4축
1. 상품찾기
2. 계약접수
3. 정산관리
4. 전자계약

정본:
- `AdminChrome`
- `TopMenu`

## Mobile — 업무 5걸음
1. 상품
2. 접수
3. 계약
4. 청구
5. 지급

정본:
- `MobileTabBar`

청구·지급은 Desktop 정산관리의 두 입구다.

## Depth rule
- depth 0: global bottom tabs
- depth 1/2: global tabs를 숨기고 해당 Panel action bar
- back은 PanelHeader에 둔다.

---

# 14. Common component SSOT

## 이미 공통화 완료 — 새로 만들지 말고 재사용

| 역할 | Component |
|---|---|
| 관리자 chrome | `AdminChrome` |
| Desktop menu | `TopMenu` |
| Mobile navigation | `MobileTabBar` |
| 목록 한 줄 | `ListRow` |
| 목록 상태 tile | `StatusTile` |
| 신원 badge | `Tag` |
| 조건 표시 | `PerkMarks` |
| icon | `Icon` |
| 세부검색 | `FilterSheet` |
| Offer 선택 | `OfferPicker` |
| 상세 tab | `DetailTabs` |
| 차량 사진 | `PhotoGallery` |

## 공통 primitive — 구현 완료

`src/app/_design/Primitives.tsx`

| 역할 | 공통 primitive |
|---|---|
| Panel header | `PanelHeader` |
| Search input core | `SearchField` |
| Bottom action | `ActionBar` |
| Empty state | `EmptyState` |
| Summary values | `SummaryGrid / SummaryItem` |

핵심 4개 실제 화면(`products/intake/settlement/esign`)은 위 primitive를 사용한다.
raw `.panel-head / .dz-bar / .dz-empty / .summary-grid` 마크업 재도입은 `npm run ui:check`가 실패시킨다.

## 다음 공통화 후보

| 역할 | 현재 | 후보 |
|---|---|---|
| Search outer/form | `.dz-searchbox` + route별 form | `SearchBox` |
| Notice | `.dz-warn/.dz-ok` | `Notice` |

**공통화는 모양을 바꾸는 작업이 아니다. 동일 마크업을 한 곳으로 모으는 작업이다.**

---

# 15. UX state hierarchy

모든 interactive component는 아래 상태를 구분한다.

1. default
2. hover
3. focus-visible
4. active/selected
5. disabled
6. busy/loading
7. error/warn (필요한 경우)

### 선택 vs 성공
- selected = Navy
- success/done = Green

둘을 같은 색으로 표현하지 않는다.

### warn vs destructive
- warn = 확인 필요
- destructive = 삭제/취소/되돌림

같은 빨강이라도 의미를 텍스트로 같이 적는다.

---

# 16. Responsive hierarchy

Mobile은 PC를 축소하지 않는다.

### Desktop
여러 Panel을 동시에 보여 맥락 유지.

### Mobile
한 번에 한 Panel.
```
depth 0 목록
  → depth 1 상세
    → depth 2 업무
```

### 유지되는 것
- 데이터
- 용어
- 상태
- action hierarchy
- badge 의미

### 달라지는 것
- Panel 동시 노출 수
- navigation 위치
- action bar 위치

---

# 17. 현재 발견된 “규격 부채” — 디자인 변경 없이 정리 대상

## A. CSS cascade가 정본 역할을 하고 있음
`globals.css` 상단에 옛 규격이 남고 아래에서 계속 덮는 구조다. **파일 맨 위에 LEGACY BASE 경고를 추가해 새 코드가 그 값을 복사하지 않게 표시했다.**

**위험:** 다음 AI가 위쪽 값을 읽고 되돌릴 수 있음.

권장 후속:
- legacy block 명시
- 최종 token/component CSS를 파일 하단이 아니라 별도 SSOT CSS로 분리

## B. UI-SPEC 옛 절이 최신 절 아래에 같이 있음
맨 위 “실제 앱 정본”이 우선이지만, 옛 22/30/34/38 규격이 계속 보인다.

권장:
- 옛 절을 `UI-HISTORY.md`로 이동
- UI-SPEC은 현행만 남김

## C. 목록 높이 용어
문서 주석은 “64px row”라고 하나 실제 outer row는 padding 포함 약 88px.

정본:
- **body = 64**
- **rendered row ≈ 88**

## D. Mobile back hit-area
처리 완료: visual 32px는 유지하면서 pseudo hit-area를 **44px**로 확장했다.

## E. 2개의 secondary surface
`--박스`, `--카드`가 둘 다 존재한다.

현재 역할:
- `--박스`: 정보/폼/요약 박스
- `--카드`: 목록 row

이 역할을 넘겨 쓰지 않는다.

---

# 18. 새 화면 체크리스트

새 화면/컴포넌트 추가 전 반드시 확인:

- [ ] Title/Main/Support 18/14/12 안에서 해결했나?
- [ ] 업무 컨트롤 40 / 주 행동·모바일 터치 44 체계 안에 있나?
- [ ] mobile touch는 44 이상인가?
- [ ] radius 4가 기본인가?
- [ ] 신원 = Tag, 조건 = PerkMarks로 갈랐나?
- [ ] 목록이면 ListRow를 재사용했나?
- [ ] Panel은 LIST/DETAIL/WORK 중 하나인가?
- [ ] Search/Filter가 기존 FilterSheet 계약을 따르나?
- [ ] 한 Panel에 Primary가 하나인가?
- [ ] Primary는 action bar에 있는가?
- [ ] selected(Navy)와 success(Green)를 구분했나?
- [ ] Desktop/Mobile에서 용어와 상태 뜻이 같은가?
- [ ] 새 CSS 숫자를 만들기 전에 이 문서를 확인했나?

---

# 19. 한 문장 규칙

> **큰 틀은 Panel, 목록은 ListRow, 신원은 Tag, 조건은 PerkMarks, 업무 컨트롤은 40, 주 행동·모바일 터치는 44, 글은 18/14/12, 선택은 Navy, 완료는 Green, 모바일은 한 Panel씩.**


---

# 20. 자동 검사

PR/푸시에서 GitHub Actions `.github/workflows/ci.yml`이 다음을 확인한다.

1. `npm run typecheck`
2. `npm test`
3. `npm run ui:check`

`ui:check`는:
- 핵심 화면이 공통 primitive를 우회해 raw 공통 마크업을 다시 만드는지
- 안정적인 UI 값이 inline style로 다시 들어오는지
- `--ui-*` 핵심 토큰이 사라졌는지
- 실제 CSS와 machine SSOT의 18/14/12 · 40 · 44 · radius 4가 변했는지
- focus-visible / reduced-motion 공통 규칙이 사라졌는지

를 검사한다.


---

# 21. 이번 정리에서 실제 코드에 반영된 것

문서 규격만 선언한 것이 아니라 아래 항목은 실제 코드에 적용됐다.

- 공통 primitive: `PanelHeader / SearchField / ActionBar / EmptyState / Notice / SummaryGrid / SummaryItem`
- 핵심 화면 `products / intake / settlement / esign`의 반복 마크업을 공통 primitive로 교체
- `DetailTabs`와 `OfferPicker`도 공통 ActionBar / EmptyState 사용
- `--ui-*` 토큰으로 공통 치수 연결
- 모바일 뒤로가기 visual 32px 유지 + 실제 hit-area 44px
- 세부검색: 닫힌 뒤 trigger로 focus 복귀 · unique dialog id · busy 상태 노출
- 상품 상세 tab에 `tablist/tab/tabpanel` 의미 추가
- ListRow 선택 상태를 접근성 트리에 노출
- 저장/정산 폼 pending 중 중복 조작 방지 + `aria-busy`
- PhotoGallery 화살표 클릭이 크게보기로 번지는 pointer 이벤트 오류 수정
- PhotoGallery reduced-motion 대응
- 전역 `:focus-visible` 및 `prefers-reduced-motion` 공통 규칙
- Badge/ListRow/Sections의 icon 이름 일부를 `IconName`으로 타입 고정
- 안정적인 inline style을 CSS class로 이동
- `AGENTS / MASTER / WORK-INBOX`의 오래된 UI 규칙에 최신 SSOT 우선관계 명시

위 항목은 **기능/업무규칙/화면 디자인을 바꾸지 않는 범위의 정리**다.


## F. 파일 책임 분리 — 2026-09-18 정리

- `src/app/globals.css` — base/legacy 및 기존 화면 호환 규칙
- `src/app/_design/admin-final.css` — 현재 관리자 UI의 final override / token / mobile / login / accessibility
- `src/app/products/workspace-config.ts` — 상품 workspace의 정적 필터축·가격구간·대표요금·표시 helper
- `src/app/intake/intake-options.ts` — 신규 접수의 기존 원장 선택지/code-map 준비
- `src/app/_design/Primitives.tsx` — 반복 시각 primitive

CSS import 순서는 **`globals.css → admin-final.css → _fn/fn.css`** 를 유지한다.
이 순서를 바꾸는 것은 디자인 변경으로 취급한다.
