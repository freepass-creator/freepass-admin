# FreePass Admin Release Gate

## Principle
코드가 존재하는 것, 테스트가 통과한 것, 배포 권한이 있는 것, 실제 운영 배포가 끝난 것은 서로 다른 상태다.

## 2026-09-30 로그인 장애 복구 적용안 — PENDING PROVISIONING

대상: Vercel `freepass-projects/freepass-admin`, Production, `freepass-admin.vercel.app`.
관측 deployment: `dpl_7KJ1oaWynX5wba7v2JhccoDE9GqE`, source `932dd42`.

1. FreePass Data 신원 프로젝트 `freepasserp5`에 Admin 신원용 서비스계정을 별도로 준비한다. 현재 목록에는 신원 전용 계정이 없었다. 기존 ERP/업무데이터 관리자 키를 복사하거나 fallback으로 사용하지 않는다.
2. 후보 이름 `freepass-admin-identity`; 권한 후보는 `firebaseauth.users.createSession`, `firebaseauth.users.get`, `firebaseauth.users.update`(기존 세션 취소), `datastore.entities.get`(승인문서 조회)이다. Owner/Editor/Firebase Admin/Firestore 쓰기 권한을 묶어 부여하지 않는다. Firestore IAM 문서 조회 권한은 collection 전용 격리와 같지 않으므로 해당 노출 범위는 승인 시 명시한다.
3. 승인된 credential을 Production의 `IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON`에 Sensitive로 바인딩한다. 값은 Git/로그/문서/PR에 남기지 않고 동일 identity project인지 검증한다.
   새 build guard는 이 설정 없이 Production build를 의도적으로 막는다. 먼저 credential을 바인딩하고 이 변경을 병합/배포하며, guard를 우회해 먼저 배포하지 않는다.
4. `npm run deploy:check` PASS 및 승인된 source의 Production build 뒤 재배포한다. 환경 저장만으로 기존 deployment가 바뀌었다고 판단하지 않는다.
5. 승인 계정으로 실제 로그인 → `/intake` 진입 → 새로고침 후 인증 유지까지 읽기 전용 검증한다. 고객 접수/정산 데이터는 만들거나 변경하지 않는다.

rollback: 코드 적용 실패 시 위 기존 deployment로 복귀한다(기존 로그인 장애까지 복귀함을 알린다). 새 credential 적용이 문제면 해당 바인딩과 새 서비스계정 키만 회수한다. 사용자 계정/승인문서를 삭제하거나 인증을 끄지 않는다.

실행 전에는 새 IAM/credential 범위와 운영 배포에 대한 직전 승인을 확인한다.

## Required gates

### G1 — Source gate
- 대상 revision 고정
- 변경 범위 기록
- SSOT 충돌 없음

### G2 — Static gate
- `npm run typecheck`
- build configuration 확인

### G2.5 — Dependency security gate
- production `npm audit` 결과를 `scripts/check-dependency-audit.mjs`로 검증
- high / critical: 허용하지 않음
- 새 moderate finding: 검토 없이 허용하지 않음
- 현재 time-bounded exception은 `docs/security/DEPENDENCY-AUDIT-2026-09-25.md`의 gaxios/uuid 2건뿐
- exception이 사라지는 것은 허용하지만 범위·심각도·경로가 바뀌면 재검토

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

Verified baseline:
- revision: `3f1812c6968f57494c1e8204e7a67d54e1c1f3ea`
- GitHub Actions run: `35437766677`
- `npm ci`: PASS
- `npm run typecheck`: PASS
- `npm test`: PASS
- `npm run build`: PASS

Current gates:
- Source: PASS for the verified revision above
- Static: PASS for the verified revision above
- Domain tests: PASS for the verified revision above
- Build/package: PASS for the verified revision above
- Development file persistence: PASS for tested single-process semantics
- Production persistence: NOT VERIFIED
- Production Auth/Permission: NOT VERIFIED
- Production audit retention policy: NOT VERIFIED
- Runtime smoke against production binding: NOT VERIFIED
- Production deployment: NOT VERIFIED

따라서 현재 상태를 PRODUCTION READY로 표기하지 않는다. 검증 PASS는 위 revision과 검사 범위에만 유효하다.

2026-09-25 PR #96 보안 보강:
- Next.js 16.1.6 → 16.3.6 후보가 typecheck/test/UI SSOT/data wiring/production build를 모두 통과한 뒤 실제 반영됨.
- baseline production audit의 high/critical 경로는 제거됨.
- gaxios/uuid moderate transitive 2건은 별도 근거와 machine gate 아래 임시 관리 중이며 “해결됨”으로 표기하지 않는다.

## Rollback
운영 배포가 도입되면 최소 다음을 기록해야 한다.
- previous deployment/revision
- data migration reversibility
- schema compatibility
- rollback command/procedure
- irreversible side effects
