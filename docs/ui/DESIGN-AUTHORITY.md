# FreePass Admin Design Authority — HARD LOCK

상태: **RECOVERY HOLD — 기존 USER-LOCKED 판정 재검증 중**  
복구 사유: 2026-09-26 실제 승인 UI 계보와 current main 시각 구현 불일치가 확인됨. 
복구가 끝날 때까지 **새 시각 규칙 추가·현 main 화면의 정본 승격·과거 브랜치 삭제 금지**. 기능/데이터 작업은 계속할 수 있다.
잠금일: **2026-09-25**  
적용 저장소: `freepass-creator/freepass-admin`

## 1. 단일 디자인 정본

FreePass Admin의 시각·배치·컴포넌트 규격은 아래만 정본이다.

1. `docs/ui/ADMIN-UI-UX-SSOT.md` — 사람이 읽는 현행 Product Profile
2. `docs/ui/admin-ui-ux-ssot.json` — 자동검사/AI용 machine SSOT
3. `docs/ui/SALES-APP-BASELINE.md` — 사용자 확정 FreePass Sales 형태 참조
4. `docs/ui/ai-core-bindings.json` — AI Core 의미/상호작용 binding
5. `src/app/_design/*` + `src/app/_design/admin-final.css` — 위 정본을 구현한 공통 부품
6. `src/app/globals.css` — 구조/호환을 위한 base. **시각 값을 새 디자인 근거로 사용하지 않는다.**

충돌하면 사용자의 최신 명시 결정 → AI Core 의미 계약 → 이 문서 → Admin SSOT(MD/JSON) → 공통 구현 순서로 해결한다.

## 2. 절대 금지

다음은 **설계 입력으로 사용 금지**다.

- 삭제된 `docs/ui/mockups/**`
- 삭제된 `docs/ui/UI-HISTORY.md`
- 2026-09-16 rail/topbar/mockup 계열
- `admin-shell*`, `classic.css`, `retro-intake*` 계열
- 과거 Design Hub 승인 mockup/hash
- 과거 스크린샷, PR 캡처, 리뷰 문서의 화면을 정본으로 역승격하는 행위
- 다른 AI가 만든 임시 화면을 현재 UI보다 우선하는 행위
- 새 화면마다 임의의 높이/반경/색/버튼/카드 규격을 만드는 행위

과거 파일이나 Git history에서 위 디자인을 발견해도 **복원·재사용·참조 구현하지 않는다.**

## 3. AI 작업 규칙

어떤 AI(Claude/Codex/GPT/기타)가 오더라도 UI 작업 시작 전에 반드시:

1. 이 파일을 읽는다.
2. `ADMIN-UI-UX-SSOT.md`와 `admin-ui-ux-ssot.json`을 읽는다.
3. 필요한 공통 부품을 `src/app/_design/*`에서 먼저 찾는다.
4. 새 모양을 만들기보다 정본 부품을 조합한다.
5. 정본에 없는 시각 결정을 추측하지 않는다.

사용자가 새 디자인을 명시적으로 승인하지 않은 상태에서 정본과 다른 화면을 만들면 **실패**다.

## 4. 변경 절차

시각 규격 자체를 바꾸는 변경은 한 PR/커밋 묶음에서 동시에 갱신해야 한다.

- `DESIGN-AUTHORITY.md`
- `ADMIN-UI-UX-SSOT.md`
- `admin-ui-ux-ssot.json`
- 필요한 `src/app/_design/*` / CSS
- `scripts/check-ui-ssot.mts`의 회귀검사

하나라도 빠지면 병합하지 않는다.

## 5. 현재 핵심 형태

- FreePass Sales 운영 앱의 밝고 얇은 컨트롤 문법이 기본
- 제목/본문/보조 **18/14/12**
- 컨트롤/Primary/모바일 touch **44px**, control radius **6px**, panel radius **4px**
- 상단은 **상태 표시 중심**, 업무 실행/메뉴를 올리지 않는다
- 주요 실행은 **하단 ActionBar**
- 목록은 `ListRow`, 상태는 `Tag/StatusTile`, 조건은 `PerkMarks`
- 선택은 두꺼운 테두리보다 **면 변화**
- 모바일은 여러 패널을 압축하지 않고 **depth 전환**
- 웹은 업무 목적에 맞는 다중 패널로 확장
- 정산은 **묶음 → 실적 → 현재 업무** 역할을 섞지 않는다

세부 규격과 최신 2026-09-25 결정은 `ADMIN-UI-UX-SSOT.md`가 정본이다.

## 6. 자동 잠금

`npm run ui:check`는 다음을 실패 처리해야 한다.

- 삭제된 mockup/history가 다시 생김
- DevCenter/AI Core manifest가 삭제된 mockup을 authority/evidence로 참조
- 과거 승인 hash가 다시 들어옴
- Design Authority가 현행 SSOT 이외의 파일을 approved visual로 지정
- machine SSOT에서 legacy visual 입력 허용
- 핵심 토큰/공통 부품 규격 회귀

**목표는 “AI가 잘 판단하기를 기대”하는 것이 아니라, 잘못된 디자인을 코드상으로 선택할 수 없게 하는 것이다.**
