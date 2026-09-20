# FreePass Admin Reference Master P10 — 2026-09-20

Status: `REFERENCE MASTER BOUND / FREE-TEXT INTAKE REFERENCES CLOSED`

## 목적

접수의 `salesChannelId`와 `assigneeId`를 자유문자열에서 Reference Master 기반 식별자로 전환한다.

## 영업채널 정본

Production ERP5 모드:

- Firestore project: `freepasserp5`
- collection: `partner`
- 기존 Partner 유형 정규화 규칙 재사용
  - provider / 공급사 → 공급사
  - sales_channel / 영업채널 / 채널 → 영업채널
  - operator / 운영사 → 운영사
  - type이 비어 있거나 일반 파트너면 code prefix 보조
    - RP* → 공급사
    - SP* → 영업채널

접수 후보에는 `영업채널`로 분류된 ACTIVE partner만 노출한다.

비활성 판단:
- _deleted
- merged_into
- 명시적 inactive/disabled/비활성/중지/폐기 상태

ERP5 Partner Master는 read-only로 사용한다.

## 담당자 정본

현재 production 권한 정본은 Firebase verified UID + `FPA_ADMIN_UIDS`다.

따라서 P10의 Assignee Master도 동일 UID allowlist를 사용한다.

- 이메일은 담당자 식별 정본이 아님
- request body의 임의 assignee id를 신뢰하지 않음
- allowlist 밖 UID는 접수 저장 불가

향후 별도 직원/조직 Master가 확인되면 `ReferenceMaster` 뒤 Adapter만 교체한다.

## 개발 모드

개발환경은 실제 ERP5 Master를 흉내 내지 않는다.

명시 환경:
- `FPA_DEV_SALES_CHANNEL_IDS`
- `FPA_DEV_ACTOR_ID`
- optional `FPA_DEV_ASSIGNEE_IDS`

설정되지 않은 임의 채널/담당자는 저장할 수 없다.

## 저장 전 검증

`submitApplication()`은 실제 저장 전에:

1. Product/Offer/version 확인
2. active SalesChannel 확인
3. active Assignee 확인
4. Application create

순서로 처리한다.

새 Service failure:
- `SALES_CHANNEL_NOT_ACTIVE`
- `ASSIGNEE_NOT_ACTIVE`

AI Core SHADOW에서는 둘 다 `VALIDATION_ERROR / 400 / USER / non-retryable`로 매핑한다.

## UI

신규접수:
- 영업채널: select
- 담당자: select
- 자유문자열 신규 ID 입력 제거
- Master가 비었거나 읽기 실패하면 접수 저장 버튼을 열지 않음

## Readiness

machine gate:
- runtime ReferenceMaster 존재
- intake action이 ReferenceMaster를 전달
- Application Service가 channel/assignee를 fail-closed 검증
- 개발 Master 환경계약 존재

## 확인된 후속 Gap

현재 idempotency는 `submissionId` 동일 요청을 replay하지만 payload fingerprint 재사용 검증이 없다.

따라서 P11에서:
- submission semantic fingerprint
- same id + same payload = replay
- same id + different payload = conflict

로 강화한다.
