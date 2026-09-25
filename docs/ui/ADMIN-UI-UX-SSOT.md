# FreePass Admin UI/UX SSOT

상태: **CANONICAL / USER-LOCKED / AI CORE CONSUMER**  
기준일: 2026-09-25
적용: `freepass-admin` 실제 관리자 화면  
코드 기준: `src/app/globals.css`(base/legacy) · `src/app/_design/admin-final.css`(현행 final) · `src/app/_design/*` · 실제 route workspace

> 공통 UI/UX 의미·선택 규칙의 정본은 **AI Core**다.
> **실제 화면 형태의 기본은 FreePass Sales 운영 앱이다(사용자 2026-09-21 정정).**
> 참조 revision/컴포넌트별 매핑은 `SALES-APP-BASELINE.md`를 먼저 읽는다.
> 이 문서는 FreePass Admin이 AI Core 규격을 어떤 도메인에 어떻게 적용하는지 정하는 **Product Profile**이다.
>
> AI Core binding: `docs/ui/ai-core-bindings.json`
>
> 이 문서는 화면을 새로 디자인하는 문서가 아니다.  
> **이미 확정된 화면의 눈에 보이는 위계·크기·역할을 한 곳에 고정**해서, 다음 화면과 다음 AI가 같은 규격을 쓰게 하는 문서다.

---

## 0. 절대 디자인 잠금 — 2026-09-25

이 문서는 FreePass Admin의 **유일한 사람용 UI/UX 정본**이다. 작업자는 먼저 [DESIGN-AUTHORITY.md](DESIGN-AUTHORITY.md)를 읽는다.

- 삭제된 `docs/ui/mockups/**`, `UI-HISTORY.md`, 2026-09-16 rail/topbar/mockup 계열은 **설계 입력으로 재사용 금지**다.
- 과거 스크린샷·PR·리뷰·Git history에서 옛 화면을 발견해도 복원하지 않는다.
- Claude/Codex/GPT 등 어떤 AI도 자체적인 “기존 디자인”을 기억/추측해 새 화면을 만들지 않는다.
- 현행 공통 부품(`src/app/_design/*`)과 이 문서의 토큰/배치만 조합한다.
- 새로운 시각 규칙은 사용자의 명시 승인 없이 추가하지 않는다.
- 시각 정본을 바꾸는 경우 이 MD, machine SSOT JSON, Design Authority, 공통 부품, 회귀검사를 **같은 변경**에서 갱신한다.

**옛 디자인으로 fallback 하는 것은 기능 정상 여부와 무관하게 UI 회귀로 간주한다.**

---

## 1. 정본 우선순위

충돌하면 아래 순서가 이긴다.

1. **사용자의 최신 명시 결정**
2. **AI Core UI/UX Feature Registry + Interaction Contract**
3. `docs/ui/ai-core-bindings.json` — FreePass Admin consumer mapping
4. **이 문서 `ADMIN-UI-UX-SSOT.md`** — FreePass Admin Product Profile
5. 실제 공통 구현 — `src/app/_design/*`
4. 실제 최종 CSS — `src/app/globals.css`의 뒤쪽 확정 규칙
5. `docs/ui/UI-SPEC.md`
6. 기타 문서·캡처·리뷰 — 참고만 가능, 시각 정본 아님

### 금지
- 과거 `admin-shell.*` 값을 실제 앱보다 우선하지 않는다.
- `globals.css` 파일 위쪽에 남은 옛 값을 보고 새 화면을 만들지 않는다.
- 새 화면마다 버튼·텍스트·라운드·뱃지 규격을 새로 정하지 않는다.
- White Label에서 가져온 뱃지는 **모양만 가져오지 말고 규격 전체**를 쓴다.

---

# 2. 전체 시각 위계

```
L0  Status / Bottom navigation
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
| Standard workspace control | **44px** | 14 | 필터, 탭, 기간, 보조 버튼, 업무 입력 |
| Search / field | **44px** | 14 | 검색창, 주요 입력 |
| Primary action | **44px** | 14 bold | 저장, 접수, 발행, 승인 |
| Mobile touch action | **44px 이상** | 14 | 엄지로 누르는 주요 행동 |

### Button radius
- 일반 버튼: **6px** — Sales 운영 공통 컨트롤 토큰
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
- 업무 workspace에서는 44px
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
- 달 넘기기 등 workspace 조작은 공통 `--ui-control-h` 44px를 사용한다.

승인된 compact 예외:
- Desktop 하단 TopMenu는 Sales의 60px 탭바 안에서 최소 44px 터치 영역을 사용한다(2026-09-21 개정).
- 검색창 내부 `세부검색` 단추는 32px visual이지만 44px search box 안의 내부 조작이다.

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

## 8-4. 상품 목록 카드 폭 배분 — 2026-09-25 사용자 결정

상품 목록은 카드 안의 정보가 왼쪽에 몰리지 않게 **가로 폭을 적극적으로 사용**한다.

Desktop:
- 1줄: 세부모델은 좌측, 상품구분/출고상태 Tag는 우측
- 2줄: **기간 = 좌측 / 월 대여료 = 중앙 핵심 / 보증금 = 우측**
- 3줄: 조건(PerkMarks)은 좌측에서 자연스럽게 이어진다.
- 긴 모델명은 Tag 영역을 침범하지 않고 ellipsis 처리한다.
- 금액/숫자는 tabular number 정렬을 유지한다.

Mobile:
- 같은 의미 순서를 유지하되 폭이 부족하면 2줄 값 영역만 자연스럽게 wrap한다.
- Desktop의 억지 3열을 축소 복사하지 않는다.
- 카드의 선택 상태는 추가 체크/테두리보다 면 변화가 우선이다.


---

## 8-5. AI Core List Presentation

목록 표현 방식의 선택은 FreePass Admin이 새로 정하지 않는다.
AI Core `data.list-presentation`을 따른다.

| FreePass domain | AI Core mode |
|---|---|
| 상품 목록 | `product-media-row` |
| 접수 목록 | `business-row` |
| 실적 목록 | `business-row` |
| 청구 목록 | `business-row` |
| 지급 목록 | `business-row` |
| Offer 선택 | `variant-card` |
| 고밀도 다열 비교 | `data-table` |

Desktop/Mobile은 배치가 달라져도 **semantic mode는 바꾸지 않는다.**
AI Core가 이 선택 규칙을 변경하면 FreePass Admin은 consumer binding을 갱신해 같이 따라간다.

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
- 높이 **44px**
- 검색 icon
- 텍스트
- 필요하면 내부 우측에 “세부검색”
- search border는 허용
- main text 14

## Quick filter
- search 아래
- height **44px** (`--ui-control-h`)
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

## 11-1. 상품 상세 기간별 대여료 — 2026-09-25 사용자 결정

상품 상세의 기간별 대여료는 **기간 버튼 묶음 + 선택값 박스**로 두 번 표현하지 않는다.

- Offer 하나 = 한 줄 선택행
- 기본 정보 순서: **기간 | 월 대여료 | 보증금·선납·주행 조건**
- 선택된 Offer는 체크 아이콘이나 강한 테두리를 추가하지 않고 `--고름` 면으로 표시
- 월 대여료는 같은 행에서 핵심값으로 강조
- 같은 기간 Offer가 둘 이상이면 기간 옆에 주행한도를 붙여 서로 구분
- Desktop은 한 줄 비교를 우선하고, Mobile은 의미 순서를 유지하면서 조건부만 아래로 자연스럽게 wrap
- 선택한 Offer ID는 기존 `useChosenOffer` 계약을 그대로 사용하여 접수 ActionBar로 전달

## 11-2. 신규 접수 WORK 입력 문법 — 2026-09-25 사용자 결정

신규 접수는 **업무 입력 화면**이므로 상세 카드 문법을 복사하지 않는다.

### 앞에 보이는 것
차량을 골라 들어온 접수:
- 이미 확정된 차량/기간/대여료/보증금은 읽기 요약
- 사람이 주로 입력하는 값은 **고객명 · 영업채널 · 영업담당**
- 도메인상 상품구분 선택이 필요한 경우에만 해당 선택을 앞에 노출
- 자동 수수료 계산이 막힌 경우에만 수수료 보완 입력을 앞에 노출

직접 접수:
- 차량/공급사
- 고객명/영업채널/영업담당
- 계약조건/요금
- 수수료

### 뒤로 내리는 것
아래 값은 기본 업무 흐름을 방해하지 않게 `더 넣기` 안에 둔다.
- 공급사코드
- 채널코드
- 영업자코드
- 계약방식/분납여부 등 선택값
- 프로모션
- 진행 체크
- 메모
- 자동 수수료가 정상일 때의 수동 수정값

### 시각 규칙
- Fieldset 자체를 또 하나의 카드로 만들지 않는다.
- **섹션은 제목 + 간격/얇은 구분선**, 입력 필드만 secondary surface를 사용한다.
- 선택된 상품 요약은 하나의 강조 surface로 충분하며 내부 값을 다시 작은 카드들로 쪼개지 않는다.
- 중복 생성 안내 같은 운영 설명은 EmptyState가 아니라 support helper text로 표시한다.
- 입력 오류는 해당 WORK panel의 하단 ActionBar 직전에 모아서 보여 주되, 실제 필드 focus/error 연결 고도화는 별도 접근성 pass에서 다룬다.

## 11-3. 접수 상세 WORK 위계 — 2026-09-25 사용자 결정

접수 상세는 데이터 전체를 펼쳐놓는 화면이 아니라 **현재 업무를 끝내는 화면**이다.

기본 읽기 순서:
1. 고객/차량 Identity
2. **현재 업무**
3. 진행 상태와 다음 단계
4. 확인이 필요한 경고
5. 핵심 금액
6. 정산 진행/금액 조정
7. 환수 등 실제 업무
8. 세부 원자·진단
9. 변경 이력
10. ActionBar

### 시각 강도
- `현재 업무`는 짧은 강조 surface 하나로 보여 준다.
- 경고는 실제 확인이 필요한 경우에만 amber 계열 보조 surface를 사용한다.
- 원자 전체와 변경 이력은 기본적으로 **접힌 보조 영역**이다.
- 세부 원자/진단/이력은 Primary action이나 현재 진행보다 시각적으로 강하면 안 된다.
- 기존 업무 기능·상태머신·금액 계산은 이 UI 정리에서 변경하지 않는다.
- ActionBar의 Primary는 기존 다음 행동 판정을 그대로 따른다.

## 11-4. 정산관리 3패널 위계 — 2026-09-25 사용자 결정

정산관리는 Desktop에서 세 패널을 동시에 보여 주되, 각 패널의 역할을 섞지 않는다.

### 왼쪽 — 거래처/채널 목록
읽기 순서:
1. 청구/지급 축
2. 월/합계
3. 상태 필터
4. 거래처/채널 목록

- 청구/지급 축은 일반 quick filter와 분리한다.
- 축 선택은 **청구=공급사 기준 / 지급=영업채널 기준**이라는 의미를 함께 보여 준다.
- 월과 총액은 한 개의 기간 context로 묶는다.
- 전체/이슈/미처리/완료는 그 아래 보조 필터다.

### 가운데 — 선택한 묶음의 실적
- 가장 중요한 값은 **이번에 청구할 돈 / 줄 돈**
- 원 실적·환수·진행 수치는 4개 이내의 Summary로 압축
- 발행 정보는 큰 카드가 아니라 **현재 문서 상태 요약**으로 표현
- 실제 발행은 기존대로 Panel 하단 Primary Action에서 한다.

### 오른쪽 — 현재 정산업무
- 기존 `IntakeDetailPanel`의 WORK 위계를 재사용한다.
- 현재 정산 단계와 다음 실행이 원자/이력보다 우선한다.

기능 규칙, 원장 계산, 발행 조건, 정정/수금/지급 상태머신은 이 UI 정리에서 변경하지 않는다.

## 11-5. 전자계약 UI/UX 단계 정리 — 2026-09-25

전자계약은 최종적으로 관리자 5단계와 고객 진행축을 분리해야 한다. 다만 현재 `freepass-admin` 계약 목록 adapter가 읽는 데이터는 `발행 · 열람 · 진행중 · 서명완료`와 링크/PDF 수준이므로, UI는 **현재 데이터가 증명하는 범위만 표현**한다.

현재 관리자 표현:
- `발송 전`: 현재 signStatus가 발행 또는 기타 pre-open 상태
- `고객 작성 중`: 열람 / 진행중
- `완료`: 서명완료
- `미연결`: 전자서명 상태 없음

규칙:
- 원시 `signStatus`와 관리자 단계는 섞지 않는다.
- 목록 필터와 목록 뱃지는 관리자 단계 용어를 사용한다.
- 상세에는 **현재 단계**를 Identity 다음에 우선 표시한다.
- 고객 작성 중에는 관리자가 할 행동을 억지로 만들지 않고 "기다림"을 명시한다.
- 계약 양식/보험/날짜/발송시각/서명시각은 `계약 메타정보` 접힘 영역으로 내린다.
- 현재 가능한 실행은 기존 링크/PDF만 사용한다: `링크 열기`, `완료 문서 열기`.
- 검토대기/승인/보완요청/봉인검증 등 현재 adapter가 제공하지 않는 상태와 행동은 UI에서 추측해 만들지 않는다.
- 전자계약 기능 세션이 해당 데이터를 연결하면 관리자 5단계 정본으로 확장한다.
- PDF Renderer/Storage/hash 검증 인프라는 이 UI 작업 범위가 아니다.

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

### 세 개
```
[ secondary 3 ] [ secondary 3 ] [ primary 4 ]
```

- primary 44
- secondary 44
- radius 6
- panel bottom에 정렬
- content 중간에 떠 있지 않는다.
- 세 버튼이 생겨도 임의 균등분할하지 않고 **3:3:4**를 유지한다.

향후 공통 컴포넌트 추출 후보:
`ActionBar(primary, secondary?)`

---

# 13. Navigation SSOT

## 2026-09-21 사용자 결정 — 현재 기준
- 상단은 상태바다. FreePass Admin 워드마크·업무 메뉴·실행 버튼을 넣지 않는다.
- 데이터 설정 여부, 쓰기 허용 여부, 로그인 사용자만 표시한다. 설정 확인을 실시간 연결 성공으로 표현하지 않는다.
- 상태 링크는 기존 데이터 진단 화면으로 이어진다. 로그아웃은 그 화면의 하단 공통 ActionBar로 이동한다.
- Desktop 기존 업무 4축은 Sales 형태의 흰 하단바(60px)에 아이콘·라벨 탭으로 옮긴다. 활성 탭 전체를 진한 면으로 채우지 않는다. 패널별 실행은 기존 ActionBar와 실제 동작을 유지한다.
- Mobile 기존 업무 5걸음은 Sales 형태의 아이콘·라벨 탭을 사용하며 depth 1/2에서는 숨기고 현재 판의 실행바만 보인다.
- 제목 18 / 본문 14 / 보조 12, 패널 라운드 4는 유지한다. 버튼/입력은 Sales의 높이 44·반경 6·간격 8을 사용한다. 두 실행의 업무 비율 3:7은 유지한다.
- 이 결정은 과거 CI 상단·상단 4메뉴·33px TopMenu 설명보다 우선한다. 로그인 화면의 BI는 대상이 아니다.


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

## 15-1. UX 상태 전수검사 — 2026-09-25

상태는 아래 의미를 섞지 않는다.

- **loading**: 데이터를 아직 받는 중. 화면 구조는 유지하고 `aria-busy` + 짧은 skeleton/support text를 사용한다.
- **empty**: 읽기는 성공했지만 결과가 0건. `EmptyState`.
- **partial error**: 일부 데이터만 실패했고 나머지 업무는 가능. 해당 Panel 안의 `Notice tone="warn"`으로 표시하고 사용 가능한 UI는 유지한다.
- **fatal error**: 화면 핵심 데이터 자체를 읽지 못함. route `error.tsx`에서 오류와 **다시 시도** Primary를 제공한다.
- **disabled**: 행동 자체가 현재 불가능. disabled control 가까이에 이유를 보이고 `aria-describedby`로 연결한다.
- **busy**: write/request 진행 중. `aria-busy` + 중복 조작 방지 + 진행형 버튼 라벨을 함께 사용한다.
- **success**: authoritative completion 뒤에만 표시. `Notice tone="ok"`는 polite live region으로 안내한다.
- **retry**: 실패 뒤 동일 작업을 다시 실행할 수 있을 때만 제공한다. 시작을 성공처럼 표현하지 않는다.
  - fatal route error의 「다시 시도」는 **실제 현재 URL 재요청**이어야 한다.
  - Next production 실측에서 error-boundary `reset()`만 호출하면 서버 요청 없이 같은 오류 상태가 유지됐다.
  - 따라서 공통 `RouteError`는 `reset()` 뒤 `window.location.reload()`로 실제 재시도를 보장한다.

현재 적용:
- products / intake / settlement / esign에 공통 `loading.tsx` + retry 가능한 `error.tsx`
- 상품 원장 전체 실패는 fatal error boundary
- 접수목록만 실패하는 경우는 partial warning으로 남겨 상품/접수 다른 기능을 계속 사용
- 정산/전자계약 핵심 목록 실패는 fatal error boundary
- 조회 전용일 때 `접수 저장`은 실제 disabled이며 이유와 연결
- 조회 전용은 접수 상세의 진행/회차/수수료/프로모션/가감/환수 및 정산 lifecycle 보조행동까지 전파된다.
- 정산관리의 문서 발행과 청구링크 생성/회수도 조회 전용이면 실제 disabled이며 가까운 이유와 연결한다.
- 정산 문서 발행 disabled는 `planInvoice`의 막힌 이유와 연결
- 접수 상세의 blocked Primary는 막힘 사유 Notice와 연결

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

## 16-1. 반응형 전수검사 규칙 — 2026-09-25

검증 기준 viewport:
- Mobile: **360 / 390 / 412**
- Desktop: **1280 / 1440**

Mobile:
- Quick filter는 여러 줄로 쌓지 않고 **한 줄 가로 스크롤**을 기본으로 한다.
- 스크롤바는 숨기되 44px touch target은 유지한다.
- Sticky list header가 필터 줄바꿈 때문에 과도하게 높아지지 않아야 한다.
- 고객명/차량명 같은 detail identity는 최대 2줄까지 허용하고, 그 외 보조정보는 한 줄 ellipsis를 우선한다.
- 상태 Tag는 identity 텍스트를 밀어내지 않도록 별도 고정 영역으로 둔다.
- 상품찾기 목록은 **고정 400px track을 만들지 않는다.** 360/390/412에서는 한 열 `minmax(0,1fr)`로 수축한다.
- ActionBar 3:7 비율과 safe-area를 유지한다.

Desktop:
- 1280에서도 panel 간 gap 12와 panel padding 22를 먼저 보존한다.
- 상품찾기 2/3 목록은 1280에서도 2개 카드가 설 수 있도록 카드 최소폭을 **360px** 기준으로 잡는다.
- 긴 identity/금액 때문에 다른 panel 폭이 밀리지 않게 각 panel 내부에서 overflow를 해결한다.
- panel/grid/flex child는 intrinsic width 때문에 전체 workspace를 밀어내지 않도록 `min-width:0` 경계를 둔다.
- 1440 이상이라고 정보 행 수를 임의로 늘리지 않는다.

## 16-2. 상호작용·접근성 전수검사 — 2026-09-25

Keyboard:
- FilterSheet는 열릴 때 dialog 내부로 focus가 들어간다.
- Desktop FilterSheet는 검색창 아래 **non-modal popover**이므로 Tab 이동을 가두지 않는다.
- Mobile FilterSheet는 backdrop이 있는 **modal sheet**이므로 Tab/Shift+Tab을 내부에서 순환시킨다.
- 둘 다 Esc로 닫히고 trigger로 focus가 돌아간다.
- DetailTabs는 roving `tabIndex`를 사용하고 **ArrowLeft / ArrowRight / Home / End**로 이동한다.
- focus-visible은 기존 전역 규칙을 유지한다.

Validation / async:
- 서버 검증 오류 `.dz-errs`는 동적으로 생길 때 `role="alert"` / `aria-live="assertive"`로 안내한다.
- pending write는 기존 `aria-busy`와 disabled 중복제출 방지를 유지한다.
- disabled Primary는 가능한 경우 버튼 라벨 또는 바로 인접한 Notice가 막힌 이유를 설명해야 한다.

Virtual keyboard / zoom:
- Mobile focused control에는 sticky header/ActionBar를 피할 scroll-margin을 둔다.
- Panel은 하단 ActionBar + safe-area만큼 scroll-padding을 둔다.
- 약 320px CSS viewport(400% reflow에 대응하는 좁은 폭)에서는 Summary / form / money / settlement axis를 1열로 reflow한다.
- ActionBar의 44px은 **minimum touch height**다. 긴 번역/확대에서는 문구가 wrap되며 버튼 높이가 늘어날 수 있다.

Visible labels:
- 업무 입력 필드는 visible label을 기본으로 한다.
- 정산 SideStep의 청구월/계산서 날짜/사업자번호도 aria-label-only가 아니라 compact visible label을 사용한다.
- 검색창은 현재 검색 아이콘 + 구체적 placeholder + accessible name을 사용한다. persistent visible text label 적용 여부는 검색 밀도와 함께 별도 SearchBox 공통화 때 검토한다.

I18N / RTL:
- 현재 루트는 `<html lang="ko">` 단일 런타임이며 실제 locale switch/RTL 경로가 없다.
- 따라서 en-US/de-DE/ar-SA는 **현재 완료로 간주하지 않는다.**
- 긴 문자열·reflow 안전성은 지금 보호하되, RTL/locale conformance receipt는 i18n runtime boundary가 생긴 뒤 실제 `lang/dir` 전환으로 검증한다.

# 17. 현재 발견된 “규격 부채” — 디자인 변경 없이 정리 대상

## A. CSS cascade / legacy base — 해결 완료
- `globals.css` 상단의 초기 mockup/base는 **LEGACY BASE LAYER**로 격리했다.
- 실제 관리자 호환 규칙 시작점에 **CURRENT ADMIN COMPATIBILITY LAYER** 마커를 추가했다.
- 이 호환층의 실제 workspace/control 규칙은 33px/40px을 제거하고 44px 공통 토큰으로 승격했다.
- 검색창 안 세부검색만 machine SSOT에 정의된 **embedded 32px 예외**를 유지한다.
- 최종 권위는 계속 `admin-final.css` + 이 문서다.

## B. 과거 UI 시각자료 — 제거 완료
- `UI-SPEC.md`는 정본으로 이동시키는 포인터만 남겼다.
- 2026-09-16 mockup/rail/topbar 계열과 `docs/ui/mockups/**`, `UI-HISTORY.md`는 현재 트리에서 삭제했다.
- Git history에 남은 과거 시각자료도 설계 입력으로 복원하지 않는다.

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
- [ ] 업무 컨트롤 44 / 주 행동·모바일 터치 44 체계 안에 있나?
- [ ] mobile touch는 44 이상인가?
- [ ] 컨트롤 반경 6 / 패널 반경 4를 구분했나?
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

> **큰 틀은 Panel, 목록은 ListRow, 신원은 Tag, 조건은 PerkMarks, 업무 컨트롤은 44, 주 행동·모바일 터치는 44, 글은 18/14/12, 선택은 Navy, 완료는 Green, 모바일은 한 Panel씩.**


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
- 실제 CSS와 machine SSOT의 18/14/12 · 44 · 44 · radius 4가 변했는지
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
- `src/app/intake/panels.tsx` — 외부에서 쓰는 안정적 re-export 경계
- `src/app/intake/NewIntakePanel.tsx` — 신규접수 WORK 판
- `src/app/intake/IntakeDetailPanel.tsx` — 접수상세/정산연계 WORK 판
- `src/app/_design/Primitives.tsx` — 반복 시각 primitive

CSS import 순서는 **`globals.css → admin-final.css → _fn/fn.css`** 를 유지한다.
이 순서를 바꾸는 것은 디자인 변경으로 취급한다.

