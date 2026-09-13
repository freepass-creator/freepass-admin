# AI Core Gate 01 — freepasserp.com v1 통합 통제판

작성일: 2026-09-13
상태: **HOLD / 통합 전 검증 필요**
대상 기준: `main@7dc793f4fc6f1d5b53a119f1bc4c1e410794ae4c`
관련 작업: PR #2 / PR #3 / PR #4

> AI Core의 역할은 기능을 더 붙이는 것이 아니라, 서로 다른 작업·AI·문서·코드가 하나의 제품 논리로 수렴하도록 증거와 우선순위를 통제하는 것이다.

---

## 1. 이번 Gate의 목적

현재 프로젝트에는 세 종류의 병렬 작업이 존재한다.

1. **PR #2 — 접수 Snapshot 참조 분리**
   - 공통 Application Domain의 작은 코드 수정.
   - `MULTI_SELECT.value` 배열의 얕은 복사 문제를 분리.
   - 8개 회귀 테스트 작성됨.
   - 테스트 실행·실DB 검증은 아직 없음.

2. **PR #3 — UI Profile / DevCenter 정렬**
   - 모바일/반응형/타입/간격/터치 목표 등 UI 규격 후보.
   - 정적 이미지 세트 및 UI 검토 패킷.
   - named 4-AI review와 사용자 이미지 승인 전까지 HOLD라고 스스로 선언.
   - application code/Firebase/runtime 변경 없음.

3. **PR #4 — 원자 최소노출 + 기능 시뮬레이션**
   - ERP4 실제 원자 구조를 읽고 v1 ADMIN UI의 정보 노출 계약 정리.
   - 상품→상세→접수→접수목록→접수상세 기능 시뮬레이션과 P0/P1 검수 기준.
   - UI 코드 변경 없음.

AI Core는 이 세 작업을 각각 좋은 문서/코드로 평가하는 것이 아니라 **서로 충돌 없이 실제 v1 수직 흐름으로 합쳐질 수 있는지**를 판정한다.

---

# 2. 제품의 단 하나의 P0 목표

현재 v1의 P0는 아래 한 줄이다.

```text
공급사 RAW
 → Adapter/Mapping
 → Canonical Product
 → Search/Filter
 → Product Detail
 → 선택 Offer
 → Application Draft
 → Application Snapshot
 → Application List
 → Application Detail
 → 계약서 / 필수서류 / 인도 / 취소
```

이 흐름과 직접 관계 없는 기능은 우선순위를 낮춘다.

현재 단계에서 **정산·SALES·WHITE LABEL의 완성 구현은 P0가 아니다.**
다만 데이터 구조와 권한 경계가 미래 세 화면을 막지 않아야 한다.

---

# 3. AI Core 교차검토에서 확인된 핵심 충돌

## CORE-01 — 현재 main의 관리자 UI는 “제품 구현”이 아니라 Prototype로 취급해야 한다

main에는 이미 1:1:1 관리자 UI와 샘플 기반 접수 동작 코드가 존재한다.
그러나 PR #3은 사용자 승인 이미지와 named 4-AI review 전까지 UI 실행 승인을 HOLD로 규정한다.

따라서 AI Core 판정:

- main UI는 **기능 탐색용 Prototype**으로 라벨링한다.
- 앞으로 시각/배치 변경은 최종 이미지 승인 없이 main에 직접 누적하지 않는다.
- 승인 전에는 UI보다 Domain/Search/Test/Adapter 같은 비시각 작업을 병렬 진행할 수 있다.

**판정: HOLD VISUAL CHANGES / DOMAIN WORK ALLOWED**

---

## CORE-02 — 신규접수 필수값이 현재 코드와 설계가 다르다

PR #3과 PR #4의 현재 기준:
- 차량
- 영업채널
- 담당자
- 고객명

현재 main prototype은 고객명과 연락처 중심으로만 신규접수를 구성한다.
영업채널·담당자 필드는 없다.

AI Core 판정:
- 현재 Prototype 폼을 v1 접수 계약으로 간주하지 않는다.
- Application Domain에서 `salesChannelId`, `assigneeId`, `customerName`을 실제 입력 계약으로 확정한 뒤 화면을 맞춘다.
- 연락처 필수 여부는 아직 확정 근거가 부족하면 `DECISION REQUIRED`로 유지한다.

**판정: P0 CONTRACT GAP**

---

## CORE-03 — Application Snapshot에 상품 버전이 명시적으로 부족하다

MASTER와 기능 시뮬레이션은 접수 Draft/저장 시 다음을 요구한다.
- product_id
- product_version
- offer_id
- 당시 Offer/Policy 사실

현재 Application Snapshot은 상품 ID·supplier·vehicle/spec/offer/policies/capturedAt을 보존하지만 `productVersion`을 명시적으로 고정하지 않는다.

`updatedAt`만으로 상품 버전 계약을 대신하면 동시 갱신·재처리·Adapter 재확정에서 의미가 모호할 수 있다.

AI Core 판정:
- Canonical Product에 안정된 `version` 또는 동등한 불변 버전 식별자 필요.
- Application Snapshot에 해당 버전을 저장.
- 저장 직전 Draft 버전과 최신 버전 비교 로직의 계약이 필요.

**판정: P0 DATA INTEGRITY GAP**

---

## CORE-04 — 현재 main 검색 UI는 Search Contract 검증용이 아니다

Prototype 검색은 상품명/세부정보/공급사/정책 문자열을 합쳐 단순 포함검색을 수행하고, 카드 대표 Offer도 첫 번째 Offer에 의존한다.

하지만 MASTER/PR #4가 요구하는 검색은:
- 모델 계층 EXACT/PARTIAL
- 다른 축 AND / 같은 축 OR
- 동일 Offer 내 기간/가격/보증금/주행거리/정책 판정
- 미확인 ≠ 0/불가/무제한
- matched offer를 상세/접수까지 유지

AI Core 판정:
- Prototype 문자열검색은 UX 임시 데모로만 인정.
- 실제 Search Contract와 테스트를 UI보다 먼저 또는 병렬로 구현.
- 목록 카드 대표가격은 `matchedOffer`에서만 계산.

**판정: P0 SEARCH GAP**

---

## CORE-05 — 이중 저장/재시도 방지 계약이 없다

PR #4 SIM-C06은 접수 저장 더블클릭·응답 유실·클라이언트 재시도 시 Application이 1건만 생성되어야 한다고 요구한다.

현재 Domain에는 idempotency key/command ID/unique constraint 계약이 없다.

AI Core 판정:
- UI의 disabled/loading만으로 중복 방지를 완료 처리하지 않는다.
- Application create command에 안정된 제출 ID 또는 동등한 서버 측 중복방지 계약 필요.
- 실제 Firebase/저장소 선택 후 transaction/unique guard 방식 검증.

**판정: P0 PERSISTENCE GAP**

---

## CORE-06 — 접수 Snapshot의 복수선택 정책 참조공유는 PR #2에서 수정 후보가 있다

PR #2는 `MULTI_SELECT.value` 배열을 원본 상품과 접수 Snapshot이 공유할 수 있는 문제를 수정한다.

AI Core 판정:
- UI와 독립된 Domain integrity 수정이므로 병합 후보 우선순위가 높다.
- 단, 작성된 8개 테스트를 실제 실행하고 기존 구현에서 반례 실패 / 수정 구현에서 성공을 확인한 후 merge.
- 이 수정이 실제 DB 영구저장/직렬화까지 검증했다는 뜻은 아니다.

**판정: MERGE AFTER TEST**

---

## CORE-07 — 원자 UI 철학과 UI Profile은 대체로 호환되지만 역할이 다르다

PR #3이 정의하는 것:
- 폰트/간격/터치/반응형/색/상호작용 문법

PR #4가 정의하는 것:
- 어떤 데이터 원자를 목록/상세/업무 화면에서 보여줄지

서로 경쟁하는 SSOT가 아니라 **Presentation Token + Data Projection Contract** 관계로 정리한다.

AI Core 판정:
- PR #3은 “어떻게 보이는가”의 규격 후보.
- PR #4는 “무엇을 보여주는가”의 규격 후보.
- 최종 이미지 시안은 두 문서를 동시에 만족해야 한다.

**판정: COMPOSE, DO NOT CHOOSE ONE**

---

## CORE-08 — named 4-AI review는 아직 GitHub 증거가 없다

PR #3은 Claude Code / Codex / Cursor Agent / Gemini CLI가 같은 commit/profile/image hash를 독립 리뷰해야 한다고 명시한다.
현재 GitHub review 제출 내역을 확인한 시점에는 PR #3, #4, #2 모두 제출된 review가 없다.

AI Core 판정:
- 다른 세션/CLI에서 작업 중일 가능성과 “GitHub에 증거 없음”을 구분한다.
- 실제 4-AI 검토가 끝났다면 reviewer/version/commit/profile/image hash/findings/verdict를 GitHub에 기록해야 Gate가 열림.
- ChatGPT 내부 판단을 named 외부 제품 리뷰로 대체하지 않는다.

**판정: EVIDENCE MISSING**

---

# 4. AI Core 권장 병합/작업 순서

## Gate A — 바로 수행 가능

### A1. PR #2 검증
- TypeScript compile
- 8개 snapshot regression test 실행
- 기존 구현 반례 실패 / 수정 후 성공 비교
- 성공하면 Domain-only fix로 merge 후보

### A2. Search Contract 테스트 작성
UI와 독립된 다음 P0 테스트를 코드화:
- 서로 다른 Offer 혼합 금지
- 18개월 검색 시 18개월 matched Offer 유지
- 보증금 undefined가 0원으로 검색되지 않음
- 모델 EXACT / PARTIAL / 다른 세부모델 제외
- Policy 대상 범위 구분

### A3. Application Contract 보강 설계
- productVersion
- salesChannelId
- assigneeId
- customerName
- idempotency/submission id
- Snapshot audit fields

위 세 작업은 최종 UI 이미지 승인 전에도 가능하다.

---

## Gate B — 사용자 UI 승인 필요

최종 ADMIN 이미지는 동시에 만족해야 한다.

### Data projection
- 목록 = 찾기
- 상세 = 확인
- 업무패널 = 실행
- 필요한 원자만 노출
- 진단/원문/메타는 기본 화면에서 숨김
- 부분 차종 매칭을 정확한 트림처럼 꾸미지 않음

### Visual/interaction
- 1:1:1 desktop
- 중간 폭에서는 3열 억지 압축 금지
- mobile list→detail→work
- 모바일 44px 조작 목표, 검색 48px
- 색은 상태 의미에만 사용
- 빠른조건/상세필터 상태 공유
- back 시 검색/스크롤/선택 복원

사용자가 정확한 이미지 revision을 승인하기 전에는 시각 구현을 “완료”로 보고하지 않는다.

---

## Gate C — Persistence/Firebase

독립 Firebase 또는 선택된 저장소가 연결되면:
- Application 실제 저장/재조회
- idempotent create
- optimistic/concurrency control
- product version compare before save
- application Snapshot 불변 검증
- auth/role scope
- 새로고침/재로그인 복원

여기까지 통과해야 `PERSISTENCE VERIFIED`.

---

## Gate D — 첫 공급사 수직연결

승인된 원천 1곳으로:

```text
RAW snapshot
 → Source Contract
 → Adapter Candidate
 → Mapping/Validation
 → Canonical version
 → Search result
 → ADMIN detail
 → Application Snapshot
```

을 끝까지 통과한다.

수집 HTTP 성공만으로 연동 완료라고 하지 않는다.

---

# 5. Work / ChatGPT / Named AI 역할 분리

## Work
- 전체 앱 통합
- 브라우저/미리보기 실행
- Firebase/Persistence 연결
- UI 코드 구현
- 실제 상호작용/반응형/접근성 검증
- 배포 증거 수집

## ChatGPT
- AI Core 통제판
- 기능 시뮬레이션
- Domain/Search/Adapter 독립 코드와 테스트
- ERP4 원자/기존 자료 기반 데이터 투영 규칙
- PR 간 충돌 검토
- 회귀 시나리오 및 Work 인수인계

## Named external AI reviews
PR #3이 요구한 동일 evidence review 수행.
AI Core는 결과를 모아서 공통 finding과 반례를 통합하지만, 리뷰를 수행했다고 가장하지 않는다.

---

# 6. 완료 보고 표준

각 기능은 다음 상태를 별도로 보고한다.

1. `DESIGNED`
2. `CODED`
3. `STATIC CHECKED`
4. `TESTED`
5. `PERSISTENCE VERIFIED`
6. `DEPLOYMENT VERIFIED`
7. `USER APPROVED` (UI/업무 승인 필요 시)

앞 단계 완료를 뒤 단계 완료처럼 말하지 않는다.

예:

`접수 Snapshot 정책분리: CODED / STATIC CHECKED / TESTED pending / PERSISTENCE pending`

---

# 7. 자기진화 루프 — AI Core 규칙

버그나 사용자 수정이 발생할 때 단순 패치로 끝내지 않는다.

```text
발견
 → 원인 분류
 → 설계 규칙 수정 필요 여부
 → 최소 수정
 → 반례 테스트 추가
 → 기능 시뮬레이션 갱신
 → Work/AI 인수인계
 → 배포 후 실제 확인
```

반복되는 오류는 세 층 중 맞는 곳에 흡수한다.

- 데이터 의미 오류 → MASTER / Domain Contract
- UI 반복 오류 → UI Profile / Projection Contract
- 구현 실수 → Regression Test / CI
- 협업 충돌 → AI Core Gate / Handoff rule

이렇게 해야 프로젝트가 대화가 늘수록 누더기가 되는 게 아니라, 오류가 생길수록 기준이 단단해진다.

---

# 8. 현재 AI Core 판정

| 영역 | 상태 | 이유 |
|---|---|---|
| 프로젝트 독립성 | PASS(설계) | AGENTS/MASTER에 기존 ERP fallback 금지 |
| ADMIN 구조 | CANDIDATE | 1:1:1 확정, 최종 이미지 승인 전 |
| 원자 최소노출 | CANDIDATE | PR #4 문서화, UI 반영 전 |
| Search Contract | HOLD | main prototype가 실제 contract를 구현하지 않음 |
| Application Domain | HOLD | version/channel/assignee/idempotency gap |
| Snapshot 참조분리 | READY FOR TEST | PR #2 코드/테스트 작성됨 |
| Persistence | NOT STARTED/UNVERIFIED | 독립 Firebase 미연결 |
| Adapter 실제 연결 | NOT STARTED/UNVERIFIED | 실제 승인 원천 미연결 |
| named 4-AI UI review | EVIDENCE MISSING | GitHub review evidence 없음 |
| 배포 검증 | NOT VERIFIED | v1 독립 preview/prod 검증 없음 |

**AI Core overall: HOLD, 하지만 비시각 P0 Domain/Search/Test 작업은 계속 진행 가능.**

---

# 9. 다음 3개의 실제 작업

AI Core가 Work에 가장 먼저 요구하는 것은 기능 추가가 아니다.

1. **PR #2 테스트 실행 후 merge 여부 확정**
2. **Search Contract P0 회귀테스트 작성/실행**
3. **Application Contract에 productVersion + channel + assignee + idempotency를 반영할 설계/코드 작업**

이 세 개가 끝난 뒤 사용자 승인 UI를 코드에 연결한다.

---

## AI Core 한 문장

> freepasserp.com v1은 화면을 많이 만드는 프로젝트가 아니다. 공급사 원문이 신뢰 가능한 Canonical 상품이 되고, 관리자가 실제 조건으로 정확히 찾아 접수하며, 그 접수가 시간이 지나도 당시 사실을 잃지 않는 한 줄을 먼저 완성한다. AI Core는 모든 AI와 작업이 이 한 줄에서 벗어나지 않도록 증거·테스트·우선순위를 통제한다.
