# Main consolidation — 2026-09-26

## 사용자 결정과 범위

「이제 진행하던 프로젝트 하나로 합치자. 이어서」에 따라 **freepass-admin의 진행 작업과 인계 기준을 main 하나로 수렴**시킨다. UFEI 책임은 유지하되 별도 정본/영구 가지로 분리하지 않는다. 다른 제품 저장소 통합, 전자계약 활성화, 운영 개통은 제외한다.

## 관측한 코드 기준

- Repository: `freepass-creator/freepass-admin`
- Main: `e72fee1d17ac07d99f6d7d587ae89d153058a270`
- Tree: `2181e930249a6df079d8db277b64b6e0faddbff5`
- 열린 PR: 0 (감사 시작 시점의 API 조회값)
- U #127 / I #128 / F #129 / E #130 / 마지막 후속 #133은 main에 병합됐다. #132는 독립 병합이 아니라 #128로 흡수한 뒤 닫힌 PR이다.
- PR #133 merge commit은 통합 I/F/E/U 기준과 PR #92 actual-route UI 보존 및 exact-head 검사 통과를 기록한다. main 자체의 GitHub 검사도 별도 확인한다.

이 SHA는 감사 기준이지 영구 checkout 대상이 아니다. 이후 작업자는 최신 main을 다시 읽는다.

## 남은 9개 브랜치의 판정

아래 ahead/behind는 감사 main 대비 GitHub compare 결과다. Git ancestry 미포함은 기능 미반영과 동일한 뜻이 아니다. 이미 폐기/선별 이식된 과거 가지를 통째로 합치지 않는다.

| 브랜치 | ahead / behind | 처리 |
|---|---:|---|
| claude/freepass-admin-launch-irkl4q | 0 / 291 | main 포함, 참조 정리 |
| work/uiux | 0 / 861 | main 포함, 구 donor 참조 정리 |
| work/freepass-admin/i01-f04-paid-rounds-map | 0 / 287 | main 포함, 참조 정리 |
| work/freepass-admin/i01-node-runtime-parity | 0 / 287 | main 포함, 참조 정리 |
| work/freepass-admin/i01-production-demo-guard | 0 / 287 | main 포함, 참조 정리 |
| work/function | 17 / 915 | 기존 권위 문서에서 DISCARDED. 고유 이력 태그 보존 후 참조 정리 |
| work/esign | 3 / 1362 | 기존 권위 문서에서 DISCARDED. 고유 이력 보존만 수행, 기능 merge/활성화 없음 |
| work/ui/finalize-baseline | 4 / 895 | 기존 registry의 SUPERSEDED_BY_PR_121. 구 Visual QA 이력 태그 보존 |
| work/release/predeploy-freeze | 3 / 290 | 차이는 BRANCH-WORKFLOW/WORK-INBOX/active-work 문서뿐. 과거 동결 지시는 최신 통합 결정으로 대체 |

정확한 SHA와 archive tag는 `registry/branch-retirement-20260926.json`에 고정했다. 자동 실행은 main 포함 여부/열린 PR/정확한 HEAD를 재확인하며, diverged 이력은 원격 태그 일치 검증 후에만 가지를 삭제한다. 새 커밋, 열린 PR, registry에 등록된 ACTIVE writer는 건너뛴다.

## 이번 수정

1. 감사 중 main은 `40fccf0d044e7a44de34b4fc6c4b1bf902516f77`로 갱신됐다. 다른 세션이 정리한 AGENTS/BRANCH-WORKFLOW/active-work의 단일 writer 규칙은 보존하고 이 최신 main 위에서 work order #134의 참조 정리만 추가한다.
2. 과거 WORK-INBOX의 업무 규칙은 보존한다. 그 안의 시점성 branch/배포 상태는 이번 결정과 현재 registry가 우선한다.
3. Branch Hygiene의 고정 lane reset 규칙을 제거한다. 정확한 HEAD 기반 삭제, 열린 PR 보호, archive 충돌 보호, lease 기반 동시 커밋 보존으로 교체한다.
4. 로컬 bare Git 저장소를 이용한 회귀테스트를 추가해 실제 삭제/복구 태그/동시 push 보호를 검증한다.

## 완료 판정과 인계

- 이 문서는 감사와 실행 의도를 기록한다. cleanup 완료 증거는 해당 PR 병합 후의 Branch Hygiene 성공 로그와 원격 branch 목록이다.
- main에 없는 과거 코드를 최신 정본으로 통째 덮어쓰지 않는다. UI/업무/정산/FreePass Data 런타임 코드는 이번 정리에서 바꾸지 않는다.
- 개발 완료, CI 통과, 운영 배포, 사용자 실사용 승인을 분리한다.
- 다음 개발은 최신 main에서 필요한 변경 한 건으로 시작하고, 테스트/PR/병합 후 다시 main으로 수렴한다.
