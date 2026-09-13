# WORK-INBOX — Chat R&D → Work 개발 반영용

최종 갱신: 2026-09-13
프로젝트: freepasserp.com v1
목적: ChatGPT 채팅에서 사용자와 확정한 R&D 내용을 Work가 자동 추측하지 않고, GitHub에서 한 곳만 읽고 개발에 반영하도록 만드는 공용 인수인계 문서.

> Work 작업 시작 전 반드시 이 문서와 `AGENTS.md`, `docs/MASTER-v1.md`를 읽는다. 이 문서는 대화 전체를 복사하는 곳이 아니라 **현재 개발에 영향을 주는 최신 결정·시뮬레이션·HOLD·다음 작업**만 요약한다.

---

## 1. 사업 구조 — 가장 먼저 이해할 것

freepasserp.com은 단순 상품목록 ERP가 아니다.

```text
공급사 상품 RAW
 → Adapter / Mapping / Validation
 → Canonical Product SSOT
 → 영업자에게 판매 가능한 상품 제공
 → 고객 접수
 → 계약서 / 필수서류 / 인도
 → 실적 생성
 → 영업자 실적 1차 확인
 → 공급사 Cross Check
 → 필요 시 영업자 재확인
 → 최종 정산 확정
 → 공급사 청구 / 계산서
 → 수금
 → 영업채널 지급
 → FreePass Margin
```

핵심 수익구조:
- 공급사로부터 받을 돈
- 영업채널에 줄 돈
- 그 차액 = FreePass 마진

`청구확정`, `계산서`, `수금`, `지급`은 서로 다른 상태다. 하나의 완료값으로 합치지 않는다.

---

## 2. 현재 첫 개발 P0

전체 사업 중 첫 번째 실제 완성 목표는 ADMIN 수직 흐름이다.

```text
Canonical Product
 → Search / Filter
 → Product Detail
 → matched Offer
 → 신규접수
 → Application Snapshot
 → 접수목록
 → 접수상세
 → 계약서 / 필수서류 / 인도 / 취소
```

SALES / WHITE LABEL / 정산 전체 구현을 이 흐름보다 먼저 벌리지 않는다.

---

## 3. ADMIN UI/UX 핵심

Desktop 기본:

```text
상품목록 1/3 | 상품상세 1/3 | 업무패널 1/3
```

역할:
- 목록 = 찾기
- 상세 = 확인
- 업무패널 = 실행

상품 상세에서 `이 상품으로 접수하기`를 누르면 LEFT/CENTER는 유지하고 RIGHT만 신규접수로 전환한다.

접수 중 다른 상품을 목록에서 구경해도 Draft의 접수 대상 상품은 자동 변경되면 안 된다. 접수상품 변경은 명시적 동작이어야 한다.

모바일은 desktop 3열 압축이 아니라 `LIST → DETAIL → WORK` 독립 화면 흐름으로 간다.

UI 시각 구현은 사용자 승인 이미지 revision을 기준으로 한다. 이미지 승인 전 신규 시각 변경을 완료라고 보고하지 않는다.

---

## 4. ERP4 원자 기반 최소 노출 원칙

ERP4 실제 atom 구조에서 확인한 철학을 참고한다. 기존 ERP4 DB/코드/Firebase를 v1 운영 의존성으로 연결하지 않는다.

원자 분류:
- 모델/차 정체
- 제원
- 등록/실차
- 변동값(상태, 주행, 가격 등)
- Offer
- Policy
- 메타/원문/검수정보

화면 원칙:
- 목록에는 찾는 데 필요한 최소 원자만 노출
- 상세에서 확인용 원자 확장
- 원문/source row/내부 메타/검수 근거는 ADMIN 진단 영역으로 제한
- 데이터에 존재한다는 이유만으로 화면에 전부 표시하지 않음
- 부분 차종 매칭을 완성된 트림처럼 꾸미지 않음
- `미확인 ≠ 0 / 불가 / 무제한`

관련 설계 PR: #4

---

## 5. Search Contract — P0

현재 main의 문자열 검색은 Prototype이다. 실제 검색 완료로 간주하지 않는다.

필수 규칙:
- 같은 축 복수값 기본 OR
- 다른 축 기본 AND
- 모델 / 세부모델 / 트림 EXACT-PARTIAL 구분
- 다른 세부모델로 확정된 상품을 PARTIAL에 섞지 않음
- 기간/월대여료/보증금/약정주행거리/Offer-scope Policy는 **같은 Offer 하나**에서 동시에 만족해야 함
- 서로 다른 Offer를 섞어 가짜 조건 생성 금지
- 검색에서 일치한 `offer_id`를 카드 → 상세 → 접수까지 유지
- 보증금 공란은 0원/무보증 검색에 포함 금지

기능 시뮬레이션: PR #4의 `docs/qa/admin-functional-simulation-v1.md`

---

## 6. 접수 Contract — 현재 R&D 결정

현재 설계상 초기 접수 핵심 필드:
- 차량 / 선택 Offer
- 영업채널
- 담당자
- 고객명

연락처 필수 여부 등 아직 확정되지 않은 값은 `DECISION REQUIRED`로 둔다.

접수 저장 시 Snapshot:
- product_id
- explicit product_version 필요
- selected offer_id + 당시 Offer 조건
- 적용 Policy
- vehicle match level
- supplier/source context 필요한 범위
- captured_at

현재 상품 변경이 과거 접수를 변경하면 안 된다.

서버 측 중복 저장 방지(idempotency/submission id) 계약이 필요하다. 버튼 disabled만으로 완료 처리하지 않는다.

접수 상태/사실:
- RECEIVED
- CONTRACTED
- DELIVERED
- CANCELLED
- 별도 체크: 계약서 / 필수서류 / 인도

`차량준비` 단계는 FreePass 업무가 아니므로 만들지 않는다.

---

## 7. 실적 → 청구 → 수금 → 지급 사업 시뮬레이션

인도완료된 접수가 실적 후보가 된다. 중복 Performance 생성 금지.

운영 순서:
1. 영업자 실적 1차 확인
   - 버튼 예: `확인`, `이견 있음`
2. 공급사 Cross Check
   - 버튼 예: `공급사 확인 완료`, `이슈 등록`
3. 공급사 이슈가 영업자 지급액/인정 실적에 영향을 주면 영업자 재확인
   - 버튼 예: `재확인 요청`
   - 영업자: `수용`, `이견 유지`
4. 관리자 최종 확정
   - 버튼 예: `정산 확정`
5. 공급사 청구
   - `청구서 생성`
   - `계산서 처리`
6. 수금
   - `수금 등록`
7. 영업채널 지급
   - `지급 등록`
   - `지급 보류`
8. 금액 표시
   - 청구액 / 수금액 / 미수액
   - 확정 지급액 / 실제 지급액 / 미지급액
   - 우리 마진

부분수금/일부지급을 정상 상태로 지원한다.

상세 R&D는 AI Core PR #6의 사업 운영 모델 및 E2E 시뮬레이션을 참고한다.

---

## 8. 현재 AI Core Gate

통합 기준:
- PR #6 — AI Core Gate 01
- Issue #5 — P0 통합 순서와 HOLD 기준

현재 중요한 Gap:
- main ADMIN UI는 Prototype
- 실제 same-Offer Search Contract 미구현
- Application explicit productVersion 필요
- salesChannelId / assigneeId 계약 필요
- idempotent create 필요
- 독립 Firebase persistence 미검증
- 첫 실제 공급사 Adapter 미연결

병렬 작업:
- PR #2: Snapshot `MULTI_SELECT.value` 참조분리 — 코드/테스트 작성, 실행 검증 대기
- PR #3: UI Profile / review packet — 사용자 exact image 승인 및 evidence gate
- PR #4: Atom Projection + 기능 시뮬레이션
- PR #6: AI Core 통합 통제판

---

## 9. Work 시작 절차

매 작업 시작 시:

1. `git fetch` 후 현재 main과 자신의 branch/PR base 확인
2. `AGENTS.md`
3. `docs/WORK-INBOX.md`
4. `docs/MASTER-v1.md`
5. 해당 작업과 관련된 PR / Issue / AI Core Gate 확인
6. 같은 파일을 다른 AI가 수정 중인지 확인
7. 구현 후 완료 상태를 구분해서 보고

완료 상태 표준:
- DESIGNED
- CODED
- STATIC CHECKED
- TESTED
- PERSISTENCE VERIFIED
- DEPLOYMENT VERIFIED
- USER APPROVED

`CODED`를 `DEPLOYMENT VERIFIED`처럼 보고하지 않는다.

---

## 10. Chat R&D 반영 규칙

이 채팅에서 새로운 사업/UX/상태/버튼 결정이 생기면 ChatGPT는:

1. 대화에서 의미를 정리
2. 기능 시뮬레이션으로 반례 확인
3. 다음 중 맞는 곳에 기록
   - 사업구조 → Business Operating Model
   - 데이터 의미 → MASTER / Domain contract
   - UI 노출 → UI Projection contract
   - 기능 흐름 → Functional simulation
   - 테스트 가능한 규칙 → Regression test
   - 우선순위/충돌 → AI Core Gate
4. `docs/WORK-INBOX.md`의 최신 요약을 갱신
5. 필요 시 Work 대상 Issue/PR에 링크 댓글 남김

따라서 Work는 **이 채팅 자체를 읽을 필요 없이 WORK-INBOX에서 현재 결정을 확인**할 수 있어야 한다.

---

## 11. 지금 Work가 먼저 할 일

1. PR #2 테스트 실제 실행 후 merge 판단
2. same-Offer / EXACT-PARTIAL / unknown!=0 / matched Offer continuity Search 회귀테스트
3. Application Contract에 productVersion + salesChannelId + assigneeId + idempotency 반영
4. 사용자 승인 ADMIN 이미지 기준으로 UI 구현
5. 독립 Firebase 연결 후 실제 저장/재조회/중복방지 검증
6. 승인 공급사 1곳 RAW→Canonical→검색→접수 수직연결

---

## 한 문장

> Work는 기능을 임의로 늘리지 말고, 공급사 원문이 판매 가능한 Canonical 상품이 되어 영업되고, 접수·인도·실적·청구·수금·지급까지 이어지는 사업 흐름 안에서 현재 P0를 구현한다. Chat의 최신 R&D는 이 WORK-INBOX를 통해 전달받는다.
