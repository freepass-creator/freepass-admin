# FreePass Admin Design Authority

상태: **RECOVERY CANONICAL — PR #92 actual route only**  
기준 브랜치: `claude/erp-platform-ui-ux-hvfyfa`  
복구 작업장: `recovery/pr92-modernize-20260926`

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

## 금지

다음은 디자인 정본으로 사용하지 않는다.
- 과거 mockup
- 저장 screenshot
- reference 이미지
- isolated component browser fixture
- Git history의 삭제된 UI 파일
- main에서 더 최근 날짜라는 이유만으로 선택한 시각 구현
- 다른 PR/AI가 별도로 만든 두 번째 visual authority

현재 트리에서 혼동용 mockup/reference/stale screenshot은 제거한다.

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

대체 branch나 별도 mockup을 새로운 정본으로 만들지 않는다.
