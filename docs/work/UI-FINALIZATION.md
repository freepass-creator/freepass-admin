# UI/UX Finalization Work Order

상태: ACTIVE
브랜치: `work/ui/finalize-baseline`
base: 최신 `main`
목표: FreePass Admin의 사용자 승인 UI/UX를 한 번 최종 확정해 `main`의 시각 정본으로 만든다.

## 이 브랜치가 소유하는 것
- layout / responsive behavior
- typography / spacing / visual hierarchy
- design primitives / shared UI components
- interaction presentation
- accessibility / focus / touch target
- desktop/mobile visual parity
- Visual QA / screenshot evidence
- UI SSOT와 디자인 권위 문서의 최종 정렬

## 이 브랜치가 소유하지 않는 것
- Product/Search/Intake/Settlement 업무 규칙 변경
- FreePass Data schema/authority 변경
- 계약금/취소/해지/정산 state machine 변경
- 운영 배포 환경/도메인/IAM 변경
- 전자계약 backend 재설계

기능 버그가 발견되면 이 브랜치에서 독자적으로 업무 규칙을 바꾸지 않는다. current main의 기능 정본을 그대로 소비하고, 기능 수정 필요를 별도 evidence로 남긴다.

## 시각 입력
- 현재 기능 코드는 반드시 최신 main을 기준으로 한다.
- 과거 `work/uiux` / PR #117은 **REFERENCE-ONLY donor**다. 그 브랜치 자체를 merge base나 런타임 정본으로 사용하지 않는다.
- 승인 UI 계보에서 필요한 화면/토큰/구조만 현재 main에 선별 이식한다.
- 과거 브랜치 전체 merge/cherry-pick 묶음 금지.

## 작업 규칙
1. 한 시점에 한 AI/개발자만 writer다.
2. 다른 AI가 이어받으면 새 브랜치를 만들지 않고 이 브랜치 HEAD에서 계속한다.
3. 매 작업 전 `AGENTS.md`, `docs/BRANCH-WORKFLOW.md`, `docs/FUNCTION-AUTHORITY.md`, UI authority 문서를 읽는다.
4. 기능 파일을 바꾸지 않는 것이 원칙이다. 불가피하면 변경 이유와 기능 영향 0을 PR에 증명한다.
5. 최종 사용자 승인 전에는 `main`의 최종 시각 정본이라고 주장하지 않는다.

## 완료 Gate
- desktop/mobile 실제 route visual QA
- console/runtime error 0
- UI regression checks PASS
- 기능 회귀테스트 PASS
- UI SSOT/registry/design authority가 같은 기준을 가리킴
- 사용자 최종 승인
- PR merge 후 이 브랜치는 폐기 대상
