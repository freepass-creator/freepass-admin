# FreePass Admin Semantic Idempotency P11 — 2026-09-20

Status: `SERVICE + ATOMIC REPOSITORY ENFORCEMENT IMPLEMENTED`

## 목적

같은 `submissionId`는 같은 의미의 접수 요청에서만 replay할 수 있게 한다.

기존 약점:

`submissionId`만 같으면 고객/상품/채널/담당자가 달라도 기존 Application을 돌려줄 수 있었다.

## Semantic payload

fingerprint 대상:

- productId
- offerId
- expectedProductVersion
- salesChannelId
- assigneeId
- applicantName
- applicantPhone
- source

`submissionId` 자체는 key이므로 fingerprint payload에는 넣지 않는다.

Domain 저장 전에 trim되는 문자열은 fingerprint에서도 같은 방식으로 trim한다.

## Fingerprint

형식:

`sha256:<hex>`

두 함수:

- `submissionFingerprint(input)`
- `storedSubmissionFingerprint(application)`

기존 Application에 fingerprint 전용 필드를 추가하지 않아도 Snapshot과 Application 필드에서 과거 semantic identity를 재구성할 수 있다.

## Service 규칙

1. request fingerprint 계산
2. 같은 submissionId Application 조회
3. 기존 건이 있으면 stored fingerprint 재구성
4. 같음 → replay
5. 다름 → `IDEMPOTENCY_KEY_REUSE`

## 동시성 규칙

Service 선검사만으로는 충분하지 않다.

동시에 두 요청이 들어오면 둘 다 기존 건이 없다고 볼 수 있기 때문이다.

따라서 `ApplicationRepository.createSequenced()` 자체가 fingerprint를 받는다.

### File Adapter

atomic file queue 안에서:

- existing submissionId
- stored fingerprint
- request fingerprint

를 비교한다.

다르면 `IDEMPOTENCY_KEY_REUSE` conflict.

### ERP5 Adapter

Firestore transaction 안에서 동일 비교를 수행한다.

따라서 서로 다른 payload의 동시 요청이 같은 key를 사용해도 한 건만 저장되고 다른 요청은 conflict가 된다.

## Core Shadow

`IDEMPOTENCY_KEY_REUSE`

→ `CONFLICT / 409 / USER / non-retryable`

## 테스트

- stored Application fingerprint 재구성
- trim semantic equivalence
- 각 business field 변경 시 fingerprint 변경
- sequential same key + different payload conflict
- concurrent same key + different payload: one created + one conflict
- vertical smoke에서 changed payload reuse conflict

## Readiness

machine gate가 다음을 확인한다.

- Service fingerprint compare
- Repository port fingerprint input
- File atomic fingerprint compare
- ERP5 transaction fingerprint compare

## 하지 않은 것

- submissionId 생성 규칙 변경
- 과거 Application schema migration
- client-side idempotency 신뢰
- 전자계약
