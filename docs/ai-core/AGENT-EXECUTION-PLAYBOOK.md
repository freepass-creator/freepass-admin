# AGENT EXECUTION PLAYBOOK — Codex/Work 해맴 방지

작성일: 2026-09-14
상태: **LOCKED / Work·Codex 공통 실행 절차**
대상: 코드/문서를 쓰는 모든 에이전트
기준: `AGENTS.md`, `docs/WORK-INBOX.md`, `docs/MASTER-v1.md`, `docs/ai-core/scope-lock.json`

> 이 문서는 기능을 더 붙이는 곳이 아니다. 에이전트가 한 PR에서 제품 기준을 다시 쓰고 다음 Phase를 앞당기지 못하게 막는 실행 잠금이다.

---

## 1. Codex가 해맨 원인 — PR #7

브랜치 `codex/functional-settlement-mvp-20260913` (PR #7)은 아래를 한 번에 섞었다.

1. **SSOT 재작성**: 미머지 브랜치에서 `AGENTS.md` 4절 P0, `MASTER-v1.md` Phase A/D, `WORK-INBOX` “현재 구현됨”을 정산 수직흐름으로 바꿈.
2. **Phase 점프**: Phase A 접수 수용 조건이 끝나기 전에 실적·정산·청구·수금·지급·SALES 화면·Firebase Auth를 같은 PR에 넣음.
3. **임시 Gate를 확정처럼 구현**: VAT, 전액수금 후 지급 등 `DECISION REQUIRED`를 코드 기본값으로 고정.
4. **완료 단계 혼동**: localStorage/메모리 시뮬레이션을 기능 MVP로 올리고, 머지 전 작업을 WORK-INBOX 기준으로 승격.
5. **한 파일에 업무 전부**: `admin-dashboard.tsx`에 검색·접수·실적·정산을 몰아넣음.

사용자 지시 `기능 우선 / UI 보류`의 올바른 해석:

```text
상품원자 SSOT를 v1 Canonical 핵심으로 두고,
지금 P0(검색 → 상세 → 접수 Snapshot → 계약서/서류/인도/취소)를
추측 UI 없이 Domain 계약과 테스트로 고정한다.
데모 카탈로그는 Canonical이 아니다.
```

잘못된 해석:

```text
정산·SALES·Auth까지 한 번에 만들고 MASTER P0를 넓힌다.
ERP4 Firebase를 v1에 붙여 핵심을 대체한다.
```

PR #7은 **새 baseline이 아니다.** `scope-lock.json`의 salvage만 재사용하고 park 항목은 가져오지 않는다.

---

## 2. 매 작업 시작 — 질문 네 개

코드를 쓰기 전에 답한다. 하나라도 “예”면 멈추고 보고한다.

1. 이 변경이 `AGENTS.md` 3–4절, MASTER Phase, WORK-INBOX P0를 다시 쓰는가?
2. 이 PR이 `scope-lock.json`의 `notP0UntilPhaseAVerified`를 구현하는가?
3. 이 PR이 `onePrOneSlice` 중 **둘 이상**을 건드리는가?
4. 값이 `DECISION REQUIRED`인데 임시 규칙을 만들어 통과시키려 하는가?

예외는 사용자 명시 변경 + **문서 전용 PR**에 이유·영향 기록일 때만이다. 코드 PR에서 SSOT를 같이 넓히지 않는다.

---

## 3. 지금 해도 되는 일 / 하면 안 되는 일

### 해도 됨 — Gate A

- 상품원자 SSOT 계약: 공통/변동/정책/메타, 공개 allowlist, Adapter Offer 축, 버전 포인터. ERP4 프로젝트는 읽기 참고만
- same-Offer 검색: 기간·월대여료·보증금·약정주행·Offer-scope Policy가 **같은 Offer 하나**에서 동시에 맞을 때만 통과
- 같은 축 복수값 OR, 다른 축 AND
- 모델/세부모델/트림 EXACT vs PARTIAL. 다른 세부모델로 확정된 상품은 PARTIAL에 넣지 않음
- 보증금 공란 ≠ 0원/무보증
- 일치 `offer_id`를 반환해 상세·접수까지 유지할 수 있게 함
- Application 필수: 차량/선택 Offer, `salesChannelId`, `assigneeId`, `customerName`
- Snapshot에 explicit `productVersion`, 선택 Offer, Policy 값 복사(배열 포함)
- `submissionId` idempotency (같은 요청 replay, 다른 payload는 충돌)
- 연락처는 필수 아님 (`customerPhone` optional)

### 하면 안 됨

- SALES `/sales` 화면, WHITE LABEL 엔진
- 정산 확정, 청구서, 수금/지급 원장, 마진 UI를 P0로 구현
- 신규 Firebase 프로젝트 연결, 로그인 UI, 세션 쿠키를 같은 슬라이스에 넣기
- 승인 이미지 없이 ADMIN 시각 개편을 완료로 보고
- 기존 ERP/Firebase/ADC fallback
- 미머지 작업으로 WORK-INBOX 구현 목록을 덮어쓰기

상품 원자의 실체는 `docs/reference/ERP4-ERP5-PRODUCT-ATOM-SSOT.md`에 확인돼 있다. 2026-09-14부터 이것이 freepasserp.com의 제품 핵심이다. 데모 카탈로그를 Canonical로 승격하지 말고, ERP4 `products`를 v1 운영 DB로 연결하지도 않는다.

---

## 4. PR 크기

한 PR은 `onePrOneSlice` 중 하나, 또는 **같은 슬라이스의 Domain + 회귀테스트**만.

검색 계약을 고치면 검색 테스트만 추가한다. 접수 계약을 고치면 접수 테스트만 추가한다. 정산 테스트와 Auth 테스트와 UI 토큰을 같은 PR에 넣지 않는다.

---

## 5. 완료 보고

| 상태 | 의미 |
|---|---|
| DESIGNED | 계약이 MASTER/WORK-INBOX와 맞음 |
| CODED | 코드가 그 계약만 구현 |
| STATIC CHECKED | typecheck/lint |
| TESTED | 회귀테스트 실행 통과. 가능하면 구구현 반례 실패를 기록 |
| PERSISTENCE VERIFIED | 독립 저장소에 저장/재조회/중복방지 증거 |
| DEPLOYMENT VERIFIED | 승인된 환경 배포 증거 |
| USER APPROVED | 사용자 승인 (UI는 exact image) |

앞 단계를 뒤 단계처럼 말하지 않는다.

---

## 6. PR #7에서 가져올 것 / 버릴 것

가져올 것:

- same-Offer 검색과 세부모델 혼입 금지
- `CanonicalProduct.version`과 Snapshot `productVersion`
- 접수 4필수 + 전화 비필수
- MULTI_SELECT 배열 복사
- `submissionId` fingerprint replay/충돌

가져오지 말 것:

- AGENTS/MASTER/WORK-INBOX P0 재작성
- `src/domain/settlement/*`, `src/domain/performance/*`를 현재 P0 코드로 main에 승격
- `/sales`, Firebase Admin/세션/Rules, `/dev-preview` localStorage 영속
- `src/app/admin-dashboard.tsx` 일체형 화면
- VAT/지급정책을 운영 기본값으로 고정한 코드

정산 Domain은 이후 Gate에서 **별도 PR**로 재검토한다. 그때도 MASTER Phase D이며, Phase A 검색·접수·영속 검증보다 앞세우지 않는다.
