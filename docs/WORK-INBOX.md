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

---

## 12. 기능 우선 수직 흐름 — 2026-09-13 사용자 변경

사용자는 UI 추가 개선을 뒤로 미루고, 먼저 실제로 정산 가능한 기능 흐름을 만들도록 우선순위를 변경했다.

첫 기능 슬라이스:

```text
상품/Offer 선택
 → 4개 필수값 접수
 → 버전/Offer/Policy Snapshot
 → 계약서/필수서류/인도
 → 인도에서 Performance 1회 생성
 → 영업자 확인
 → 공급사 확인
 → 정산 확정
 → 청구서 생성
 → 부분수금
 → 부분지급
 → 미수/미지급/마진 확인
```

현재 구현 상태:
- Application의 `productVersion`, `salesChannelId`, `assigneeId`, `customerName`, `submissionId` 계약 반영
- 전화번호를 최초 접수 필수값에서 제외
- MULTI_SELECT Policy를 포함한 Snapshot 참조 분리
- 인도 사실에 `deliveryEventId`, `deliveredAt` 추가
- Performance 검토 순서와 Settlement 확정 Gate 구현
- 청구/수금과 지급을 별도 누적 원장으로 구현
- 브라우저 새로고침 후 기능 확인을 위한 localStorage 개발 저장 추가
- 단위테스트/TypeScript/Next build 통과

현재 완료 수준:
- Domain: `CODED / STATIC CHECKED / TESTED`
- UI 연결: `CODED / STATIC CHECKED`
- 브라우저 저장: 개발 시뮬레이션용이며 `PERSISTENCE VERIFIED`가 아님
- Firebase Auth 세션 경계/서버 역할 강제/Rules: `CODED / STATIC CHECKED / TESTED`
- 실제 신규 Firebase 프로젝트/Firestore 영속성/Transaction: 아직 미연결
- Deployment: `NOT AUTHORIZED`

Firebase 연결 전 결정 필요:
- 신규 Firebase 프로젝트 ID / 리전 / ADMIN Auth 방식
- VAT 운영 기준
- 공급사 수금 전 영업채널 지급 허용 정책
- 부분수금 비례지급 정책

개발 시뮬레이션에서는 VAT를 명시적으로 선택해야 정산 확정할 수 있고, 지급은 보수적으로 공급사 전액 수금 후에만 허용한다. 이는 운영 확정값이 아니라 안전한 임시 Gate다.

---

## 13. ADMIN 웹 UI·UX R&D 업데이트 — 2026-09-13

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

## 14. 역할 분리 확정 — 2026-09-13 사용자 변경

사용자 최신 결정:
- SALES 영업자는 상품 검색과 상품 상세 확인까지만 사용한다.
- 계약 접수와 접수 이후 접수관리·실적·정산·청구·수금·지급은 ADMIN만 처리한다.
- WHITE LABEL은 기존 시스템을 최대한 활용해 별도로 수정한다.

구현 반영:
- STAFF 역할은 `ADMIN | SALES`, 제품 Surface는 `ADMIN | SALES | WHITE_LABEL`로 분리한다.
- SALES는 상품 읽기만 허용하고 모든 ADMIN 업무 권한은 deny-by-default로 거부한다.
- SALES 상품 화면은 별도 `/sales` 경로에서 상품목록·상품상세만 렌더링한다.
- SALES 응답 Projection에서 공급사 ID, 공급사 상품키, 원문 Snapshot ID를 제외한다.
- ADMIN localStorage의 고객/접수/금액 상태를 SALES 화면에서 읽지 않는다.
- ADMIN이 영업채널/공급사의 확인 사실을 기록할 때 채널·공급사 ID와 `recordedByAdminId`를 분리한다. 실제 개인 확인자와 증빙 방식은 `DECISION REQUIRED`다.

현재 완료 수준:
- 역할 계약/SALES 화면: `CODED / STATIC CHECKED / TESTED`
- Firebase 세션 쿠키 검증 Adapter와 서버 capability 강제: `CODED / STATIC CHECKED / TESTED`
- Firestore 클라이언트 catch-all deny Rules: `CODED / FIRESTORE EMULATOR TESTED`
- 실제 신규 Firebase 프로젝트 연결·계정 발급·로그인 UI·영속성: `NOT IMPLEMENTED`
- 실제 프로젝트가 연결되기 전 `/`와 `/sales`는 fail-closed하며 미인증 401/권한부족 403 접근 안내를 표시한다. 로컬 기능 시뮬레이션은 개발 환경의 `/dev-preview`에서만 열리며 운영 빌드에서는 404다.
- 인증된 운영 경로는 고객·금액 localStorage를 읽거나 쓰지 않는다. localStorage 시뮬레이션은 `/dev-preview`에만 제한한다.
- Firebase Admin은 명시적인 `FREEPASS_FIREBASE_*` 세 값 없이는 초기화하지 않고, 로컬 Google 자격증명이나 기존 ERP 환경변수로 fallback하지 않는다.

운영화 P0:
1. 신규 Firebase 프로젝트 ID / 리전 / Auth provider 확정
2. `staffAccounts/{uid}`에 ACTIVE ADMIN/SALES를 승인 절차로 발급하고 권한강등·토큰폐기 절차 확정
3. 현재 클라이언트 시뮬레이션 mutation을 서버 Command + Firestore transaction으로 이전
4. 역할 변경·로그아웃 시 고객/금액 localStorage를 제거하고 서버에서 재조회
5. 신규 Firebase Auth Emulator/실 프로젝트에서 세션 생성·폐기·비활성 사용자 E2E 검증

서버 권한 원칙:
- 세션 쿠키는 Firebase Admin `verifySessionCookie(..., true)`로 취소 여부까지 확인한다.
- 실제 권한은 요청 body/header의 role이 아니라 서버가 읽은 `staffAccounts/{verified uid}`의 ACTIVE 역할로 결정한다.
- ADMIN·SALES 모두 브라우저 Firestore 직접 접근을 금지한다. 서버 Admin SDK는 Rules를 우회하므로 모든 서버 명령에서 capability를 다시 검사한다.
- 세션 교환은 same-origin, double-submit CSRF, 최근 5분 로그인 조건을 확인하며 쿠키는 HttpOnly/Secure/SameSite=Strict로 발급한다.
- SALES는 상품 Projection만 받고 접수·실적·정산·청구·수금·지급 경로는 403으로 거부한다.
