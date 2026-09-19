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

## Completed in backend hardening — 2026-09-19

- 계약서 / 필수서류 / 잔금 / 인도 4개 진행 사실을 Domain에 반영
- Application Snapshot의 MULTI_SELECT deep clone 보장
- ActorRef + ActorProvider 경계 추가
- APPLICATION_CREATED / APPLICATION_PROGRESS_CHANGED / APPLICATION_CANCELLED 최소 감사 이력 추가
- submissionId 중복방지 + 접수번호 발번을 Repository 원자 create 계약으로 통합
- 진행/취소 변경을 Repository 원자 mutate 계약으로 통합
- 비원자 create/update write API를 ApplicationRepository에서 제거
- 서로 다른 20건 동시 접수번호 중복 0 회귀테스트 추가
- 서로 다른 진행 사실 동시 변경 시 lost update 방지 회귀테스트 추가
- GitHub Actions backend gate 추가
- revision `f8eb1bfd8337aad4a12948f18e668e3ee19ad3fc`: npm ci / typecheck / test / build PASS (run 35437615280)

## Current gaps

### P0 — Product UI가 Domain/Search Service를 완전히 사용하지 않음
실제 Next 화면과 Mockup에 Domain을 우회하는 별도 검색/상태 로직이 존재한다.
UI/UX 재설계는 HOLD지만, 향후 연결 시 Domain 우회 로직은 제거해야 한다.

### P0 — Production persistence 미검증
현재 file store는 개발·검증용이며 단일 Node 프로세스 안의 queue 원자성만 증명한다.

운영 Adapter 요구사항은 코드 계약으로 고정됨:
- transaction/atomic create
- atomic aggregate mutate
- concurrency
- idempotency
- unique human-readable number
- retry/failure semantics

남은 일은 승인된 운영 저장소 Adapter의 실제 구현/검증이다.

### P0 — Production Auth / Permission binding 미검증
ActorProvider Port와 actor audit 의미는 들어갔지만 실제 관리자 인증 Adapter/권한 정책은 아직 연결하지 않았다.

### P1 — Settlement domain
실적/환수/청구/지급 중 상당 부분이 Mockup 수준이다.

### P1 — 운영 Audit 보존정책
Application aggregate 안의 최소 이력은 구현됐다.
운영에서 별도 append-only audit collection/sink가 필요한지는 persistence 설계와 함께 확정한다.

## Recommended backend sequence
1. 승인된 운영 persistence target 확정
2. Firestore 등 운영 Repository Adapter 구현
3. 실제 transaction/concurrency/idempotency integration test
4. 관리자 Auth/Permission Adapter 연결
5. production audit 보존정책 확정
6. Performance/Settlement Domain
7. 실제 UI를 Domain/Search/Application Service에 연결
8. 마지막에 AI Core UI/UX 규격 적용

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
