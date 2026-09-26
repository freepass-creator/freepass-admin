# FreePass Admin Branch Workflow

상태: **ACTIVE / CANONICAL — UNIFIED MAIN / SINGLE WRITER**
기준일: **2026-09-26**
사용자 최신 지시: **「자 메인으로 병합하고 이제 하나로 합치자」**

이 문서와 `registry/active-work.json`은 현재 브랜치 운영 정본이다. 과거 `docs/WORK-INBOX.md` 등의 ACTIVE branch 목록은 당시 이력이며 현재 작업 배정이 아니다.

## 1. 현재 통합 결과

- `main`만 통합 코드 정본이다.
- I #128 → F #129 → E #130 → U #127 → F 후속 #133이 모두 main에 병합됐다.
- 마지막 기능 병합: PR #133, `e72fee1d17ac07d99f6d7d587ae89d153058a270`.
- PR #133 검증 head: `c36f5cf599750d17c5d39555cde908dbf49d2d37`; main `da0834d7f85d4bedbab04d2be3a4d3073be6fc6a`를 포함하고 behind=0이었다.
- 최종 head 검사 7개 PASS: Canon Guard #261, admin-core-domain #402, CI #1385, backend-check #1382, freepass-data-persistence #335, Next runtime check #265, Visual QA #103.
- 이 통합 직후 열린 PR은 0개로 확인했다. 이는 관측 기록이며 후속 작업 전에는 원격 상태를 다시 읽는다.
- 과거 PR #120/#121/#122의 운영 준비·승인 UI·운영 확정사항도 유지한다.

## 2. 하나의 작업선

- U/F/E/I는 화면·업무규칙·계산·연결을 빠뜨리지 않기 위한 **검토 축**이다. 각각의 영구 branch/독립 writer가 아니다.
- 통합 작업에 writer는 한 시점에 1명만 둔다. 다른 AI는 review/audit 또는 변경 인계를 맡는다.
- 새 세션은 먼저 원격 main, 이 문서, registry, 현재 work order를 읽는다. 새 채팅을 열었다는 사실만으로 쓰기 권한이나 새 작업선이 생기지 않는다.
- `다음`, `계속`, `고도화`를 새 병렬 branch 생성으로 해석하지 않는다.
- 후속 코드 변경은 단일 work order와 writer를 먼저 등록한다. 격리가 필요할 때만 최신 main에서 임시 branch 하나를 사용하고 검증 → PR → merge → 작업선 종료로 회수한다.
- 기존 로컬 미커밋 변경은 보존하고 인계한다. remote main을 fetch한 뒤 차이를 검토하며 강제 push/reset으로 덮어쓰지 않는다.

## 3. 끝난 작업선과 보관 ref

- #127~#130 및 #133을 다시 열거나, 옛 PASS를 새로운 변경의 검증으로 재사용하지 않는다.
- `work/function`, `work/esign`, `work/uiux`, `work/ui/finalize-baseline`, 과거 release/launch branch는 현재 개발 기준이 아니다.
- 과거 branch가 GitHub에 남아 있다는 사실은 ACTIVE 승인이 아니다. 코드 정본과 보관 ref를 구분한다.
- 오래 갈라진 branch는 통째로 merge하지 않는다. 필요한 의미와 회귀테스트만 current main에 없는지 확인한 뒤 별도 승인된 작업에서 선별 이식한다.
- 이번 정리에서는 과거 remote ref를 물리적으로 삭제하지 않았다. 미병합 고유 변경의 보존을 확인하지 않은 삭제는 하지 않는다.
- 브랜치 삭제 시에는 삭제 직전 HEAD를 다시 읽고 main 포함 여부/보존 기록/열린 PR/활성 writer를 확인한다. 완료된 PR의 head가 이동했다면 새 변경을 버리지 않는다.

## 4. 변경하지 않은 경계

- UI: PR #92 actual-route 계보와 `docs/ui/DESIGN-AUTHORITY.md` 유지.
- 데이터: FreePass Data 정본 및 `src/server/freepass-data.ts` 단일 진입점 유지. RTDB 재활성화 금지.
- 접수·정산 정본: `Intake / settlement_rows / src/domain/settlement/**` 유지.
- 코드 통합은 운영 배포·실데이터 write·cutover·전자계약 활성화 승인이 아니다.
- 운영 개통은 별도 담당자의 환경/권한/live smoke/rollback 검증을 따른다. 이 통합에서 환경값이나 승인 gate는 변경하지 않았다.
- 기존 launch scope의 `ERP5_WRITE=off`, `ESIGN_ENABLED=off`, Catalog `OBSERVE`를 임의로 열지 않는다.

## 5. 완료 판정

정상적인 코드 기준은 `main` 하나다. 각 기능의 구현·검증·메인 병합 완료와 운영 개통 완료를 구분한다. 다음 작업은 이 통합 main에서 시작하며, 과거 branch를 또 다른 최신본으로 안내하지 않는다.
