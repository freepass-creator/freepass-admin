# PR #96 — 세부검색 상호작용 브라우저 검증 (2026-09-25)

## 판정과 범위

**ISOLATED FILTER COMPONENT BROWSER VERIFIED.** 운영 배포, 실기기, 실제 로그인/Firestore, 전체 Next 라우팅 검증 완료를 뜻하지 않는다. PR #96은 Draft 유지. 병합·배포·운영 데이터 쓰기는 수행하지 않았다.

- 수정 전 코드: `ce19bb43d8ed1be718331a02617a4470b302efeb`
- 수정 후 검증 코드 HEAD: `bedcd2835507702d2a4dcc1d560d59ca905a1c5e`
- 수정 후 Actions merge checkout: `d304b3777ebce322b2b3647db9ac7945550d987c`
- 브라우저: Chromium `140.0.7339.16`, headless, `ko-KR`, 높이 900 CSS px
- 검증 폭: 320 / 390 / 900 / 901 / 1440 CSS px

## 재현한 문제와 수정

1. **웹 바깥 클릭 후 포커스 탈취**: 다른 패널의 입력칸을 클릭하면 기존 close()가 다음 프레임에 검색 버튼을 다시 focus하여 연속 입력이 끊겼다. 바깥 클릭/Tab 이탈은 포커스 복귀 없이 닫고, 명시적 닫기/Escape만 원래 검색 버튼으로 복귀하도록 분리했다.
2. **해제·초기화 뒤 포커스 유실**: 현재 포커스가 있는 버튼이 선택값 변경으로 사라지면 body로 포커스가 떨어졌다. 시트 내용 변경 시 유실된 포커스를 사용 가능한 필터 컨트롤로 복구한다. 더보기 뒤 첫 새 항목으로 이동하는 동작도 명시적으로 유지한다.
3. **모바일 모달의 배경 조작 경계 미완성**: aria-modal과 Tab 순환만 있고 배경 input으로 프로그램 포커스가 이동할 수 있었다. 시트의 조상은 건드리지 않고 그 밖 형제 가지를 inert 처리하며 문서 스크롤을 잠근다. 닫기, 화면폭 변경, unmount 때 원래 inert 속성과 overflow 값을 복원한다. 열려 있는 동안 추가되는 배경 노드도 같은 경계에 포함한다.

기능 수정 커밋은 `src/app/_design/FilterSheet.tsx` 한 파일만 변경한다. 색상/타이포/CSS 디자인, OR/AND 필터 의미, URL 수정 함수, 사업 계산, API/DB 인증 규칙은 변경하지 않았다.

## 같은 검사로 수정 전후 비교

| 화면 폭 | 수정 전 | 수정 후 |
|---|---:|---:|
| 320px | 21/28 | 28/28 |
| 390px | 21/28 | 28/28 |
| 900px | 21/28 | 28/28 |
| 901px | 17/21 | 21/21 |
| 1440px | 17/21 | 21/21 |
| 합계 | **97/126** | **126/126** |

모바일 폭의 검사에는 1440px로 늘린 후 배경 잠금 해제와 외부 입력 복귀도 포함된다. 실패 29건은 화면별로 반복된 assertion 수이며, 독립 결함 29개라는 뜻이 아니다.

검사 항목: 열기/닫기/Escape, Tab/Shift+Tab 순환, 모달 여부, 배경 포커스/inert/스크롤 잠금·해제, 더보기, 0건 조건 선택, 항목별 해제, 다른 축 보존, 전체 초기화, 검색어·무관한 query 보존, page reset, 선택된 숨은 항목 자동 펼침, 빈 축에서도 안전한 닫기, 외부 입력 연속 타이핑, 브라우저 런타임 오류.

**수정 전후 테스트 스크립트/fixture/navigation boundary의 SHA-256은 동일하다.** 다운로드한 두 receipt의 source hash를 비교하면 실제 변경 파일은 FilterSheet.tsx 하나뿐이다. 검사를 완화해서 통과시킨 것이 아니다.

첫 probe `175709f`에서는 테스트의 바깥 입력칸이 실제 팝오버 아래 가려져 클릭할 수 없었다. 테스트 입력칸을 다른 보이는 패널로 옮기고, 중도 오류에도 부분 결과를 남기도록 수정했다. 위 표는 그 수정이 적용된 `ce19bb4`를 기준으로 비교한다. 강제 클릭으로 가림을 우회하지 않았다.

## 기존 검사 회귀

동일 수정 후 HEAD에서:
- 기존 목록/상세/업무 fixture 8개 폭 × 3상태: **24/24 PASS**
- 기존 상세 탭/Offer 선택 상호작용: **14/14 PASS**
- 세부검색: **126/126 PASS**
- CI: **PASS** (typecheck / test / UI SSOT / data wiring)
- backend-check: **PASS** (typecheck / test / data wiring / production build)
- 두 브라우저 receipt의 외부 요청: **0건**, 런타임 오류 없음

## 증거

수정 전:
- Run: https://github.com/freepass-creator/freepass-admin/actions/runs/36119412398
- Artifact ID: `10857035158`
- ZIP SHA-256: `12b862d4da1c3b11ed4f4501b24177998f47cba19207c8d59a05136a6169a159`

수정 후:
- Browser: https://github.com/freepass-creator/freepass-admin/actions/runs/36119614469
- CI: https://github.com/freepass-creator/freepass-admin/actions/runs/36119614403
- Backend: https://github.com/freepass-creator/freepass-admin/actions/runs/36119614556
- Artifact ID: `10856763260`
- Artifact: `ui-browser-bedcd2835507702d2a4dcc1d560d59ca905a1c5e`
- ZIP SHA-256: `bc931ecb11d38be50288a18efba33a528b4f5bf5e2fe2164c6e202c91267a87c`
- 스크린샷 총 31장: 기존 26장 + 세부검색 5장
- 다운로드 후 재해시: 세부검색 소스 **10/10 일치**, 기존 UI 소스 **11/11 일치**
- 390px 수정 후 모바일 화면, 901px 수정 전 웹 화면을 직접 이미지로 확인했다.
- 보관기간 7일. 만료 또는 코드 변경 시 Actions 재실행으로 새 증거를 생성한다.

테스트 파일:
- `scripts/browser/filter-fixture.tsx`
- `scripts/browser/filter-navigation.ts`
- `scripts/check-ui-filter-browser.mjs`
- 기존 `.github/workflows/ui-browser-check.yml`에 세부검색 검사 및 artifact 경로 추가

## 남은 검증 및 배포 보류 항목

- Next navigation hook은 테스트 전용 URL boundary로 대체한다. **실제 Next 서버 전환 지연/연속 클릭 경쟁, 오류·재시도, history 이동은 이번 증거에 포함되지 않는다.**
- 운영 로그인, Firestore/IAM, 서버 액션, 실제 접수·정산·계약 처리, 모바일 실기기 키보드, 타 브라우저, RTL, 스크린리더 실측, Design Hub 승인은 별도다.
- `npm ci`의 최초 probe 실행 로그에서 의존성 취약점 알림 **5건(Moderate 2, High 2, Critical 1)**을 확인했다. 패키지별 advisory/도달가능성/수정버전은 이번 UI 작업에서 조사하지 않았고 dependencies/lockfile을 임의 변경하지 않았다. **브라우저·빌드 PASS로 이 보안 경고를 해소 처리하지 않는다. 배포 전 별도 보안 검증 필요.** 관측 로그: run `36119149432`, job `108020229616`, 2026-09-25 09:34 UTC.

참고 기준:
- W3C APG modal dialog: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- Next useRouter: https://nextjs.org/docs/app/api-reference/functions/use-router

이번 작업으로 전체 제품의 출시 준비 완료나 보안 적합성을 선언하지 않는다.
