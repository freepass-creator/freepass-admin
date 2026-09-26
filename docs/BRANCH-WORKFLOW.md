# FreePass Admin Branch Workflow

상태: **ACTIVE / CANONICAL**
기준일: **2026-09-26**

이 문서는 FreePass Admin의 브랜치 운영 정본이다.

## 1. 기본 원칙

- `main`은 항상 통합된 코드 정본이다.
- 브랜치는 팀/AI/영역의 영구 소유물이 아니라 **현재 변경을 안전하게 격리하기 위한 임시 작업 공간**이다.
- 작업이 끝나면 테스트 → PR → merge → branch 폐기 순서로 종료한다.
- “고도화”, “다음”, “계속”은 현재 작업 브랜치의 후속 작업을 뜻한다. 새 브랜치를 자동 생성하라는 뜻이 아니다.
- 새 브랜치는 **현재 동시에 분리해야 하는 변경이 실제로 있을 때만** 최신 main에서 만든다.
- v2/final/latest 같은 이름으로 브랜치를 파생하지 않는다. (AI 이름(claude/gpt/codex 등) 브랜치 금지는 사용자 결정으로 2026-09-26 해제)

## 2. 현재 상태 — PRE-DEPLOY FREEZE

운영개시 준비 PR #120은 main에 병합됐다. UI 정본은 PR #121, 운영 확정사항은 PR #122로 main에 반영됐다.

현재 **개발 ACTIVE branch는 없다.** `main`이 유일한 배포 후보 코드다.

배포 전에는 아래만 허용한다.
- 읽기 전용 검증
- 배포 환경 바인딩
- 실제 배포 시도
- 배포를 막는 결함이 확인된 경우에만 current main에서 짧은 fix branch 생성

일반 고도화는 첫 배포 시도와 운영 smoke가 끝난 뒤 시작한다.

현재 외부 P0:
1. Vercel `freepass-projects` 팀에 `freepass-admin` 프로젝트 생성/연결
2. production env/OAuth/service account/IAM 바인딩
3. 첫 배포는 `ERP5_WRITE=off`, `ESIGN_ENABLED=off`, Catalog `OBSERVE`
4. live login/read/rollback 확인 후 통제된 테스트 write


## 3. AI 인계 규칙

- 한 branch에는 한 시점에 **writer 1명**만 둔다.
- 다른 AI가 이어받으면 새 branch를 만들지 않는다. 해당 branch의 HEAD와 work order를 읽고 그대로 이어간다.
- review/audit AI는 별도 branch 없이 읽기 전용으로 검토할 수 있다.
- writer가 바뀌어도 branch 이름은 바꾸지 않는다.
- 다른 branch의 코드를 직접 수정하지 않는다. 의존 변경은 먼저 소유 branch를 main에 merge한 뒤 최신 main을 반영한다.

## 4. 현재 merge 상태

- PR #121 — 승인 UI 계보 → main **MERGED**
- PR #122 — 로그인 보안·작업자 기록·운영 확정분 → main **MERGED**
- PR #120 — 운영 개시 준비/검증 → main **MERGED**

이 시점부터 main을 변경하지 않고 첫 배포 시도를 준비한다. 배포 차단 결함이 발견될 때만 별도 short-lived fix branch를 만든다.

## 4.5 UI 정본 확정 — 2026-09-26

사용자가 PR #92 계보의 PC 화면을 정본으로 확정했다(「이제 이거가 정본이고 메인이고 … 확정되지 못한 거는 폐기」). main 반영은 PR #121.
- `work/ui/finalize-baseline`의 목적(승인 UI 확정)은 PR #121로 달성된다. 이후 이 branch에서 새 UI 방향을 만들지 않는다.
- 화면 정본과 폐기 목록은 `docs/ui/DESIGN-AUTHORITY.md` 하나가 가진다.

## 5. 과거 브랜치 — 폐기(DISCARDED)

- `work/function`: **DISCARDED** / 개발 근거 아님. 사용자 확정 운영 항목(전자계약 운영 제외, 작업자 기록, 로그인 되돌림 검증)만 `work/release/operational-launch`에서 최신 main 위에 다시 적용한다.
- `work/esign`: **DISCARDED** / 개발 근거 아님
- `work/uiux`: **DISCARDED** / 내용은 PR #121로 main에 반영 완료

과거 branch의 고유 변경이 필요하면 branch 전체를 merge하지 않는다. current main에 필요한 변경만 검토하여 현재 ACTIVE branch로 선별 이식한다.

전자계약을 다시 개발할 시점이 오면 `work/esign`을 되살리지 않고 **그 시점 최신 main에서 목적이 명확한 새 임시 branch**를 만든다.

## 6. 완료 후

두 작업이 끝나면 정상 상태는 다시:

```text
main
```

하나다. 다음 업무가 생기는 시점에 필요한 branch만 새로 만든다.
