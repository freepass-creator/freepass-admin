# Backend Boundary Contract v1

상태: ADOPTED FOR FREEPASS ADMIN  
범위: UI/UX 제외

## 1. Layer contract

### Domain Engine
소유:
- 업무 의미
- 계산/검증
- 불변조건
- 상태 전이
- 동일 Offer 규칙
- Snapshot 의미

금지:
- Firebase SDK 직접 호출
- HTTP fetch
- React state
- 공급사 raw field 직접 해석

### Application Service
소유:
- 하나의 use case 실행 순서
- 여러 Domain operation 조합
- Port 호출 순서
- idempotency 흐름
- 결과/error mapping

금지:
- UI 렌더링
- 공급사별 if/else 난립

### Port
소유:
- Domain/Service가 필요로 하는 의미 계약
- 저장/조회/권한/audit 같은 추상 기능

Port는 구현 기술을 이름에 박지 않는다.
예: `ApplicationRepository`는 허용, `FirestoreApplicationRepositoryPort`는 금지.

### Adapter
소유:
- 외부 포맷/단위/필드 변환
- Port 구현
- 공급사/프로젝트별 차이
- controlled side effects

Adapter는 Domain 의미를 새로 만들지 않는다.

### Repository
소유:
- persistence
- atomicity
- uniqueness
- transaction
- concurrency
- storage-level idempotency

### Connector
소유:
- HTTP/DB/API transport
- authentication transport plumbing
- timeout/retry primitive

Connector는 FreePass 업무 규칙을 판단하지 않는다.

## 2. Idempotency contract
쓰기 use case는 UI disabled만으로 중복을 막지 않는다.

최소:
- caller-generated 또는 server-issued idempotency key
- storage-level uniqueness
- duplicate retry 시 기존 결과 반환
- side effect가 있다면 outbox/transaction 전략 별도 검증

## 3. Concurrency contract
`read count → +1 → write`는 운영 unique number 생성에 사용하지 않는다.

허용 후보:
- transactional counter
- DB atomic sequence
- opaque primary key + 별도 transaction-bound display number

## 4. Error contract
오류는 최소 다음 계층을 구분한다.

- VALIDATION
- NOT_FOUND
- CONFLICT
- VERSION_MISMATCH
- DUPLICATE_REUSED
- UNAUTHORIZED
- FORBIDDEN
- EXTERNAL_DEPENDENCY
- PERSISTENCE
- UNKNOWN

사용자 표시 문구와 내부 error code를 동일 문자열로 강제하지 않는다.

## 5. Audit contract
민감 상태 변경은 최소 다음 evidence를 남길 수 있어야 한다.

- event id
- event type
- occurred_at
- actor id / actor type
- entity type / entity id
- source revision or app version where available
- before/after or semantic delta
- reason where required
- correlation/idempotency id

Audit log는 일반 application memo와 분리한다.

## 6. Version contract
사용자가 본 Product version과 저장 시 version이 다르면 조용히 최신 조건으로 저장하지 않는다.

결과는 명시적 conflict로 처리한다.

## 7. Promotion rule
이 계약을 DevCenter 공통 표준으로 자동 승격하지 않는다.

승격 전:
1. FreePass Admin 실제 적용
2. 두 번째 실제 프로젝트 재사용
3. contract/integration test
4. rollback 확인
5. 프로젝트 고유 업무 의미 침범 없음
