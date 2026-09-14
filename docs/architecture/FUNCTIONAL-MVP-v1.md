# freepasserp.com v1 — Functional MVP

## 목표

시각 완성보다 먼저 합성 상품 한 건이 접수부터 정산 잔액까지 이어지는지 검증한다.

## 현재 경계

- UI는 기존 1:1:1 업무 골격을 유지한다.
- ADMIN만 접수·접수관리·실적·정산을 처리한다.
- SALES는 상품 검색·상품 상세만 사용하며 고객·접수·실적·정산 데이터를 받지 않는다.
- WHITE LABEL은 기존 시스템 활용·별도 수정 범위이며 신규 ADMIN 업무 권한과 분리한다.
- 최초 접수 필수값은 차량/Offer, 영업채널, 담당자, 고객명 네 개다.
- 접수는 product version, Offer, Policy를 Snapshot으로 보존한다.
- 인도완료는 되돌리는 토글이 아니라 별도 delivery event fact다.
- Performance는 Application당 한 번만 생성한다.
- 영업자 확인 뒤 공급사 확인을 거쳐야 정산 확정할 수 있다.
- 받을액, 줄액, 마진은 분리한다.
- 수금과 지급은 서로 다른 append-only 배열이며 부분처리를 허용한다.
- VAT 미선택이면 정산 확정을 막는다.
- 임시 지급정책은 전액 수금 후 지급이다.

## 기능 우선 UI 계약

- 공통 시각값은 `src/ui/tokens.css`, 기본 조작은 `src/ui` 컴포넌트에서 관리한다.
- 실적 버튼의 노출·활성 기준은 `getPerformanceActionAvailability()` 한 곳에서 결정한다.
- UI에는 금액 저장 → 영업채널 확인/이견 → 공급사 확인/이슈 → 재확인/이슈 해결 → 정산 확정 흐름이 연결되어 있다.
- 인도완료, 정산확정, 수금, 지급은 실행 전 확인한다.
- 접수 초안에 입력값이 있으면 닫기 전에 유실을 확인한다.
- 현재 확인창은 기능 MVP의 브라우저 기본 UI다. 접근 가능한 공통 Dialog로 교체하되 업무 상태 규칙은 변경하지 않는다.

## 영속성 단계

현재 localStorage는 새로고침을 포함한 기능 시뮬레이션 전용이다. 고객명과 금액을 운영 데이터로 저장하는 수단이 아니다.

운영 영속성은 독립 Firebase 프로젝트 확정 후 다음 경계를 사용한다. 아래 인증/Rules 경계는 코드와 로컬 에뮬레이터 테스트까지 완료됐지만 실제 프로젝트에는 아직 배포하지 않았다.

1. 브라우저는 Firebase Auth만 사용한다.
2. 모든 mutation은 Next.js 서버에서 Firebase Admin으로 수행한다.
3. Firestore 클라이언트 직접 쓰기는 deny-all Rules로 막는다.
4. Application, Delivery→Performance, Settlement, Collection, Payout은 transaction과 idempotency key를 사용한다.
5. 수금/지급 원장은 수정·삭제하지 않고 reversal/adjustment를 추가한다.

## 역할 경계

- `/`는 서버에서 ACTIVE ADMIN 세션을 요구한다.
- `/sales`는 서버에서 ACTIVE ADMIN 또는 SALES의 상품조회 권한을 요구하며 localStorage의 ADMIN 고객·금액 데이터를 읽지 않는다.
- 실제 Firebase 연결 전 기능 시뮬레이션은 개발 환경의 `/dev-preview`에서만 제공하고 운영 빌드에서는 404로 닫는다.
- 인증된 `/`는 고객·금액 상태를 localStorage에 저장하지 않는다. 전역 localStorage 시뮬레이션은 개발 전용 경로에만 한정한다.
- 역할 허용표는 deny-by-default 순수 계약과 회귀테스트로 고정한다.
- Firebase 세션의 검증된 uid로 `staffAccounts`를 다시 읽어 ACTIVE 역할을 결정한다. client role/source/actorId는 권한 근거로 사용하지 않는다.
- Firestore Rules는 모든 브라우저 read/write를 catch-all 거부한다. 서버 Admin SDK가 Rules를 우회하므로 모든 mutation은 서버 capability를 다시 검사한다.
- 로그인 UI, 신규 Firebase 프로젝트 계정 발급, 실제 Firestore transaction 영속성은 아직 미구현이다.
- 영업채널/공급사 확인은 해당 채널·공급사 ID와 `recordedByAdminId`를 분리해 관리자가 외부 확인 사실을 기록했음을 보존한다. 실제 개인 확인자와 증빙 방식은 `DECISION REQUIRED`다.
