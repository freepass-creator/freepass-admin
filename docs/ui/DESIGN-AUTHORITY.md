# FreePass Admin Design Authority

상태: **CANONICAL — USER APPROVED 2026-09-26 (PC) · PR #92 actual route only**  
확정: 사용자 2026-09-26 「큰 화면으로 준 92버전이 정본이고 그게 메인으로 합쳐져야 돼」 「이제 이거가 정본이고 메인이고 … 확정되지 못한 거는 폐기」  
main 반영 PR: #121 (PR #92 → #112 → `work/uiux` 계보 + 당시 main 기능)

## 폐기 (DISCARDED)

아래는 **구현 근거가 아니다.** 되살리거나 참고해 현재 화면을 바꾸지 않는다.
- #121 이전 main의 화면(하단 탭 5개 · 네 줄 목록 카드 · dz 셸)과 그 잠금 문서(2026-09-25 HARD LOCK, #108~#111)
- 삭제된 과거 목업(rev 5 포함) · 캡처 · 리뷰 문서
- `work/uiux`, `recovery/pr92-modernize-20260926`, `claude/erp-platform-ui-ux-hvfyfa` 브랜치 자체 — 내용은 #121로 main에 들어왔고 브랜치는 폐기
- 사용자 확정 없이 다른 브랜치 · PR · AI가 만든 화면 · 토큰 · 레이아웃

폰(≤900px) 화면은 같은 계보 안에서 다듬는 중이며 사용자 최종 확정 전이다. 다듬기는 이 계보 안에서만 한다.

## 현재 단일 디자인 정본

PC actual route 구현:
- `src/app/_erp/Workspace.tsx`
- `src/app/_erp/ProductsScreen.tsx`
- `src/app/_erp/SettlementScreen.tsx`
- `src/app/_erp/EsignScreen.tsx`
- `src/app/_erp/parts.tsx`
- `src/app/_erp/ProductDetail.tsx`
- `src/app/_erp/erp-standard.css`
- `src/app/_erp/shell.css`

제품 UI 규칙:
- `docs/ui/ADMIN-UI-UX-SSOT.md`
- `docs/ui/admin-ui-ux-ssot.json`

복구 진행판:
- `docs/recovery/PR92-LATESTIZATION-STATUS.md`

## 현재 사용 규칙

UI/UX 작업은 이 문서에 적힌 actual route 구현과 UI SSOT만 읽는다.
디자인 판단은 저장된 이미지가 아니라 실제 route 렌더 결과로 한다.

## actual route 우선

스크린샷, 문서, fixture와 actual route가 다르면 **actual route 코드가 이긴다**.

- 계약접수: `/intake`
- 상품찾기: `/products`
- 정산관리: `/settlement`
- 전자계약: `/esign`

UI 완료 판정은 실제 route를 1440 / 1280 / 390에서 렌더링한 Visual QA receipt가 있어야 한다.

## UI 핵심

- PC는 multi-panel
- 계약접수 기본은 3 Panel
- Search / Panel / Control은 line-free
- 선택은 border 추가가 아니라 surface 변화
- 카드/컨트롤은 얇고 평평한 operational UI
- 기능/데이터 최신화 때문에 별도 UI를 만들지 않는다.

## 변경 절차

UI 변경은 한 변경에서 다음을 같이 갱신한다.
1. actual route code
2. UI SSOT
3. machine-readable UI SSOT
4. Visual QA
5. 이 authority 문서

UI 변경은 위 actual route 계보 안에서만 수행한다.
