# UI 규격 — freepass-admin

> **현행 UI/UX 공통 정본:** [ADMIN-UI-UX-SSOT.md](ADMIN-UI-UX-SSOT.md)  
> AI/자동검사용: [admin-ui-ux-ssot.json](admin-ui-ux-ssot.json)  
> 이 문서의 아래 과거 규격과 충돌하면 **ADMIN-UI-UX-SSOT가 우선**한다.

## 0. 실제 앱 정본 — 2026-09-18

> 아래 기존 mockup 규격은 설계 이력으로 유지한다. **값이 다르면 이 절과 실제 `src/app` 구현이 우선**한다.
> 실제 구현 정본: `src/app/globals.css` + `src/app/_design/*` + 각 route workspace.

### 현재 화면 체계

- Desktop 상단 업무축: **상품찾기 / 계약접수 / 정산관리 / 전자계약**
- Mobile depth 0 하단축: **상품 / 접수 / 계약 / 청구 / 지급**
  - 청구·지급은 같은 정산관리 화면의 서로 다른 입구다.
  - 상세(depth 1·2)에서는 5탭 대신 해당 판의 하단 action bar가 선다.
- 첫 화면: `/` → `/intake`
- 실제 route: `/products` · `/intake` · `/settlement` · `/esign`

### 현재 시각 토큰

| 항목 | 현재값 |
|---|---|
| CI 주색 | FreePass Navy **#1B2A4A** |
| 바닥 | `#eef1f4` 계열 |
| 판 | 흰 면 |
| 카드/목록줄 | 선 없이 면으로 구분 |
| 라운드 | **4px** 기본 |
| 텍스트 | **제목 18 / 메인 14 / 보조 12** 3단 |
| 뱃지 | White Label 규격 12px / radius 8 |
| 업무 컨트롤 | **44px** |
| 주 실행 / 모바일 터치 | **44px** |
| Desktop global chrome | **60px 하단 탭바** — 내부 터치영역 44px 이상 |
| 목록 줄 | 공통 `ListRow`, 3줄 구조 |
| 선택 | 테두리보다 **옅은 네이비 면**으로 위계 |

### 판 규칙

- 상품찾기: 상품 목록 **2/3** + 상품 상세 **1/3**
- 계약접수: 상품 목록 + 상품 상세 + 접수/업무 판
- 정산관리: 묶음 + 실적 줄 + 접수 상세
- 전자계약: 계약 목록 **2/3** + 계약 상세 **1/3**
- 모바일에서는 같은 내용을 압축하지 않고 **목록 → 상세** depth로 전환한다.

### 구현 원칙

1. 목록은 `_design/ListRow`를 우선 사용한다.
2. 뱃지는 `_design/Badges`를 사용한다.
3. 아이콘은 `_design/Icon` 한 벌을 쓴다.
4. 관리자 chrome은 `_design/AdminChrome`, 폰 하단은 `_design/MobileTabBar`가 정본이다.
5. mockup 전용 `admin-shell.*`과 실제 route가 다르면 실제 route를 고친다. mockup을 운영 화면으로 간주하지 않는다.
6. 새 UI 규격을 만들기 전에 `globals.css`의 확정 토큰과 이 절을 먼저 확인한다.

---

## 과거 규격 기록

2026-09-16 mockup 기반의 과거 22/30/34/38/46px 규격, rail 중심 IA, 상단 chrome 설계는 현행 정본에서 제거했다.

필요할 때만 [UI-HISTORY.md](UI-HISTORY.md)를 참고한다. 과거 기록은 **구현 기준으로 사용하지 않는다.**
