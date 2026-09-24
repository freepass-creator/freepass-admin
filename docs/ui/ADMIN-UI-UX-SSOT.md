# FreePass Admin UI/UX SSOT

상태: **CURRENT PRODUCT STANDARD / AI CORE PROMOTION CANDIDATE**  
기준일: **2026-09-24**  
적용 저장소: `freepass-creator/freepass-admin`  
기준 브랜치: `claude/erp-platform-ui-ux-hvfyfa`  
문서 작성 시 기준 revision: `74bbda50ef20209df630a093f2dc9b5a403a890e`

> 이 문서는 FreePass Admin의 **현재 디자인 정본**이다.
> 테스트용 mockup, 과거 screenshot, 폐기된 §4 PageHeader/erp-cols 구조보다 이 문서와 현재 구현이 우선한다.
>
> 지금 FreePass Admin에서 먼저 검증·고도화하고, 안정화된 규칙만 이후 AI Core 전사 공통 규격 후보로 승격한다.

---

## 0. 한 문장 정의

**FreePass Admin은 “Minimal Operational UI”를 따른다.**

미니멀은 장식을 줄이는 취향이 아니라,
**업무 완료에 필요하지 않은 시각·행동 요소를 제거하고 정보·상태·행동의 위계를 일관되게 유지하는 것**을 뜻한다.

핵심 키워드는 두 개다.

- **Minimal**
- **Simple**

“트렌디해 보이기 위한 장식”은 목표가 아니다.
대신 현대적인 업무도구가 가져야 할 **명확한 hierarchy, contextual panel, responsive composition, 빠른 상태 인지, 낮은 학습비용**은 적극적으로 채택한다.

---

# 1. 정본 우선순위

충돌 시 아래가 이긴다.

1. 사용자의 가장 최근 명시 결정
2. 현재 FreePass Admin의 확정 구현
   - `src/app/_erp/Workspace.tsx`
   - `src/app/_erp/ProductsScreen.tsx`
   - `src/app/_erp/SettlementScreen.tsx`
   - `src/app/_erp/EsignScreen.tsx`
   - `src/app/_erp/parts.tsx`
   - `src/app/_erp/ProductDetail.tsx`
3. 현재 generated standard CSS
   - `src/app/_erp/erp-standard.css`
   - `src/app/_erp/shell.css`
4. 이 문서
5. 과거 문서·mockup·screenshot

### 중요한 규칙

- `docs/ui/erp-standard/classic-*.png` 등 저장 screenshot은 **현재 코드보다 뒤처질 수 있다**.
- screenshot과 코드가 충돌하면 **현재 branch HEAD 코드가 우선**이다.
- AI는 UI 작업 전에 반드시 현재 branch HEAD를 새로 조회한다.
- 오래된 commit/revision을 “최신 디자인”으로 재사용하지 않는다.

---

# 2. 현재 확정된 전체 구조

## 2-1. PC Shell

PC는 다음 4영역으로 구성한다.

1. **Topbar**
   - 브랜드
   - 회사/모드 정보
   - 통합검색
   - 데이터 상태
   - 사용자
   - 업무 실행 CTA는 두지 않는다.

2. **Sidenav**
   - 업무 이동의 유일한 주 navigation
   - 같은 navigation을 상단 탭으로 중복하지 않는다.

3. **Workspace**
   - 1~3개의 Panel을 조합
   - 업무의 실제 내용

4. **Statusbar**
   - ERP5 연결/설정
   - 쓰기/조회 모드
   - 시스템 상태

### 금지

- 상단에 동일한 업무 메뉴를 다시 반복하지 않는다.
- Side navigation + top tab navigation을 중복하지 않는다.
- 페이지마다 새 shell을 만들지 않는다.

---

# 3. Panel이 기본 단위다

현재 PC 화면의 정본은 **§5-4 Panel architecture**다.

폐기:
- `PageHeader`
- `erp-cols`
- 화면 전체 단독 카드 페이지
- 구형 §4 skeleton

현재 실제 코드에서도 죽은 §4 부품과 CSS는 제거됐다.

## 3-1. Panel 구조

모든 Panel은 가능한 한 다음 순서로 간다.

```
Panel
  ├─ PanelHead
  ├─ SearchBar / QuickFilter   (목록일 때)
  ├─ PanelBody
  └─ PanelFoot                (실행이 있을 때)
```

### PanelHead

```
[종류 칩] 제목                         [count/context]
```

- 패널 제목은 screen title처럼 과장하지 않는다.
- 현재 token: `--erp-fs-panel: 17px`
- 패널마다 동일한 visual grammar 사용

## 3-2. Panel 역할

### LIST PANEL
찾고, 거르고, 훑고, 고르는 판.

기본 순서:

```
PanelHead
SearchBar + Filter
QuickFilter
RowCards
```

### DETAIL PANEL
선택한 한 건을 읽고 판단하는 판.

기본 순서:

```
PanelHead
Identity / Hero
Primary values
Sections / Tiles
PanelFoot
```

### WORK PANEL
실제 상태를 변경하는 판.

기본 순서:

```
PanelHead
Current state
Required fields
Validation / evidence
PanelFoot
```

### 원칙

한 Panel이 무엇을 하는지 애매하면 안 된다.
LIST / DETAIL / WORK의 책임을 필요 이상으로 섞지 않는다.

---

# 4. 현재 화면별 확정 composition

## 상품찾기

```
[ 상품목록 1×2 wide ] [ 상품상세 ]
```

- 상품찾기가 메인이다.
- 목록 Panel은 `compact + wide`
- wide 목록은 두 칸 grid로 상품 카드를 배치한다.
- 검색창도 wide Panel 폭을 따라 넓어진다.
- 상품상세는 계약접수와 **동일한 `ProductDetail`** 을 재사용한다.

## 계약접수

```
[ 상품목록 ] [ 상품상세 ] [ 접수목록 ]
```

- 기본 landing은 3 Panel.
- 상품상세는 상품찾기와 같은 `ProductDetail`.
- 접수 상세/신규 접수는 같은 shell 안에서 실제 work context로 이어진다.

## 실적

```
[ 분납실적 ] [ 실적상세 ] [ 완납실적 ]
```

- 분납/완납은 동시에 비교 가능해야 한다.
- 가운데 상세는 별도 새 디자인을 만들지 않고 기존 상세 부품을 재사용한다.

## 정산관리

```
[ 청구목록 ] [ 정산상세 ] [ 지급목록 ]
```

- 청구와 지급은 항상 양쪽에서 비교 가능해야 한다.
- 월 선택은 검색창이 아니라 **QuickFilter line**에 둔다.
- 양쪽 목록 모두 같은 month context를 보여준다.

## 전자계약

```
[ 전자계약목록 ] [ 전자계약상세 ]
```

- 입력 Panel 없음.
- 전자계약 생성은 별도 흐름이 담당.
- Admin은 목록과 상세/서명 상태 확인이 중심.

---

# 5. 목록 규격

모든 업무 목록은 가능한 한 같은 문법을 사용한다.

## 5-1. 순서

**검색창 + 필터 → 퀵 필터 → 목록**

예외를 만들려면 명확한 이유가 있어야 한다.

### SearchBar
- 검색창 옆에 필터 버튼
- 검색창은 해당 Panel 폭을 충분히 사용
- wide Panel에서 좁은 max-width를 그대로 두지 않는다.

### Filter
- 상세 조건은 FilterSheet/facet 규칙 재사용
- 화면마다 다른 모달/드롭다운 방식 새로 만들지 않는다.

### QuickFilter
- 검색 바로 아래
- 상태/분류/월처럼 “누르는 즉시 결과가 바뀌는 조건”
- 월 dropdown도 QuickFilter의 한 구성원
- 주변 pill/control과 높이·레벨을 맞춘다.

### List
- 기본: `RowCards / RowCard`
- 긴 카드형
- compact Panel은 상태/분류 thumbnail을 허용
- 선택은 surface 변화로 표현
- 장식용 좌측 색 bar는 사용하지 않는다.

---

# 6. RowCard 정보 위계

목록 한 건은 다음 순서를 기본으로 한다.

1. **Identity**
   - 고객/상품/차량/계약
2. **Status**
   - Badge
3. **Context**
   - 차번, 공급사, 채널, 코드
4. **Progress**
   - 필요한 경우
5. **Facts**
   - 기간, 상품구분, 주요 조건
6. **Amount**
   - 숫자/금액은 우측 정렬

### 금지

- 목록 카드 안에 상세정보 전체를 집어넣지 않는다.
- 금액 위치를 화면마다 바꾸지 않는다.
- 상태마다 카드 구조를 다르게 만들지 않는다.
- 선택 표시를 decorative line으로 추가하지 않는다.

---

# 7. Detail 규격

상세는 “더 많은 카드”를 만드는 곳이 아니다.

기본:

```
Identity / Hero
Primary value
Related options
Operational notes
Action
```

## ProductDetail

현재 상품찾기와 계약접수의 동일 상품은 반드시 같은 `ProductDetail`을 사용한다.

구성:

- 차량 identity / status
- 차량번호 / 제조사 / 공급사
- 연식 / 주행 / 색상 / 상품구분
- 기간별 대여료 Tile
- 우대조건 / 정책
- 하단 접수 action

### 원칙

**같은 entity는 어느 화면에서 열어도 같은 Detail component를 사용한다.**

화면별로 별도 상세 UI를 만들지 않는다.

---

# 8. Action 규격

## 8-1. Primary

- 한 action boundary에 Primary는 **1개**
- Panel 내부 업무의 최종 행동은 `PanelFoot`가 기본
- 저장/접수/완료/발행 등 업무 결과를 바꾸는 action은 시각적으로 가장 강해야 한다.

## 8-2. Secondary

- Primary보다 한 단계 약하게
- 의미 없는 outlined button 남발 금지
- 버튼의 개수로 화면 hierarchy를 무너뜨리지 않는다.

## 8-3. 모바일

기존 사용자 확정 규칙 유지:

- 1개: 100%
- 2개: **3 : 7**
- 3개: **3 : 3 : 4**

Primary는 항상 1개다.

---

# 9. Surface / Border 철학

컨셉은 **Minimal + Simple**.

## 9-1. 기본

구분 순서:

1. spacing
2. surface
3. typography
4. border

border는 마지막 수단이다.

### border를 써도 되는 곳

- input/search
- 실제 데이터 읽기선이 필요한 table/grid
- focus
- 구조상 반드시 필요한 경계

### 기본적으로 border를 줄이는 곳

- 일반 button
- Badge
- Tag
- 선택 카드
- nested information box
- decorative container

### 선택

selected는 **면 변화**가 기본.
좌측 bar, 두꺼운 outline 등 추가 장식은 금지한다.

---

# 10. 상태 색

semantic tone은 제한한다.

- Primary
- Success / OK
- Info
- Warning
- Error
- Neutral

## 구분

- **selected**와 **success**는 다른 의미다.
- **warning**과 **destructive**는 다른 의미다.
- 상태 의미를 색만으로 전달하지 않는다.
- Badge는 배경 + 텍스트만으로 충분하면 dot를 추가하지 않는다.

### 금지

- 화면별 임의 status 색 생성
- 같은 상태를 다른 화면에서 다른 색으로 표현
- 혜택/우대조건과 위험/검증 상태를 같은 표현으로 사용

---

# 11. Typography

현재 ERP standard token이 정본이다.

주요 단계:

- screen title: 22px
- panel title: **17px**
- section: 15px
- body: 13px
- label: 12px
- caption: 11.5px

## 원칙

- 계층을 만들기 위해 임의 font-size를 추가하지 않는다.
- 크기보다 weight / spacing / surface로 먼저 해결한다.
- Panel title을 Page title 크기로 반복하지 않는다.
- 숫자는 tabular alignment를 유지한다.

---

# 12. Spacing / Radius / Control

현재 값은 `erp-standard.css` token을 정본으로 한다.

핵심 token:

- spacing: 4 / 8 / 12 / 16 / 20 / 24
- radius: 4 / 6 / 8 / pill
- topbar: 56
- sidenav: 240
- statusbar: 26
- input: 32
- button: 34
- small button/dropdown: 28
- desktop grid row: 40

### 원칙

- 화면마다 임의 숫자를 추가하지 않는다.
- “조금 더 넓게/조금 더 둥글게”를 개별 CSS로 해결하지 않는다.
- 새로운 안정값이 필요하면 token layer에서 결정한다.

---

# 13. Responsive 원칙

모바일은 PC 축소판이 아니다.

## Desktop

- 여러 Panel을 동시에 노출
- context 유지
- 비교와 반복 업무 속도 우선

## Mobile

- 한 번에 하나의 업무 surface
- 깊이에 따라 list → detail → work
- global navigation과 local action을 동시에 과다 노출하지 않는다.

### 중요한 현재 상태

현재 코드에서 `≤900px`은 PC `.erp-screen`을 숨기고 기존 mobile board를 사용한다.

따라서:
- PC 디자인을 그대로 줄여 모바일로 쓰지 않는다.
- FreePass Admin의 PC standard와 Mobile baseline은 동일 business semantics를 공유하되 presentation은 다를 수 있다.
- 향후 모바일 재정비 시 PC Panel 하나가 모바일 한 화면으로 자연스럽게 옮겨지는지를 기준으로 한다.

---

# 14. “트렌디하지 않게 보이는” 위험과 보완 규칙

현재 디자인의 가장 큰 위험은 색이나 radius가 아니라 **반복과 과밀도**다.

## 위험 A — 모든 것을 카드로 만들기

문제:
- 카드 안 카드가 늘어나면 2010년대 dashboard처럼 보일 수 있음.

보완:
- entity 선택/업무 단위만 카드
- 단순 facts는 평면 정보
- 비교/대량 데이터는 필요하면 table/grid
- 의미 없는 wrapper 금지

## 위험 B — 모든 Panel이 똑같이 무거워 보이기

문제:
- 3개의 Panel이 모두 같은 정보량/강도로 보이면 집중점이 사라짐.

보완:
- list / detail / work 역할 차이를 content hierarchy로 표현
- 중앙 Detail/Work의 핵심 정보가 자연스럽게 중심이 되도록 함
- border/shadow를 더 세게 해서 중심을 만들지 않음

## 위험 C — 미니멀 = 빈약함

문제:
- 선과 장식을 걷은 뒤 typography/spacing hierarchy가 약하면 그냥 허전해 보임.

보완:
- title / primary / secondary / meta 단계 고정
- spacing rhythm 엄격히 유지
- selected / hover / disabled 차이를 명확히
- empty/loading/error 상태까지 같은 수준으로 설계

## 위험 D — 업무 화면이라서 모든 공간을 채우기

문제:
- 정보량을 최대화하면 금방 구형 ERP 느낌이 난다.

보완:
- 빈 공간은 낭비가 아니라 grouping 수단으로 사용
- 한 화면에서 지금 필요한 정보만 우선 노출
- 세부값은 Detail로 이동

## 위험 E — 트렌드 장식 추가

금지:
- glassmorphism
- 과한 gradient
- 불필요한 blur
- oversized headline
- decorative animation
- floating CTA 남발

이런 것은 “최신처럼 보이기” 위해 넣지 않는다.

현대성은 다음에서 만든다.

- 명확한 hierarchy
- 빠른 state transition
- contextual Panel
- 적절한 density
- keyboard/focus
- skeleton/loading
- 반응형 composition
- 적은 cognitive load

---

# 15. Density 규칙 — 보완 필요 영역

현재 가장 더 정교화해야 할 영역 중 하나다.

향후 다음 3단 density를 검토한다.

- comfortable
- standard
- compact

단, 사용자가 density switch를 직접 바꾸게 하는 것이 목적이 아니다.
화면/Panel 성격에 따라 적절한 density를 표준이 선택하는 구조가 우선이다.

### 현재 원칙

- compact Panel = 목록 중심
- Detail/Work = compact를 남발하지 않음
- wide list = compact card를 2열로 펼칠 수 있음
- table은 비교/대량 처리에 본질적으로 유리할 때만

---

# 16. Interaction state — 반드시 완성해야 하는 규격

모든 interactive component는 다음 상태를 고려한다.

1. default
2. hover
3. pressed
4. selected
5. focus-visible
6. disabled
7. loading/busy
8. empty
9. error
10. stale/offline/readonly — 필요한 경우

### 특히 주의

- hover와 selected가 같은 표현이면 안 된다.
- loading 중 중복 제출을 막는다.
- readonly와 disabled를 구분한다.
- focus-visible을 제거하지 않는다.
- 색 하나만으로 상태를 설명하지 않는다.

---

# 17. Component reuse 규칙

새 화면을 만들기 전에 반드시 기존 부품으로 조합 가능한지 확인한다.

현재 핵심:

- `Screen`
- `Panel`
- `PanelHead`
- `PanelBody`
- `PanelFoot`
- `SearchBar`
- `QuickFilter`
- `FilterSheet`
- `RowCards`
- `RowCard`
- `Tile`
- `TileGroup`
- `Badge`
- `AutoSelect` (QuickFilter 안 월/분류 드롭다운 — 새 조건 셀렉트가 필요하면 이것부터 재사용)
- `ProductDetail`
- `SettlementDetail`

## 절대 규칙

**새로운 화면은 새 디자인을 만드는 일이 아니라, 기존 업무 패턴과 컴포넌트를 조합하는 일로 시작한다.**

필요한 primitive/pattern이 없으면:

1. 기존 부품으로 해결 가능한지 재검토
2. 정말 공통 패턴이면 FreePass Admin standard에 먼저 추가
3. 그 다음 화면에서 사용

화면 안에서 일회성 디자인을 먼저 만들지 않는다.

---

# 18. Anti-patterns

다음은 기본 금지한다.

- 폐기된 §4 PageHeader / erp-cols 재도입
- 화면마다 별도 card system
- 같은 entity를 화면마다 다른 Detail UI로 구현
- 검색창만 있고 필터 버튼이 없는 목록
- QuickFilter 위치를 화면마다 바꿈
- 월/상태 dropdown을 검색창 줄에 임의로 삽입
- 목록 Panel인데 compact 규격을 무시
- 선택된 menu/card에 decorative left bar 추가
- 상단 navigation 중복
- 버튼 radius/height 개별 생성
- inline style로 안정값 고정
- 임의 status color
- screenshot을 코드보다 정본으로 취급
- 테스트 화면/mockup을 현재 production design으로 오인

---

# 19. AI 작업 Preflight

FreePass Admin UI를 만지기 전에 AI는 반드시 확인한다.

```
FreePass Admin UI preflight

- repository: freepass-creator/freepass-admin
- branch:
- HEAD revision:
- target screen:
- current Panel composition:
- reused components:
- new component/pattern needed?:
- desktop/mobile scope:
- visual verification required:
```

그리고:

1. branch HEAD 새로 조회
2. 해당 화면 source 읽기
3. `parts.tsx` 및 공용 detail 확인
4. `erp-standard.css` token 확인
5. 과거 screenshot보다 현재 코드 우선
6. 변경 후 typecheck/test/build
7. 실제 browser screenshot으로 visual check

---

# 20. 현재 확정 여부

2026-09-24 기준:

### 확정
- Minimal + Simple 방향
- PC Panel architecture
- 화면별 Panel composition
- 목록 순서: Search+Filter → QuickFilter → RowCards
- compact / wide 역할
- ProductDetail 재사용
- Settlement/Performance 3 Panel
- 전자계약 2 Panel
- Sidenav 중심 navigation
- Topbar는 정보 중심
- 구형 §4 skeleton 제거

### 계속 고도화
- density 세부 수치
- empty/loading/error visual
- 모바일을 최신 Panel grammar에 맞추는 작업
- 더 정교한 accessibility/keyboard behavior
- 실제 운영 데이터에서 정보량 검증
- 장시간 사용하는 직원 기준 fatigue 검증
- small laptop / 1280 width에서 3 Panel readability 검증

---

# 21. AI Core 승격 전 체크

이 규격을 AI Core로 승격하기 전에 FreePass Admin에서 먼저 검증한다.

승격 후보 조건:

- 실제 업무에서 반복 사용
- 상품/접수/실적/정산/전자계약 모두 동일 문법으로 안정화
- PC 1280/1440 이상 검증
- 모바일 360/390/412 검증
- Visual QA
- 접근성/keyboard/focus 검증
- 특정 FreePass 도메인에만 필요한 부분과 전사 공통 부분 분리
- AI가 이 문서만 읽고도 임의 재설계 없이 같은 화면을 만들 수 있음

**FreePass Admin에서 검증되지 않은 아이디어를 AI Core의 전사 규칙으로 먼저 고정하지 않는다.**

---

# 22. 최종 요약

> **FreePass Admin의 기본 UI는 Minimal Operational UI다.**
>
> 화면은 Panel로 조립하고, 목록은 Search+Filter → QuickFilter → RowCards 순서를 지킨다.
> 같은 entity는 같은 Detail component를 쓴다.
> 업무 action은 PanelFoot에 둔다.
> 시각적 구분은 border보다 spacing·surface·typography를 먼저 쓴다.
> PC는 multi-panel로 context를 유지하고, 모바일은 한 업무 surface에 집중한다.
> 새로운 화면은 새로운 디자인이 아니라 기존 pattern의 조합으로 시작한다.
