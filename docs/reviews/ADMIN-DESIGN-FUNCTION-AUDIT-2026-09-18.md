# FreePass Admin 디자인·기능 통합 검토 — 2026-09-18

기준 브랜치: `main`  
기준 커밋: `f2ec21569de57504a55761c711053208c6368074`  
검토 범위: 실제 Next 앱(`src/app`), 도메인/서비스(`src/domain`, `src/services`, `src/ports`, `src/adapters`), 최신 관리자 mockup(`docs/ui/mockups`), UI 규격(`docs/ui/UI-SPEC.md`)  
상태: **STATIC REVIEW** — 코드와 문서를 대조한 검토이며 실제 운영 배포/브라우저 E2E 검증 완료를 의미하지 않는다.

> 목적: 디자인과 기능을 따로 보되 마지막에는 같은 제품으로 맞춘다.  
> 최신 mockup이 곧 운영 구현이라는 뜻은 아니고, 실제 `src/app`이 곧 최신 제품 기준이라는 뜻도 아니다.

---

## 0. 총평

현재 FreePass Admin은 **업무규칙·도메인 설계와 최신 관리자 mockup은 상당히 앞서 있고, 실제 Next 화면은 초기 Prototype 수준에 머물러 있다.**

가장 큰 문제는 “디자인이 부족하다”가 아니라 아래 세 층이 서로 다른 버전을 보고 있다는 점이다.

1. **제품 규칙 / Domain**
   - same-Offer 검색
   - Product Version + Application Snapshot
   - idempotent submission
   - 취소 사유 보존
   - 파일 저장소 포트
2. **최신 Mockup**
   - 7:3 목록/상세
   - 모바일 페이지 전환
   - 계약서 → 서류 → 잔금 → 인도
   - 차량번호
   - 환수 실적
   - 실적/청구/지급
3. **실제 `src/app/page.tsx`**
   - 하드코딩 `PRODUCTS`
   - 하드코딩 `INITIAL_APPS`
   - React state 저장
   - 1:1:1 동일폭 3열
   - 계약서 → 서류 → 인도 3단계
   - 단순 문자열 검색

**우선순위는 새 기능을 더 만드는 것이 아니라 이 세 층을 하나로 수렴시키는 것이다.**

---

# A. 디자인 검토

## A-1. 유지해야 할 방향

### 1) 목록 7 : 상세 3
최신 `UI-SPEC.md`의 **목록 7 : 상세 3** 구조가 관리자 업무에 더 적합하다.

이유:
- 관리자는 상세 읽기보다 여러 건을 비교·선택하는 시간이 길다.
- 상품/접수/실적의 표 열을 충분히 보존할 수 있다.
- 상세는 “선택한 한 건”을 읽는 영역이므로 360~450px 정도로도 성립한다.

현재 `src/app`의 **1:1:1 동일폭 3열**은 실제 데이터가 늘면 가장 먼저 무너질 가능성이 높다.

**판정: 최신 mockup 방향 유지. 실제 앱을 mockup 구조로 이동.**

---

### 2) 상태색을 바탕색이 아니라 테두리+글자색으로 표현
상태 칩을 파스텔 배경으로 도배하지 않고, 정상/주의/이슈만 낮은 채도의 색으로 표현한 방향은 좋다.

관리자 화면은 하루 종일 보기 때문에:
- 상태색이 너무 많으면 중요도가 평준화된다.
- “이슈”만 실제로 튀어야 한다.
- 선택행은 옅은 틴트 + 좌측 3px 바가 충분하다.

**판정: 유지.**

---

### 3) 검색어를 조건으로 해석한 뒤 토큰으로 다시 보여 주는 방식
직원이 전화받으면서:

> 싼타페 36개월 무보증 21세

처럼 입력하고, 시스템이 이를 조건으로 해석한 뒤 **무슨 조건이 적용됐는지 다시 토큰으로 보여 주는 구조**는 매우 적합하다.

검색이 “똑똑해 보이는 것”보다 중요한 것은:
- 어떤 조건을 읽었는지 사용자에게 보여 주는 것
- 결과 건수가 줄어든 이유를 신뢰할 수 있게 만드는 것

**판정: 제품 핵심 UX로 유지.**

단, 아래 기능 검토에서 설명하듯 이 검색 해석은 mockup 전용 코드가 아니라 Domain 검색계약과 하나로 합쳐야 한다.

---

### 4) 모바일에서 PC 패널을 세로로 쌓지 않는 방향
최신 mobile mockup의:

`목록 → 상세 → 접수폼 → 접수목록`

구조가 맞다.

현재 실제 `globals.css`는 900px 이하에서 세 패널을 그냥 세로로 쌓는데, 이는 모바일 ERP에서 사용성이 급격히 떨어진다.

**판정: mockup 방식 유지. 실제 Next 앱의 모바일 구조는 전면 교체 필요.**

---

### 5) 주 행동 하나 + 위험 행동은 더보기
상세 하단에:
- 메모
- 보조 행동
- 우측 하나의 주 행동

으로 고정한 것은 좋다.

특히 삭제/취소/환수처럼 되돌리기 어려운 행동을 상시 빨간 버튼으로 띄우지 않고 `⋯` 안으로 분리한 원칙은 관리자 화면에 적합하다.

**판정: 유지.**

---

## A-2. 디자인상 수정이 필요한 부분

### D-P0-01. 실제 앱과 최신 디자인이 사실상 다른 제품
현재 실제 `src/app/page.tsx` / `globals.css`와 최신 `admin-shell.html`은 구조가 너무 다르다.

실제 앱:
- 1:1:1 3열
- 큰 카드형 상품목록
- 64px 상단바
- 모바일 패널 세로 쌓기
- 퀵필터 상시 노출

최신 기준:
- 좌측 업무 레일
- 목록 상/하 + 우측 단일 상세
- 표 중심 고밀도 업무화면
- 46px 상단바
- 모바일 페이지 전환
- 검색 + 조건토큰 + 세부필터

**조치:** 기존 실제 UI를 조금씩 고치는 방식보다, 최신 관리자 shell을 React 구조로 이식하는 편이 안전하다.

---

### D-P0-02. 모바일 정보구조가 데스크톱과 다르게 분류돼 있다
Desktop NAV:
- 상품찾기
- 계약접수
- 정산관리
- 전자계약

Mobile bottom tab:
- 상품
- 접수
- 실적
- 설정

그런데 모바일 `설정` 안에:
- 정산관리
- 전자계약

이 들어간다.

**정산과 전자계약은 설정이 아니다.** 업무 모듈이다.

권장안:
- 하단 4개를 `상품 / 접수 / 정산 / 더보기`
- 정산 안에 `실적 / 청구 / 지급`
- 더보기에 `전자계약 / 설정`

또는:
- `상품 / 접수 / 실적 / 더보기`
- 더보기에서 `청구 / 지급 / 전자계약 / 설정`

어느 쪽이든 **정산·전자계약을 설정 아래에 두는 분류는 제거**한다.

---

### D-P0-03. 모바일 취소 버튼이 상시 노출돼 Desktop 원칙과 충돌
Desktop은 “위험 행동은 `⋯` 안에 둔다”는 원칙인데, 모바일 접수상세에는 하단에 `취소` 버튼이 상시 노출된다.

**조치:** 모바일도 취소는 우측 `⋯` 안으로 이동하고, 실행 시 사유입력 + 확인 과정을 거친다.

---

### D-P1-01. 전역 검색과 패널 검색의 범위를 명확히 해야 한다
최신 mockup에는:
- 상단 전역 검색 `.gs`
- 상품/접수 패널 검색 `.fd`

이 동시에 있다.

구현 전 범위를 명확히 하지 않으면 직원은 두 검색의 차이를 모른다.

권장:
- 전역검색이 아직 미구현이면 숨긴다.
- 구현한다면 placeholder를 명확하게:
  - `전체 차량번호·접수번호·고객 검색`
- 상품 패널 검색:
  - `차종·대여기간·보증금·연령 조건`
- 접수 패널 검색:
  - `고객·차량번호·접수번호`

---

### D-P1-02. 한글 업무화면에서 9~10px 텍스트 사용 범위를 더 줄인다
전체 규격은 잘 닫혀 있지만 일부:
- 메타
- badge
- table header
- 보조설명

이 9~10.5px까지 내려간다.

장시간 보는 한글 ERP에서는 실제 Windows 배율/브라우저 배율에 따라 가독성이 크게 떨어질 수 있다.

권장 최소:
- 표 본문: 12px 이상
- 표 머리: 11px 이상
- 보조설명: 11px 이상
- 9~10px는 badge/count/코드성 메타에만 제한

---

### D-P1-03. 좌측 상/하 두 목록 중 “지금 어느 판이 주업무인지”를 더 명확히
상품목록과 접수목록을 동시에 보이는 구조는 장점이 있지만, 사용자가 어디를 조작 중인지 약해질 수 있다.

현재 선택행은 보이지만 “활성 판” 표현은 약하다.

권장:
- 활성 패널 제목줄에만 아주 얇은 강조
- 키보드 포커스가 들어온 판 제목에 focus indication
- 상세 제목에 `상품 상세 / 접수 상세 / 실적 상세`을 강하게 유지

색면을 크게 바꾸는 것은 금지. **제목줄/좌측 2~3px 정도의 미세 강조만** 사용.

---

### D-P1-04. 모바일 접수상세에 차량번호를 더 앞에서 보여 준다
환수 및 실제 운영에서 차량번호가 핵심 검색키로 쓰이므로, 모바일 접수상세에서는 접수 내용 안쪽보다 **상단 chip 또는 핵심정보 영역**에 차량번호를 먼저 노출하는 편이 좋다.

---

### D-P2-01. “왜 빠졌나”는 유지하되 기본은 접힘
검색 신뢰성에는 좋은 기능이다.

다만 모바일에서 결과보다 더 긴 진단정보가 되지 않게:
- 기본 접힘
- `N건이 조건에 걸려 제외됨`
- 펼쳤을 때만 상세 이유

현재 방향 유지.

---

# B. 기능 검토

## B-1. 잘 잡힌 부분

### 1) same-Offer Search Contract
`src/domain/search`의 핵심 원칙은 맞다.

- 기간
- 월대여료
- 보증금
- 약정주행거리
- 정책

을 **하나의 Offer가 동시에 만족**해야 한다.

다른 Offer의 가격과 다른 Offer의 무보증 조건을 합쳐 “없는 상품”을 만들지 않는 규칙은 반드시 유지한다.

---

### 2) matched Offer continuity
검색에서 맞은 `offerId`를:
- 목록
- 상세
- 접수

까지 그대로 가져가는 구조가 맞다.

이 값은 화면이 다시 “가장 싼 것”이나 “첫 Offer”를 고르면 안 된다.

---

### 3) Product Version + Application Snapshot
접수 당시 조건을 굳혀 보존하는 방향이 맞다.

상품이 바뀌어도 기존 접수가 따라 바뀌면 안 된다.

`productVersion`을 명시적으로 들고 있는 것도 적절하다.

---

### 4) submissionId 기반 중복방지
같은 요청의 재전송을 저장소에서 막는 구조는 맞다.

버튼 disabled는 UX일 뿐이고, 중복방지는 서버/저장소 경계에서 보장해야 한다.

---

### 5) 환수를 원실적 수정이 아닌 반대부호 실적으로 남기는 설계
이 방향도 유지한다.

- 원 실적 불변
- 환수는 새 실적
- `origin`으로 연결
- 청구/지급/마진 모두 반대부호
- 두 번 환수 방지

이 방식이 감사 추적과 원장 합산에 유리하다.

---

## B-2. 기능상 P0

### F-P0-01. 실제 Next UI가 Domain/Service를 전혀 사용하지 않는다
`src/app/page.tsx`는:
- `PRODUCTS`
- `INITIAL_APPS`
- `useState`

만으로 움직인다.

현재 Domain에 이미 있는:
- `searchProducts()`
- `submitApplication()`
- repository
- snapshot
- product version
- cancellation reason

을 실제 화면이 쓰지 않는다.

**조치:** 실제 UI를 Domain/Service에 연결하는 것이 최우선.

---

### F-P0-02. 실제 화면 검색은 Search Contract를 위반한다
현재 실제 화면은:

```ts
PRODUCTS.filter(p =>
  `${p.name} ${p.sub} ${p.supplier} ${p.offers.flatMap(o=>o.policies).join(' ')}`
    .includes(query)
)
```

식으로 상품 전체의 문자열을 합쳐 검색한다.

그리고 목록 표시 가격은:

```ts
const o = p.offers[0]
```

이다.

따라서 예를 들어:
- 24개월 Offer: 카드결제, 99만원
- 36개월 Offer: 21세 가능, 92만원

인 상품에서 `21세`로 검색하면 상품은 검색되지만 카드에는 **첫 Offer인 24개월 99만원**이 표시될 수 있다.

즉 검색조건과 화면 표시조건이 다른 계약이 된다.

**조치:** 실제 UI에서 반드시 `matchedOffers / matchedOfferIds`를 사용한다.

---

### F-P0-03. Mockup 검색엔진과 Domain 검색엔진이 또 따로 있다
최신 mockup의:
- `parseQ()`
- `offerOK()`
- `prodOK()`
- `evaluate()`

는 Domain `searchProducts()`와 별도 구현이다.

화면과 Domain에 검색 규칙 두 벌이 생기면 나중에 반드시 갈린다.

**조치:**  
텍스트 → `ProductSearchQuery` 변환기만 별도 두고, 실제 판정은 Domain `searchProducts()` 하나를 호출한다.

---

### F-P0-04. 진행 4단계가 Mockup에만 있고 Domain은 3단계
최신 결정:
- 계약서
- 필수서류
- 잔금
- 인도

Mockup:
```js
STEPS = [
  ['contract','계약서'],
  ['docs','필수서류'],
  ['balance','잔금'],
  ['deliv','인도']
]
```

Domain:
```ts
ApplicationProgress {
  contractCompleted
  documentsCompleted
  deliveryCompleted
}
```

**잔금이 Domain에 없다.**

또 mockup의 `appStatus()`도 아직 balance를 반영하지 않아,
계약서+서류 완료 / 잔금 미완료 상태에서 **“인도 대기”**로 표시될 수 있다.

**조치:**
- `balanceCompleted`를 Domain에 추가
- status/next-action 파생함수도 한 곳으로 통합
- UI의 `appStatus()` 별도 구현 제거

---

### F-P0-05. 차량번호가 최신 운영규칙에 필요하지만 Domain Application에 없다
최신 mockup에서는 접수에 `plate`가 있고 환수 대상 선택의 첫 열도 차량번호다.

하지만 `Application` Domain에는 차량번호가 없다.

CanonicalProduct에는 `registration.vehicleNumber`가 있을 수 있지만:
- 접수 시점 배정 차량번호
- 상품 등록 당시 차량번호

는 동일 개념이라고 가정하면 위험하다.

**조치:** 접수/배정 정보에 `vehicleNumber`를 명시적으로 두고, 실적 생성 시 Snapshot 또는 immutable reference로 보존한다.

중요:
- 화면 검색키로 차량번호를 적극 사용
- DB의 유일한 primary key는 `performanceId / applicationId` 사용
- 차량번호만으로 영구 식별하지 않는다

같은 차량이 재렌트될 수 있기 때문이다.

---

### F-P0-06. 취소 UI와 Service 계약이 다르다
Service는 취소사유 필수:
`REASON_REQUIRED`

실제 `src/app`:
- 버튼 누르면 즉시 `cancelled:true`

Mockup:
- `관리자 취소 — 사유 입력 화면이 뜬다` 라는 임시 문자열

**조치:** 실제 사유입력 dialog/sheet를 구현하고, Service `cancel()`만 통해 취소한다.

---

### F-P0-07. 실제 UI는 전화번호를 필수로 요구한다
Domain 규칙:
- 고객명 필수
- 전화번호 선택

실제 `src/app`:
```ts
if(!customer.trim() || !phone.trim()) return;
```

최신 mockup은 올바르게:
- 영업채널 필수
- 담당자 필수
- 고객명 필수
- 연락처 선택

**조치:** 실제 UI를 Domain 규칙과 일치시킨다.

---

### F-P0-08. 실제 UI에 영업채널/담당자가 없다
Domain 최초 접수 필수:
- 선택 차량/Offer
- 영업채널
- 담당자
- 고객명

현재 실제 앱은 고객명/전화번호만 입력한다.

**조치:** latest mockup 폼을 그대로 Domain 입력계약에 연결.

---

### F-P0-09. Application 번호 발번은 서로 다른 동시 접수에서 충돌 가능
현재:
1. `countByDatePrefix()`
2. `applicationNumber(count + 1)`
3. `create()`

서로 다른 `submissionId`의 요청 두 개가 동시에 들어오면 같은 count를 읽을 수 있다.

현재 테스트는 “같은 submissionId 6번”은 검증하지만 “서로 다른 접수 동시 생성”은 검증하지 않는다.

**조치:** Firestore에서는 날짜별 counter를 transaction으로 발번하거나, applicationNumber 유일성을 transaction에서 보장한다.

테스트 추가:
- 서로 다른 submissionId 20개 동시 생성
- applicationNumber 중복 0

---

### F-P0-10. Snapshot의 MULTI_SELECT 배열이 깊은 복사가 아니다
현재 `create-application.ts`의:

```ts
policyValues: offer.policyValues.map(policy => ({ ...policy }))
```

는 `MULTI_SELECT.value: string[]`의 배열 참조를 공유한다.

PR #2에서 이미 정확한 수정안이 존재한다.

**조치:** current main 기준으로 `clonePolicyValue()`를 재적용하고 회귀테스트 병합.

---

### F-P0-11. 실적/환수/청구/지급은 아직 실제 Domain 구현이 아니라 Mockup 로직
`docs/ui/mockups/admin-shell.data.js`의:
- `PERFS`
- `BILLS`
- `PAYS`

와 app.js의 직접 mutation은 설계 시뮬레이션이다.

실제 `src/domain` / `src/services`에는 동일 수준의 실적/정산 Domain이 main 기준으로 없다.

**조치:** UI부터 production 기능으로 오해하지 않는다.

권장 순서:
1. Delivered Application → Performance 생성
2. Performance 원본 불변
3. Clawback origin 강제
4. 확정 단계
5. Billing/Payout ledger
6. partial collection/payment transaction
7. UI 연결

---

## B-3. 기능상 P1

### F-P1-01. Offer에 보증금 비율이 없다
Mockup 결정:
- `depRate`
- 0% = 무보증
- undefined = 미확인

실제 Domain Offer:
- `deposit?: number`
- `prepayment?: number`

**조치:** 보증금 비율을 명시적 필드 또는 PolicyValue로 정규화한다.

중요:
- `undefined` = 모름
- `0` = 무보증
- 금액 0과 “정보 없음”을 절대 같은 값으로 취급하지 않는다.

---

### F-P1-02. 검색 텍스트 Parser의 공식 계약이 없다
Domain Search Contract는 구조화된 Query 판정은 잘 돼 있지만 자연어 검색어 파싱은 아직 공식 계약이 아니다.

Mockup `TERMS`는 유용한 실험이지만 그대로 제품 핵심으로 삼으면 안 된다.

**조치:** 별도:
`parseAdminSearchText(text) -> ProductSearchQuery + recognizedTokens + freeText`

계약을 만든다.

---

### F-P1-03. File Repository 동시성은 개발 프로세스 한 개 안에서만 보장
`JsonFileStore.queue`는 한 Node 프로세스 안에서 유효하다.

멀티 프로세스/서버리스 인스턴스에서는 공유되지 않는다.

코드 주석에도 개발용으로 명시되어 있으므로 설계 오류는 아니지만, 실제 운영 연결 전 반드시 Firestore transaction으로 대체한다.

---

### F-P1-04. 인증/권한 경계가 main 실제 앱에 없다
현재 main에는:
- middleware
- auth
- API route
- Firebase session boundary

가 없다.

PR #7에 관련 설계/코드가 있으나 범위가 과도하게 넓고 오래된 base를 사용한다.

**조치:** PR #7 전체 merge 금지. 필요한 Auth boundary만 최신 main 기준 작은 단위로 재구성.

---

# C. Mockup 내부 정합성에서 바로 고칠 것

## C-01. `appStatus()`에 잔금 반영
현재:
- contract true
- docs true
이면 바로 “인도 대기”

최신 4단계 기준이면:
- balance false → **잔금 대기**
- balance true / deliv false → **인도 대기**

---

## C-02. 접수 상세 안내문도 3단계 문구가 남아 있다
일부 설명에:
> 계약서·서류·인도는 서로 독립입니다.

가 남아 있다.

최신:
> 계약서·필수서류·잔금·인도

로 맞춘다.

---

## C-03. Mockup 데이터에 중복 object key가 있다
일부 APPS object에:
- `memoAgent`
- `memoProvider`
- `memoAdmin`

가 한 객체 안에서 중복 선언돼 있다.

JS에서는 뒤 값이 앞 값을 덮어쓰므로 실행은 되지만 테스트 fixture 품질이 떨어진다.

**조치:** 중복 key 제거.

---

## C-04. Mockup 환수 번호 발번은 production 규칙으로 사용 금지
`makeClawbackFrom()`의 번호 생성은 화면 시뮬레이션용이다.

실제 실적번호는 server-side unique sequence/ID와 별도 사람이 읽는 번호를 분리한다.

---

# D. 구현 순서 제안

## Phase 1 — 화면과 Domain을 하나로 만들기
1. 실제 `src/app`의 하드코딩 상품 제거
2. ProductRepository → 실제 UI 연결
3. 검색을 `searchProducts()`로 연결
4. matched Offer를 list → detail → application까지 유지
5. 신규접수를 `submitApplication()`에 연결
6. cancellation을 `cancel()`에 연결
7. progress를 `markProgress()`에 연결
8. `balanceCompleted`, `vehicleNumber`, `depositRate` 정합성 보강

## Phase 2 — 최신 관리자 디자인 이식
1. `admin-shell` 구조 React component화
2. 7:3 layout
3. panel 공통 component
4. table/list 공통 component
5. detail action bar
6. desktop filter sheet
7. mobile route/view state
8. 모바일 IA 재정리(정산/전자계약 ≠ 설정)

## Phase 3 — Persistence/Auth
1. Firestore repository
2. transaction 발번
3. submission idempotency
4. ACTIVE ADMIN auth
5. audit log / sensitive action actor

## Phase 4 — 실적/환수
1. delivered application → performance
2. performance immutable origin
3. clawback
4. stage/recheck
5. test

## Phase 5 — 정산
1. billing ledger
2. collection
3. payout
4. partial transaction
5. reversal/history
6. UI

---

# E. 완료 기준

다음이 모두 이어져야 “ADMIN 핵심 기능 구현”으로 본다.

- [ ] 실제 Canonical 상품을 검색한다
- [ ] 검색조건을 만족한 동일 Offer가 목록에 표시된다
- [ ] 같은 Offer가 상세에 유지된다
- [ ] 같은 Offer가 접수 Snapshot에 저장된다
- [ ] 영업채널/담당자/고객명이 필수로 저장된다
- [ ] 전화번호는 선택으로 저장된다
- [ ] 새로고침/재실행 후 접수가 남는다
- [ ] 같은 submission 재시도는 중복 생성되지 않는다
- [ ] 서로 다른 동시 접수의 접수번호가 충돌하지 않는다
- [ ] 상품 version 변경 시 기존 Snapshot은 바뀌지 않는다
- [ ] 취소는 사유를 남긴다
- [ ] 계약서/서류/잔금/인도 네 사실이 Domain과 UI에서 동일하다
- [ ] 인도 완료 건만 실적 후보가 된다
- [ ] 환수는 원 실적을 수정하지 않는다
- [ ] 모바일은 panel stack이 아니라 page navigation이다
- [ ] desktop/mobile 업무 모듈 정보구조가 동일한 개념을 사용한다

---

## 마지막 판단

**디자인 방향은 최신 mockup 쪽이 맞다. 기능 방향은 현재 Domain/Search/Application 쪽이 맞다.**

따라서 새 기준을 또 만들 필요가 없다.

해야 할 일은:

> **최신 Mockup의 UI와 현재 Domain의 기능계약을 실제 Next 앱 한 곳에서 만나게 만드는 것**

이다.

이 문서는 검토 결과이며 제품 기준 문서를 임의로 덮어쓰지 않는다. 확정된 기존 규칙과 충돌하는 항목이 발견되면 먼저 기존 기준 문서의 최신 결정을 확인한 뒤 수정한다.
