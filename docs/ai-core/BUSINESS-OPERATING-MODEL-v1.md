# freepasserp.com v1 — Business Operating Model

작성일: 2026-09-13
상태: R&D 기준 / Work 구현 인수인계

> 이 시스템의 목적은 차량 상품을 등록하는 것이 아니라, 공급사 상품을 표준화하여 영업자가 팔 수 있게 제공하고, 접수를 실적으로 만들고, 그 실적을 근거로 공급사에서 돈을 받아 영업채널에 지급하며 그 차액을 관리하는 것이다.

---

## 1. 사업 구조

### 공급 측
- 여러 공급사가 서로 다른 양식으로 차량·가격·정책 정보를 제공한다.
- FreePass는 공급사 원문을 그대로 판매화면에서 쓰지 않는다.
- 원문을 RAW로 보존하고, Adapter/Mapping/Validation을 거쳐 Canonical Product로 확정한다.

### 판매 측
- Canonical Product는 ADMIN, SALES, WHITE LABEL이 같은 원천을 사용한다.
- SALES는 제휴 영업자가 상품을 찾고 고객에게 안내하고 접수한다.
- WHITE LABEL은 영업회사 이름/BI/CI로 제공되는 B2C 고객 페이지다.
- ADMIN은 전체 상품·접수·진행·실적·정산을 관리한다.

### 실적 측
- 접수는 단순 문의가 아니라 업무 추적의 시작점이다.
- 계약서/필수서류를 확인하고 실제 인도가 완료되면 실적 후보가 된다.
- 취소된 접수는 실적이 아니다.

### 돈 흐름
- 공급사로부터 FreePass가 받을 금액이 있다.
- FreePass가 영업채널/영업자에게 지급할 금액이 있다.
- 그 차이가 FreePass의 마진이다.

```text
Supplier
  ↓ 상품 제공
FreePass Canonical Product
  ↓ 판매 제공
Sales Channel / Salesperson / White Label
  ↓ 고객 접수
Application
  ↓ 계약·서류·인도
Performance
  ↓
영업자 우선 실적 확인
  ↓
공급사 Cross Check
  ↓
공급사 이슈 시 영업자 재확인
  ↓
Final Settlement Item
  ↓
공급사 청구 / 계산서
  ↓
수금
  ↓
영업채널 지급
  ↓
FreePass Margin
```

---

## 2. 시스템의 핵심 객체

### Product
`판매 가능한 조건의 원천`
- vehicle/master match
- specs / registration facts
- offers
- policies
- supplier
- product version

### Application
`누가 어떤 조건으로 어떤 고객을 접수했는가`
- product + productVersion + offer snapshot
- sales channel
- salesperson/assignee
- customer
- contract/documents/delivery/cancel facts

### Performance
`실제로 인도된 접수에서 파생된 실적`
- applicationId
- deliveredAt
- supplier
- sales channel / salesperson
- confirmed product/offer facts
- settlement candidate amounts

### Settlement Item
`해당 실적에 대해 누구에게 얼마를 받고 누구에게 얼마를 줄지 확정하는 단위`
- performanceId
- supplier receivable
- channel payable
- FreePass margin
- salesperson first confirmation
- supplier cross-check
- salesperson reconfirmation if issue
- final confirmed amounts

### Billing / Collection / Payout
- supplier billing/invoice state
- supplier collection state
- channel payout state
- actual received / actual paid
- outstanding balances

---

## 3. 절대로 한 상태로 뭉개지 않을 것

아래는 서로 다른 사실이다.

- 실적 금액 확정
- 계산서/증빙 발행
- 실제 수금
- 실제 지급

예:
`금액 확정됨`이어도 아직 미수일 수 있다.
`공급사 수금 완료`여도 영업채널 미지급일 수 있다.

따라서 Settlement 전체를 단일 `완료/미완료` 상태로 만들지 않는다.

---

## 4. 정산 업무 순서

사용자 업무 기준:

1. 인도 완료 실적 생성
2. **영업자/영업채널이 먼저 자기 실적 확인**
3. 공급사 Cross Check
4. 공급사가 `이 건 안 됨 / 금액 다름` 등 이슈 제기
5. 영향 있는 건을 영업자에게 다시 확인
6. 최종 금액 확정
7. 계산서/증빙 처리
8. 공급사에서 수금
9. 영업채널/영업자에게 지급
10. 마진/미수/미지급 확인

이 순서를 화면 상태와 버튼 순서에도 반영한다.

---

## 5. 관리자 화면의 업무 IA

### 기본 메뉴
- 상품·접수
- 접수 관리
- 실적 관리
- 정산 관리
- 화이트라벨 관리
- 공급사 관리
- 기준정보
- 시스템 설정

메뉴 수와 위치는 UI 승인 시 조정 가능하지만 업무 경계는 유지한다.

### 상품·접수
PC 1:1:1
- LEFT = 상품 찾기
- CENTER = 상품 확인
- RIGHT = 접수 실행/접수 확인

### 실적 관리
- 인도완료에서 생성된 Performance 목록
- 영업자 확인 상태
- 공급사 확인 상태
- 이견 여부
- 최종 확정 여부

### 정산 관리
- 공급사별 받을 금액
- 채널별 줄 금액
- 마진
- 증빙/계산서
- 수금
- 지급
- 미수 / 미지급

---

## 6. 사용자별 화면 역할

### ADMIN
- 전체 상품 검색
- 전체 접수/실적/정산
- 공급사/영업채널/화이트라벨 설정
- 내부 원문/검수/금액 접근 권한

### SALES
- 공통 상품 검색
- 자기 고객 접수
- 자기 접수 진행 확인
- 자기 실적 확인
- 자기 지급 대상/확정 범위
- 다른 채널/회사 마진/내부 공급정보는 차단

### WHITE LABEL
- 고객 상품 검색/상세
- 회사별 BI/CI
- 해당 채널로 귀속되는 고객 유입/접수 기능은 승인된 범위에서만 제공

---

## 7. 가장 중요한 제품 원칙

### 원칙 A — 상품검색이 중심
사용자는 먼저 `고객에게 가능한 차`를 찾아야 한다.

### 원칙 B — 접수는 Snapshot
현재 상품과 과거 접수를 분리한다.

### 원칙 C — 인도완료가 실적의 출발점
계약서 작성만으로 실적을 확정하지 않는다.

### 원칙 D — 정산은 양방향 돈 흐름
`받을 돈`, `줄 돈`, `마진`을 분리한다.

### 원칙 E — 영업자 확인이 공급사 확인보다 먼저
실적이 먼저 영업자에게 보여지고, 이후 공급사 cross-check를 한다.

### 원칙 F — 이견은 건별로 남긴다
한 건 이견 때문에 정상 실적 전체를 막지 않는다.

---

## 8. AI/Work가 임의로 만들면 안 되는 것

- 차량준비 같은 FreePass 비업무 단계
- 인도 전 자동 실적 확정
- 서로 다른 Offer 조건 합성
- 공급사 미확정 금액을 확정 수익으로 표시
- 수금 전 지급완료 처리
- 미수/미지급 삭제
- 취소 거래의 원거래 삭제
- 화이트라벨을 별도 상품 DB로 분리
- 기존 ERP/Firebase fallback

---

## 9. R&D → Work 전달 규칙

이 대화에서 새 업무 결정이 생기면 다음 중 하나로 GitHub에 반영한다.

- 사업 흐름 변경 → 본 문서
- 화면/버튼/상태 변경 → `docs/qa/end-to-end-business-simulation-v1.md`
- 데이터 계약 변경 → MASTER/Domain Contract
- 오류 반례 → regression test
- 미확정 → Issue의 `DECISION REQUIRED`

Work는 대화 기억을 가정하지 않고 GitHub 기준을 읽는다.
