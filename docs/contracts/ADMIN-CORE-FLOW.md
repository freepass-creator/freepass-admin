# FreePass Admin Core Flow — 상품찾기 → 접수 → 실적 → 정산

최종 갱신: 2026-09-20

## 0. 범위

FreePass Admin 1차 운영 범위는 세 메뉴다.

1. 상품찾기
2. 계약접수
3. 정산관리

전자계약·기타 관리기능은 이 3개 흐름을 방해하지 않는 별도 기능으로 둔다.

최종 목표는 **FreePass Admin 단독 접수·정산**이다.
F04 Google Sheet는 과도기 병행/검증/내보내기 대상이며 장기 정본이 아니다.

---

## 1. 최종 Authority

### Product
FreePass Data의 Canonical Product / Offer / Policy가 상품 정본이다.

### Application
FreePass Admin의 Application이 접수 정본이다.

### Performance
인도 완료로 발생한 Performance가 실적 정본이다.

### Settlement
Performance에서 파생된 Settlement가 청구·수금·지급·가감 정본이다.

### F04
Legacy Mirror / Migration Source다.
F04 탭 이름이나 열 구조를 Admin 도메인 모델로 복제하지 않는다.

---

## 2. 한 줄 업무 흐름

```
Canonical Product
  ↓ searchProducts()
Matched Product + exact Offer
  ↓
Application
  ├─ productVersion
  ├─ selected Offer snapshot
  ├─ registration snapshot
  ├─ salesChannelId
  ├─ assigneeId
  └─ applicant
  ↓ contract / documents / balance
deliveryCompleted = true
  ↓
Performance(kind=NORMAL)
  ├─ applicationId
  ├─ performanceId
  ├─ settlementCode
  └─ immutable application snapshot
  ↓
Settlement
  ├─ ruleRef
  ├─ claim
  ├─ payout
  ├─ adjustments[]
  ├─ claimIssuedAt
  ├─ collectedAt
  └─ payoutPaidAt
```

차량번호는 검색·대조용이다.
시스템 연결키는 **applicationId → performanceId → settlementCode**다.

---

## 3. 상품찾기

화면은 `src/app/page.tsx`의 로컬 PRODUCTS/문자열 includes를 최종 경로로 사용하지 않는다.

정본 경로:

```
ProductRepository.list()
  → services/products.findProducts()
  → domain/search/searchProducts()
  → ProductSearchMatch
```

### 규칙

- 기간/대여료/보증금/주행거리/정책은 **같은 Offer 하나**가 동시에 만족해야 한다.
- 검색에서 일치한 `offerId`가 상세와 접수까지 그대로 간다.
- 미확인 값은 0/없음/불가로 간주하지 않는다.
- 접수는 현재 상품을 재조립하지 않고 사용자가 본 `productVersion + offerId`를 제출한다.

---

## 4. 접수

최초 접수 핵심값:

- 상품 + Offer
- 영업채널
- 담당자
- 고객명

전화번호는 선택값이다.

Application Snapshot은 최소 아래를 굳힌다.

- productId / productVersion
- supplierId
- vehicle master ref
- vehicle specs
- registration(vehicleNumber/VIN 등)
- selected Offer
- product/offer policies

현재 상품이 바뀌어도 이미 받은 접수의 Snapshot은 바뀌지 않는다.

### 진행 사실

- contractCompleted
- documentsCompleted
- balanceCompleted
- deliveryCompleted

파생 상태:

- RECEIVED
- CONTRACTED
- DELIVERED
- CANCELLED

---

## 5. 인도 → 실적

`deliveryCompleted=true`가 실적 발생 조건이다.

하나의 Application에는 NORMAL Performance가 정확히 하나만 존재한다.
멱등키는 `applicationId`다.

Performance는 F04의 「분납실적」「완납실적」 탭을 복제하지 않는다.

분납/완납은 **정산 조건/진행**이고,
Performance는 **인도로 실적이 발생했다는 불변 사실**이다.

운영 Firestore 전환 시 반드시:

> Application 인도완료 + NORMAL Performance 생성

을 하나의 transaction / Unit of Work로 묶는다.

---

## 6. 정산

Performance 하나당 Settlement 하나다.

Settlement는 상태 하나로 뭉개지 않고 돈의 사실을 분리한다.

- `claimIssuedAt` — 공급사 청구를 발행했는가
- `collectedAt` — 실제 수금했는가
- `payoutPaidAt` — 영업채널 지급을 완료했는가

### 계산

수수료 규칙 엔진은 `SettlementRuleProvider` 뒤에 둔다.

과도기:
- freepasserp4의 수수료표/계산 규칙을 Legacy Provider로 사용 가능

최종:
- FreePass Admin / FreePass Data가 Rule Provider 정본을 소유

정산 결과에는 값만 저장하지 않는다.

- ruleId
- ruleVersion
- sourceRevision
- auto
- explanation

을 함께 저장한다.

자동으로 한 값이 안 나오는 규칙(예: 최대 N%, 협의)은
`REVIEW_REQUIRED`로 만들고 검토 전에는 청구/수금/지급 사실을 진행시키지 않는다.

### 가감

기본 청구액/지급액을 덮어쓰지 않는다.

```
기본 청구액
+ CLAIM adjustments[]

기본 지급액
+ PAYOUT adjustments[]
```

각 Adjustment에는:
- 금액
- 사유
- 처리자
- 처리시각

을 남긴다.

---

## 7. F04 병행 규칙

현재 F04의 주요 탭:

- 접수
- 취소
- 분납실적
- 완납실적
- 정산 진행
- 월별 청구/지급
- 청구요약
- 수수료표

이 구조는 **이관 근거**이지 새 Admin의 컬렉션 구조가 아니다.

### 필드 매핑 원칙

| F04 | Admin 정본 |
|---|---|
| 접수일 | Application.createdAt |
| 차량번호 | Application.snapshot.registration.vehicleNumber |
| 공급사 | Application.snapshot.supplierId → master display |
| 모델명 | Application.snapshot.vehicle → master display |
| 영업채널 | Application.salesChannelId |
| 영업담당자 | Application.assigneeId |
| 고객명 | Application.applicantName |
| 계약기간 | Application.snapshot.offer.termMonths |
| 렌탈료 | Application.snapshot.offer.monthlyRent |
| 보증금 | Application.snapshot.offer.deposit |
| 계약서 | Application.progress.contractCompleted |
| 인도완료 | Application.progress.deliveryCompleted |
| 인도일 | Performance.occurredAt |
| 정산코드 | Performance.settlementCode |
| 청구 | Settlement.claimIssuedAt 존재 여부 |
| 수금 | Settlement.collectedAt 존재 여부 |
| 청구가감 | Settlement.adjustments(side=CLAIM) |
| 지급가감 | Settlement.adjustments(side=PAYOUT) |
| 가감사유 | SettlementAdjustment.reason |

환수는 기존 정상실적을 수정하지 않는다.
후속 구현에서 `Performance(kind=CLAWBACK, originPerformanceId=...)`로 별도 음수 실적을 만든다.

---

## 8. 병행 단계

### Phase A — 현재
- 과거 F04 데이터는 계속 조회/검증한다.
- Admin 신규 구조를 완성한다.
- F04 직접 입력도 일시적으로 존재할 수 있다.

### Phase B — 신규 접수 Admin 우선
- 기준일 이후 신규 Application은 Admin에서 생성한다.
- Admin → F04 mirror만 허용한다.
- 같은 건을 F04에서 다시 수정하는 dual-writer를 금지한다.

### Phase C — 정산 Admin 우선
- 실적/청구/수금/지급/가감/환수의 writer를 Admin 하나로 제한한다.
- F04는 검증/조회/내보내기다.

### Phase D — 단독 운영
- FreePass Admin = 유일 writer/SSOT
- F04 = archive/export 또는 폐기

---

## 9. 다음 구현 순서

1. Firestore ProductRepository를 FreePass Data SSOT에 연결
2. 실제 Admin 상품화면을 `findProducts()`에 연결
3. 실제 접수화면을 `submitApplication()`에 연결
4. Firestore transaction으로 인도완료 + Performance 원자 처리
5. freepasserp4 수수료 엔진을 Legacy SettlementRuleProvider로 연결
6. 정산관리 화면: 실적 / 청구 / 지급
7. F04 mirror adapter
8. CLAWBACK Performance
9. 기준일 이후 F04 direct writer 차단
