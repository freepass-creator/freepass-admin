# FreePass Admin Handoff

기준일: 2026-09-19  
범위: Backend / Domain / Adapter / Persistence

## Current direction
UI/UX는 AI Core/DevCenter 공통 규격 확정 전까지 HOLD다. 현재 기능을 유지하고 Backend 정합성을 먼저 높인다.

## Already strong
- Canonical Product 모델
- Offer / Policy 분리
- same-Offer Search
- Product version + Application Snapshot
- submissionId idempotency 의도
- Domain / Service / Port / Adapter 경계
- cancel reason 보존
- 기존 ERP와 신규 프로젝트 isolation

## Completed in backend hardening — 2026-09-19

- 계약서 / 필수서류 / 잔금 / 인도 4개 진행 사실을 Domain에 반영
- Application Snapshot의 MULTI_SELECT deep clone 보장
- ActorRef + ActorProvider 경계 추가
- APPLICATION_CREATED / APPLICATION_PROGRESS_CHANGED / APPLICATION_CANCELLED 최소 감사 이력 추가
- submissionId 중복방지 + 접수번호 발번을 Repository 원자 create 계약으로 통합
- 진행/취소 변경을 Repository 원자 mutate 계약으로 통합
- 비원자 create/update write API를 ApplicationRepository에서 제거
- 서로 다른 20건 동시 접수번호 중복 0 회귀테스트 추가
- 서로 다른 진행 사실 동시 변경 시 lost update 방지 회귀테스트 추가
- GitHub Actions backend gate 추가
- typed `AppError` code 도입 — Service가 문자열 message 비교로 분기하지 않음
- Application mutation 불변식 추가 — id/applicationNumber/submissionId/createdAt/Snapshot 불변, history append-only
- 불변식 회귀테스트 추가
- revision `3f1812c6968f57494c1e8204e7a67d54e1c1f3ea`: npm ci / typecheck / test / build PASS (run 35437766677)

## Current gaps

### P0 — Product UI가 Domain/Search Service를 완전히 사용하지 않음
실제 Next 화면과 Mockup에 Domain을 우회하는 별도 검색/상태 로직이 존재한다.
UI/UX 재설계는 HOLD지만, 향후 연결 시 Domain 우회 로직은 제거해야 한다.

### P0 — Production persistence 미검증
현재 file store는 개발·검증용이며 단일 Node 프로세스 안의 queue 원자성만 증명한다.

운영 Adapter 요구사항은 코드 계약으로 고정됨:
- transaction/atomic create
- atomic aggregate mutate
- concurrency
- idempotency
- unique human-readable number
- retry/failure semantics

남은 일은 승인된 운영 저장소 Adapter의 실제 구현/검증이다.

### P0 — Production Auth / Permission binding 미검증
ActorProvider Port와 actor audit 의미는 들어갔지만 실제 관리자 인증 Adapter/권한 정책은 아직 연결하지 않았다.

### P1 — Settlement domain
실적/환수/청구/지급 중 상당 부분이 Mockup 수준이다.

### P1 — 운영 Audit 보존정책
Application aggregate 안의 최소 이력은 구현됐다.
운영에서 별도 append-only audit collection/sink가 필요한지는 persistence 설계와 함께 확정한다.

## Recommended backend sequence
1. 승인된 운영 persistence target 확정
2. Firestore 등 운영 Repository Adapter 구현
3. 실제 transaction/concurrency/idempotency integration test
4. 관리자 Auth/Permission Adapter 연결
5. production audit 보존정책 확정
6. Performance/Settlement Domain
7. 실제 UI를 Domain/Search/Application Service에 연결
8. 마지막에 AI Core UI/UX 규격 적용

## Do not do
- UI를 먼저 갈아엎지 않는다.
- 운영 자격증명 없이 Firebase 연결을 추측 구현하지 않는다.
- 기존 ERP DB를 fallback으로 연결하지 않는다.
- Mockup을 Domain SSOT로 취급하지 않는다.
- AI Core로 FreePass 업무 로직을 이동하지 않는다.

## Verification commands
```bash
npm run typecheck
npm test
npm run build
```

각 명령의 실제 PASS 여부는 실행 증거가 있을 때만 기록한다.


---

# 2026-09-22 AI Core 재감사 — 상품 → 접수 → 계약 → 정산

기준 revision 관측: `da5bf6fc552706bfbc6338f5fad85fbe61b29d5e` 이후 current main.  
목적: FreePass Admin이 실제 운영 범위인 **상품 찾기 → 접수 → 계약 → 정산**을 어디까지 커버하는지와 다음 Codex 작업 우선순위를 고정한다.

> 이 절이 위 2026-09-19의 과거 gap 목록보다 최신 판정이다. 특히 당시 "Settlement domain 상당 부분 Mockup" 평가는 현재 main에서 더 이상 유효하지 않다.

## 1. 현재 범위 판정

FreePass Admin의 공식 운영 범위는 다음 네 단계다.

```text
상품/Offer 탐색
  → 접수(Application/Intake)
  → 계약/전자계약
  → 정산(청구·지급·수금·환수)
```

현재 구현 성숙도(코드 기준, production 배포 인증 점수와는 별도):

| 영역 | 현재 판정 | 대략적 성숙도 |
|---|---|---:|
| 상품 찾기 / Offer 조건 | ERP5 live repository 연결 | 90 |
| 접수 생성 / 조회 / 상세 | settlement_rows + events 실데이터 연결 | 92 |
| 접수 → 정산 handoff | 동일 ledger context, unresolved 시 fail-closed | 92 |
| 공급사 청구 / 영업채널 지급 | lifecycle 구현 | 92 |
| 확정 / 정정 / 보류 | 구현 | 90 |
| 세금계산서 / 청구서 / 지급명세 | 구현 | 88 |
| 수금 / 지급 | cash lifecycle로 문서 완료와 분리 | 92 |
| 환수 | 구현 | 88 |
| 계약 목록 / 상세 | ERP5 `contract` 실데이터 연결 | 85 |
| 전자계약 발행 / 고객 작성 / 서류 / 제출 | ERP5 + Storage runtime 연결, pending_review까지 | 80 |
| 접수 → 계약 자동 handoff | SSOT 연결 증거 부족 | 50 |
| 관리자 최종 승인 → signed | 미완결 | 45 |
| 최종 서명 PDF 생성 / 보존 / hash | 미완결 | 35 |

현재 전체 평가는 약 **80/100**. 접수·정산만 보면 90점대, 계약까지 end-to-end로 보면 아직 70점대 후반 수준이다.

## 2. 현재 실제 live runtime

현재 핵심 화면은 mock fallback 없이 ERP5 repository를 사용한다.

- `/intake`: Product + Intake/Settlement ledger
- `/settlement`: Claim/Pay group + performance + intake detail
- `/esign`: contract collection
- `/system/data-status`: live repository probe

전자계약 runtime은 다음 실제 persistence를 사용한다.

- `contract`
- `esign_session`
- `esign_private`
- `esign_event`
- Storage asset path

공통 ERP5 write gate `ERP5_WRITE=on` 없이는 write가 fail-closed여야 한다.

## 3. 가장 중요한 남은 P0 — Intake → Contract handoff

현재 `EsignService.createContract()`는 고객/차량/공급사/대여료/기간/보증금 등을 입력받아 계약을 만들 수 있지만, **접수 aggregate/snapshot을 계약의 명시적 원천으로 pin 하는 계약이 부족하다.**

목표 흐름:

```text
FreePass Data Product / Offer / Policy
        ↓
Admin Intake
        ↓
Application Snapshot
        ↓
Contract Create Command
        ↓
Contract Snapshot
        ↓
Esign
```

계약 생성은 가능하면 재입력하지 않고 접수 당시 확정 사실을 상속해야 한다.

최소 연결 증거 후보:
- `application_id` 또는 `intake_id`
- `source_product_id`
- `source_offer_id`
- `application_snapshot_revision` / digest
- 계약 생성 당시 immutable `contract_snapshot`
- source/customer/vehicle/price/deposit/policy provenance

Acceptance:
1. 접수 상세에서 계약 생성 시 동일 사실을 재입력하지 않는다.
2. Contract가 어느 Intake/Application revision에서 생성됐는지 역추적 가능하다.
3. Intake가 이후 변경돼도 이미 생성된 Contract Snapshot이 조용히 바뀌지 않는다.
4. source mismatch/revision drift가 있으면 계약 생성을 fail-closed 한다.
5. 재시도는 idempotent해야 하며 중복 계약을 만들지 않는다.

## 4. 두 번째 P0 — Esign finalization

현재 전자계약은 대략 다음까지 구현돼 있다.

```text
계약 생성
→ 링크 발행
→ 고객 열람
→ 중간 저장
→ 신분증/필수서류 업로드
→ 동의/서명
→ 고객 제출
→ pending_review
→ 반려/보완
→ 재진행 또는 revoke
```

현재 main의 `EsignService`에는 **관리자 최종 승인/finalize 경로가 완결돼 있지 않다.** `signed_pdf_url` 필드는 존재하지만 발행 시 빈 값으로 초기화되며, 승인 후 최종 PDF를 생성·해시·저장하고 Contract를 signed로 종결하는 end-to-end receipt가 필요하다.

목표:

```text
pending_review
  → admin approve/finalize
  → final contract render
  → immutable PDF bytes
  → SHA-256 + Storage object
  → signed session
  → signed Contract state
  → audit/event/receipt
```

Acceptance:
1. 승인 claim/transition이 경쟁 요청에 안전하다.
2. 승인 전에 required docs/consents/signature/snapshot validation을 다시 수행한다.
3. 최종 PDF는 승인된 immutable snapshot을 사용한다.
4. PDF storage path + SHA-256 + template/agreement versions를 보존한다.
5. Contract와 EsignSession의 최종 상태 변경이 부분 성공으로 찢어지지 않거나, recovery 가능한 explicit receipt를 남긴다.
6. 같은 승인 요청 재시도는 같은 결과를 반환하고 PDF/이벤트를 중복 생성하지 않는다.
7. signed 후 일반 edit/revoke가 불가능하다.

## 5. Settlement는 현재 P0 병목이 아니다

2026-09-19 handoff의 "Settlement domain 상당 부분 Mockup"은 current main 기준으로 superseded다.

현재 구현에서 확인되는 운영 축:
- 공급사/영업채널 axis 분리
- confirm/correct/uncorrect
- bill month
- invoice state
- claim/collect
- pay/payout
- bill hold
- clawback
- 문서 진행과 실제 cash completion 분리
- intake detail → exact settlement ledger focus

따라서 다음 큰 개발 자원은 Settlement 신규 기능 확장보다 **Intake→Contract handoff와 Esign finalization**에 먼저 투입한다.

## 6. FreePass Data와의 경계

FreePass Data가 Admin workflow를 흡수하지 않는다.

- FreePass Data: Product / Offer / Policy 등 공유 Canonical fact + projection/contract
- FreePass Admin: Intake / Contract / Esign / Settlement workflow와 운영 상태

장기 목표:

```text
FreePass Data Catalog Projection
        ↓
FreePass Admin Product Search
        ↓
Application Snapshot
        ↓
Contract Snapshot
        ↓
Esign Finalization
        ↓
Settlement lifecycle
```

Admin의 operational ledger/contract/settlement 사실을 근거 없이 FreePass Data의 두 번째 ledger로 복제하지 않는다.

## 7. Codex next work order

1. **P0 Intake → Contract Handoff Contract**
2. **P0 Esign approve/finalize + immutable final PDF**
3. handoff/finalization concurrency + idempotency + recovery tests
4. Intake/Contract/Esign/Settlement 전체 journey integration test
5. Data Status에 Contract/Esign finalization readiness 추가
6. 그 다음 UI/UX polishing 및 FreePass Data catalog consumer cutover

## 8. End-to-end 완료 기준

FreePass Admin을 "상품 → 접수 → 계약 → 정산 완결"로 부르려면 최소 다음 journey가 자동검증돼야 한다.

```text
Offer 선택
→ Intake 생성
→ Application Snapshot 고정
→ Contract 생성
→ Contract Snapshot 고정
→ Esign 발행
→ 고객 제출
→ 관리자 승인
→ Final PDF + hash 저장
→ signed
→ 인도/정산 대상 연결
→ 공급사 청구/수금 또는 채널 지급
→ 필요 시 환수
```

각 단계는 단순 UI 클릭이 아니라 authoritative persistence 결과와 receipt/evidence로 검증한다.


---

# 2026-09-25 기능 재정렬 — Product Finder → Intake → Performance → Settlement

이 절이 위의 계약 중심 P0 해석보다 최신이다.

## User-confirmed operating model

```text
White Label Product Finder ≒ Admin Product Finder
                    ↓
                  Intake
                    ↓
                Performance
             ↙               ↘
 Supplier Claim/Collection   Sales-channel Pay
             ↘               ↙
                 Settlement
```

### Product finder
- White Label is the outward-facing projection of Admin's product finder.
- Search/filter/Offer meaning should converge on one contract.
- Admin may extend it with internal-only supplier/delivery-status/diagnostic facets.
- Confirmed drift to resolve: `mile` currently means actual vehicle mileage in White Label but annual contracted mileage in Admin.
- Evidence: `docs/reviews/PRODUCT-FINDER-PARITY-2026-09-25.md`.

### Cancellation
- Pre-delivery cancellation is an Intake cancellation fact.
- E-sign linkage does not create a separate business cancellation workflow.
- E-sign revoke/session/evidence handling remains a technical sub-flow owned by the e-sign layer.

### Termination / clawback
- Post-delivery termination is a clawback review trigger.
- Historical claim/pay/collection/payment facts remain immutable.
- Do not auto-calculate or auto-create clawback money.
- Confirmed clawback is a separate negative ledger line in the clawback month.

## Current implementation delta

- `progressPatch` allows pre-delivery Intake cancellation even when an e-sign contract is linked.
- `progressPatch` blocks cancellation after delivery and directs the case to termination/clawback review.
- `terminationClawbackReview` classifies termination as `PENDING` until a clawback explicitly linked to the Intake code is recorded.
- `pendingTerminationClawbackRows` exposes the domain queue without inventing clawback amounts.
- `admin-core-domain` CI isolates finder/intake/performance/settlement/clawback regressions from separately owned e-sign failures.

## Next implementation order

1. Make Admin and White Label finder semantics converge, starting with axis identity and the vehicle-mileage vs annual-contract-mileage split.
2. Expose the pending termination clawback review queue in Settlement without turning it into a third money ledger.
3. Keep Intake → Performance promotion and Claim/Pay ledgers deterministic and tested.
4. Treat e-sign finalization as supporting contract evidence, not the center of the Admin operating workflow.
