# 2026-09-27 운영개시 — 실제 배포에서 전 route 500, 원인과 조치

사용자 지시: 「운영개시하자」
기준 revision: main `2c44e17` (PR #136 통합본)
작업 branch: `work/ops/launch-runtime-fix` (최신 main에서 딴 임시 1개, 검증 → PR → merge 후 회수)

## 1. 관측 — 문서의 PASS가 실제 배포에서 재현되지 않았다

Vercel 팀 `freepass-projects`에 `freepass-admin` 프로젝트가 실제로 생성되고(2026-09-27 08:36 KST)
GitHub `main` 연결 · production 배포 `● Ready` 까지 갔다. 따라서 위 2026-09-26 절의
「실제 Vercel project: NOT CREATED」는 superseded다.

그런데 배포된 런타임은 **전 route 500**이었다.

```
/ · /login · /system/data-status · /intake · /settlement  → 모두 HTTP 500
```

환경변수 누락이 아니었다. 실제 런타임 오류:

```
Failed to load external module firebase-admin/auth:
ERR_REQUIRE_ESM: require() of ES Module node_modules/jose/dist/webapi/index.js
from node_modules/jwks-rsa/src/utils.js not supported
```

## 2. 원인

- `next.config.ts`가 `firebase-admin`을 `serverExternalPackages`에 둔다 → 런타임에 CJS `require`로 불린다.
- `firebase-admin@14.4.0` → `jwks-rsa@4.1.0`(CJS) → `jose@^6.1.3`.
- `jose@6`은 ESM 전용이다. `exports["."]`에 `require` 조건이 없고 `dist/webapi/index.js`(type: module) 하나뿐이다.
- 즉 `jwks-rsa@4.x`는 **Node의 `require(esm)`에 의존**한다. 운영 런타임에서 그것이 없으면 깨진다.

`jwks-rsa` 4.0.0/4.0.1/4.1.0 전부 `jose@^6.1.3`이다. 버전 선택으로는 피할 수 없다.

### 왜 로컬·CI는 통과했나

로컬 Node 24.19.0은 `require(esm)`를 지원하므로 `require('jose')`가 성공한다.
그래서 typecheck/test/build/Next runtime check 전부 PASS였고, 문서의
「actual Next production-route verification: PASS」도 거짓 기록이 아니었다.
**실제 배포 런타임에만 없는 조건이었다.**

실패 런타임을 로컬에서 정확히 재현하는 방법:

```bash
node --no-experimental-require-module -e "require('firebase-admin/auth')"
# → ERR_REQUIRE_ESM, 배포 로그와 같은 파일·같은 스택
```

## 3. 조치

`package.json`에 override 하나:

```json
"overrides": { "jose": "^5.10.0" }
```

`jose@5.10.0`은 `exports["."].require → ./dist/node/cjs/index.js`를 아직 제공한다.
그래서 `require(esm)` 지원 여부와 **무관하게** 로드된다.

- `jose` 의존자는 lockfile 전체에서 `jwks-rsa` 하나뿐이다. 앱 소스는 `jose`를 직접 쓰지 않는다.
- `jwks-rsa`가 실제로 쓰는 API는 `importJWK` · `exportSPKI` 두 개이며 jose@5에 둘 다 있다.
  실 RSA JWK로 `retrieveSigningKeys()`를 돌려 정상 SPKI PEM이 나오는 것을 확인했다.

### 회귀 방지

`src/server/server-externals-cjs.test.ts` — `serverExternalPackages` 4개를
`--no-experimental-require-module`로 require 해서 배포 런타임 조건을 고정한다.
override가 풀리면 이 테스트가 먼저 깨진다.

## 4. production 환경변수 바인딩

사용자 결정(2026-09-27): 로그인은 **Google Workspace OAuth**, freepasserp5 서비스계정은 **읽기 전용으로 투입**.

| 변수 | 상태 |
|---|---|
| `SESSION_SECRET` | 설정 — 새로 생성한 64자 무작위값 |
| `ERP5_FIREBASE_SERVICE_ACCOUNT_JSON` | 설정 — `project_id=freepasserp5` |
| `APP_BASE_URL` / `PUBLIC_BASE_URL` / `CLAIM_LINK_BASE` | 설정 — 셋 다 `https://freepass-admin.vercel.app` |
| `ERP5_WRITE` / `ESIGN_ENABLED` / `FREEPASS_DATA_ADMIN_CATALOG_READ_MODE` | 기존값 유지 — `off` / `off` / `OBSERVE` |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | **미설정 — 운영자 투입 대기** |

`ERP5_WRITE`는 열지 않았다. 운영 쓰기는 `ERP5_WRITE_APPROVAL_JSON`(최소권한 IAM + 실제
backup/restore drill 증거)이 먼저다. 이 저장소에는 여전히 production backup/restore job이 없다.

## 5. 남은 것

1. Google Cloud OAuth 웹 클라이언트 ID/SECRET 투입.
2. 승인된 리디렉션 URI `https://freepass-admin.vercel.app/login/google/callback` 등록.
3. Workspace 계정 로그인 성공 / 외부 계정 거부 확인.
4. `/system/data-status` 실제 probe 수치 확인, 상품·접수·정산 조회 확인.
5. backup/restore drill + 최소권한 IAM 확인 → `ERP5_WRITE_APPROVAL_JSON` → `ERP5_WRITE=on`.
6. 비고객 테스트 접수 1건으로 write → reload → 중복클릭 idempotency 확인.

## 6. 로컬 gate 실측 (main `2c44e17` + 이 변경)

| 검사 | 결과 |
|---|---|
| `npm run typecheck` | PASS |
| `npm run ui:check` | PASS |
| `npm run data:check` | PASS |
| `npm run build` | PASS |
| `npm test` | 749개 중 739 PASS |

`npm test`의 실패 10건은 전부 전자계약 PDF 렌더러 테스트이며, Windows 로컬에
serverless Chromium이 없어서 브라우저가 뜨지 않은 환경 문제다. 이 변경과 무관하고
전자계약은 운영개시 범위 밖(`ESIGN_ENABLED=off`)이다. 해당 job의 판정은 Linux CI를 따른다.

> `DEPLOYMENT VERIFIED` / `PRODUCTION PERSISTENCE VERIFIED`는 위 5번 증거가 나온 뒤에만 적는다.

---

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
