# Operational Launch Work Order

상태: ACTIVE
브랜치: `work/release/operational-launch`
base: 최신 `main`
목표: FreePass Admin을 실제 운영 개시 가능한 상태로 연결·검증·배포한다.

## 이 브랜치가 소유하는 것
- production environment wiring
- Vercel/deployment/release configuration
- auth / Google Workspace admin access
- FreePass Data live wiring
- Firestore write/read verification
- environment-variable validation
- runtime health / smoke test
- production rollback/readiness evidence
- 운영 첫 사용 체크

## 이 브랜치가 소유하지 않는 것
- UI/UX 재디자인
- Product/Search/Intake/Settlement 업무 의미 재설계
- 새 데이터 SSOT 생성
- 전자계약 기능 범위 확대

운영 차단 버그가 발견되면 기존 main 기능을 최소 수정할 수 있지만, 새 업무 상태/엔진/정본을 만들지 않는다.

## UI와 병행하는 방법
- 이 브랜치는 지금부터 운영 연결/검증을 진행할 수 있다.
- **최종 운영 배포 직전에는 반드시 UI 최종 브랜치가 main에 merge된 뒤 최신 main을 다시 반영**한다.
- 최종 production smoke/acceptance는 그 최신 상태에서 다시 수행한다.

## 전자계약
현재 운영개시 기본 범위에서 전자계약은 별도 전담 영역이다. 사용자가 명시적으로 운영 범위에 포함하기 전에는 e-sign 고도화를 이 브랜치에 섞지 않는다.

## 작업 규칙
1. 한 시점에 한 AI/개발자만 writer다.
2. Claude/Codex/다른 AI가 인계받아도 새 release 브랜치를 만들지 않고 이 브랜치에서 계속한다.
3. 매 작업 전 `AGENTS.md`, `docs/BRANCH-WORKFLOW.md`, `docs/FUNCTION-AUTHORITY.md`, `docs/RELEASE.md`를 읽는다.
4. staging evidence와 production evidence를 구분한다.
5. 실제 배포/쓰기/IAM 검증 전에는 DEPLOYMENT VERIFIED/PERSISTENCE VERIFIED라고 표기하지 않는다.

## 완료 Gate
- current main + final UI 반영
- typecheck/test/data check/build PASS
- production env validation PASS
- production auth login verified
- FreePass Data read/write verified
- critical route smoke PASS
- rollback path confirmed
- user acceptance
- merge/deploy 후 이 브랜치는 폐기 대상
