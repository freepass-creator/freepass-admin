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

# 11. Typography — normalized scale

FreePass Admin의 실제 Product Scale은 아래 6단계로 제한한다.

| 단계 | 값 | 용도 |
|---|---:|---|
| KPI | 24px | 큰 숫자·핵심 KPI만 |
| Screen | 20px | 정말 필요한 화면 단위 제목 |
| Panel | 18px | Panel / local screen title |
| Section | 16px | section heading이 필요한 경우 |
| Body | 14px | 본문·값·버튼·입력 |
| Support | 12px | label·meta·caption·보조정보 |

### 원칙

- 새 UI에서 **11.5 / 13 / 15 / 17 / 22px 위계를 만들지 않는다.**
- Panel title을 Screen title 크기로 반복하지 않는다.
- 계층이 필요하면 font-size를 늘리기 전에 weight / spacing / surface를 먼저 사용한다.
- 숫자는 tabular alignment를 유지한다.
- 예외는 로그인 BI, 브라우저 zoom 방지용 모바일 input 16px 등 명시된 경우만 허용한다.

### 구현

PC 최신 ERP는 generated `erp-standard.css`를 직접 수정하지 않고
`src/app/_erp/shell.css`에서 Product Scale로 override한다.

Mobile/legacy Admin은 기존 18 / 14 / 12 체계를 유지하며,
향후 공통 component 통합 시 동일 semantic scale로 수렴한다.

---

# 12. Spacing / Radius / Control — normalized scale

## Spacing

기본 scale:

`4 / 8 / 12 / 16 / 20 / 24 / 32`

- 4: label ↔ value처럼 아주 가까운 관계
- 8: control/card 내부 기본 gap
- 12: compact item/panel 내부 간격
- 16: section/panel 기본 rhythm
- 20: desktop panel outer padding / 넓은 내부 여백
- 24: 큰 section 분리
- 32: 큰 화면 수준 여백이 정말 필요할 때

### 금지

- 새 안정값으로 10 / 14 / 18 / 22 같은 off-scale spacing 생성
- page별 독자 padding/gap
- optical correction을 일반 layout token처럼 확대

## Radius

`4 / 6 / 8 / pill`

- 4: 작은 구조요소
- 6: control
- 8: card/panel/badge
- pill: 의미상 capsule인 selection/status만

새 radius 단계는 만들지 않는다.

## Desktop control

| 단계 | 높이 |
|---|---:|
| Small control | 32px |
| Standard control | 36px |
| Data row | 40px |
| Topbar | 56px |

검색/버튼/셀렉트가 같은 줄에 서면 같은 height tier를 사용한다.
QuickFilter처럼 의도적으로 작은 control만 32px을 사용한다.

## Mobile control

- Standard control: **44px**
- Action: **44px**
- Touch minimum: **44px**
- Bottom navigation: **56~60px**

## Action 비율

- 1개: 100%
- 2개: 3 : 7
- 3개: 3 : 3 : 4

Primary의 우선순위는 높이/elevation 차이가 아니라 색·weight·위치로 표현한다.

## Elevation

`0 / base / hover / float`

- 0: screen / signal
- base: card / button / field
- hover: interactive hover/focus
- float: dropdown / sheet / popover

그 이상 elevation 단계는 만들지 않는다.

---

# 13. Responsive / Shell 원칙

**같은 업무 부품을 쓰되, Web과 Mobile의 shell composition은 다르다.**

모바일은 PC 축소판이 아니다.

## Web shell

```
Topbar
Sidenav | Multi-panel workspace
Statusbar
```

- 전역 Topbar 있음
- 좌측 Sidenav 있음
- 2~3 Panel 동시 노출 가능
- 하단 Statusbar 있음
- context 유지와 비교/반복 업무 속도 우선

## Mobile shell

```
[ Current Panel ]
[ Global bottom tabs ]   ← depth 0

또는

[ Current Panel ]
[ Local ActionBar ]      ← depth 1+
```

- **전역 Topbar 없음**
- Sidenav 없음
- Statusbar 없음
- 현재 Panel이 화면 최상단부터 시작
- depth 0에서는 전역 하단탭
- depth 1+에서는 전역 하단탭을 숨기고 해당 Panel의 ActionBar만 노출
- 한 번에 하나의 업무 surface
- 깊이에 따라 list → detail → work

## Panel role vs navigation depth

둘은 반드시 구분한다.

### Panel role
시각/업무 책임이다.

- `list`
- `detail`
- `work`

### Navigation depth
모바일에서 지금 몇 단계 들어와 있는지다.

- depth 0
- depth 1
- depth 2

URL의 `v=list|detail|work` 같은 값은 **navigation state**일 수 있으며,
Panel role과 1:1로 같다고 가정하지 않는다.

예:
- 정산관리 가운데 「실적 줄」은 모바일 navigation 상 `detail` 단계에 있지만,
  역할은 **LIST Panel**이다.
- 신규 접수는 navigation 상 `work`이면서 역할도 **WORK Panel**이다.

따라서:
- **어떤 Panel을 보여줄지 = route/navigation state**
- **어떻게 보여줄지 = data-panel-role**

이 분리를 깨지 않는다.


## 같은 것 / 다른 것

### Web과 Mobile에서 같은 것
- business state
- command 의미
- Panel content contract
- Search / Filter / QuickFilter
- RowCard / Detail / Tile
- Button hierarchy
- selected / hover / pressed / disabled 의미
- color / typography / spacing token
- validation / loading / error 의미

### Web과 Mobile에서 다른 것
- 전역 shell
- 동시에 보이는 Panel 수
- navigation 위치
- global context 노출 방식
- action boundary의 화면 배치

### 핵심 문장

> **Same component semantics, adaptive shell composition.**

같은 컴포넌트를 쓴다는 말은 Web과 Mobile의 화면을 똑같이 복사한다는 뜻이 아니다.
업무 의미와 부품 contract는 같고, viewport에 따라 shell과 배치가 달라진다.

현재 `≤900px`에서는 PC `.erp-screen`을 숨기고 mobile board를 사용한다.
모바일의 기존 전역 `fn-top` 상태바는 2026-09-24 결정으로 제거했다.

향후 모바일 최신화 기준:
**PC의 Panel 하나를 떼어 모바일 한 화면으로 놓아도 같은 업무를 끝낼 수 있어야 한다.**

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

# 16. Surface type / Interaction hierarchy — 2026-09-24 확정

**물성은 타입이 정하고, 상호작용은 hover/press가 정한다.**

카드가 읽기 전용이라고 바닥에 붙이지 않는다.
카드면 카드답게 기본적으로 한 단계 떠 있어야 하고,
버튼이면 버튼답게 기본적으로 한 단계 떠 있어야 한다.

## 16-1. 기본 높이

| Type | 기본 상태 | 외곽선 | Hover |
|---|---|---|---|
| Card / Box | elevation-base | 없음 | interactive일 때만 |
| Button / Control | elevation-base | 없음 | 있음 |
| Input / Search | elevation-base | 없음 | focus 중심 |
| Panel | Web=base / Mobile=0 | 없음 | 없음 |

핵심:
- **Card와 Button은 같은 기본 elevation 선상에서 시작한다.**
- Primary라고 기본 높이를 더 올리지 않는다.
- 우선순위는 색·weight·위치가 말한다.
- elevation은 “누를 수 있음”의 유일한 신호가 아니다.

## 16-2. Borderless polish — 2026-09-24

현재 확정 레이아웃·크기·간격·타이포·라운드는 **변경하지 않는다.**
이 단계는 리디자인이 아니라 **보이는 외곽선만 걷는 polish**다.

### Card / Panel
- visible border 없음
- 기존 box model은 유지
- surface 색 + elevation으로 경계를 읽는다
- 목록 카드가 텍스트로 사라지지 않도록 기본 elevation은 유지한다

### Button / QuickFilter / Control
- visible border 없음
- 버튼 크기·padding·radius는 그대로
- surface 색 + elevation으로 조작물임을 표현
- interactive일 때만 hover / press가 생긴다

### Input / Search
- 일반 input/select/textarea는 입력 가능한 영역이 분명해야 하므로 필요한 경계를 유지할 수 있다
- **Search는 borderless**를 기본으로 한다
- 검색 구조와 크기·padding·radius는 그대로 유지한다
- 평소: 돋보기 + 옅은 neutral surface + base elevation
- hover: surface만 미세하게 변함
- focus: 선/밑줄/사각 ring 대신 surface + elevation이 한 단계 또렷해짐
- 검색창을 라인으로 둘러싸서 카드/버튼 체계와 다른 시각 언어를 만들지 않는다

### Geometry 보호
- border 제거 때문에 1px씩 크기가 변하지 않게 한다
- 가능하면 `border: 0` 대신 기존 border box를 유지한 채 `border-color: transparent`를 쓴다
- 이 polish를 이유로 width/height/padding/gap/font-size/radius를 바꾸지 않는다

## 16-3. Interactive vs Passive

### Passive card
- 기본 elevation 유지
- hover 없음
- pressed 없음

### Interactive card / button
- 기본 elevation은 passive card와 동일
- hover 시 한 단계 올라감
- press 시 shadow가 사라지며 1px 내려앉음

즉:

```
같은 타입 = 같은 기본 물성
interactive 여부 = hover / press 존재 여부
```

## 16-4. Selected

selected는 더 떠오르는 상태가 아니다.

```
default  = elevation-base
hover    = elevation-hover
pressed  = 내려앉음
selected = 눌려 고정된 surface
```

- selected에서 elevation을 강화하지 않는다.
- selected + hover에서도 다시 올라오지 않는다.
- QuickFilter / Filter / Offer / RowCard가 같은 selected 문법을 쓴다.
- decorative left bar / 두꺼운 outline 추가 금지.

## 16-5. Token

Desktop:
- `--fp-elevation-base`
- `--fp-elevation-hover`
- `--fp-elevation-float`
- `--fp-line-card`
- `--fp-line-control`
- `--fp-line-input`

Mobile/legacy Admin:
- `--ui-elevation-base`
- `--ui-elevation-hover`
- `--ui-elevation-float`
- `--ui-line-card`
- `--ui-line-control`
- `--ui-line-input`

FreePass Admin에서 검증한 뒤 AI Core 승격 후보로 삼는다.

---

# 16-A. Interaction state — 반드시 완성해야 하는 규격

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


# 23. 2026-09-24 전수 규격 감사 — 페이지별 독자 UI 금지

FreePass Admin 전체 UI를 다시 분류한 결과, **내부 관리자 업무 화면에는 페이지별 독립 디자인을 두지 않는다.**

## 23-1. 내부 Admin — 공통 규격 강제

대상:
- 상품찾기
- 계약접수
- 실적
- 정산관리
- 전자계약 관리
- 데이터 상태
- 접수/정산의 내부 입력·처리 화면

이 화면들은 업무 내용이 달라도 시각 규칙은 공통이다.

공통으로 가져오는 것:
- shell / navigation
- Panel / PanelHead / PanelBody / PanelFoot
- Search / Filter / QuickFilter
- List / RowCard
- Detail / Tile
- Button / ActionBar
- selected / hover / pressed / disabled
- elevation
- typography / spacing / radius / color
- empty / warning / success / error
- focus-visible / reduced-motion

도메인별 파일은 **데이터·문구·validation·workflow만 소유**한다.

예:
- MoneyForm은 금액 계산과 필드 구성을 소유할 수 있다.
- LifeForms는 청구/지급 업무 입력을 소유할 수 있다.
- 그러나 버튼의 높이·radius·shadow·pressed·selected 색을 자체 정의하면 안 된다.

## 23-2. 명시적 별도 Surface

다음은 내부 관리자 업무화면과 audience/shell이 다르므로 별도 surface로 인정한다.

1. `/login`
   - 인증 전 진입 화면
2. `/c/[token]`
   - 공급사/외부 상대방 확인·이의 화면
3. `/sign/[token]`
   - 고객 전자계약·서명 화면

이 세 화면도 임의 디자인을 허용한다는 뜻은 아니다.
내부 Admin의 Panel composition을 그대로 강제하지 않을 뿐이며,
향후 typography / button / interaction / accessibility 같은 상위 원칙은 공통화 대상으로 본다.

**새로운 별도 surface는 자동 허용하지 않는다.**
필요하면 이 목록에 사유를 먼저 기록한다.

## 23-3. 현재 남은 구조적 부채

### A. 두 세대의 공통 부품

현재:
- PC 최신 ERP: `_erp/*`
- 모바일/기존 board: `_design/*` + `dz-*`

둘 다 “페이지별 디자인”은 아니지만 공통 primitive가 두 세대로 존재한다.

정리 방향:
- 당장 억지 병합하지 않는다.
- semantics와 interaction hierarchy부터 동일하게 유지한다.
- 모바일 최신화 시 Panel / List / Action의 공통 contract로 수렴한다.

### B. 도메인 CSS class

`dz-money`, `dz-life-form`, `dz-intake-form`처럼 업무 이름이 붙은 class가 있다.

허용:
- layout
- domain-specific field grouping
- business state 표시를 위한 hook

금지:
- 독자 button system
- 독자 radius
- 독자 elevation
- 독자 typography scale
- 독자 selected/pressed language
- 독자 status palette

## 23-4. Interaction hierarchy 통일 완료

PC와 mobile/legacy Admin board 모두 같은 원칙을 쓴다.

```
read-only card → base elevation, no hover
surface        → base elevation
interactive→ elevation + hover
pressed    → sinks
selected   → pressed/locked surface
primary    → strongest tactile affordance
disabled   → flat
```

선택은 elevation을 키우지 않는다.
**selected = 눌려 고정된 상태**다.

## 23-5. CI Guard

`scripts/check-ui-ssot.mts`가 내부 관리자 화면에서 다음을 막는다.

- raw 공통 markup 재도입
- inline visual style
- page-local `<style>`
- JSX 안의 안정적인 visual constant
- public/login surface class prefix의 Admin 내부 유입
- SSOT token drift

페이지가 자기 디자인을 만들 필요가 생겼다고 느껴지면,
페이지에서 바로 만들지 않고 **공통 규격에 먼저 추가할지 판단**한다.

---



# 24. Line-free UI standard — 2026-09-24

FreePass Admin은 visible border에 의존하지 않는다.

## 24-1. 기본 원칙

위계는 다음 순서로 만든다.

1. surface
2. elevation
3. spacing
4. typography
5. state color
6. interaction

border는 기본 위계 수단이 아니다.

## 24-2. 공통 control

다음은 visible border를 기본적으로 사용하지 않는다.

- Button
- QuickFilter
- Dropdown
- Select
- Input
- Search
- Card
- Tile
- RowCard
- Panel 내부 구획
- FilterSheet / Popover 외곽

### Input / Select / Search

입력 가능한 영역은 선 대신 다음으로 구분한다.

- neutral surface
- base elevation
- focus 시 surface 변화
- focus 시 elevation 강화
- placeholder / icon / caret

focus ring을 사각 border처럼 상시 보이게 만들지 않는다.
접근성 focus-visible 의미는 유지하되 line-free 문법 안에서 표현한다.

## 24-3. Dropdown / Popover

Dropdown / FilterSheet / floating menu는 별도 border를 쓰지 않는다.

- surface
- float elevation
- spacing
- selected state

로 구분한다.

## 24-4. Table / Row

행선·셀선에 의존하지 않는다.

- header surface
- zebra surface가 필요하면 약하게 사용
- hover
- selected
- spacing / alignment

으로 읽기 흐름을 만든다.

필요한 숫자 정렬과 column alignment는 유지한다.

## 24-5. Panel — Web / Mobile

Panel은 viewport에 따라 역할이 다르다.

### Web Panel

Web에서는 Panel이 **canvas 위의 큰 surface island**다.

- canvas: neutral background
- panel: surface
- panel border: 없음
- elevation: base
- gap으로 panel 간 경계 확보
- panel 내부 header/body/footer도 line 없이 spacing으로 구분

즉 Web에서 Panel은 “조금 떠 있는 큰 판”이다.

### Mobile Panel

Mobile에서는 한 번에 한 Panel만 보므로 Panel 자체를 카드처럼 띄우지 않는다.

- Panel = screen surface
- panel border: 없음
- panel shadow: 없음
- child card/control만 elevation 사용
- PanelHeader가 화면의 local header 역할
- depth 0: bottom global tabs
- depth 1+: local ActionBar

즉 Mobile에서 Panel은 “현재 화면 그 자체”다.

## 24-6. Geometry freeze

Line-free 전환을 이유로 다음을 바꾸지 않는다.

- width
- height
- padding
- gap
- radius
- typography
- panel composition
- navigation structure

가능하면 border box는 유지하고 color만 transparent로 바꿔 geometry drift를 막는다.



# 25. Semantic state standard — 일반 UI 관례 기반

FreePass Admin의 상태 표현은 역할별로 분리한다.

## 25-1. Badge = Signal

Badge/Tag/Perk는 상태를 **보여주는 것**이다.

- hover 없음
- press 없음
- elevation 없음
- cursor pointer 없음
- semantic color + text
- 선택 control처럼 보이면 안 됨

예:
- 완료
- 보류
- 경고
- 상품구분
- 출고상태
- 혜택조건

## 25-2. Button = Action

Button은 **행동을 실행하는 것**이다.

- base elevation
- hover 가능
- pressed 가능
- disabled는 elevation 제거
- Primary/Secondary는 높이가 아니라 surface color와 weight로 위계 구분

Primary:
- brand solid surface
- white text
- 같은 base elevation

Secondary:
- neutral/soft surface
- dark text
- 같은 base elevation

## 25-3. QuickFilter / Toggle = Selection control

QuickFilter는 **값을 선택하는 control**이다.

기본:
- soft surface
- base elevation

hover:
- surface 변화
- elevation 상승

selected:
- brand surface
- on-primary text
- 눌려 고정된 shadow
- hover해도 다시 뜨지 않음

## 25-4. Card

### Passive Card
- base elevation
- hover 없음
- press 없음

### Interactive Card
- base elevation
- hover 상승
- press 내려앉음

### Selected Card
- primary weak/tint surface
- inset pressed state
- 더 떠오르지 않음

## 25-5. Field

Input/Search/Select/Dropdown은 visible border 없이 다음으로 구분한다.

- soft surface
- base elevation
- focus halo
- focus 시 surface 밝아짐
- placeholder/icon/caret

keyboard focus는 반드시 보이되,
solid outline/border 대신 **soft focus halo**를 기본으로 한다.

## 25-6. Popup / Sheet

- surface white
- float elevation
- border 없음
- 내부 선택 상태는 Selection control 규칙 사용

## 25-7. Canvas / Panel

### Canvas
- very light blue-gray
- current FreePass Admin base: `#F2F6FC`

### Web Panel
- white
- base elevation
- border 없음

### Mobile Panel
- white
- shadow 없음
- screen surface 자체

## 25-8. 금지

- Badge에 hover/pressed 넣기
- Primary만 더 높이 띄우기
- selected를 outline으로 표시
- 색 의미와 interaction 의미 혼용
- page별 shadow 강도 생성
- page별 focus style 생성
- line을 다시 기본 hierarchy 수단으로 사용


# 26. Surface depth hierarchy — Canvas / Panel / Card

Line-free UI에서 shadow만으로 위계를 만들지 않는다.
색의 밝기 단계와 elevation을 함께 쓴다.

| Layer | Surface | 역할 |
|---|---|---|
| Canvas | `#F2F6FC` | 가장 바깥 작업 배경 |
| Panel | `#FFFFFF` | 하나의 업무 surface |
| Component / Card | `#F7F9FC` | Panel 내부 entity / info 단위 |
| Hover | `#F3F6FA` | interactive 순간 상태 |
| Selected | `#EAF1FF` | 선택 고정 상태 |
| Popup / Sheet | `#FFFFFF` + float elevation | 떠 있는 transient surface |

## 원칙

- Panel과 Card가 같은 resting surface를 쓰지 않는다.
- 위계가 약하다고 shadow를 더 세게 하지 않는다.
- Card/Field/Secondary control은 같은 cool surface family를 쓸 수 있다.
- 역할 차이는 interaction semantics로 구분한다.
- Selected는 회색을 더 진하게 하는 것이 아니라 primary tint로 표현한다.
- Web Panel은 Canvas 위에서 base elevation.
- Mobile Panel은 screen surface이므로 shadow 없음; child card만 component surface를 쓴다.


# 27. Interaction state matrix — final

Line-free UI에서도 접근성 상태는 반드시 보인다.
다만 focus만 예전 outline 문법으로 돌아가지 않는다.

| Role | Default | Hover | Pressed | Selected | Focus | Disabled |
|---|---|---|---|---|---|---|
| Badge / Signal | semantic surface | 없음 | 없음 | 해당 없음 | control 아님 | 의미 약화만 |
| Button | base elevation | hover elevation | sink | 해당 없음 | soft halo | flat + opacity |
| QuickFilter / Toggle | soft surface | hover elevation | sink | brand surface + locked | selected 유지 + halo | flat + opacity |
| Interactive Card | component surface | hover elevation | sink | primary tint + locked | state 유지 + halo | flat |
| Field / Search / Select | soft surface | 선택적 | 해당 없음 | 해당 없음 | white surface + halo | muted |
| Popup / Sheet | white + float | 내부 항목만 | 내부 항목만 | 내부 항목만 | 내부 항목 halo | - |

## Focus 규칙

- keyboard focus-visible은 제거하지 않는다.
- solid outline/border를 기본 focus 표현으로 쓰지 않는다.
- soft halo를 사용한다.
- selected + focus에서는 selected 상태를 유지하고 halo만 추가한다.
- disabled는 focus/hover/press elevation을 갖지 않는다.
- Badge/Tag/Signal은 focusable control처럼 보이지 않는다.


# 28. Density contract — standard

FreePass Admin은 사용자 선택형 density switch보다
화면 역할에 맞는 **고정된 표준 밀도**를 우선한다.

## Desktop

| 영역 | 높이 |
|---|---:|
| PanelHead | 48px |
| Search / Query row | 52px |
| QuickFilter row | 48px |
| PanelFoot | 60px |
| Compact RowCard | 최소 64px |
| Standard RowCard | 최소 72px |
| Standard control | 36px |
| Small control | 32px |
| Data row | 40px |

## Mobile

| 영역 | 높이 |
|---|---:|
| PanelHead | 56px |
| Standard control | 44px |
| Action | 44px |
| RowCard | 최소 88px |
| Bottom navigation | 56~60px |

## Rhythm

- section separation: 16px
- list/card gap: 12px
- control gap: 8px
- compact item inner gap: 8px
- card/item padding: 12px
- panel/content padding: 16~20px

## 예외

검색창 내부의 embedded filter trigger처럼
상위 control 안에 들어가는 보조 control만 32px을 허용한다.

## 금지

- 화면별 임의 33/34/42px control
- 같은 역할인데 Panel마다 다른 header/footer 높이
- card 높이를 내용마다 임의로 줄여 목록 리듬이 흔들리는 것
- density를 이유로 typography scale을 새로 만드는 것


# 29. Alignment & information hierarchy

## 기본 정렬

- 텍스트 / 이름 / 설명 / 상태 문구: **좌측**
- 숫자 / 금액 / 합계 / 비율: **우측**
- 숫자는 tabular-nums 사용
- 상태 Badge는 내용 폭만 차지
- 주요 Action은 PanelFoot

## RowCard 정보 순서

### 1행
식별 정보
- 고객명
- 차량명
- 계약번호
- 상태 Badge

### 2행
보조 정보 / metadata
- 차량번호
- 공급사
- 영업채널
- 날짜
- 조건

### 3행 / 우측 끝
결과 / 금액
- 대여료
- 청구액
- 지급액
- 수수료
- 기간/단위

좁은 Panel에서는 내용을 무작정 여러 줄로 늘리지 않는다.
식별 정보와 meta는 말줄임을 우선하고,
핵심 금액/결과는 우측 정렬 상태를 유지한다.

## PanelHead

- 왼쪽: kind + title
- 오른쪽: count / status summary
- 중간 action 금지
- title은 말줄임 허용
- count는 고정 폭이 아니라 content width + tabular nums

## 금지

- 금액을 카드마다 좌/우 다르게 배치
- 같은 데이터 타입인데 화면별 정렬 다르게 적용
- status badge를 금액보다 더 큰 시각적 위계로 만들기
- 좁은 패널에서 긴 문자열 때문에 카드 전체 폭/높이 깨뜨리기


# 30. List information budget

목록은 **판단을 위한 최소 정보**, 상세는 **확인을 위한 전체 정보**를 담당한다.

## 기본 예산

한 목록 카드/행은 기본적으로 다음까지만 노출한다.

1. 식별 정보 1개
2. 상태 1개
3. meta 1줄
4. 핵심 값 1개
5. 운영상 위험/예외가 있으면 flag 1개

PC의 넓은 RowCard는 추가 facts를 **최대 2개**까지 허용한다.

## 목록에서 빼는 정보

다음은 상세에서 확인 가능한 경우 목록에서 기본적으로 제외한다.

- 생성일/발송일/서명일 등 보조 날짜
- 내부 코드
- 담당자와 공급사 등 이미 다른 meta로 충분히 식별되는 값
- 양식/보험처럼 현재 의사결정에 직접 필요하지 않은 설정값
- 같은 의미를 반복하는 상태 수치

## 위험/예외

위험은 숨기지 않는다.

- 여러 위험이 있으면 meta에 전부 나열하지 않고 flag로 승격
- flag는 최대 1개
- 여러 위험을 합칠 때는 핵심 2개까지만 보이고 나머지는 "외 N"으로 압축 가능
- 상세에서는 전체 위험 원인을 유지한다

## 금지

- Badge + meta + 별도 숫자로 같은 상태 반복
- 한 카드에서 4개 이상의 meta segment를 기본 노출
- 목록에서 상세 정보 대부분을 미리 보여주기
- 정보량을 줄인다는 이유로 운영상 경고를 숨기기


# 31. Empty / Loading / Error / Readonly states

예외 상태도 Line-free surface hierarchy를 따른다.

## Empty
- neutral component surface
- support text
- border 없음
- 빈 상태를 경고처럼 과장하지 않는다

## Warning
- amber soft surface
- warning text
- border 없음
- 사용자가 행동해야 하는 이유가 있으면 문구로 설명

## Error
- red soft surface
- error text
- border 없음
- 단순 빨간 글 한 줄로 끝내지 않는다

## Success
- green soft surface
- success text
- border 없음

## Readonly
- muted neutral surface
- no elevation
- no hover / press
- disabled와 구분: 값은 읽을 수 있고 focus/selection 의미는 유지 가능

## Busy / Loading
- 기존 geometry 유지
- opacity만 낮춤
- pointer interaction 잠금
- cursor progress
- 레이아웃 점프 금지

## Stale / Offline
- error보다 약한 neutral/info surface
- 현재 데이터가 최신이 아닐 수 있다는 의미
- destructive color 사용 금지

## 금지
- empty/error/warn을 일반 텍스트 한 줄로만 처리
- loading 때문에 card/panel 크기가 바뀌는 것
- readonly를 disabled와 동일하게 처리
- stale를 error와 같은 붉은 상태로 표현


# 32. Page QA matrix — current structure lock

페이지별 정보는 달라도 shell/pattern은 아래 구조를 벗어나지 않는다.

| 화면 | Web Panel composition | List pattern | Detail | Action |
|---|---|---|---|---|
| 상품찾기 | Wide List + Detail | Search → QuickFilter → RowCards | ProductDetail | Detail PanelFoot |
| 계약접수 | Product List + Product Detail + Work | Search → QuickFilter → RowCards | ProductDetail | Work ActionBar/PanelFoot |
| 실적 | Installment List + Detail + Paid List | Search → QuickFilter → RowCards | SettlementDetail | Detail PanelFoot |
| 정산 | Claim List + Settlement Detail + Pay List | Search → QuickFilter → RowCards | Settlement summary/detail | Detail PanelFoot |
| 전자계약 | Contract List + Detail | Search → QuickFilter → RowCards | Contract detail | Detail PanelFoot |

## 공통 QA 기준

### List Panel
1. PanelHead
2. Search
3. QuickFilter
4. RowCards
5. 필요 시 PanelFoot

이 순서를 바꾸지 않는다.

### Detail Panel
- 동일 entity는 동일 Detail component를 재사용한다.
- 상단에 page-level action을 추가하지 않는다.
- action은 PanelFoot/ActionBar에 둔다.

### Work Panel
- 입력/처리 단계만 소유한다.
- 목록용 filter/search를 억지로 넣지 않는다.
- primary action은 하단 고정 영역에 둔다.

## Page QA 결과 — 2026-09-24

- 상품찾기: 구조 적합
- 계약접수: 구조 적합
- 실적: 구조 적합
- 정산: 구조 적합
- 전자계약: 구조 적합
- residual visible navigation divider 제거
- route-level error fallback semantic surface 적용

이 QA는 **코드 구조 기준**이다.
실제 viewport별 visual regression은 별도 screenshot/browser QA에서 확인한다.


# 33. Responsive width contract

## Desktop viewport tiers

### 1280~1439
- 3-panel 구조 유지
- workspace gap: 12px
- workspace padding: 12px / 16px
- compact RowCard의 identity가 먼저 줄어듦
- amount/status는 가능한 한 유지
- QuickFilter는 필요 시 내부 horizontal scroll
- page 자체 horizontal overflow 금지

### 1440+
- standard density
- workspace gap: 16px
- workspace padding: 16px / 20px

## Mobile target widths

반드시 다음 폭에서 가로 overflow 없이 동작해야 한다.

- 360px
- 390px
- 412px

### Mobile rules
- Panel은 1개만 보임
- page horizontal scroll 금지
- QuickFilter / Tabs / OfferPicker / Month selector만 내부 horizontal scroll 허용
- 긴 identity/meta는 ellipsis
- 금액/결과는 우측 정렬 유지
- 360-class에서는 touch height를 줄이지 않고 horizontal padding만 줄임

## 금지
- 1280에서 Panel 자체를 숨기거나 구조를 바꾸기
- 모바일에서 44px touch target 축소
- 긴 문자열 때문에 viewport 자체가 넓어지는 것
- 금액을 줄바꿈해 카드 높이를 예측 불가하게 만드는 것


# 34. Color contrast & semantic palette

## Text contrast

- strong text: `#101828` / mobile equivalent dark text
- secondary text: `#475467`
- muted/support text: **`#667085` 이상**
- 12px support/meta에 `#98A2B3`처럼 너무 옅은 색을 기본값으로 쓰지 않는다

## Navigation

- dark nav background 유지
- inactive nav text는 충분한 대비를 가진 neutral
- active는 brand/navy surface + white text
- active indicator는 보조 역할이며 선택 의미의 유일한 신호가 아니다

## Semantic colors

- Success: green text + green soft surface
- Info: blue text + blue soft surface
- Warning: amber text + amber soft surface
- Error: red text + red soft surface
- Neutral: gray text + neutral soft surface

색 하나만으로 의미를 전달하지 않는다.
Badge/Notice에는 반드시 텍스트 의미가 함께 있어야 한다.

## 원칙

- 대비가 부족하다고 모든 텍스트를 진하게 만들지 않는다
- body/secondary/muted 세 단계만 유지
- 상태색 saturation을 과하게 올리지 않는다
- dark nav와 light workspace는 brand blue 계열로 연결한다


# 35. Icon & touch target contract

아이콘 크기와 누르는 영역은 별개다.

## Desktop

| 용도 | Glyph | Hit area |
|---|---:|---:|
| Small inline icon | 16px | parent control |
| Navigation icon | 18px | nav item |
| Icon-only action | 18px | 36×36px |
| Large/status icon | 20px | component-defined |

## Mobile

| 용도 | Glyph | Hit area |
|---|---:|---:|
| Small inline icon | 16px | parent control |
| Standard action icon | 20px | 최소 44×44px |
| Bottom navigation icon | 24px | 최소 44×44px |
| Status/display icon | 20px | non-interactive |

## 원칙

- glyph 크기로 touch target을 대신하지 않는다.
- 모바일 icon-only action은 최소 44×44px.
- 상태/배지/장식 icon은 pointer interaction을 갖지 않는다.
- 클릭 가능한 카드/버튼/선택 control만 pointer cursor를 사용한다.
- icon-only action에는 접근 가능한 이름(aria-label 또는 동등한 accessible name)이 있어야 한다.
- decorative icon은 aria-hidden 처리한다.

## 금지

- 모바일 32×32 icon-only action
- Badge/Status에 pointer cursor
- 장식 icon에 click handler
- 같은 역할의 icon 크기를 화면마다 임의로 바꾸기


# 36. Keyboard & accessibility behavior

## Tabs
- `role="tablist"` / `role="tab"` / `role="tabpanel"`
- 선택 탭만 `tabIndex=0`
- 비선택 탭은 `tabIndex=-1`
- Left / Right Arrow로 탭 이동
- Home = 첫 탭
- End = 마지막 탭
- 탭 전환 후 새 활성 탭으로 focus 이동

## Row selection
- 선택 상태는 시각 카드뿐 아니라 실제 focus target에도 전달한다
- RowCard의 링크는 선택 시 `aria-current`를 가진다
- decorative chevron/icon은 `aria-hidden`

## FilterSheet
- trigger는 `aria-expanded`, `aria-haspopup="dialog"`, `aria-controls`
- dialog가 열리면 focus를 dialog 내부 첫 focusable control로 이동
- Escape / 닫기 / 외부 클릭으로 닫힘
- 닫힌 뒤 focus는 원래 trigger로 복귀
- pending 영역은 `aria-busy`

## Disabled / Readonly
- disabled: interaction 불가, hover/press 없음
- readonly: 값은 읽을 수 있으나 편집 불가
- 둘을 같은 의미로 처리하지 않는다

## 공통
- focus-visible은 soft halo로 명확히 표시
- icon-only action은 accessible name 필수
- 키보드로 도달할 수 없는 핵심 action 금지


# 37. Form validation & submit contract

## Required
- 실제 필수값은 native `required`를 사용한다.
- 시각적 별표는 보조 표기다.
- 필수 여부를 색만으로 표현하지 않는다.

## Error
- 서버 validation error summary는 `role="alert"` + `aria-live="assertive"`.
- field-specific error가 특정될 때만 해당 control에 `aria-invalid="true"`.
- 전체 폼 오류를 모든 입력에 `aria-invalid`로 뿌리지 않는다.
- 오류 surface는 red-soft + readable text, visible border 없음.

## Numeric / Money
- `inputmode="numeric|decimal"` 사용 가능.
- 숫자·금액은 우측 정렬.
- tabular-nums 사용.
- spinner가 필요하지 않은 업무 금액 입력에 `type=number`를 강제하지 않는다.

## Pending / Submit
- form은 `aria-busy="true"`로 pending을 표시.
- 실제 submit control은 disabled 또는 동등하게 중복 제출 방지.
- 버튼 문구는 가능하면 `저장 중…`, `만드는 중…`처럼 현재 상태를 말한다.
- pending 때문에 layout geometry가 바뀌지 않는다.

## Success
- 성공 메시지는 해당 action/form 근처에 표시.
- green soft surface + 텍스트 의미.
- 성공했다고 자동으로 상세 정보를 숨기지 않는다.

## Retry / Failure
- 서버 오류 시 사용자가 입력한 값을 가능한 한 보존한다.
- 실패 후 재시도 경로가 사라지지 않는다.
- destructive action은 일반 저장과 시각적으로 구분한다.


# 38. Action risk hierarchy

액션의 색과 확인 절차는 **문구가 아니라 데이터 변화의 가역성**으로 결정한다.

## Secondary
예:
- 뒤로
- 목록으로
- 입력 취소
- 필터 닫기

특징:
- 데이터 변화 없음
- neutral secondary surface
- 별도 확인 없음

## Caution
예:
- 보류
- 정정 요청
- 청구 링크 거두기
- 다시 발행처럼 기존 결과를 대체하는 동작

특징:
- 재실행/복구 가능
- amber soft surface 가능
- 상황에 따라 설명 문구
- 무조건 confirm을 붙이지 않는다

## Destructive
예:
- 접수 취소
- 인도 완료 되돌림
- 영구 삭제/철회

특징:
- 업무 흐름이나 원장 상태에 큰 영향
- red soft surface + red text
- 일반 Primary보다 더 크게 띄우지 않는다
- 실행 직전 확인
- 확인 문구는 결과를 구체적으로 설명한다

## 원칙
- "취소"라는 단어가 있다고 모두 destructive가 아니다.
- destructive는 하단 primary와 경쟁하지 않게 별도 위험 표현을 사용한다.
- 복구 액션(예: 취소 풀기)은 danger로 칠하지 않는다.
- 위험 액션도 disabled/pending 규칙을 동일하게 따른다.


# 39. Motion & immediate feedback

업무 UI의 모션은 장식이 아니라 **입력 확인 피드백**만 담당한다.

## Timing
- press: 80ms
- hover / selected / focus state: 120ms
- popup / sheet: 160ms
- easing: ease-out
- press sink: 1px

## 원칙
- scale 확대/축소로 타격감을 만들지 않는다.
- 눌림은 1px sink + elevation 변화 정도로 충분하다.
- hover가 없는 모바일에서도 active feedback은 유지한다.
- pending 시 geometry를 바꾸지 않는다.
- pending opacity는 약 0.72.
- pointer interaction은 잠근다.
- 진행 중인 버튼은 가능하면 텍스트로 현재 상태를 말한다.

## Filter / async
- 필터 결과 갱신 중에는 값 영역만 약하게 dim.
- 전체 화면을 불필요하게 막지 않는다.
- skeleton/spinner는 장시간 로딩에서만 필요할 때 사용한다.

## Reduced motion
`prefers-reduced-motion: reduce`에서는 transition/animation을 사실상 제거한다.

## 금지
- 200~300ms 이상의 장식성 page transition
- bounce / spring
- 버튼 scale-up
- loading 때문에 layout이 움직이는 것
- 화면별 임의 transition duration


# 40. Terminology & microcopy contract

UI 표시문구와 도메인 enum은 분리한다.
도메인 값은 기능 호환을 위해 유지할 수 있지만, 화면에 보이는 말은 표준 용어를 따른다.

## 기본 원칙

- 상태명: 명사형
- 버튼/액션: 동사형
- 날짜 값: `~일`
- 금액 값: `~금액`, `월 대여료`, `수수료`
- 같은 개념은 화면마다 다른 별칭을 만들지 않는다
- 설명문은 짧고 행동 중심으로 쓴다

## 표준 용어

| 비표준/혼용 | 표준 표시 |
|---|---|
| 할일 | 할 일 |
| 영업 담당 | 영업담당 |
| 렌탈료 | 월 대여료 |
| 만든 때 | 생성일 |
| 발송 (날짜 의미) | 발송일 |
| 서명 (날짜 의미) | 서명일 |
| 돈 고치기 | 금액 조정 |

## 상태 vs 액션

예:
- 상태: `인도 완료`
- 액션: `인도 완료 처리` 또는 문맥상 `인도 완료`
- 상태: `정정`
- 액션: `정정 요청`, `정정 저장`
- 상태: `취소됨`
- 액션: `접수 취소`, `취소 풀기`

## 버튼 문구

버튼은 무엇이 일어나는지 바로 알 수 있어야 한다.

좋음:
- 접수 저장
- 차량번호 저장
- 인도 완료
- 청구서 발행
- 서명본 열기
- 정정 요청

피함:
- 확인
- 처리
- 실행
- 적용

단, 이미 화면 문맥상 대상이 명확한 경우 짧은 표현은 허용한다.

## 설명문

- 한 문장에 한 행동만 설명
- 내부 구현 용어를 사용자 문구로 노출하지 않는다
- ERP5/원장 같은 운영상 필요한 고유명은 예외
- 긴 안내는 상세/Notice로 보내고 버튼/목록 문구는 짧게 유지


# 41. End-to-end business flow contract

FreePass Admin은 화면 모음이 아니라 하나의 운영·정산 흐름이다.

```
상품 찾기
→ 접수
→ 계약서 / 차량번호 / 인도
→ 공급사 청구 가능 상태
→ 청구서 / 공급사 확인 / 계산서
→ 공급사 수금
→ 영업자 지급 가능 상태
→ 지급명세 / 영업채널 확인
→ 영업자 지급
→ 완료
```

## 공통 Workflow Phase

모든 화면은 아래 상위 phase를 같은 도메인 함수로 읽는다.

1. 접수 진행
2. 공급사 청구
3. 공급사 수금
4. 영업자 지급
5. 완료
6. 취소

화면별로 별도 phase 판정 로직을 만들지 않는다.

## 정산대상 예외

- `공급` only: 공급사 수금 후 완료
- `영업` only: 접수/인도 뒤 영업자 지급 축으로 직행
- `양쪽`: 공급사 축을 먼저 끝내고 영업자 지급 축으로 진행

## Next Action

상세 화면은 항상:
- 현재 phase
- 막힌 이유
- 다음 행동

을 같은 도메인 판정으로 보여준다.

Raw blocker를 그대로 노출하지 않는다.

표시 예:
- `공급사 없음` → `공급사 입력 필요`
- `영업채널 없음` → `영업채널 입력 필요`
- `청구금액 모름` → `청구금액 확인 필요`
- `지급금액 모름` → `지급금액 확인 필요`

## UI 관점 핵심

- 상품 화면은 접수로 이어져야 한다.
- 접수 상세는 정산관리로 자연스럽게 handoff 되어야 한다.
- 정산관리에서는 받을 돈과 줄 돈을 동시에 이해할 수 있어야 한다.
- 공급사 수금 이후 영업자 지급이 다음 흐름으로 읽혀야 한다.
- 어디서 막혔는지 찾기 위해 다른 화면을 추측하며 돌아다니게 하지 않는다.


# 42. Panel / Card separation guard

카드형 UI의 전제는 Panel과 Card가 실제 렌더링에서도 분리되어 보이는 것이다.

## Resting surface

- Panel: `#FFFFFF`
- Card / Component: `#F7F9FC`
- Hover: `#F3F6FA`
- Selected: primary tint

Panel과 Card는 **같은 resting background를 사용하지 않는다.**

## 원칙

- line-free UI라서 background 차이가 hierarchy의 핵심이다.
- shadow만 강하게 해서 위계를 대신하지 않는다.
- Card는 Panel보다 한 톤 낮은 cool surface를 사용한다.
- selected는 grey 단계가 아니라 semantic primary tint를 사용한다.
- 실제 브라우저 computed style에서 Panel/Card background가 같으면 Visual QA 실패다.

## 검증

`visual:qa` report는 첫 visible Panel/Card의 computed background를 비교한다.
같으면 FAIL 처리한다.


# 43. Card density & rhythm guard

카드형 UI는 surface뿐 아니라 내부 리듬이 일정해야 한다.

## 기본값

- card gap: 12px
- card padding: 12px
- compact desktop card min-height: 64px
- standard desktop card min-height: 72px
- mobile card min-height: 88px

## 정보 위계

- 1행: identity + status
- 2행: meta / condition
- 3행 또는 우측: primary value / money
- 금액·숫자: 우측 정렬 + tabular-nums
- 긴 identity/meta: ellipsis
- risk flag: 최대 1개 압축 표현

## 금지

- 같은 목록에서 카드마다 padding이 다름
- 카드 간 gap이 화면마다 다름
- 금액이 좌측 정렬되어 identity와 섞임
- 카드 높이를 줄이기 위해 핵심 정보가 겹치거나 줄바꿈 폭주
- compact와 standard를 화면별 임의 값으로 재정의

## Visual QA

실제 브라우저에서 첫 visible card의 computed:
- padding
- rendered height
- amount alignment

를 검사한다.


# 44. Card role & hit-area contract

카드는 역할에 따라 interaction을 명확히 나눈다.

## Interactive card

예:
- 상품 RowCard
- 접수 RowCard
- 실적 RowCard
- 정산 거래처 RowCard
- 전자계약 RowCard
- 선택 가능한 Tile

규칙:
- 카드 전체가 클릭/탭 영역
- 제목 텍스트만 링크가 되어서는 안 된다
- hover / press / selected feedback 있음
- pointer cursor 사용
- selected 상태는 `aria-current` 또는 `aria-pressed`

## Passive card

예:
- 정보 요약 Tile
- KPI
- 읽기 전용 정보 그룹

규칙:
- hover / press 없음
- pointer cursor 없음
- click handler 없음
- elevation은 있어도 action처럼 보이면 안 된다

## Visual QA

실제 브라우저에서:
- interactive RowCard의 중앙/모서리 hit-test가 링크로 연결되는지 검사
- passive Tile의 computed cursor가 `pointer`면 실패


# 45. Panel scroll topology

패널마다 세로 스크롤 책임은 하나만 가진다.

## Desktop

- PanelHead: 고정
- Search / QuickFilter: 패널 상단 영역
- PanelBody: 주 세로 스크롤
- PanelFoot: 고정
- 3-panel workspace의 각 Panel은 서로 독립적으로 스크롤

입력·저장 Panel:
- 외부 PanelBody가 아니라 폼 본문이 스크롤될 수 있음
- ActionBar / dz-bar는 sticky bottom
- 동시에 두 개의 세로 스크롤 컨테이너를 만들지 않는다

## Mobile

- 현재 screen Panel이 기본 컨테이너
- 페이지 전체와 Panel 내부가 동시에 세로 스크롤되지 않게 한다
- 내부 choice row(QuickFilter/Tabs 등)의 가로 스크롤은 허용
- 세로 nested scroll은 금지

## Visual QA

한 visible Panel 안에서 실제 scrollHeight/clientHeight와 overflow-y를 검사한다.
세로 스크롤 가능한 컨테이너가 2개 이상 중첩되면 FAIL.


# 46. Panel vertical rhythm alignment

같은 workspace 안에서 같은 역할의 영역은 같은 y축에 선다.

## Desktop rhythm

- PanelHead: 44px
- Search row: 48px
- QuickFilter row: 40px
- PanelFoot: 56px

## Alignment

3-panel 화면에서:
- Head top
- Search top
- QuickFilter top
- Foot bottom

은 같은 역할끼리 2px 이내로 맞춘다.

패널 내용이 달라도 shell rhythm은 흔들리지 않는다.
내용 유무 때문에 Search/QuickFilter 줄이 임의 높이로 줄거나 늘지 않는다.

## Mobile

- PanelHead: 52px
- Search row: 48px
- QuickFilter controls: 44px touch/control 기준
- 모바일은 단일 Panel 구조라 cross-panel y축 정렬보다 내부 rhythm 유지가 우선

## Visual QA

Desktop 1280+에서 visible Panel들의 computed rect를 비교한다.
같은 종류 영역의 top/bottom 차이가 2px를 넘으면 FAIL.


# 47. Panel width role contract

패널 폭은 페이지별 임의 디자인이 아니라 역할로 결정한다.

## Desktop

### Equal 3-panel
`1 : 1 : 1`

적용:
- 계약접수
- 실적
- 정산관리

목록/상세/업무가 서로 다른 역할이어도 shell width는 기본적으로 동일하다.

### Wide list + detail
`2 : 1`

적용:
- 상품찾기처럼 목록 탐색 비중이 큰 2-panel 화면

wide list 내부에서는 compact card를 2열로 배치할 수 있다.

### Two-panel standard
`1 : 1`

적용:
- 전자계약 등 목록 + 상세 구조

## Responsive

- 1280~1439: 구조 유지, gap/padding만 compact
- 1440+: standard spacing
- viewport가 좁다고 workflow 구조 자체를 바꾸지 않는다
- mobile은 한 Panel씩 보이므로 width ratio 적용 대상 아님

## Visual QA

- 3-panel equal layout: max/min width ratio <= 1.08
- wide + detail: wide/detail ratio 1.85~2.15
- 실제 computed width 기준으로 검사


# 48. ActionBar ratio & primary placement

모바일/웹 공통 ActionBar 규격.

## 버튼 수와 비율

- 1개: `100%`
- 2개, 주/보조 구분 있음: `3 : 7`
- 2개, 동급 액션: `5 : 5`
- 3개: `3 : 3 : 4`

## Primary 위치

- Primary action은 항상 **가장 오른쪽**
- 3개일 때도 Primary는 오른쪽의 4
- Secondary는 왼쪽부터 배치
- 위험 액션은 Primary 위치를 빼앗지 않는다

## Component API

- `ActionBar balance="primary"`: 3:7 / 3:3:4
- `ActionBar balance="equal"`: 동급 2개 5:5
- `PanelFoot balance="primary|equal"`: 웹에서도 동일

## 금지

- Primary가 왼쪽에 오는 배치
- 2개 주/보조를 5:5로 처리
- 동급 2개를 3:7로 처리
- 3개를 1:1:1로 처리
- 모바일/웹에서 서로 다른 버튼 비율 사용

## Visual QA

실제 rendered width와 x좌표를 검사한다.

- 2개 primary: 약 30% / 70%
- 2개 equal: 50% / 50%
- 3개: 약 30% / 30% / 40%
- Primary right edge가 모든 action 중 가장 오른쪽이어야 한다.


# 49. Card gap vs section rhythm

카드 간격과 섹션 간격은 다른 계층이다.

- 같은 섹션 안 Card ↔ Card: **12px**
- 서로 다른 Section ↔ Section: **16px**

예:
- 상품상세의 `대여료` 기간별 Tile들: 12px
- 차량요약 ↔ 대여료 ↔ 담당자 참고: 16px
- 일반 목록 RowCard들: 12px

금지:
- TileGroup에 section rhythm 16px를 적용
- 카드 간격과 섹션 간격을 같은 토큰으로 묶기


# 50. Selection styling audit

카드 선택 상태는 **visible border를 사용하지 않는다.**

## Card
- resting: component surface
- hover: subtle surface/elevation
- selected: primary tint + shallow inset
- selected + hover: selected tint 유지
- focus: soft halo 추가
- selected border: transparent

## Compact selection control
QuickFilter / Tab / segmented control처럼 작은 control은
solid brand surface + on-primary text를 사용할 수 있다.

## 금지
- 카드 선택에 2px/3px primary outline
- 선택 카드만 갑자기 테두리가 생겨 box size가 달라지는 것
- hover와 selected가 같은 그림자
- selected card를 더 높이 띄우는 것
- 카드마다 서로 다른 selected 문법

## Spacing hierarchy
- control gap: 8px
- card gap: 12px
- section gap: 16px


# 51. Visual slimness & mobile QuickFilter

세련됨은 단순히 요소를 작게 만드는 것이 아니라
**터치영역은 유지하고 보이는 물성만 가볍게 만드는 것**이다.

## Spacing hierarchy

- control gap: 8px
- card gap: 12px
- section gap: 16px
- card padding: 12px

카드는 서로 달라붙지 않게 숨 쉴 공간을 주되,
섹션처럼 과하게 벌리지 않는다.

## Mobile QuickFilter

- touch row: 44px
- visual pill height: 34px
- horizontal padding: 12px
- gap: 8px
- radius: pill
- font: 13~14px
- unselected: soft neutral surface
- selected: brand/navy solid + white text
- visible border: 없음
- horizontal scroll: 허용

QuickFilter를 일반 Action button과 같은 44px visual height로 만들지 않는다.

## Selection

Card:
- borderless
- selected = primary tint + shallow inset
- selected hover에서도 tint 유지
- focus에서만 soft halo

Compact selection control:
- selected = solid brand surface 허용

## 금지

- 모바일 QuickFilter를 일반 버튼처럼 뚱뚱하게 만들기
- 카드 선택 시 2px 이상 primary border/outline
- 카드 간격 8px 이하로 과도하게 조이기
- 모든 UI 요소를 동일 높이로 강제하기


# 52. Full-width workspace & gutter contract

세련된 밀도는 가운데에 좁게 띄우는 것이 아니라
**바깥 여백만 정확히 두고 그 안의 가용 폭을 모두 쓰는 것**이다.

## Desktop

### 1280~1439
- workspace gutter X: 16px
- workspace gutter Y: 12px
- panel gap: 12px

### 1440+
- workspace gutter X: 20px
- workspace gutter Y: 16px
- panel gap: 16px

Workspace/Panel/Card는 `max-width`로 임의 축소하지 않는다.
역할별 panel ratio(1:1:1 / 2:1 / 1:1) 안에서 가용 폭을 전부 사용한다.

## Mobile

- 380px 이상: screen gutter 16px
- 360-class(<380px): screen gutter 12px
- visible Panel: gutter 안의 100%
- List/Card/Form: Panel 안의 100%

## 역할 분리

- screen/workspace gutter: 화면 바깥 여백
- panel padding: panel 내부 콘텐츠 여백
- card gap: 카드 사이 12px
- section gap: 섹션 사이 16px

위 네 가지를 같은 토큰으로 묶지 않는다.

## 금지

- 내부 화면에 임의 `max-width`를 걸어 가운데 좁게 띄우기
- 카드 폭을 고정 px로 제한해 오른쪽 여백 남기기
- 모바일에서 workspace gutter와 card gap을 같은 값으로 묶기
- viewport가 넓어졌는데 panel/card 폭이 그대로인 상태

## Visual QA

실제 브라우저에서:
- workspace content left/right edge와 visible panel group edge 비교
- mobile gutter 16px / narrow 12px 확인
- panel/card가 남는 폭을 채우는지 확인


# 53. Slim vertical shell density

전체적인 세련됨을 위해 카드 내용보다 **shell row의 불필요한 세로 부피를 먼저 줄인다.**

## Desktop

- PanelHead: 44px
- Search row: 48px
- QuickFilter row: 40px
- PanelFoot: 56px
- standard control: 36px
- compact control: 32px

## Mobile

- PanelHead: 52px
- Search row: 48px
- QuickFilter touch row: 44px
- QuickFilter visual pill: 34px
- Action / touch minimum: 44px

## 원칙

- 카드 자체를 억지로 눌러 정보가 답답해지게 하지 않는다.
- 먼저 header/search/filter/footer shell 높이를 줄인다.
- touch target은 줄이지 않는다.
- 시각 높이와 hit area를 분리한다.
- mobile primary/action 44px은 유지한다.


# 54. Detail panel inner rhythm

상세 패널은 내용이 많아도 세로로 뚱뚱해 보이지 않게
**내부 padding은 줄이고, 카드/섹션 간격으로 구조를 만든다.**

## Desktop

- detail body padding: 12px
- section gap: 16px
- subtitle → card group: 8px
- card gap: 12px
- tile inner title → content: 8px
- info dt/dd group gap: 8px

## Line-free detail

- tile title underline/bottom border 금지
- 제목 계층은 typography + spacing으로 표현
- 카드 내부에서 section line을 다시 만들지 않는다

## 원칙

- card gap과 section gap을 섞지 않는다
- subtitle은 아래 카드 묶음에 붙어 읽히게
- detail body 바깥 padding을 과하게 키우지 않는다


# 55. Typography weight hierarchy

전체 UI가 무거워 보이지 않게 굵기를 역할별로 제한한다.

- PanelHead title: 700
- Card identity/title: 600
- Primary value / money / KPI: 700
- Subtitle / Tile title: 600
- Primary / Secondary action: 600
- Badge / Tag: 600
- Meta / support: 400~500

## 원칙

- 선택 상태를 font-weight로 강조하지 않는다.
- selected는 surface/tint로 표현한다.
- 카드 제목과 금액을 둘 다 700으로 반복하지 않는다.
- 한 카드 안에서 700은 핵심 수치/결과에 우선한다.


# 56. Elevation restraint

세련된 Admin UI는 모든 카드를 계속 띄우지 않는다.

## Resting

- Panel: very light base elevation 허용
- Card: shadow 없음
- Passive Card: shadow 없음
- Button: shadow 없음
- Search/Filter control: shadow 없음

## Interaction

- Interactive Card hover: subtle hover elevation
- Selected Card: outer elevation 없음
- Selected Card: primary tint + shallow inset
- Primary button hover: 색 변화가 우선
- Popup / Sheet / Modal: float elevation 허용

## Elevation tokens

- base: 0 1px 2px rgba(16,24,40,.05)
- hover: 0 2px 6px rgba(16,24,40,.08)
- float: 0 8px 22px rgba(16,24,40,.12)

## 금지

- resting card에 진한 drop shadow
- selected card를 hover보다 더 띄우기
- passive card hover elevation
- 모든 버튼에 기본 shadow 적용


# 57. Brand color restraint

브랜드 색은 넓은 면 전체에 반복하지 않고
**주요 액션과 compact selection control에 집중한다.**

## Brand

- primary/navy: #1B2A4A
- primary hover: #24395F
- primary weak: #EEF3FA
- focus ring: #D8E2F0

## Selected Card

- selected surface: soft primary tint
- title/value text: neutral strong text 유지
- support/meta: neutral secondary text 유지
- selected 카드 내부 텍스트를 전부 brand blue/navy로 바꾸지 않는다

## Compact selection

QuickFilter / Seg / compact toggle:
- selected = solid brand + white text 허용

## Semantic colors

- info / success / warning / error는 status/badge 용도
- semantic info blue를 primary brand 대용으로 쓰지 않는다

## 금지

- 큰 카드 선택 시 title + amount + border + shadow까지 모두 brand color
- brand blue/navy를 여러 계층에서 반복
- Desktop만 선명한 SaaS blue를 쓰고 Mobile은 navy를 쓰는 불일치


# 58. Card signal budget

카드 한 장에서 같은 의미를 아이콘·배지·텍스트로 반복하지 않는다.

## 기본 예산

- identity/title: 1
- status signal: 1
- meta line: 1
- primary value/result: 1
- risk flag: 필요할 때만 1

## Status 표현

- compact card에서 status thumbnail이 있으면 동일 status Badge를 다시 표시하지 않는다.
- wide card에서 thumbnail이 사라지면 Badge를 유지할 수 있다.
- icon은 행동/상태 의미가 있을 때만 사용한다.
- 장식용 icon은 넣지 않는다.

## 금지

- 같은 상태를 icon + short label + badge로 중복 표시
- 카드 한 장에 badge 여러 개를 기본값으로 사용
- 금액/상태/이름이 이미 있는데 동일 의미 라벨 추가


# 58. Divider restraint

선은 장식이 아니라 **구조 의미가 있을 때만** 사용한다.

## 제거 대상

- PanelHead 아래 선
- Search / QuickFilter 사이 선
- PanelFoot 위 선
- Card title divider
- Card footer divider
- 단순 section 구분선

위 계층은 surface + spacing + typography로 구분한다.

## 허용

- Timeline connector
- Popup/Sheet의 독립 레이어 경계
- Focus/Error state
- Navigation structure처럼 위치 관계를 설명하는 선

## 원칙

- line-free가 기본
- 같은 정보를 spacing과 surface로 구분할 수 있으면 선을 쓰지 않는다
- generated/legacy CSS가 decorative divider를 되살리면 Visual QA FAIL


# 59. Compact signal hierarchy

작은 정보 신호는 작게 유지한다.

## QuickFilter

- selection control
- pill 허용
- mobile visual 34px
- selected = brand solid + white

## Badge / Status

- signal only
- visual height: 약 20px
- padding: 3x8 mobile / 1x7 desktop
- radius: 6px
- 한 Card에 대표 상태 Badge 1개
- hover / elevation 없음

## Tag

- Badge보다 한 단계 작음
- visual height: 약 18px
- radius: 4px

## Icon

- desktop status/decorative: 14~16px
- desktop icon-only action: glyph 18 / hit 36
- mobile icon-only action: glyph 20 / hit 44
- bottom nav: 24px

## 금지

- 모든 작은 신호를 pill로 만들기
- Badge를 QuickFilter와 같은 크기로 만들기
- 한 카드에 상태 Badge 여러 개 반복
- 상태 아이콘에 pointer/elevation 부여


# 60. No-wrap responsive density

작은 화면에서 세로로 비대해지는 것보다
**한 줄 유지 + ellipsis / horizontal scroll**을 우선한다.

## Choice rows

QuickFilter / Tabs / OfferPicker / Month selector:
- flex-wrap 금지
- horizontal scroll 허용
- scrollbar는 숨김
- item은 flex:none + nowrap

## Cards

- identity/title: 1줄 우선
- primary value/money: 1줄 우선
- support/meta: 1줄 + ellipsis
- perks/secondary signals: 1줄 안에서 잘림/요약
- 내용 때문에 모바일 카드가 100px 이상으로 상시 비대해지지 않게 한다

## Actions

- Primary / Secondary button text: nowrap
- overflow 시 ellipsis
- 버튼 높이를 텍스트 줄바꿈으로 늘리지 않는다

## 원칙

- 좁은 폭은 horizontal behavior로 해결
- workflow/card hierarchy를 세로 wrap으로 재구성하지 않는다
- touch target은 유지
# 61. QuickFilter content is provisional until business rules are set

QuickFilter의 **위치·높이·형태·선택 문법은 UI 규격**이지만,
어떤 업무 항목을 둘지는 별도 업무 설정이다.

현재 업무 항목이 확정되지 않은 화면에서는:
- 전체 + 대표 예시 1개 정도만 둔다.
- 월/기간처럼 이미 필요한 context selector는 유지할 수 있다.
- 가능한 상태를 전부 미리 버튼으로 만들지 않는다.
- URL/domain이 더 많은 상태를 지원하더라도 UI에 선제 노출하지 않는다.

목적은 자리와 interaction을 검증하는 것이지,
사용자 결정 전에 업무 분류를 대신 확정하는 것이 아니다.


# 62. Natural ERP typography

폰트 크기는 위계의 주 수단이 아니다.
일상적인 ERP 화면은 가능한 한 **14px 하나를 기본 언어**로 사용하고,
보조정보만 12px로 낮춘다.

기본 역할:
- Panel title: 14 / 700
- Section title: 14 / 600
- Card identity / body / input / button / QuickFilter: 14
- Primary money/value: 기본 14 / 700
- Support / label / meta / Badge / Tag: 12

제한적 예외:
- 16px 이상은 화면 단위 제목, KPI, 특수 결과값처럼 명확한 이유가 있을 때만 허용
- 일반 Panel/Card 안에서는 크기 차이보다 weight / color / spacing으로 위계를 만든다

Mobile도 동일:
- Panel title / Card identity / body / input / action / QuickFilter: 14
- Support / label / meta / Badge: 12

Visual QA:
- Panel title / Card title / Primary value / Control은 기본 14px 범위인지 검사한다.
- Support는 12px 범위인지 검사한다.
- 일반 업무 화면에서 제목이라는 이유만으로 16~18px로 커지면 FAIL한다.

원칙:
- 화면마다 새로운 폰트 크기를 만들지 않는다.
- 선택 상태는 font-size/weight 증가로 표현하지 않는다.
- 제목은 크기보다 굵기·색·여백으로 구분한다.
- 목표는 디자인한 티가 아니라 오래 써도 자연스러운 시판형 ERP다.

# 63. Solid commercial ERP materiality

목표는 화려함이 아니라 **단단하고 오래된 제품처럼 일관된 물성**이다.

기본 상태:
- Panel: flat
- Card / Tile: flat
- Button / Search / QuickFilter: flat
- visible border: 기본 없음
- hierarchy: Canvas → Panel → Component surface 차이 + spacing + alignment
- shadow: hover / focus / popup / sheet처럼 상호작용 또는 부유 레이어에만 사용

원칙:
- 평상시 모든 요소가 떠 있으면 SaaS dashboard처럼 보이고, ERP의 안정감이 약해진다.
- 단단함은 두꺼운 선/그림자가 아니라 geometry와 반복 규칙의 일관성에서 만든다.
- Panel/Card/Button/Input의 height, radius, padding, gap, text alignment가 화면마다 흔들리지 않아야 한다.
- selected는 tint + shallow inset이며 outer elevation을 강화하지 않는다.
- page별 임의 border/shadow를 추가하지 않는다.
- 예전 §16의 "Card/Button 기본 elevation" 설명보다 이 규칙이 우선한다.

Visual QA:
- resting Panel/Card/Button/Search/QuickFilter에 outer shadow가 있으면 FAIL
- floating layer는 shadow 허용
- selected card는 outer shadow 금지

# 64. Geometry consistency

상용 ERP의 단단함은 요소를 두껍게 만드는 것이 아니라
**같은 역할이 항상 같은 geometry를 갖는 것**에서 만든다.

Desktop:
- Panel radius: 8px
- Card / Tile / ListCard: 6px
- Button / Input / Search / Select: 6px
- Card / Tile padding: 12px
- Compact RowCard: vertical 10px / horizontal 12px
- Panel head/search/quick/footer horizontal padding: 16px

Mobile:
- 현재 Panel은 화면 surface이므로 radius 0
- Card / Form group / Search / Control: 6px
- 일반 card padding: 12px
- 380px 미만 narrow device에서만 card horizontal padding 8px 허용

원칙:
- 같은 역할의 radius/padding을 페이지별로 다시 만들지 않는다.
- 장식용 큰 radius를 추가하지 않는다.
- 1~2px optical correction을 새 token처럼 확산하지 않는다.
- geometry 차이는 역할 차이가 있을 때만 허용한다.

Visual QA:
- Panel/Card/Control computed radius 검사
- Card horizontal padding 검사
- 허용값에서 1px 이상 벗어나면 회귀로 취급

# 65. Card line contract

카드의 **줄 수는 고정하지 않는다.** 2줄, 3줄, 4줄, 5줄이 될 수 있다.
규격화할 것은 줄 수가 아니라 **각 줄의 역할·우선순위·간격·정렬**이다.

기본 line rhythm:
- line-height: 20px
- line gap: 2px
- 각 정보줄은 기본 한 줄 유지
- 긴 값은 ellipsis
- 카드 전체 높이는 실제 필요한 정보줄 수에 따라 자연스럽게 증가

## 정보 우선순위

1행은 항상 그 카드를 고를 때 가장 먼저 봐야 하는 정보다.

차량/상품 목록 권장:
- 1행: 차종 또는 차량 identity ↔ 월 대여료
- 2행: 차량번호 · 상품구분
- 3행: 기간 · 보증금
- 4행 이후: 공급사, 연식, 주행거리, 색상, 기타 운영정보 등 실제 업무상 필요한 순서

접수/계약 목록은 같은 원칙을 적용하되 identity가 고객명/차량일 수 있다.
정산 목록은 상대방/상태/금액이 1순위가 될 수 있다.
즉 **도메인마다 1행의 핵심정보는 다를 수 있지만 중요도 순서는 반드시 명시**한다.

## 금액 표기

목록은 빠른 스캔이 목적이므로 금액을 축약할 수 있다.
- 월 대여료: `월 67만 원`
- 보증금: `보증 500만 원`
- 상세 화면: 필요 시 `670,000원`, `5,000,000원`처럼 정확 금액
- 축약 표기와 실제 저장값/계산값은 분리한다.

## 줄바꿈

- identity/title: 기본 nowrap + ellipsis
- 차량번호/기간/보증금/금액: nowrap
- status/badge: nowrap
- 긴 설명문만 상세 영역에서 자연 줄바꿈
- 줄이 많다는 이유만으로 카드 자체를 금지하지 않는다.

## 정렬

- identity/context: 좌측
- 금액/result: 우측
- 같은 목록의 금액 우측선은 동일
- 숫자는 tabular-nums
- 한 줄 안에서 중요값을 좌우 끝에 배치할 수 있다.

## 금지

- 카드 줄 수를 3줄 등으로 전역 고정
- 카드 높이를 96px 등으로 전역 제한
- 중요정보를 상세에만 숨기고 목록에서 식별/비교가 안 되게 만들기
- 같은 역할의 줄인데 화면마다 line-height/gap을 다르게 만들기

Visual QA:
- 각 정보줄 line-height 20px 검사
- 의도치 않은 한 정보줄의 multi-line wrap 검사
- 카드 전체 높이는 실패 조건으로 사용하지 않는다.

# 66. List amount language

목록은 계산서가 아니라 **빠르게 비교하는 화면**이다.
따라서 금액은 정확 원 단위보다 읽는 속도를 우선해 축약할 수 있다.

기본 문법:
- 월 대여료: `월 57만 원` — 약식 허용
- 보증금: `보증 100만 원` — 약식 허용
- 수수료: `1,160,000원` — 목록/상세 모두 정확 원 단위
- 청구액: `1,160,000원` — 정확 원 단위
- 지급액: `900,000원` — 정확 원 단위
- 남는 금액: `260,000원` — 정확 원 단위
- 정산액: `3,200,000원` — 정확 원 단위

금지:
- `57만원/월`
- `월대여료 570,000원`을 목록의 기본 표현으로 사용
- 수수료/청구/지급/남는 금액을 만원 단위로 축약
- 같은 의미를 amountLabel + unit + value로 중복 표시
- 화면마다 `월`, `월 대여료`, `원/월`, `/월`을 섞어 사용

상세 화면:
- 정확 금액이 필요하므로 `570,000원`, `1,000,000원`처럼 원 단위 표기를 유지한다.

표현과 데이터:
- 축약은 표시 형식일 뿐 저장값/계산값은 변경하지 않는다.
- 만원 단위 반올림 규칙은 공통 formatter를 사용한다.

# 67. Card information matrix

카드 줄 수는 전역 고정하지 않지만, **카드 종류별 표준 줄 수와 줄 역할은 고정**한다.
빈 값은 억지로 빈 줄을 만들지 않고 생략할 수 있으며,
이슈/위험 정보는 조건부 추가 줄로 붙일 수 있다.

## 상품 카드 — 표준 4줄

1. 차종/차량 identity + 상태 ↔ 우측 `월 N만 원`
2. 차량번호 · 상품구분
3. 기간 · `보증 N만 원`
4. 공급사
5. 연식/주행거리/색상 등은 업무상 필요할 때만 추가

## 접수 카드 — 표준 5줄

1. 고객명 + 진행상태 ↔ 우측 `월 N만 원`
2. 차량번호 · 차종
3. 상품 · 기간 · `보증 N만 원`
4. 공급사 · 영업채널 · 영업담당
5. **수수료 청구 N원 · 지급 N원** — 정확 원 단위

접수 카드에서 수수료가 null이면 `—`로 표시하고 0원으로 꾸미지 않는다.

## 실적 카드 — 표준 5줄

1. 고객명 + 분납/완납상태 ↔ 우측 **남는 N원 정확 금액**
2. 차량번호 · 차종
3. 상품 · 기간 · 결제
4. **수수료 청구 N원 · 지급 N원** — 정확 원 단위
5. 공급사 · 영업채널

## 정산 거래처 카드 — 표준 3줄 + 조건부 1줄

1. 공급사/영업채널 + 상태 ↔ 우측 **정산 N원 정확 금액**
2. 청구서/지급명세 진행 건수
3. 완료 건수
4. 미확정/끊김/환수가 있으면 이슈 줄 추가

## 정산 개별 줄

1. 고객명 + 현재 단계 ↔ 우측 **청구/지급 N원 정확 금액**
2. 차량번호 · 차종
3. 상품 · 기간
4. 결제/분납 상태
5. **수수료 청구 N원 · 지급 N원** — 정확 원 단위

## 전자계약 카드 — 표준 4줄

1. 고객명 + 서명상태 ↔ 우측 `월 N만 원`
2. 차량번호 · 차종
3. 기간 · 계약상태
4. 계약코드

## 공통 원칙

- 첫째 줄은 해당 카드를 선택/비교할 때 가장 중요한 정보.
- 대여료·보증금만 목록에서 만원 단위 약식 허용.
- 수수료/청구/지급/정산/남는 금액은 목록에서도 정확 원 단위.
- 숫자/금액은 우측 정렬 + tabular-nums.
- 줄 수를 맞추기 위해 중요정보를 숨기지 않는다.
- 이슈/위험은 조건부 추가줄 가능.
