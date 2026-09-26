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
- 모델명(claude/gpt/codex 등), v2/final/latest 같은 이름으로 브랜치를 파생하지 않는다.

## 2. 현재 허용된 ACTIVE 작업

### A. UI/UX 최종 확정
- branch: `work/ui/finalize-baseline`
- base: 생성 시점 최신 main
- work order: `docs/work/UI-FINALIZATION.md` (해당 branch)
- 목적: 승인 UI 계보를 current main 위에 최종 정렬하고 실제 화면 QA 후 사용자 승인
- 과거 `work/uiux` / PR #117: **REFERENCE-ONLY donor**, 개발 금지

### B. 운영 개시
- branch: `work/release/operational-launch`
- base: 생성 시점 최신 main
- work order: `docs/work/OPERATIONAL-LAUNCH.md` (해당 branch)
- 목적: production wiring/auth/FreePass Data read-write/runtime/deployment/rollback 검증
- 최종 운영 검증 직전 UI 최종본이 merge된 최신 main을 반드시 반영

현재 위 두 branch 외 신규 작업 branch 생성은 금지한다. 새 병렬 작업이 정말 필요하면 먼저 이 문서와 machine registry를 갱신한다.

## 3. AI 인계 규칙

- 한 branch에는 한 시점에 **writer 1명**만 둔다.
- 다른 AI가 이어받으면 새 branch를 만들지 않는다. 해당 branch의 HEAD와 work order를 읽고 그대로 이어간다.
- review/audit AI는 별도 branch 없이 읽기 전용으로 검토할 수 있다.
- writer가 바뀌어도 branch 이름은 바꾸지 않는다.
- 다른 branch의 코드를 직접 수정하지 않는다. 의존 변경은 먼저 소유 branch를 main에 merge한 뒤 최신 main을 반영한다.

## 4. merge 순서

현재 작업의 최종 합류 순서는:

```text
main
 ├─ work/ui/finalize-baseline
 │    → Visual QA
 │    → 사용자 UI 승인
 │    → main merge
 │
 └─ work/release/operational-launch
      → 최신 main(UI 포함) 반영
      → production smoke/read-write/auth 검증
      → 운영 개시
      → main merge
```

운영 준비 작업은 UI와 병행할 수 있지만, **최종 production acceptance는 UI 최종 merge 이후 상태에서 다시 수행**한다.

## 5. 과거 브랜치

- `work/function`: ARCHIVE / 신규 개발 금지
- `work/esign`: ARCHIVE / 신규 개발 금지
- `work/uiux`: REFERENCE-ONLY / 승인 UI donor / 신규 개발 금지

과거 branch의 고유 변경이 필요하면 branch 전체를 merge하지 않는다. current main에 필요한 변경만 검토하여 현재 ACTIVE branch로 선별 이식한다.

전자계약을 다시 개발할 시점이 오면 `work/esign`을 되살리지 않고 **그 시점 최신 main에서 목적이 명확한 새 임시 branch**를 만든다.

## 6. 완료 후

두 작업이 끝나면 정상 상태는 다시:

```text
main
```

하나다. 다음 업무가 생기는 시점에 필요한 branch만 새로 만든다.
