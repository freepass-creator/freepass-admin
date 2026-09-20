# FreePass Admin Core Flow P0 — 2026-09-20

Status: `DOMAIN CONTRACT / CURRENT MAIN COMPATIBLE / NO PRODUCTION CLAIM`

## 우선순위

전자계약보다 먼저 아래 업무축을 안정화한다.

1. 상품 찾기
2. 접수
3. 인도 사실에서 실적 생성
4. 실적 금액 확인
5. 영업채널 확인 / 이견
6. 공급사 확인 / 이슈
7. 정산 확정
8. 청구
9. 수금
10. 지급

## 현재 main에서 이미 있는 것

- Canonical Product / Offer / Policy
- 같은 Offer 기준 상품 검색
- Product version
- Application immutable snapshot
- submissionId 기반 접수 중복 방지
- Application progress + append-only history
- C Core Contract SHADOW
- D Workflow SHADOW

## 이번 P0에서 보강하는 것

### 상품찾기

회귀 테스트로 고정:

- 확정 차종과 PARTIAL 구분
- 기간/대여료/보증금/주행거리 조건은 같은 Offer가 동시에 만족
- 공란 보증금은 0원으로 취급 금지
- Offer 정책이 같은 policy id의 상품 정책을 override
- 조건을 만족한 Offer id가 접수까지 이어질 수 있음

### 접수

회귀 테스트로 고정:

- 필수: 선택 Offer / 영업채널 / 담당자 / 고객명
- 전화번호는 최초 접수 필수가 아님
- 접수 당시 productVersion 보존
- Offer / Policy snapshot deep clone
- 동일 submissionId 재호출은 1건
- 화면이 본 productVersion과 현재판이 다르면 저장 금지

### 실적 / 정산

새 순수 Domain:

- Application의 `deliveryCompleted=true`만으로는 부족
- append-only history에 실제 delivery completion event가 있어야 Performance 생성
- Performance id는 `performance:<applicationId>`로 결정적
- 공급사 받을 금액 / 영업채널 지급액 / VAT mode 분리
- 영업채널 확인 후 공급사 확인
- 이견/변경 시 자동 확정 금지
- 정산 확정 후 Billing 생성
- 수금 / 지급 ledger 분리
- 부분수금 / 부분지급 잔액
- 정책상 완납 전 지급 차단 가능
- 같은 ledger id 다른 payload 금지
- reversal은 원본 삭제가 아니라 별도 사실

## 이번 P0가 하지 않는 것

- UI 재디자인
- Firebase/Firestore production adapter
- production Auth
- 실제 계산서 발행
- 은행 입출금 연동
- 전자계약
- 배포

화면은 이후 이 Domain을 표현한다. 화면 상태가 업무 사실을 새로 정의하지 않는다.
