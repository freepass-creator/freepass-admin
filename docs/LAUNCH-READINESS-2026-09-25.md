# FreePass Admin 운영 개시 점검 — 2026-09-25

기준: main `4c37c73`(#106 통합본) + 브랜치 `claude/freepass-admin-launch-irkl4q`.
이 문서는 운영 개시 직전 "남은 것"만 모은다. 업무 의미는 `WORK-INBOX.md`, 배포 절차는 `OPERATIONS-FIRST-USE.md`가 정본이다.

## 1. 확인된 상태

| 항목 | 상태 |
|---|---|
| typecheck / 전체 테스트 / UI·Data 경계 체크 / production build | TESTED (로컬, 이 브랜치: 566/566) |
| 상품찾기 · 접수 · 실적 · 정산(청구/수금/지급/환수) 화면 | CODED, 실데이터(FreePass Data) 경유. mock 없음 |
| 운영 배포 · 로그인 키 · 서비스계정 · 라이브 URL | NOT BOUND (Vercel 프로젝트 0, 시크릿 미확인) |
| 운영 persistence / IAM / 백업 | NOT VERIFIED |

## 2. 이 브랜치에서 마무리한 것

- 로그인 뒤 돌아갈 주소 `/\evil.com` 우회 open redirect 차단 (`src/server/safe-next.ts` + 테스트).
- 정산·접수·청구링크·환수 이력의 `by`가 고정값 `freepass-admin`이던 것을 로그인한 사람 `이름 <이메일|uid>`로 기록. 계약/전자계약 route도 동일 (AGENTS.md §9.5 actor).
- `ERP5_WRITE=off`인데 청구 링크 열기가 실패 횟수/열람 횟수를 쓰던 누수를 fail-closed로 막음.
- `.env.example`에 빠진 변수(`ADMIN_AUTH`, `NEXT_PUBLIC_APP_URL`, `ESIGN_CHROMIUM_EXECUTABLE_PATH`) 기재, #96의 SHADOW_READ 주석 반영.

## 3. 운영 개시 전 남은 것 (P0)

1. **배포 바인딩** — 사용자/운영자만 가능. `OPERATIONS-FIRST-USE.md` 순서대로 preview(`ERP5_WRITE=off`) → 로그인 허용/거부 계정 확인 → `/system/data-status` → 쓰기 on.
2. **전자계약 관리자 화면 — DECISION REQUIRED.** `/esign`은 읽기 전용 목록이다. 접수→계약 생성, 승인, 취소, 해지 API는 있으나 화면에서 부르지 않고, 링크 발행(`issue`)·반려(`reject`)·철회(`revoke`)는 route조차 없다. 고객이 제출하면 `검토대기`에서 멈춘다. 또 `/esign` 목록이 `검토대기`를 "발송 전"으로 표시한다.
   → 전자계약을 운영 개시 범위에 넣을지(화면 구현) / 개시 범위에서 빼고 종이계약으로 갈지 결정 필요.

## 4. 첫 몇 주 안에 (P1)

- **권한 등급 없음.** Google Workspace 도메인 전원이 전체 관리자(정산 쓰기·발행 포함). Google 세션 5일, 서버측 폐기 불가. → 허용 이메일 목록 또는 역할 모델 결정 필요.
- **환수 섞인 청구서의 수금/지급 기록 잠김** — 현금 배분 정책 DECISION REQUIRED (`domain/settlement/lifecycle.ts`).
- **인도 후 해지 → 환수 검토 대기열 화면 없음** — 도메인(`pendingTerminationClawbackRows`)만 있음.
- **전체 컬렉션 읽기 / 페이지네이션 없음** — `/settlement`, `/intake`가 매 요청 원장 전체를 읽는다. 행 수가 늘면 느려진다.
- **실적 "이슈" 필터** — 수금/지급 완료된 줄은 정정·보류·끊김이어도 "이슈"에 안 뜬다(`performance-filter.ts`). 의도인지 확인 필요.

## 5. 고도화 (P2)

- 공통 `error.tsx` / `not-found.tsx` 없음. 공개 전자계약 API가 내부 오류 문구를 그대로 반환.
- 보안 헤더/CSP 없음, 공개 엔드포인트 rate limit 없음.
- 공개 경로 판정이 확장자(`.png` 등)만으로 통과 — 현재는 무해하나 취약한 규칙.
- 테스트 전용 JSON 파일 저장소(`src/adapters/store`) 정리.
- 상품찾기 정렬 순서 DECISION REQUIRED (`domain/search/search-products.ts`).

## 6. 열린 PR 정리 권고

| PR | 권고 |
|---|---|
| #104, #102, #94, #97 | main에 이미 통합 → 닫기 |
| #96 | 남은 주석 1건 이 브랜치로 이식 → 닫기 |
| #98 | 내용은 main에 더 새 버전으로 있음. 남은 차이는 "전자계약 연결 접수는 접수취소 불가" 규칙으로 WORK-INBOX 0-A와 충돌 → 닫기 |
| #72, #70 | 과거(09-22) 기준 문서/코드, 0-AA와 충돌 → 닫기 (#72의 모바일 목업 html만 필요 시 보존) |
| #92 | 새 ERP 표준 UI 방향(487커밋). rev 5 밖 방향이라 사용자 결정 필요 |
