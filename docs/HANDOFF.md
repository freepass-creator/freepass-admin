# FreePass Admin Handoff

기준일: 2026-09-19  
범위: Backend / Domain / Adapter / Persistence

## Current direction
UI/UX는 AI Core/DevCenter 공통 규격 확정 전까지 HOLD다. 현재 기능을 유지하고 Backend 정합성을 먼저 높인다.

## Already strong
- Canonical Product 모델
- Offer / Policy 분리
- same-Offer Search
- Product version + Application Snapshot
- submissionId idempotency 의도
- Domain / Service / Port / Adapter 경계
- cancel reason 보존
- 기존 ERP와 신규 프로젝트 isolation

## Current gaps

### P0 — Product UI가 Domain/Search Service를 완전히 사용하지 않음
실제 Next 화면과 Mockup에 Domain을 우회하는 별도 검색/상태 로직이 존재한다.

### P0 — Production persistence 미검증
현재 file store는 개발용이다.
필요:
- Firestore repository 또는 승인된 운영 저장소
- transaction
- concurrency
- idempotency
- unique number
- retry/failure semantics

### P0 — Auth / permission / actor 경계 미구현
상태 변경·취소·향후 정산 작업에 actor가 남아야 한다.

### P0 — Audit event contract 미구현
최소 이벤트:
- APPLICATION_CREATED
- APPLICATION_PROGRESS_CHANGED
- APPLICATION_CANCELLED
- PRODUCT_VERSION_REJECTED
- DUPLICATE_SUBMISSION_REUSED

### P0 — 접수번호 동시성
count + 1 방식은 운영 멀티 인스턴스에서 안전하지 않다.

### P1 — Domain과 최신 업무단계 정합
계약서 / 필수서류 / 잔금 / 인도 4단계 기준을 Domain에서 단일 파생 규칙으로 수렴해야 한다.

### P1 — Settlement domain
실적/환수/청구/지급 중 상당 부분이 Mockup 수준이다.

## Recommended backend sequence
1. Error taxonomy + Audit event 최소 계약
2. Repository transaction/idempotency 계약 명시
3. Firestore Adapter 구현 전 테스트 fixture 확정
4. Auth/actor port 설계
5. persistence adapter 구현
6. concurrency/idempotency integration test
7. Application state contract 수렴
8. Performance/Settlement Domain
9. 마지막에 AI Core UI/UX 규격 적용

## Do not do
- UI를 먼저 갈아엎지 않는다.
- 운영 자격증명 없이 Firebase 연결을 추측 구현하지 않는다.
- 기존 ERP DB를 fallback으로 연결하지 않는다.
- Mockup을 Domain SSOT로 취급하지 않는다.
- AI Core로 FreePass 업무 로직을 이동하지 않는다.

## Verification commands
```bash
npm run typecheck
npm test
npm run build
```

각 명령의 실제 PASS 여부는 실행 증거가 있을 때만 기록한다.
