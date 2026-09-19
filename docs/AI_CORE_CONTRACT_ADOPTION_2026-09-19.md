# AI Core Core Contract Adoption — FreePass Admin — 2026-09-19

상태: **SHADOW PILOT / DEVELOPMENT BINDING PARTIAL**

기준 revision:
`fb85037969a6c2f4596350b9c66303025be6f19d`

AI Core 기준:
- Core Contract P0: PR #94
- Cross-project adoption P1: PR #96
- canonical contracts: 25

## 1. 왜 Admin부터 Application Service 계약을 만들었나

FreePass Admin은 이미 실제 코드에서 다음 경계를 갖는다.

```
Domain
  -> Application Service
  -> Port
  -> Adapter / Repository
```

기존 AI Core에는 Engine / Port / Adapter는 machine contract가 있었지만
Application Service는 문서 의미만 있고 독립 계약이 없었다.

Admin 실제 구현을 대입하면서 이 공백을 발견했고,
AI Core에 `core.application-service.v1`을 추가했다.

## 2. Application Service SHADOW

정본 파일:
`contracts/ai-core/application-service.json`

실제 source:
`src/services/applications.ts`

use case별 정책을 따로 선언한다.

### submit_application
- actor: REQUIRED
- side effect: yes
- idempotency: REQUIRED
- transaction boundary: REPOSITORY_ATOMIC
- same submissionId retry -> existing application replay
- expected product version conflict -> VERSION_MISMATCH family

### mark_progress
- actor: REQUIRED
- idempotency: SUPPORTED
- 같은 완료값 재저장 시 history를 추가하지 않음
- cancelled application은 변경 금지

### cancel_application
- actor: REQUIRED
- idempotency: SUPPORTED
- 재취소 시 첫 취소 이유를 덮지 않음

업무 상태와 transition 의미 자체는 D 영역이며 C가 재정의하지 않는다.

## 3. Port SHADOW

### application.repository

실제 구현:
`ApplicationRepository`

Core 의미:
- application lookup
- submissionId uniqueness
- atomic sequenced create
- aggregate mutate

read와 write를 함께 가지므로 Core Port에 `MIXED` direction을 추가했다.

### product.read

실제 TypeScript `ProductRepository` 전체를 그대로 Core Port로 복제하지 않았다.

Application Service가 실제로 요구하는 의미는:
**현재 Product + version 조회**

뿐이므로 Core에서는 `product.read`로 좁힌다.

이 원칙은 구현 interface를 HQ contract로 복사하지 않고,
consumer가 요구하는 semantic Port를 선언한다는 C 원칙과 같다.

### actor.provider

실제 Port는 존재한다.

`src/ports/auth.ts`

하지만 production ActorProvider adapter는 아직 검증되지 않았다.

따라서 Binding Profile에 **일부러 bind하지 않는다.**

## 4. Adapter SHADOW

현재 검증된 개발 adapter:

- `freepass-admin.file-application`
- `freepass-admin.file-product-read`

둘 다 현재 file repository 구현을 가리킨다.

이것은 production persistence라고 선언하지 않는다.

## 5. Binding Profile

`contracts/ai-core/development.binding-profile.json`

상태:
`PARTIAL`

bind:
- application.repository -> file application adapter
- product.read -> file product read adapter

미bind:
- actor.provider

이유:
운영 Auth/Permission adapter가 아직 없다.

AI Core contract 모양을 맞추기 위해 존재하지 않는 adapter를 만들어 쓰지 않는다.

## 6. Core Request Context SHADOW

submit의 기존 `submissionId`를 그대로 idempotency key로 사용한다.

추가 projection:
- submissionId -> request_id
- `application:<submissionId>` -> correlation_id
- actor -> Core actor
- productId/version -> expected_revision
- semantic request fields -> SHA-256 payload digest

기존 `submitApplication()`의 실행/저장 의미는 바꾸지 않는다.

## 7. Core Snapshot SHADOW

기존 Application snapshot은 이미:
- 접수 당시 Product version
- 선택 Offer
- Vehicle/spec
- Product policies
- capturedAt

을 deep copy로 고정한다.

Core projection은:
- application id -> subject id
- product id/version -> subject/source revision
- existing snapshot -> payload
- canonical JSON digest -> payload_digest

로만 변환한다.

Product가 나중에 version up되어도 과거 Application snapshot digest는 바뀌지 않아야 한다.

## 8. Core Error SHADOW

기존 `AppError`를 제거하지 않는다.

Core transport/error projection에서만 stable family로 매핑한다.

예:
- VALIDATION -> VALIDATION_ERROR
- PERSISTENCE -> PERSISTENCE_ERROR
- UNAUTHORIZED -> AUTHENTICATION_REQUIRED
- CANCELLED -> CANCELLED

Service result reason도 별도로 매핑한다.

예:
- PRODUCT_NOT_FOUND / OFFER_NOT_FOUND -> NOT_FOUND
- PRODUCT_CHANGED -> VERSION_MISMATCH
- REASON_REQUIRED -> VALIDATION_ERROR

Domain result type은 그대로 유지한다.

## 9. 테스트

`src/adapters/ai-core/__tests__/core-contract-shadow.test.ts`

실제:
- FileApplicationRepository
- FileProductRepository
- submitApplication()

을 사용한다.

검증:
1. contract source revision
2. development binding = PARTIAL
3. actor.provider가 거짓으로 bind되지 않음
4. same submissionId replay
5. Core request digest continuity
6. Product update 후 application snapshot digest 불변
7. AppError -> Core Error mapping
8. Service reason -> Core Error mapping

## 10. 아직 VALIDATED가 아닌 이유

- production Firestore repository adapter 없음
- production ActorProvider adapter 없음
- production audit sink/retention 미검증
- production release target 미검증
- Core receipt는 critical production mutation에 아직 연결되지 않음

따라서 현재 단계는 **SHADOW / PARTIAL**이다.

## 11. 다음 gate

1. backend-check 전체 PASS
2. AI Core adoption registry에 Admin SHADOW artifact 연결
3. production persistence adapter 설계 시 Core Port/Adapter/Binding contract 선적용
4. production ActorProvider가 생길 때 exact binding
5. critical write receipt/idempotency evidence
6. production proof 후 계약별 VALIDATED 판정
