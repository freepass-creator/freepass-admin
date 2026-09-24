# FreePass Admin Visual QA Runbook

기준 문서: `docs/reviews/ADMIN-UI-VISUAL-QA-GAP-2026-09-24.md`

## 목적

CSS/상태/반응형 변경 뒤 "코드는 맞는데 실제 화면은 깨지는" 회귀를 잡는다.

특히 아래를 확인한다.

- selected QuickFilter / aria-pressed
- aria-current row/card
- Primary action
- Canvas / Panel / Card surface hierarchy
- 1280px 3-panel 압축
- 390px / 360px mobile overflow
- danger / caution action
- text/background contrast

## 실행

앱을 먼저 실행한다.

```bash
npm run dev
```

관리 개발환경에서 Playwright가 전역 설치되어 있으면:

```bash
NODE_PATH=/opt/node22/lib/node_modules npm run visual:qa -- http://localhost:3000
```

브라우저 위치가 다르면:

```bash
PW_CHROMIUM=/path/to/chromium \
NODE_PATH=/path/to/node_modules \
npm run visual:qa -- http://localhost:3000
```

## 고정 캡처 대상

Desktop:
- /products 1440×900
- /products 1280×800
- /intake 1440×900
- /settlement 1440×900
- /esign 1440×900

Mobile:
- /products 390×844
- /intake 390×844
- /settlement 390×844
- /esign 390×844
- /products 360×800
- /intake 360×800

결과:
- `artifacts/visual-qa/*.png`
- `artifacts/visual-qa/report.json`

## 자동 실패 조건

- HTTP 응답 실패
- viewport보다 body가 넓은 horizontal overflow
- visible selected/primary element의 foreground/background contrast가 3 미만
- desktop /products에서 selected/current 상태를 하나도 관찰하지 못함
- desktop /products에서 primary action을 하나도 관찰하지 못함

자동 검사는 최종 판정이 아니다. PNG를 실제로 눈으로 확인해야 한다.

## 사람이 반드시 볼 것

1. selected QuickFilter 글자가 배경에 묻히지 않는가
2. Primary action이 흰 배경/흰 글자처럼 사라지지 않는가
3. Canvas → Panel → Card 단계가 실제로 구분되는가
4. 1280px에서 세 패널이 찌그러지거나 겹치지 않는가
5. 360/390px에서 페이지 전체 수평 스크롤이 생기지 않는가
6. 금액/숫자가 우측 정렬되고 잘리지 않는가
7. danger는 red-soft, caution은 amber-soft이며 일반 취소는 neutral인가
8. disabled/read-only/pending이 같은 상태처럼 보이지 않는가
9. focus/selected 상태가 line-free 원칙을 깨지 않는가
10. 수정한 화면 외 최소 한 화면에서 공통 CSS 회귀가 없는가

## 운영 원칙

- 색/배경/elevation/state CSS 변경은 visual QA 없이 완료 처리하지 않는다.
- `:is()` 안에 복잡한 `:not()` 가지를 섞은 변경은 반드시 selected 상태를 캡처한다.
- generated `erp-standard.css`는 직접 수정하지 않는다.
- visual QA가 실패하면 규칙을 더 추가하기 전에 실제 렌더링 원인을 먼저 고친다.


## 클라우드 작업공간에서 실행 — 기본 경로

GitHub Actions는 필요하지 않다.

권장 실행 흐름:

```
GitHub private repo
→ 클라우드 작업공간 checkout
→ 대상 branch checkout
→ npm ci
→ npm run dev
→ npm run visual:qa
→ PNG / report.json 직접 검토
```

작업공간이 repo를 checkout한 뒤:

```bash
npm ci
npm run dev
```

별도 터미널에서:

```bash
NODE_PATH=/opt/node22/lib/node_modules \
npm run visual:qa -- http://localhost:3000
```

환경에 Playwright가 전역 설치되어 있지 않다면 해당 작업공간에서만 설치해 사용한다.
프로젝트 runtime dependency로 강제하지 않는다.

## 운영 원칙

- Visual QA의 정식 경로는 **클라우드 작업공간에서 실제 앱을 실행하고 Chromium으로 확인하는 것**이다.
- GitHub Actions 결제/쿼터 상태와 무관하게 QA가 가능해야 한다.
- Actions가 사용 가능하더라도 Visual QA의 필수 전제조건으로 두지 않는다.
- CSS/state 변경 후 실제 PNG 확인 없이 완료 처리하지 않는다.
- generated `erp-standard.css`는 직접 수정하지 않는다.


## 원커맨드 실행

클라우드 작업공간에서는 아래 한 줄을 기본으로 사용한다.

```bash
npm run visual:qa:cloud
```

이 명령은 자동으로:

1. Next dev server를 `127.0.0.1:3100`에서 시작
2. `/products`가 응답할 때까지 최대 90초 대기
3. 기존 `visual:qa` harness 실행
4. PNG + `report.json` 생성
5. dev server 종료

결과:
- `artifacts/visual-qa/*.png`
- `artifacts/visual-qa/report.json`
- `artifacts/visual-qa/server.log`

포트가 이미 사용 중이면:

```bash
VISUAL_QA_PORT=3200 npm run visual:qa:cloud
```

이 명령이 실패하면 화면 규칙을 더 수정하기 전에 `server.log`와 `report.json`부터 확인한다.
