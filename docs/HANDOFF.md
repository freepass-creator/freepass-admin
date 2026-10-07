# FreePass Admin Handoff

## 2026-10-07 차종마스터 단일화 — 기존 Admin reader 의존

- 동일 통합 Task/PR #171의 소비자 의존 요청: `01a11481-ba1e-7cd2-9639-5ecbf88dbb60`. 시작 소비처 revision `681549cc59292afd1f9983459c81f0db24dced50`, academy READY 확인. 기존 reader/index/시험을 실제 검색해 `COMPOSE_OR_EXTEND`했고 새 파일·작업선은 만들지 않았다.
- 정본: 기준 한 장 v1과 freepasserp5 `vehicle_master`/`vehicle_trim_master`/별칭. Data의 기존 repair 구현에서 `retired === true` boolean 규약을 확인했다. 이름/ID 임의 보정, F03 조회, 운영 write/배포는 없다.
- 변경: `nodeFromErp5`는 `aliases`와 `sub_model_aliases`의 배열/JSON 배열을 함께 읽어 정확히 같은 별칭만 중복 제거한다. 기존 `indexMaster`는 mapper가 전달한 retired boolean을 확인해 폐기 노드를 제외한다. `loadMasterIndex`도 동일 인덱스를 사용하므로 폐기 문서가 매칭 후보를 늘리지 않는다.
- 검증: 기존 master-match 시험에 retired+active 별칭 충돌, retired-only, 배열/JSON 별칭, 이름/ID 보존, 잘못된 별칭 입력 비추정 회귀검증을 추가했다. 관련 9 tests와 typecheck/diff check PASS.
- 남음: 새 head 전체 CI/실제 소비처 배포·runtime 검증은 별도. 기존 5분 프로세스 cache와 저장된 과거 상품 매칭은 이 코드 수정으로 재작성하지 않는다. Claude 독립 검토 FAILED/GHD 단독 merge_owner는 유지한다.
- next_start_here: PR #171 새 head CI → 요청 담당에 exact revision/검증 인계 → GHD 검토·반영 → 별도 승인된 소비처 runtime 확인. 운영 마스터/상품/별칭 정정은 원천 담당만 수행한다.

## 2026-10-07 공통 재사용 규칙 적용 증거

- 같은 Task: `ledger-commission-read-20261003` / PR #171. 시작 revision `497718c89cf08c47d165a6c262128c88ab22cee7`, 원격 main `dd065349`. 새 개발선이나 문서를 만들지 않는다.
- 실제 검색: AI Core `reuse:check`(capability registry·파일명 429·내용 200 검색), 대상 `AGENTS.md`, `docs/BRANCH-WORKFLOW.md`, `docs/HANDOFF.md`, `registry/active-work.json`, AI Core `AI_WORKING_STANDARD.md`, 현재 열린 PR #171/#179/#180/#181. 규칙과 담당/재개점이 이미 있으므로 판정 `COMPOSE_OR_EXTEND`: 기존 AGENTS 진입절과 이 인계만 보강한다.
- academy: 로컬 main이 원격 main보다 앞서 `LOCAL_BRANCH_NOT_CURRENT` HOLD였다. 새 branch 생성 없이 기존 PR #171 소유 branch를 같은 통합 revision으로 fast-forward한 뒤 재실행해 blockers 0 / READY를 확인했다. 다른 dirty 작업과 직원 입력은 그대로 보존한다.
- 같은 목적의 Data 금액 동기화 연결은 정산 담당 보고를 읽고 B3Q 상위에 기존 수집 담당의 의존으로 전달했다. 신규 Task·writer·예약·상주 프로세스·운영 데이터 쓰기는 없다. 담당 수령과 실제 자동 실행은 아직 미확인이다.
- Claude 독립 검토 FAILED와 GHD 단독 merge_owner는 유지한다. 이 규칙 보강은 검토 면제·운영 삭제·자동화 기동 승인으로 해석하지 않는다.
- next_start_here: AGENTS -3 → 기존 active-work 단일 owner/PR #171 exact head → CI 재조회 → GHD 반영 패킷. 최신 main/head가 바뀌면 다시 대조하고 과거 PASS를 새 revision의 PASS로 사용하지 않는다.

## 2026-10-07 ADMIN main 통합 — 원격 반영 전 검증

- 목적: 대표 지시로 갈라진 ADMIN 개발선을 main 하나로 회수한다. 기준 원격 main은 `dd0653491361f54c14fc4ee4cdd9a28b9a7a4bd6`.
- 로컬 main에 PR #171 `18e2800d`, #179 `203e6ef2`, #180 `c4963f33`, #181 `3b60b100`을 순서대로 병합했다. 원격 main 병합/운영 배포/시트·DB 쓰기는 아직 실행하지 않았다.
- 충돌 해결: Data 기간별 수수료와 뮤카 경고 테스트 모두 보존; PDF는 접수만 집계하며 비공개 issuer 설정을 유지; 별도 보관 회차 재합산과 공개 issuer 정보 복구를 막았다.
- 의존성: sharp 0.35.5와 source-map-js 1.2.2로 lockfile 패치. 기존 감사 예외는 확대하지 않았다. production audit gate PASS(high/critical 0, 기존 검토된 moderate 2).
- 보존: 기본 폴더 `.claude/launch.json` 변경은 stash `recovery-before-admin-main-consolidation-20261007`에 보존했다. 다른 dirty worktree, 출력물, ignored 파일과 기존 작업 브랜치는 삭제하지 않았다.
- 검증: typecheck/UI SSOT/live-data wiring PASS. 전체 Windows 테스트 874 중 864 PASS/10 FAIL(서버용 Chromium ENOENT). 설치된 Chrome 대체 실행도 template-script timeout이 발생해 테스트 변경은 되돌렸다. 전체 테스트 PASS로 세지 않는다.
- 독립 검토: Claude gate status RESET_REACHED였으나 실제 호출은 조직의 Claude subscription access 차단으로 FAILED(exit 1). ANSWERED가 아니며 필수 독립 검토 미충족.
- 개발선: 기존 가장 먼저 열린 PR #171을 통합 검증 경로로 재사용한다. #179/#180/#181은 코드가 통합 원격 main에 포함되고 재조회된 뒤 종료한다. 단일 active_owner는 이 ADMIN 지휘 통합 작업이며 다른 시트 담당의 입력을 다시 실행하지 않는다.
- 잔여: 오래된 esign-contract-audit 2커밋은 계약 문안/조건 변경이라 별도 검토 필요. intake-ledger-lifecycle은 registry에서 새 ledger에 의해 대체된 작업이다. archive/legacy/dirty 개발선을 통째로 병합하지 않는다.
- next_start_here: PR #171의 정확한 통합 head와 CI 결과 → 독립 검토 차단 해소 → 원격 main 포함 확인 → 겹친 PR 종료 → exact-SHA 보존 후 오래된 로컬 ref 정리. main 원격 반영은 전체 필수 검증 전에 실행하지 않는다.

## 2026-10-07 상품·신규접수 준비방 통합 인계

- 원문 Task/출처: `01a11440-e4fd-7fc2-b247-8e6ee83b015a` `[B3Q] FREEPASS-ADMIN · 상품·접수`. 원 담당은 상품 검색·상세·신규접수 준비, 실행 변경 없이 읽기 전용 확인만 완료했다. 대표가 중복방 보관을 직접 요청한 turn `01a1146b-4839-7d23-9482-c9db5a465793`을 보존한다.
- 통합 담당/active_owner: 접수현황 `01a11116-563b-7fa1-a345-20dc4613f771`의 Codex. 접수·상품업무에서 Canonical Product → Search/Filter → Detail → Application을 함께 다룬다. Claude/Codex 동시 쓰기 금지. 계약·인도는 별도 담당을 유지한다. 원방은 복구 가능한 보관 대상으로 원문 삭제 금지.
- 검증 근거: 원방 완료 turn `01a11440-e758-7ae1-8a0e-c103cc5bddcf`는 지정 문서 읽기 전용 확인, 코드/운영 변경 0. 당시 archive 브랜치 `5b4ff75b`였으므로 현재 운영 검증으로 세지 않는다. 이번 인계 기록 대상 revision `cdc855e1`.
- 보존 규격: 검색에서 신규접수까지 동일 Offer·상품 version·접수 Snapshot 유지, 공급사 RAW 및 직원 입력 보존. 강지수 팀장 작성·전달 내용과 68로3249/375어8059 원문복구본은 AI 수정·삭제·자동보정·재계산 금지.
- 남음/next_start_here: 총괄의 작업 소유권 확인 → 최신 main 실제 revision 재조회 → academy READY → 동일 Offer/version이 상세와 신규접수 Snapshot까지 유지되는지 읽기 전용 대조. archive 브랜치 수정 금지. 기존 접수나 동일 변경을 다시 실행하지 않는다. 구현·운영 변경은 본래 사용자 오더와 정본 범위에서만 진행한다.

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


---

# 2026-09-25 FreePass Data persistence boundary — latest

This supersedes older wording that treated FreePass Data as catalog-only persistence.

## Authoritative data path

```text
FreePass Admin feature/workflow
        ↓
src/server/freepass-data.ts
        ↓
Repository / Adapter
        ↓
Firestore project freepasserp5
```

FreePass Admin owns business semantics and workflow decisions. FreePass Data owns the authoritative persistence gateway for those facts.

All of the following are read/written through FreePass Data:
- Product / Offer / Policy / Vehicle
- Intake
- Performance facts
- Contract facts used by Admin
- Settlement
- Supplier claim / collection
- Sales-channel pay
- Clawback

No second Admin database/ledger is introduced.

## Enforced implementation

- `src/server/freepass-data.ts` is the single composition root.
- `src/server/erp5.ts` is deprecated compatibility only.
- App/Server/Service may not directly import the Firestore/product/settlement/contract/fee ERP5 adapters.
- `src/server/freepass-data-boundary.test.ts` enforces the rule in CI.
- mutation-time Product/Offer validation performs an uncached FreePass Data read.
- RTDB remains forbidden.

E-sign implementation internals remain separately owned, but Admin-facing contract facts must converge on the same FreePass Data SSOT rather than creating a second contract truth.


---

# 2026-09-25 sealed Intake catalog snapshot — latest

The Product Finder → Intake handoff now persists an immutable FreePass Data selection receipt.

## Write path

```text
Finder matched Product + Offer
        ↓
Intake panel
        ↓
FreePass Data fresh Product read
        ↓
version / sourceSnapshot / Offer revalidation
        ↓
sealed catalog snapshot + SHA-256 digest
        ↓
FreePass Data settlement repository transaction
        ↓
Firestore settlement_rows
```

## Snapshot contents

New product-backed Intake snapshot preserves:
- Product id/version/source snapshot
- supplier/product kind/status/consumer price
- confirmed vehicle identity
- vehicle specs + registration identity
- Product-scope policy atoms
- selected Offer id/term/rent/deposit/prepayment/annual mileage
- Offer-scope policy atoms
- resolved Product+Offer policy result
- deterministic catalog snapshot digest

`capturedAt` is excluded from the digest so an exact retry produces the same digest.

## Idempotency boundary

Same Product + same intake date is **not sufficient** to reuse an existing Intake.

Existing Intake is idempotently reused only when these also match:
- Product version
- Offer id
- FreePass Data source snapshot id
- catalog snapshot digest

If a different Offer/version/snapshot is submitted for the same Product/date, the repository fails closed instead of silently opening the existing Intake.

Product-backed Intake without a sealed snapshot is rejected at Repository boundary even if an App action is bypassed.

## Evidence

Firestore Emulator suite `freepass-data-persistence`:
- contract termination transaction tests: 4/4 PASS
- intake sealed snapshot persistence tests: 3/3 PASS
- total: **7/7 PASS**

Domain/core suite after snapshot hardening:
- FreePass Data boundary: 2/2 PASS
- Product Finder: 62/62 PASS
- Intake/Performance/Settlement/Clawback including snapshot tests: 115/115 PASS

Production Firestore security rules/IAM remain a separate deployment verification item; the emulator currently uses permissive rules.
