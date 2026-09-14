# WORK-INBOX — Chat R&D → Work 개발 반영용

최종 갱신: 2026-09-14
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

제품 핵심은 상품원자 SSOT다. 그 위에서 첫 완성 목표는 ADMIN 수직 흐름이다.

```text
상품원자 SSOT (공통/변동/정책/메타 + Offer 축 + 버전)
 → Canonical Product Version
 → Search / Filter
 → Product Detail
 → matched Offer
 → 신규접수
 → Application Snapshot
 → 접수목록
 → 접수상세
 → 계약서 / 필수서류 / 인도 / 취소
```

SALES / WHITE LABEL / 정산 전체 구현을 이 흐름보다 먼저 벌리지 않는다. 데모 카탈로그와 기존 ERP Firebase 연결은 이 핵심을 대체하지 않는다.

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
- main ADMIN UI는 Prototype. 검색/접수 Domain 계약은 이 브랜치에서 테스트로 고정 중이며, Prototype UI에 아직 연결하지 않음 (시각 HOLD)
- 독립 Firebase persistence 미검증
- 첫 실제 공급사 Adapter 미연결

참고로 확인됨 (연결 아님):
- 2026-09-14 사용자 결정: 이 원자 SSOT가 freepasserp.com의 제품 핵심이다.
- ERP4는 Firebase 프로젝트 `freepasserp3`의 `products`가 운영 상품원자다.
- ERP5는 별도 프로젝트가 아니라 같은 Firebase의 `productMasterVersions/*`로 공개 원자만 단방향 복사한다.
- 2026-09-13 1회 게시: 1538대 검증본 저장, `--activate` 없음, 어댑터 부착 298 / blocker 320.
- 상세: `docs/reference/ERP4-ERP5-PRODUCT-ATOM-SSOT.md`. v1은 이 프로젝트/시크릿을 쓰지 않는다.

병렬 작업:
- PR #2: Snapshot `MULTI_SELECT.value` 참조분리 — 이 브랜치 Application 계약이 같은 분리를 포함하므로 중복 merge를 피한다.
- PR #3: UI Profile / review packet — 사용자 exact image 승인 및 evidence gate
- PR #4: Atom Projection + 기능 시뮬레이션
- PR #6: AI Core 통합 통제판
- PR #7: Codex 기능 수직 PR. **새 baseline 아님.** 검색·접수 계약만 salvage, 정산/SALES/Auth/SSOT 재작성은 park. 상세는 `docs/ai-core/AGENT-EXECUTION-PLAYBOOK.md`.

---

## 9. Work 시작 절차

매 작업 시작 시:

1. `git fetch` 후 현재 main과 자신의 branch/PR base 확인
2. `AGENTS.md`
3. `docs/WORK-INBOX.md`
4. `docs/MASTER-v1.md`
5. `docs/ai-core/AGENT-EXECUTION-PLAYBOOK.md` / `docs/ai-core/scope-lock.json`
6. 해당 작업과 관련된 PR / Issue / AI Core Gate 확인
7. 같은 파일을 다른 AI가 수정 중인지 확인
8. 구현 후 완료 상태를 구분해서 보고

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

1. 상품원자 SSOT를 v1 Canonical 핵심으로 고정한다. 계약은 `docs/reference/ERP4-ERP5-PRODUCT-ATOM-SSOT.md`. ERP4 Firebase는 연결하지 않는다.
2. Codex/Work는 `docs/ai-core/AGENT-EXECUTION-PLAYBOOK.md`와 `docs/ai-core/scope-lock.json`을 읽고 정산/SALES로 P0를 넓히지 않는다.
3. same-Offer / EXACT-PARTIAL / unknown!=0 / matched Offer continuity Search를 원자 Offer 축 위에서 회귀테스트
4. Application Contract에 productVersion + salesChannelId + assigneeId + customerName + submissionId + Snapshot 참조분리 + idempotency 반영
5. PR #2는 위 4와 겹치면 중복 merge하지 말고 테스트 증거만 맞춘다
6. 사용자 승인 ADMIN 이미지 기준으로 UI 구현 — 이미지 승인 전 HOLD. 화면은 원자를 재해석하지 않는다.
7. 독립 Firebase에 원자 버전 컬렉션을 만든 뒤 저장/재조회/중복방지 검증
8. 승인 공급사 1곳 RAW→원자 Canonical→검색→접수 수직연결

PR #7의 정산·SALES·Auth는 이 목록보다 먼저 벌리지 않는다.

---

## 한 문장

> Work는 기능을 임의로 늘리지 말고, 상품원자가 버전 Canonical이 되어 검색·접수까지 이어지는 흐름을 freepasserp.com의 핵심으로 구현한다. 정산은 그 다음이다. Chat의 최신 R&D는 이 WORK-INBOX를 통해 전달받는다.

---

## 12. ADMIN 웹 UI·UX R&D 업데이트 — 2026-09-13

상태: **CANDIDATE / USER DIRECTION CONFIRMED / EXACT IMAGE APPROVAL PENDING / IMPLEMENTATION HOLD**

사용자 최신 결정과 AI Core·DevCenter 기반 독립 관점 검토를 반영한 관리자 웹 설계 방향:

- 개발 우선순위는 모바일보다 PC 웹이다.
- 전역 메뉴를 제외한 업무영역은 공통 `목록 1/3 | 상세 1/3 | 현재 업무 1/3` 문법을 사용한다.
- 직원은 왼쪽에서 대상을 고르고, 가운데서 사실·Snapshot을 확인하고, 오른쪽에서 현재 단계의 주 행동 하나를 수행한다.
- 큰 둥근 카드·무거운 전역 상단바·알약형 상태 남발을 피하고 Pretendard, 흰 작업면, 1px 구분선, 44px 입력/버튼, 2줄 목록, 은은한 선택/주의 배경을 사용한다.
- 상품 상세의 기간조건은 압축 가로 표를 폐기한다. 실제 공급사가 제공하는 Offer를 세로 한 행씩 표시하고, 행 전체로 선택한다.
- 각 Offer 행은 같은 Offer의 `기간 | 월 대여료 | 보증금 | 약정주행거리 | 적용 Policy`를 함께 유지한다. 서로 다른 Offer 값 합성은 금지한다.
- 예시 우선기간은 1/6/12/24/36/60개월이지만, DB는 실제 제공 기간을 반복 객체로 수용하며 없는 기간을 생성하지 않는다.
- `공유`와 `접수하기`는 상품 상세 하단에 고정한다.
- 최초 접수 필수값은 정확히 `차량/선택 Offer | 영업채널 | 담당자 | 고객명` 네 개다. 전화번호·주소·생년월일·메모·서류는 최초 접수에 강제하지 않는다.
- 상품 경로 진입 시 차량/Offer를 미리 채우고, 영업채널은 최근값, 담당자는 로그인 사용자를 제안하되 모두 보이고 수정 가능해야 한다.
- 접수 저장은 productVersion·Offer·Policy Snapshot과 idempotency/submission id를 보존해야 한다.
- 접수 화면은 `접수 목록 | 접수 상세 | 진행 업무·이력`, 실적 화면은 `실적 목록 | 실적 상세 | 공급사 대조·확정`을 사용한다.
- 좌측 전역 업무 메뉴는 정확히 `상품 | 접수 | 실적 | 정산` 네 개를 기본으로 한다. `정산` 안에서 `청구 | 지급`을 탭/업무모드로 분리한다. 수금은 청구 상세의 후속 업무로 관리하며, 청구 원장과 지급 원장은 분리한다. 청구확정액/실제수금액/미수액과 지급확정액/실제지급액/미지급액을 합치지 않는다.
- 부분수금·부분지급·취소·조정은 원금액을 덮어쓰지 않고 거래·조정 이력으로 추가한다.
- 목록/상세/업무는 같은 선택 ID를 가리켜야 하며, 뒤로가기에서 검색·필터·스크롤·선택·포커스를 복원한다.
- 로딩·빈값·부분오류·권한없음·동시수정·종료상품·중복저장 상태를 별도로 설계한다.

AI Core 추가 결정 필요:
1. 고객명 최소 저장에 대한 개인정보 보관·권한·마스킹·파기 기준
2. 금액별 VAT 포함/별도 기준
3. 공급사 수금 전 영업채널 지급 허용 정책
4. 부분수금 시 부분지급 정책
5. 마감 후 취소·환수·조정 승인권자

현재 채팅에서 상품/접수, 접수관리, 실적대조, 청구·수금 PC 이미지 후보를 만들었다. 상품 기간조건을 세로 Offer 선택으로 고친 방향은 사용자가 긍정 확인했다. 다만 정확한 최종 이미지 파일/해시를 GitHub 검토 증거로 고정하고 사용자 승인하기 전에는 시각 구현을 시작하지 않는다.

AI Core Gate:
- visual implementation: `HOLD_UNTIL_USER_IMAGE_APPROVAL`
- domain/search/application contract work: 기존 승인 범위에서 계속 가능
- production deploy: `NOT_AUTHORIZED`

---

## 13. Codex 해맴 잠금 — 2026-09-14

상태: **USER DIRECTION — 성능 고도화 / 해맴 방지**

원인: Codex PR #7이 `기능 우선`을 Phase D 정산·SALES·Firebase까지 한 PR로 해석하고, 미머지 브랜치에서 P0 SSOT를 다시 썼다.

잠금:
- `docs/ai-core/AGENT-EXECUTION-PLAYBOOK.md`
- `docs/ai-core/scope-lock.json`
- `AGENTS.md` 11절 Scope lock

해석 고정:
- `기능 우선 / UI 보류` = 현재 P0 검색·접수 계약을 테스트로 고정
- `기능 우선` ≠ 정산 MVP, ≠ SALES 화면, ≠ Auth 경계를 지금 구현
- PR #7 문서는 main WORK-INBOX보다 우선하지 않음

---

## 14. ERP4 상품원자 당김 경로 확인 — 2026-09-14

상태: **USER DIRECTION — freepasserp.com 제품 핵심 / 원천 Firebase NOT CONNECTED**

사용자 최신 결정: “이게 이제 erp.com의 핵심이 될 것.” 여기서 이것 = ERP4 상품원자를 같은 Firebase 버전 컬렉션으로 공개 복사하는 계약.

핵심으로 승격하는 것:
- 원자 역할표 (공통/변동/정책/메타, 비공통은 계산)
- 공개 allowlist + 개인정보/수수료 차단
- Adapter 가격축 (`rentVariants`, depositPolicy) → v1 Offer
- `productMasterVersions` + `ssotState` 활성 포인터
- 해소는 한곳, 화면은 포맷만

핵심이 아닌 것:
- `freepasserp3` 프로젝트/시크릿을 v1 운영 DB로 쓰기
- `/erp5` 보류 UI
- 빈 트림 `기본형` 채움
- 정산/SALES를 원자보다 먼저 구현

확인 수치(2026-09-13 apply-draft): 1538대 복사, adapter 298, blocker 320, 활성 포인터 미교체.

