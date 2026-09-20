# WORK-INBOX — Chat R&D → Work 개발 반영용

최종 갱신: 2026-09-16
프로젝트: freepass-admin (구 freepasserp.com 저장소)
목적: ChatGPT 채팅에서 사용자와 확정한 R&D 내용을 Work가 자동 추측하지 않고, GitHub에서 한 곳만 읽고 개발에 반영하도록 만드는 공용 인수인계 문서.

> Work 작업 시작 전 반드시 이 문서와 `AGENTS.md`, `docs/MASTER-v1.md`를 읽는다. 이 문서는 대화 전체를 복사하는 곳이 아니라 **현재 개발에 영향을 주는 최신 결정·시뮬레이션·HOLD·다음 작업**만 요약한다.

---

## 1. 사업 구조 — 가장 먼저 이해할 것

freepass-admin은 단순 상품목록 ERP가 아니다.

```text
공급사 상품 RAW
 → Adapter / Mapping / Validation
 → Canonical Product SSOT
 → 영업자에게 판매 가능한 상품 제공
 → 고객 접수
 → 계약서 / 필수서류 / 잔금 / 인도
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
 → 계약서 / 필수서류 / 잔금 / 인도 / 취소
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
- 별도 체크: 계약서 / 필수서류 / 잔금 / 인도

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

## 13. ADMIN 시각 기준 확정 — 2026-09-16 · **USER APPROVED**

상태: **DESIGNED / USER APPROVED (시각 방향)** — §12 의 `HOLD_UNTIL_USER_IMAGE_APPROVAL` 은 **해제됐다.**

승인 증거 (WORK-INBOX §12 가 요구한 파일·해시 고정):

```
docs/ui/mockups/admin-product-to-application.html   rev 5
sha256  6d2c26dc171d0c519d8ba5d8f9d7ab4be29cfeb371f6c8e639606863b62cef7d
```

사용자 승인 발언: 「이 느낌으로 가자 이게 맞는거 같다」 · 「이렇게 해야하는게 **모바일로도 할거면** 이게 맞아」 ·
「여기서 디자인 고도화 해나가면 되고 **어차피 중요한건 기능**이니까」

→ 시각은 이 파일을 기준으로 **이어서 다듬는다**. 새 방향을 다시 제안하지 않는다.
→ 우선순위는 **기능**이다. 화면을 예쁘게 만드느라 접수·정산 동작을 미루지 않는다.

### 13-1. §12 를 덮어쓰는 결정

| 항목 | §12 (2026-09-13) | **§13 (2026-09-16) — 이것이 현행** |
|---|---|---|
| 패널 구분 | 1px 구분선 · 큰 둥근 카드 회피 | **패널을 띄운다** — 레일·세 칸이 각자 떠 있는 카드(간격 12, 모서리 16, 층진 그림자). 선으로 나누지 않고 **여백과 면**으로 나눈다 |
| 근거 | — | 모바일을 같이 갈 것이기 때문이다. 3열을 압축하는 것이 아니라 같은 카드가 폰에서 화면 하나가 된다 |

§12 의 나머지(Pretendard, 흰 작업면, 44px 급 입력·버튼, 2줄 목록, 은은한 선택 배경, 알약형 상태 남발 금지)는 **그대로 유효**하다.

### 13-2. 관리자 찾기 — 퀵필터를 두지 않는다

- 대표(2026-09-16): 「관리자는 퀵필터 필요없고 그냥 **검색이랑 세부필터**면 돼 어차피 **검색창에 무보증 이런거 21세 이런거 다 먹히게** 할거니까」
- 관리자 상품 찾기는 **검색창 하나 + 오른쪽 끝 `세부필터`** 다. 화이트라벨의 알약 한 줄은 **손님 화면의 것**이고 관리자에는 두지 않는다.
- 검색어는 **조건을 먹는다**: 무보증 · 만21세 · 카드결제 · 후불 · 분납 · 하이브리드/디젤/가솔린 · N개월 · 월 N만원 이하 · 공급사명.
- ★읽어낸 조건은 **반드시 되돌려 보여 준다**(점선 토큰). 안 보여 주면 직원은 무엇을 걸었는지 모른 채 결과만 줄어드는 것을 보고, 그때부터 화면의 숫자를 안 믿는다.
- 검색어에서 읽은 조건은 세부필터 시트에서 **잠긴 상태**로 보인다 — 끄려면 검색창에서 지운다. 한 조건을 끄는 문이 두 개면 어느 쪽이 진짜인지 모른다.

### 13-3. 세부필터 — 두 칸 시트

fp4 화이트라벨 실물(`components/shop/ShopFilterSheet.tsx`)의 확정 규격을 그대로 쓴다.

- **왼쪽 축 지도 · 오른쪽 값.** 위아래로만 쌓지 않는다 — 밑에 무슨 축이 더 있는지 안 보인다.
- 두 칸은 **따로 구른다.**
- **적용·취소 단추를 두지 않는다.** 고르는 즉시 반영되고 바닥은 `N건 보기`로 결과 수만 말한다.
- 건수는 **그 축을 뺀 나머지 조건**으로 센다(교차 집계). **0건이 되는 값은 세우지 않는다.**

★`EMAIL-RND-CONSOLIDATED.md` 의 「Draft / 닫기 / 적용」과 충돌한다. **fp4 실물이 더 나중이고 이유가 붙어 있어** 그쪽을 따랐다
(취소 단추를 두면 화면의 목록과 시트 안의 선택이 갈려, 닫기 전까지 어느 쪽이 진짜인지 알 수 없다).

### 13-4. 사진

- **사진 위에는 아무것도 얹지 않는다.** 차번도 안 얹는다 — 사진 밝기가 제각각이라 얹은 글자는 어떤 사진에서는 안 읽힌다.
- 신원칩(공급사·확정도)만 **우하단**에 어두운 유리로.
- **사진만 둥글게, 글자는 그냥 밑에.** 카드를 나누는 것은 선이 아니라 여백이다.
- 사진 없는 차가 실측 28% 다 — 네모 빈 상자 대신 둥근 **「사진 준비 중」**.
- ★**사진이 있다고 원자가 있는 것이 아니다.** 사진은 있는데 색상 값이 없는 상품이 실제로 있다. 그때 색상은 `미확인`이다.

### 13-5. 다음 — 기능

시각이 잠겼으므로 남은 것은 전부 **동작**이다.

1. 저장 — `src/ports/repositories.ts` 문 뒤에 실제 저장소를 붙이고 저장·재조회·중복방지를 **실행으로** 확인한다 (독립 Firestore. RTDB 는 폐기 정책상 금지)
2. API — 접수 생성에 `submissionId` 기반 idempotency 를 서버에서 건다
3. 화면 — 승인된 rev 5 대로 ADMIN 수직 한 줄을 실제 데이터로 잇는다
4. 실적 → 청구 → 수금 → 지급 (§7 순서 그대로)
5. 승인 공급사 1곳 RAW → Canonical → 검색 → 접수 수직연결

---

## 14. 2026-09-21 continuation baseline — P0~P12 복원 완료

이 절은 §8·§11의 과거 gap 목록보다 최신이다. 과거 항목을 삭제하지 않고 진행 이력을 보존하되, 현재 작업 시작점은 아래를 사용한다.

### 기존 구현 체인
- P0 (#19): Product/Search/Application/Performance/Settlement 핵심 Domain
- P1 (#20): 실제 `/products` · `/intake` 화면/Repository 연결, 하드코딩 데모 제거
- P2 (#21): Performance → Settlement → Billing → Collection/Payout durable operations
- P3 (#22): ERP5 Firestore Product read + namespaced Admin transaction adapter
- P4 (#23): Firebase 관리자 세션/ActorProvider/페이지 보호
- P5 (#24): `admin:readiness` machine gate
- P6 (#25): ERP5 product cache + 50건 paging + 기간 필터
- P7 (#26): 접수 운영검색/필터, Registration Snapshot, 인도→정산 handoff
- P8 (#27): 정산 운영검색/필터 + append-only ledger reversal
- P9 (#28): 상품→접수→인도→실적→정산→청구→수금→지급 vertical smoke
- P10 (#29): ERP5 Partner/관리자 UID Reference Master
- P11 (#30): semantic submission fingerprint + storage atomic idempotency
- P12: Billing invoice evidence Domain 및 실제 저장/Service/UI/Smoke 연결

최신 continuation branch:
`work/gpt/admin-p12-continuation-20260921`

### 지금 이미 된 것으로 취급할 것
- same-Offer 검색과 선택 Offer 연속성
- 실제 Repository 기반 상품찾기 화면
- Application Snapshot + registration continuity
- File/ERP5 transaction persistence 경계
- verified Admin Actor/Auth 경계
- 실적 검토 → 정산확정 → Billing → 부분수금 → 지급
- append-only ledger reversal
- 50건 paging/검색/필터
- Reference Master 검증
- semantic idempotency
- 계산서 증빙이 완료되기 전 수금 차단

### 최신 사용자 결정 — F04
- 당분간 `[F04 사용중] 프리패스 정산원장`과 병행한다.
- 최종 목표는 FreePass Admin에서만 접수·실적·정산을 처리하는 단일 writer 구조다.
- F04는 명시적 Legacy Bridge로만 연결하고 Domain 정본이나 fallback으로 사용하지 않는다.
- Admin/F04 동시 수정(dual writer)을 최종 구조로 허용하지 않는다.

### 다음 순서
1. P12 계산서 증빙 경로 typecheck/test/smoke 검증
2. F04 Legacy Bridge 계약과 stable-id 매핑 설계
3. 기존 F04 접수/분납실적/완납실적/월청구 데이터를 Admin Projection과 대조
4. 신규 Admin writer → F04 mirror 경로를 병행 단계로 구현
5. 환수(사업 clawback)와 ledger reversal을 명확히 분리해 Domain에 반영
6. 기준일 이후 Admin 단일 writer 전환 Gate 설계

---

## 15. FreePass Data 연동 준비 — 2026-09-21

사용자 최신 결정: 프리패스 어드민은 향후 프리패스 데이터를 연계할 것을 전제로 계속 개발한다.

### 구현 완료
- Admin Product source와 operational persistence 설정 분리
- `FPA_PRODUCT_SOURCE=file|erp5|freepass-data`
- FreePass Data `admin-catalog/v1` Adapter
- Offer별 supplier authority
- Offer/PriceTerm provenance (`sourceOfferId`, `sourceOfferRevision`, `sourcePriceTermKey`)
- depositState 보존
- ERP5 vs FreePass Data shadow parity service
- `npm run admin:data-shadow` 수동 비교 명령
- readiness에 Data consumer boundary/shadow tooling 검사 추가

### Data 쪽 계약
- repo: `freepass-creator/freepass-data`
- PR #12: Admin Catalog Projection V1
- schema: `freepass-data.admin-catalog/v1`
- endpoint target: `/v1/views/admin-catalog/products`
- 현재 상태: CONTRACT LOCKED / ENDPOINT NOT ACTIVE

### Cutover 전 필수
1. Admin Catalog ACTIVE Release
2. service IAM/auth
3. searchable Policy typed-value parity
4. ERP5 direct vs Data shadow parity
5. freshness/rollback evidence

### 다음 개발
1. P12 코드 검증(typecheck/test/smoke)
2. fp-settlement 순수 정산엔진 reverse import 계약
3. FreePass Data Admin projection 구현 준비와 policy normalization parity
4. F04 Legacy Bridge stable-id mapping
5. Business clawback Domain
6. Data/F04/기존 정산엔진/Admin 4-way parity fixture

---

## 16. Settlement pricing + F04 bridge continuation — 2026-09-21

### 구현
- `SettlementPricingProvider` / CatalogFacts vs OperationalFacts 분리
- `fp-settlement` proven fee table blob `ccc8b5456c79a00f00c3795ee87b94061f96791f` 역수입
- 공급사 stable ID → fee-rule key Resolver
- 웰릭스 재렌트/신차 차량가액/오토플러스 EV 등 자동추천 규칙 Provider
- auto:false / 조건분기 / 식별 실패 → REVIEW_REQUIRED
- 정산 화면 `기존 정산 규칙 자동추천` 추가
- 자동 산출 Evidence를 Performance → finalized Settlement까지 보존
- 수동 금액 수정/공급사 수정 시 stale auto Evidence 제거

### F04
- `OBSERVE → MIRROR_ADMIN_OWNED → ADMIN_SINGLE_WRITER` Bridge Mode
- applicationId 기반 deterministic `stl_` code
- 병행 단계에서 Admin-owned field만 patch
- 분납여부/청구월/환수/요율/인센티브/가감은 Admin 정본화 전까지 미러에서 제외

### Data
- Catalog read source와 Admin writer 분리 유지
- Data PR #12 consumer contract가 최신 main 위에서 mergeable 상태
- `commercialType`, `vehiclePrice`, Offer/PriceTerm provenance, depositState를 정산 입력까지 보존
- `admin:data-shadow` parity에 commercial pricing facts 포함

### 다음
1. 실제 typecheck/test/admin:smoke 실행 가능한 환경에서 P12+ 검증
2. FreePass Data Admin Catalog Projection 구현 + Policy typed-value parity
3. Business CLAWBACK Domain 구현 (Ledger REVERSAL과 분리)
4. F04 row-link persistence/Sheets Adapter — 안정 row mapping 후 연결
5. F04 / fp-settlement / Admin / Data 4-way parity fixture


---

## 17. 환수 현금·계산서 / F04 Row Link / Data Projection — 2026-09-21

### Business CLAWBACK — 원장 REVERSAL과 분리 완료

환수 한 건은 원 Settlement를 수정하지 않는 별도 불변 사건이다.

```
원 정산
  ↓
ClawbackItem
  ├─ 공급사 환수액
  ├─ 영업채널 환수액
  ├─ VAT impact
  ├─ 환수 사유/발생일
  └─ 원 settlement/performance/application 연결
```

- 누적 환수는 원 정산 금액을 초과할 수 없다.
- 채널 환수액 미입력 시 기존 지급/청구 비율로 계산한다.
- 동일 clawback id exact replay만 멱등 허용한다.
- 원 Settlement / Billing / 기존 수금·지급 원장은 수정하지 않는다.

### 환수 후 Net Position

환수가 생기면 신규 수금·지급 한도는 원 정산이 아니라 순액으로 계산한다.

- netReceivable = supplierReceivable - supplierClawback
- netPayable = channelPayable - channelClawback
- 초과수금 → supplierRefundOutstanding
- 초과지급 → channelRecoveryOutstanding
- 이후 일반 수금/지급은 순액까지만 가능
- AFTER_FULL_COLLECTION 정책은 미수뿐 아니라 공급사 환불 미완료도 차단한다.

Ledger 계정:
- SUPPLIER_COLLECTION
- CHANNEL_PAYOUT
- SUPPLIER_REFUND
- CHANNEL_RECOVERY

잘못 입력한 네 종류의 현금기록은 REVERSAL로 정정하되, clawback cash reversal은 clawbackId가 원본과 같아야 한다.

### 환수 계산서 조정

원 Billing을 고치지 않는다.

각 Clawback마다 별도 `ClawbackBillingAdjustment(direction=CREDIT)`를 만든다.

- settlementAmount
- netAmount
- vatAmount
- totalAmount
- CREATED / EVIDENCE_COMPLETE
- 증빙번호 / 발행일 / 기록자 / 기록시각

File operations state는 schemaVersion 3이며 v1/v2 누락 필드를 normalize하여 읽는다.
ERP5는 Admin namespace의 `clawbacks` / `clawback_billings` 컬렉션을 사용한다.

### F04 안정 Row Link

F04 writer는 아직 활성화하지 않는다.

먼저:
- applicationId ↔ f04SettlementCode ↔ sheetName/legacyRowRef
- File/ERP5 F04RowLinkRepository
- ERP5 `f04_links` namespace
- application remap / settlement-code collision 차단
- migration auto-link는 차량번호 + 고객명 + 접수일 정확히 1건일 때만
- 양쪽 공급사명이 있으면 공급사도 일치해야 함
- 0건 = NONE / 2건 이상 = AMBIGUOUS, 자동 연결 금지

실제 Sheets writer는 이 stable link를 사용해야 하며 매번 차량번호로 행을 다시 찾으면 안 된다.

### FreePass Data

최신 Data 작업 PR은 `freepass-creator/freepass-data#12`.

구현 범위:
- 실제 Admin Catalog Projection Release
- `GET /v1/views/admin-catalog/products`
- bearer-token fail-closed
- policyParity COMPLETE/INCOMPLETE evidence
- generation/subModel 분리
- product policyCode → Canonical Offer.policyId lineage
- Admin 운영 Data adapter는 COMPLETE만 허용
- `admin:data-shadow`에서만 명시적으로 INCOMPLETE 비교 허용

운영 cutover blocker:
1. legacy Policy source → Canonical Policy facts
2. full shadow parity
3. service IAM/auth runtime evidence
4. freshness/rollback evidence

### 다음

1. 실제 Sheets Adapter — F04RowLink 기반 OBSERVE부터
2. legacy Policy 별도 Source/RAW/Canonical 경로
3. F04 / fp-settlement / Admin / Data 4-way parity fixture
4. 실제 typecheck/test/admin:smoke 실행 가능한 환경에서 검증


---

## 18. P13 운영 안전 마감 — 2026-09-21

최신 작업 branch:
`work/gpt/admin-p13-operational-safety-20260921`

### 이번 마감 범위
- 영업채널 확인/이견/재확인은 Performance Snapshot의 `salesChannelId`와 동일한 party만 허용
- 공급사 확인/이슈는 Performance Snapshot의 `supplierId`와 동일한 party만 허용
- 모든 Billing / Collection / Payout / Clawback / Refund / Recovery / Reversal Server Action은 선택한 Performance에서 Settlement를 서버 재조회
- hidden `settlementId`가 실제 연결과 다르면 `SETTLEMENT_SELECTION_MISMATCH`로 fail-closed
- AFTER_FULL_COLLECTION 조건이 열리기 전에는 지급 폼 자체를 노출하지 않음
- 멀티 공급사 Offer의 공급사 ID를 상품 상세·Offer 선택·신규접수 Snapshot 직전까지 명시적으로 표시
- 보증금 `KNOWN / ZERO / UNKNOWN / NOT_APPLICABLE` 의미를 신규접수 화면에서 숫자 0으로 뭉개지 않음
- `admin:readiness`에 위 P13 가드를 추가해 회귀 차단

### 확인된 결함과 수정
기존 Domain은 영업채널/공급사 review의 `partyId`가 Snapshot 당사자인지 검증하지 않았다.
따라서 접수 채널이 `online`이어도 다른 ID로 확인 기록이 가능했다.
P13에서 이를 Domain invariant로 격상하고 회귀 테스트를 추가했다.

### 현재 우선순위
1. P13 typecheck / test / admin:smoke 실행 증거 확보
2. 실제 ERP5 환경에서 상품→접수→인도→정산→계산서→수금→지급 1건 persistence 재조회
3. F04는 OBSERVE 기반 row-link 검증부터 진행
4. FreePass Data Catalog ACTIVE 전까지 ERP5 direct read 유지


---

## 19. P14 AI Core UI Composition 적용 — 2026-09-21

AI Core Search & Discovery Composition 정본 후보(PR ai-core #185)를 FreePass Admin 상품찾기에 최초 적용한다.

### Product Search mode
- `SEARCH_FILTER`
- 검색창과 세부필터 trigger를 같은 row에 배치
- 상시 1/6/12/24/36/60개월 quick filter 제거
- 기간 / 월 대여료 상한 / 보증금 상한은 세부필터에 수용
- 적용된 조건은 검색창 바로 아래에서 보이고 개별 해제 가능
- 모바일에서 세부필터 panel은 bottom-sheet 형태로 전환
- 검색/필터/결과수/목록은 동일 URL query를 SSOT로 사용

### 같이 수정한 기능 결함
기존 숫자 query parser는 빈 문자열을 Number('')=0으로 읽을 수 있었다.
필터 미입력은 0이 아니라 `undefined`가 되도록 수정한다.

### 금지
- 운영 근거 없이 상품검색 quick filter를 다시 추가하지 않는다.
- 같은 조건을 검색 parser / quick filter / detailed filter의 서로 다른 state로 중복 관리하지 않는다.

최신 branch:
`work/gpt/admin-p14-ui-composition-20260921`
