# FreePass Admin Settlement Operations P8 — 2026-09-20

Status: `FUNCTIONAL SETTLEMENT OPERATIONS / APPEND-ONLY CORRECTION`

## 목적

P2의 실적·정산·청구·수금·지급 흐름을 운영자가 실제로 찾고 정정할 수 있는 수준으로 보강한다.

## 실적 검색 / 필터

검색 대상:
- 고객명
- 접수번호
- 차량 제조사/모델/세부모델/트림
- 차량번호
- 공급사
- 영업채널
- 담당자

필터:
- 전체
- 진행중 전체
- 금액 입력 대기
- 영업채널 확인
- 공급사 확인
- 영업채널 재확인
- 이슈 해결
- 정산확정 가능
- 정산확정
- 공급사
- 영업채널
- 담당자

목록은 50건/page.

## 차량번호 연속성

P7에서 Application Snapshot에 보존한 registration을 Performance Snapshot까지 전달한다.

즉:
Canonical Product
→ Application Snapshot
→ Performance Snapshot

에서 당시 차량번호/VIN/등록일 증거를 유지한다.

## Ledger reversal

잘못된 수금/지급 기록은 삭제하거나 원본을 수정하지 않는다.

원본 CASH entry를 참조하는 REVERSAL entry를 append한다.

요구:
- 원본 settlement 동일
- 원본 account 동일
- reversal amount = 원본 amount
- 이미 reversal된 원본은 다시 reversal 금지
- ledger history 수정/삭제 금지

## 완납 후 지급 정책의 reversal 순서

현재 지급 정책은 `AFTER_FULL_COLLECTION`이다.

지급이 남아 있는 상태에서 공급사 수금을 먼저 reversal하면:
- 미수 발생
- 영업채널 지급은 유지

라는 모순이 생긴다.

따라서:
1. 영업채널 지급 reversal
2. 공급사 수금 reversal

순서로만 허용한다.

Domain에서 이 순서를 강제한다.

## UI

확정 정산의 ledger CASH entry에:
- 정정 사유
- 원장 정정

동작을 제공한다.

reversal된 원본은 `정정됨`으로 표시하고 다시 정정할 수 없다.

## 하지 않은 것

- 실제 세금계산서 API 연동
- 은행 입출금 자동대사
- 정산 정책 변경
- 독립 지급정책 도입
- 원장 삭제
- 전자계약
