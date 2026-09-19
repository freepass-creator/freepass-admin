# FreePass Admin Release Gate

## Principle
코드가 존재하는 것, 테스트가 통과한 것, 배포 권한이 있는 것, 실제 운영 배포가 끝난 것은 서로 다른 상태다.

## Required gates

### G1 — Source gate
- 대상 revision 고정
- 변경 범위 기록
- SSOT 충돌 없음

### G2 — Static gate
- `npm run typecheck`
- build configuration 확인

### G3 — Domain test gate
- `npm test`
- Search same-Offer invariants
- Application Snapshot/version
- duplicate submission
- cancel reason
- state transitions

### G4 — Persistence gate
운영 저장소 사용 시:
- transaction
- concurrent create/update
- duplicate request
- unique human-readable number
- retry/failure
- persistence after restart

### G5 — Permission/Audit gate
- actor identity
- authorization
- sensitive action audit event
- immutable or append-only evidence where required

### G6 — Runtime smoke
- 실제 runtime 시작
- 대표 업무 시나리오
- error/loading/empty path
- no legacy fallback

### G7 — Deployment
- target 확인
- environment 확인
- rollback 방법 확인
- 승인 경계 확인
- 배포 후 smoke evidence

## Current status
2026-09-19:
- Source: ACTIVE
- Static: requires current execution evidence
- Domain tests: existing tests present, current full PASS not asserted here
- Persistence: NOT VERIFIED
- Permission/Audit: NOT VERIFIED
- Runtime smoke: NOT VERIFIED
- Production deployment: NOT VERIFIED

따라서 현재 상태를 PRODUCTION READY로 표기하지 않는다.

## Rollback
운영 배포가 도입되면 최소 다음을 기록해야 한다.
- previous deployment/revision
- data migration reversibility
- schema compatibility
- rollback command/procedure
- irreversible side effects
