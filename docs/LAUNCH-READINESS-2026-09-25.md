# 2026-09-26 운영개시 최신 상태

기준 branch: `work/release/operational-launch`  
기준 CI run: `36219570958`

## 현재 판정
- 코드/타입/전체 테스트: **PASS**
- production build: **PASS**
- UI/Data boundary: **PASS**
- Firestore/Storage emulator persistence: **PASS**
- actual Next production-route verification: **PASS**
- PR #121 UI lineage actual-route Visual QA: **PASS**
- 브랜치 상태: latest main 기준 **behind 0**
- 전자계약: **운영개시 범위 밖 / off 유지**
- 실제 Vercel project: **NOT CREATED / connected team project count 0**
- production OAuth / 서비스계정 / IAM / live read-write: **NOT VERIFIED**

## 남은 P0 — 외부 운영 바인딩
1. Vercel team `freepass-projects`에 `freepass-admin` 프로젝트 생성
2. GitHub `freepass-creator/freepass-admin` 연결
3. Node 24.x / production env 설정
4. 첫 배포는 `ERP5_WRITE=off`, `ESIGN_ENABLED=off`, catalog `OBSERVE`
5. production URL 확정 후 `APP_BASE_URL` / `PUBLIC_BASE_URL` / `CLAIM_LINK_BASE` 동일 origin 설정
6. Google OAuth callback에 `/login/google/callback` 등록
7. Workspace 계정 로그인 / 외부계정 거부 / `/system/data-status` / 상품·접수·정산 조회 확인
8. rollback/backup/IAM 확인 뒤 `ERP5_WRITE=on`
9. 비고객 테스트 접수 1건으로 write→reload→idempotency 확인

> 위 실제 운영 증거 전에는 DEPLOYMENT VERIFIED / PRODUCTION PERSISTENCE VERIFIED로 표기하지 않는다.

---

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
2. ~~전자계약 관리자 화면~~ → **운영 개시 범위에서 제외(사용자 확정)**. `ESIGN_ENABLED=off`로 화면·고객 링크·API를 닫았다. 다시 열려면 관리자 발행/승인/반려 화면과 `issue`/`reject`/`revoke` route가 먼저 필요하다.

### Vercel 첫 배포 체크리스트 (도메인 없이)
1. Vercel 프로젝트 생성 → 이 저장소 연결, Node 24.x.
2. 환경변수: `SESSION_SECRET`(32자 이상 무작위), `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `GOOGLE_WORKSPACE_DOMAIN=teamjpk.com`, `ERP5_FIREBASE_SERVICE_ACCOUNT_JSON`, `ERP5_STORAGE_BUCKET`(필요 시), `ERP5_WRITE=off`, `ESIGN_ENABLED=off`, `FREEPASS_DATA_ADMIN_CATALOG_READ_MODE=OBSERVE`.
   - 값 확인: `npm run deploy:check` (값은 출력하지 않음). Vercel에 넣은 값은 `vercel env pull .env.check --environment=production && node --env-file=.env.check --import tsx scripts/check-deploy-env.mts && rm .env.check`.
3. 첫 배포 후 production 주소(`https://<project>.vercel.app`)를 `APP_BASE_URL`·`PUBLIC_BASE_URL`·`CLAIM_LINK_BASE`에 넣고 재배포.
4. Google Cloud OAuth 클라이언트에 승인된 리디렉션 URI `https://<project>.vercel.app/login/google/callback` 등록.
5. Workspace 계정 로그인 / 외부 계정 거부 확인 → `/system/data-status` 확인 → 상품·접수·정산 조회 확인.
6. 백업/롤백 확인 후 `ERP5_WRITE=on`, 비고객 테스트 접수 1건으로 저장·재조회·중복클릭 확인.

## 4. 첫 몇 주 안에 (P1)

- ~~권한 등급~~ → Workspace 구성원 전원 관리자(사용자 확정). 세션 즉시 차단은 `SESSION_SECRET` 교체로만 가능.
- ~~환수 섞인 청구서 수금/지급 잠김~~ → 환수는 문서의 마이너스 줄·상계로 확정, 잠금 해제.
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
