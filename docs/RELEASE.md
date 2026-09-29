# FreePass Admin Release Gate

## Principle
코드가 존재하는 것, 테스트가 통과한 것, 배포 권한이 있는 것, 실제 운영 배포가 끝난 것은 서로 다른 상태다.

## 2026-09-30 로그인 장애 복구 적용안 — KEYLESS VALIDATION

대상: Vercel `freepass-projects/freepass-admin`, Production, `freepass-admin.vercel.app`.
관측 deployment: `dpl_7KJ1oaWynX5wba7v2JhccoDE9GqE`, source `932dd42`.

1. 전용 계정 `freepass-admin-identity@freepasserp5.iam.gserviceaccount.com`과 custom role `freepassAdminIdentityRuntime`은 생성·조회 확인했다. 사용자 승인 뒤 장기 키 생성/저장을 시도했으나 도구 정책이 실행 전 거절했다. 생성된 사용자 관리 키는 0개다. 이 명령을 재시도하거나 기존 관리자 키로 대체하지 않는다.
2. 승인된 역할은 `firebaseauth.users.createSession`, `firebaseauth.users.get`, `firebaseauth.users.update`(기존 세션 취소), `datastore.entities.get`(승인문서 조회) 네 가지다. Owner/Editor/Firebase Admin/Firestore 쓰기 권한을 묶어 부여하지 않는다. Firestore IAM 문서 조회 권한은 collection 전용 격리와 다르며 이 범위는 사용자에게 설명하고 승인받았다.
3. 안전한 대안은 장기 키가 없는 Vercel OIDC → GCP WIF → 전용 identity 계정이다. 기존 `vercel` pool을 재사용하되 provider `freepass-admin-identity-production`에는 issuer `https://oidc.vercel.com/freepass-projects`, audience `https://vercel.com/freepass-projects`, subject `owner:freepass-projects:project:freepass-admin:environment:production`을 제한한다. 해당 단일 principal에만 이 계정의 `roles/iam.workloadIdentityUser`를 준다. Preview/Development나 업무 계정의 권한을 넓히지 않는다.
   Production 환경값은 비밀이 아닌 `IDENTITY_GCP_WIF_AUDIENCE`와 `IDENTITY_GCP_SERVICE_ACCOUNT_EMAIL` 두 개다. 장기 키 설정과 혼용하지 않는다. 먼저 trust/환경값을 확인하고 build guard를 통과한 코드만 병합/배포한다.
   Auth는 공식 SDK의 custom Credential, 승인문서는 Google Firestore REST document GET으로 읽는다. Firebase Admin Firestore는 custom Credential을 받지 않으므로 억지로 SDK 내부를 바꾸지 않는다. 계정문서 외 경로와 쓰기 API는 추가하지 않는다. OIDC는 공식 `@vercel/oidc`로 매 token refresh 시 현재 요청에서 얻는다.
4. `npm run deploy:check` PASS 및 승인된 source의 Production build 뒤 재배포한다. 환경 저장만으로 기존 deployment가 바뀌었다고 판단하지 않는다.
5. 승인 계정으로 실제 로그인 → `/intake` 진입 → 새로고침 후 인증 유지까지 읽기 전용 검증한다. 고객 접수/정산 데이터는 만들거나 변경하지 않는다.

rollback: 코드 적용 실패 시 위 기존 deployment로 복귀한다(기존 로그인 장애까지 복귀함을 알린다). 신원 연결 문제가 있으면 전용 계정의 위 단일 workload principal binding과 신원 환경값만 회수한다. 공용 pool/다른 provider/사용자 계정/승인문서를 삭제하거나 인증을 끄지 않는다.

사용자는 전용 인증 연결·운영 배포를 승인했고, 차단 후 연결 해결을 다시 요청했다. 장기 키 생성은 계속 중단하며, 키 없는 연결의 독립 검토와 실제 운영 로그인 결과를 완료 근거로 남긴다.

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
