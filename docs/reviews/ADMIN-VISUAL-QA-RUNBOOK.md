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
