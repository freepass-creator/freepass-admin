# FreePass Admin Design Authority

2026-10-03 사용자 결정 — 접수 관리(/ledger): 「엑셀은 참고. 아주 심플하게, 엑셀보다 편하고 눈에 띄게. ERP처럼」 · 「좌우 스크롤 없이」 · 「목록과 상세 2:1 · 접수할 때만 옆이 열리게 · 쪼그라들면 항목이 카드처럼 순서대로 아래로 · 폰트 맞추고 허접해 보이면 안 된다」. 기존 판 `.pb`(products/board.css) 모양·토큰을 그대로 쓰고, 평소 목록 전체 폭 → 처리 시 목록 2 : 처리 판 1. 목록 줄 = 박스 없는 한 줄 카드(상태 글자 + 접수 항목 전부, 이름표 위·값 아래, 순서대로 흐름), 계약서·인도는 줄에서 체크. 별도 상세 판 없음 — 줄을 누르면 새 접수와 같은 입력판으로 고친다. 기존 ProductsBoard 화면은 지우지 않고 나란히 유지. 저장은 기존 settlement_rows와 기존 접수 액션만. 구현: `src/app/ledger/`.

2026-10-01 공간 비율 정정: PC 동일폭3패널·모바일1패널 유지. 실제 사진 높이 PC120/모바일128, 사진→요약12/요약→대여료16. 제목 아이콘은 차량/대여료에 16px·gap8만 적용. 1280~1439의 board 메뉴도64px rail. 기존 도메인/Offer/저장 동선 변경 없음.

상태: **MAIN_UI_CANONICAL — USER APPROVED 2026-09-30 · ProductsBoard intake actual route**

## 단일 메인 기준 · 이전 디자인 폐기

사용자 최신 정정: **기존 ProductsBoard 모양을 잠그는 것이 아니라, 마지막 웹·모바일 3장 시안으로 화면 틀을 교체한다.** ProductsBoard는 기존 기능을 이어 쓰는 구현 위치이지 과거 디자인의 승인 근거가 아니다. PR92 복구 화면·옛 브랜치·목업·캡처는 HISTORICAL_ONLY / RESTORE_FORBIDDEN이다.

## MAIN_CODE_RENDER_V1 — 렌더와 구현을 같은 코드로

최신 상품상세 정정(2026-09-30): 항목별 가로선 대신 label-above-value 정보 묶음. PC 2열, 모바일 짧은 차량/제원 2열·정책 1열, 긴 값은 전체 열. 섹션 여백으로 구분하며 추가 카드 테두리를 만들지 않는다. 대여료 세로 선택은 유지. 상세 행동 버튼 높이는 PC 36 / 모바일 44, 고정 너비 없이 공유 내용폭·접수 잔여폭. 이는 아래 과거 fact row 형태보다 우선한다.

### 최신 동선 정정: 목록 보며 처리 (2026-09-30)

웹 접수목록에서 건을 선택하면 가운데 **상세 패널**이 접수상세로 바뀌고 오른쪽 **접수목록은 유지**한다. 선택 신호와 검색·필터·상품/Offer 문맥을 보존하며 같은 목록에서 다음 건을 선택한다. 상품을 다시 선택하면 접수상세 선택을 해제하고 상품상세로 돌아간다. 모바일은 공간상 접수상세 한 장으로 전환하되 목록 복귀 URL은 기존 목록 조건을 보존한다. 이 최신 동선은 앞서 이미지의 「오른쪽 목록 → 오른쪽 상세」보다 우선한다.

- 기준 원본: 마지막 3장 `exec-084a6166-2033-4e5f-8286-1bf741e9d9b5.png` (작성), `exec-36d9f176-bbe4-44a3-9d3b-88bf7db301af.png` (목록), `exec-fc747e30-cf14-4fbd-a853-e9805c67763a.png` (상세). 원본 위치: `C:/Users/admin/.codex/generated_images/01a0e3d8-73bf-7ab1-90a4-bac2a882f585/`.
- 이후 시안 이미지는 실제 `/intake` 코드를 브라우저에서 캡처한다. 생성 이미지·별도 시안 HTML·다른 저장 엔진으로 대체하지 않는다.
- shell: `AdminChrome` + `SideMenu`; 네이비 152px sidebar, 흰색 56px header, 접기 64px. 전역 검색은 계약접수에서 반복하지 않고 현재 업무 제목만 표시한다. 데모 데이터 표지는 운영 오인 방지를 위해 유지한다.
- composition: `ProductsBoard`의 3개 동일 폭 패널, 10px gutter, 흰색 panel, 16px 내부 padding, 8px radius. 각 패널 독립 scroll와 고정 footer. Mobile ≤900은 같은 DOM을 `v=list/detail/work`로 한 장씩 표시한다.
- list card: `BoardList` + `productRows`; web 76px/56px thumbnail, mobile 88px/64px thumbnail. 첫 줄 차명·오른쪽 월 대여료, 둘째 공급사·상품·상태, 셋째 차번·기간·보증금. 알려지지 않은 보증금은 0이 아니라 미확인이다.
- detail: `PhotoGallery` → plain summary → 기간/월 대여료/보증금의 세로 Offer 표 → 차량·정책 정보. 선택은 pale blue와 radio 신호. fuel/year 중첩 박스 없음. `offer.id`와 snapshot 의미는 그대로 유지한다.
- form: `BoardIntakeForm`; 고객명 먼저, 채널/담당자/payKind native select, label/control 2열, 선택 메모 disclosure, 취소/접수 저장 footer. 웹 input 32px, mobile input/touch 44px; 기존 저장 action·오류 초안 유지·코드 매핑 재사용.
- task states: 작성 `w=new`, 접수목록 `ic` 없음, 접수상세 `ic=<실제 접수 ID>`; 상품/Offer 문맥을 잃지 않도록 저장 redirect를 후속 정합화한다. 성공 알림은 실제 저장 성공에만 표시한다.
- 연결 계약: `productView`/`freepass-data` → 기존 CanonicalProduct/Offer → 기존 `createIntakeAction`/snapshot/service. 새 UI가 다른 DB·계산·정책을 만들지 않는다.
- 남은 차이: 연락처·추가 연령/주행 조건은 별도 저장 계약이 아직 없다. 등록 계약서·필수서류·잔금 세부 workflow, 저장 후 목록 전환 및 상세 탭/accordion은 마지막 시안에 맞추는 후속 구현 대상이다. UI만 만들어 저장 완료를 주장하지 않는다.
- 완료 기준: 1440/1280/390/360 실제 캡처, overflow 0, 검색/Offer 선택/입력/오류/목록·상세 전환, 타입·관련 테스트·build. 각 캡처의 viewport/commit/data mode/미구현 차이를 함께 남긴다. 현재 첫 구현은 CODED이며 마지막 이미지와 완전 동일 판정은 아직 미통과다.

목록 / 상세 보기 / 입력의 세 가지 패널을 조합하며 복합 패널도 허용한다. 상품 선택은 상세 스크롤을 위로 초기화하고 접수하기는 오른쪽 업무 패널만 바꾼다. 대여료는 세로 선택 목록이다. 웹과 모바일은 같은 업무 의미와 공용 컨트롤을 사용한다. 새 디자인 분기·내 처리함·과한 중첩 박스를 추가하지 않는다.

다른 업무 페이지에서 실제 사용하는 `_erp`·`_design` 부품은 기능 보존을 위해 유지하지만 과거 형태를 재도입할 권한은 아니다. 기존 코드의 존재와 디자인 승인 상태를 구분한다. 다른 페이지의 전체 시각 통일 완료를 이 결정만으로 주장하지 않는다.
최신 확정: 사용자 2026-09-30 기존 디자인 폐기 결정. `/intake`는 `ProductsBoard`의 `상품찾기 | 상품상세 | 접수목록/업무` 3패널 구조를 메인으로 사용한다. 기존 PR #92 계보는 통합 이력과 재사용 코드의 출처로만 남으며 디자인 기준이 아니다.
확정: 사용자 2026-09-26 「큰 화면으로 준 92버전이 정본이고 그게 메인으로 합쳐져야 돼」 「이제 이거가 정본이고 메인이고 … 확정되지 못한 거는 폐기」  
main 반영 PR: #121 (PR #92 → #112 → `work/uiux` 계보 + 당시 main 기능)

## 폐기 (DISCARDED)

아래는 **구현 근거가 아니다.** 되살리거나 참고해 현재 화면을 바꾸지 않는다.
- #121 이전 main의 화면(하단 탭 5개 · 네 줄 목록 카드 · dz 셸)과 그 잠금 문서(2026-09-25 HARD LOCK, #108~#111)
- 삭제된 과거 목업(rev 5 포함) · 캡처 · 리뷰 문서
- `work/uiux`, `recovery/pr92-modernize-20260926`, `claude/erp-platform-ui-ux-hvfyfa` 브랜치 자체 — 내용은 #121로 main에 들어왔고 브랜치는 폐기
- 사용자 확정 없이 다른 브랜치 · PR · AI가 만든 화면 · 토큰 · 레이아웃

폰(≤900px) 화면은 같은 계보 안에서 다듬는 중이며 사용자 최종 확정 전이다. 다듬기는 이 계보 안에서만 한다.
현재 모바일 전역 navigation은 PC 업무축과 동일하게 `상품 → 접수 → 실적 → 정산`을 사용하고, 전자계약이 활성화된 경우에만 별도 `계약` 문을 마지막에 둔다. 청구/지급은 정산 화면 내부 축이다.
정산 내부에서는 공급사 청구/수금 축이 완료되고 지급축에 할 일이 남으면 `지급 업무로` 하단 주 액션으로 다음 축을 직접 잇는다. 개별 상세의 현재 업무는 shared lifecycle 결과를 실행 가능한 단계명으로 표시한다.
정산 거래처/개별 실적의 상태 신호는 Web/Mobile 공통 presentation helper를 사용한다. 보류는 amber, 정정·끊김·금액모름은 red, 완료는 green, 진행은 navy, 대기는 grey로 표시하며 도메인 판정은 바꾸지 않는다.
PC 정산 실적줄은 정산 route를 벗어나지 않는다. `focus`로 가운데 Panel만 공용 `SettlementDetail`로 전환하고 기존 월·거래처·청구/지급 축을 유지한다. 상세 PanelFoot에서 정산 lifecycle action을 이어서 실행한다.
정산 focus 상세은 첫 화면에서 `현재 업무 → 정산 핵심 → 고객·차량`만 우선 노출한다. 계약·접수 정보와 이력은 기본 닫힌 보조 disclosure로 두고, 정산 중에는 접수 mutation control을 반복 노출하지 않는다.
1280~1439 PC에서는 3패널 구조를 줄이지 않고 왼쪽 업무메뉴만 64px icon rail로 접어 각 패널 가독폭을 확보한다. 1440+에서는 full sidenav를 복원한다.
긴 식별문자열은 identity/support에서 말줄임하고 원문 tooltip을 유지하되 정확 금액·상태·주 액션은 줄이거나 숨기지 않는다. FilterSheet는 modal focus trap과 Escape focus-return을 갖는다.
빈 결과는 하얀 Panel로 두지 않고 공통 상태 surface로 이유/다음 확인을 설명한다. route loading/error는 공통 RouteState boundary로 수렴하며, 조회전용은 이유를 노출하고 mutation action을 disabled+aria-describedby로 연결한다.

## 현재 단일 디자인 정본

PC actual route 구현:
- `src/app/products/board.tsx`
- `src/app/products/board.css`
- `src/app/products/product-view.tsx`
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

과거 복구 기록 (HISTORICAL_ONLY / RESTORE_FORBIDDEN):
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

- 2026-09-30 사용자 확정: 접수의 유한 선택값은 native select, 자유 텍스트는 input/textarea를 사용한다. 기간별 Offer 비교는 기존 세로 선택목록을 유지한다.
- 채널·담당자 선택지는 기존 원장 기준이며 기본값이 목록 밖이면 보존한다. 목록이 비어 있으면 수기 입력을 유지한다. 별도 저장 계약이 없는 연락처·연령/주행거리 변경값은 UI만 만들어 저장됐다고 표현하지 않는다.

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
