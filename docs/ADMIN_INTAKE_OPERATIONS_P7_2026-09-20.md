# FreePass Admin Intake Operations P7 — 2026-09-20

Status: `FUNCTIONAL INTAKE OPERATIONS / NO MASTER INVENTION`

## 목적

P1에서 연결한 실제 접수 저장/조회 흐름을 운영자가 일상적으로 사용할 수 있는 수준으로 보강한다.

## 접수 목록

검색 대상:
- 고객명
- 접수번호
- 연락처
- 차량 제조사/모델/세부모델/트림
- 차량번호
- 영업채널 ID
- 담당자 ID
- 공급사 ID

상태 필터:
- 전체
- 진행중
- 접수완료
- 계약완료
- 인도완료
- 취소

추가 필터:
- 영업채널
- 담당자

목록은 50건/page로 표시한다.

## Facet 원칙

영업채널/담당자 후보를 새 Master처럼 지어내지 않는다.

현재 Application 원장에 실제 존재하는 값에서만:
- 영업채널 후보
- 담당자 후보

를 만든다.

신규접수에서 새 ID 입력은 가능하지만 기존 값을 쉽게 재사용할 수 있게 datalist로 제안한다.

담당자 기본값은 현재 검증된 Admin Actor UID다.

## 접수 Snapshot 보강

Canonical Product에는 registration이 있었지만 Application Snapshot에는 빠져 있었다.

P7부터 optional snapshot:
- vehicleNumber
- VIN
- firstRegistrationDate

를 접수 당시 값으로 복사한다.

과거 접수에는 registration이 없어도 정상이다.

이로써 현재 상품의 차량번호가 나중에 바뀌더라도 과거 접수의 차량번호 증거가 바뀌지 않는다.

## 진행 사실

접수 상세은 아래 네 사실을 독립적으로 표시한다.
- 계약서
- 필수서류
- 잔금
- 인도

취소된 접수는 진행 사실 일반 변경을 막는다.

## 인도 → 실적

인도완료 접수:
- Performance가 이미 있으면 `실적·정산 열기`
- 없으면 `실적 생성 후 정산 열기`

를 제공한다.

Performance idempotency는 기존 P2 규칙을 그대로 사용한다.

## 감사 이력

접수 상세에서 최근 append-only history를 표시한다.
- 생성
- 진행 사실 변경
- 취소
- actor
- occurredAt

## 하지 않은 것

- 영업채널 Master 신규 정의
- 직원/조직 Master 신규 정의
- 접수 후 영업채널/담당자 임의 수정
- 전자계약
- UI 디자인 전면 개편
