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

## 4-A. 로그인 문 — ERP3/ERP5 계정을 쓰지 않는다 (2026-09-27 확정)

대표: 「프리패스 ERP3는 이제 안 쓰는 건데 그걸 또 갖고 오면 어떻게 하냐」
    「ERP5에 로그인 정보는 갖다 놨잖아 그 중에 구글 워크스페이스 멤버들만 로그인 할수 있으면 되는데」

이 절은 2026-09-18 의 「일단 프리패스erp4 계정을 같이 쓰자」를 **뒤집는다.**

### 관측 — 실제 배포 직전 `/login` 이 폐기된 창고를 정문으로 쓰고 있었다

- `/login` 이 렌더하던 것은 erp4(freepasserp3) Auth 로 붙는 이메일·비밀번호 폼 하나뿐이었다.
- 구글 문(`/login/google`)은 구현돼 있었지만 **UI 어디에서도 링크되지 않았다.** 주소를 직접 쳐야만 닿았다.
- 즉 `GOOGLE_OAUTH_CLIENT_ID/SECRET` 을 넣어도 화면은 ERP3 폼 그대로였을 것이다.

### 실측 — freepasserp5 계정으로는 「워크스페이스 멤버만」을 골라낼 수 없다

2026-09-27 서비스계정 읽기:

| 항목 | 값 |
|---|---|
| Firebase Auth 계정 | 185 — 전부 비밀번호, 구글 계정 0 |
| 이메일 도메인 | naver 105 · gmail 52 · nate 5 · `.test` 4 · oooo.ooo 2 · hanmail 2 · **teamjpk.com 2** · kakao 2 |
| Firestore `user` 문서 | 168 — agent 146 · provider 16 · admin 4 · agent_admin 1 · 역할없음 1 |
| `user` 문서 중 teamjpk.com 주소 | **0건** |
| 마지막 로그인 | 가장 최근 2026-09-10 (옮겨 놓은 사본) |

1. `role=admin` 4건(박영협 · 관리자 · 박태윤 · 프리패스)은 **이메일 칸이 비어 있다** — 워크스페이스와 대조할 값이 없다.
2. teamjpk.com Auth 계정 2개는 **둘 다 `emailVerified=false`** 다. Firebase 비밀번호 가입은 공개 웹키로 아무나 되므로,
   주소 끝만 보는 문은 남이 먼저 가입한 `아무개@teamjpk.com` 을 관리자로 들인다.
3. 나머지 183은 영업자·공급사다. 원장을 고치는 어드민에 들어오면 안 된다.

### 결정 — 정문은 Google Workspace 하나

- 워크스페이스 구성원 명단이 곧 직원 명단이고, 구글이 `hd=teamjpk.com` 으로 서명해 보낸다.
- 따로 만들 계정도, 맞춰 둘 명단도 없다. 퇴사로 워크스페이스 계정이 정지되면 어드민도 그 순간 닫힌다.
- 예외 인원 없음 — 대표 2026-09-27 확인.
- 185개 ERP5 계정은 그대로 둔다. SALES/화이트라벨의 문이고 어드민이 쓰지 않을 뿐이다.

### 코드에서 걷어낸 것

- `src/app/login/LoginForm.tsx` 삭제, `/login` 은 구글 문 하나만 띄운다. 설정이 없으면 **다른 문을 내주지 않고** 까닭만 적는다.
- `loginAction`(비밀번호 로그인 서버 액션) 삭제 — 폼을 지우는 것만으로는 서버 액션이 남는다.
- `src/server/auth.ts` 에서 `signIn` · `signOut` · `adminOf` · `erp4App` · `ADMIN_EMAILS` · `ADMIN_UIDS` 제거.
  `verifySession` 은 이제 `g1.` 구글 세션만 연다. identity 코드는 **어떤 데이터베이스도 건드리지 않는다.**
- `.env.example` 의 option B 블록 제거. `AUTH_PROJECT_ID` · `AUTH_FIREBASE_SERVICE_ACCOUNT_JSON` ·
  `FIREBASE_WEB_API_KEY` · `ADMIN_EMAILS` · `ADMIN_UIDS` 는 더 이상 읽지 않는다. 배포 환경에 남아 있으면 지운다.
- 회귀 방지: `freepass-data-boundary.test.ts` 가 auth.ts 의 firebase-admin import · `getFirestore` · `.collection(` ·
  위 환경변수 읽기를 전부 금지하고, `auth.test.ts` 가 erp4 세션 쿠키 꼴이 열리지 않는 것을 고정한다.

## 4-B. 계정·로그인 정본은 프리패스 데이터다 (2026-09-27 확정)

대표: 「프리패스 데이터에서 계정 통합해서 거기서 회원 데이터 관리하고 다 관리할 거거든」
    「프리패스 데이터에서 먼저 로그인 할수 있게끔 만들 거고 그거를 갖다 쓰던지 동일하게 하던지 할 거라고」
    「기존 만들던 거는 중복이면 폐기하고 이쪽에서 더 좋은 점이 있으면 그쪽에다가 합치고」

### 결정

- **계정·회원·승인의 정본은 프리패스 데이터**다. 어드민은 소비하는 쪽이다.
- 프리패스 데이터가 로그인을 먼저 세운다. 어드민은 그 뒤에 **갖다 쓰거나 같은 방식으로 맞춘다.**
- **어드민은 자기 계정 창고를 만들지 않는다.** 이 절이 그 금지의 근거다.

### 걷어낸 것 — 다시 만들지 마라

2026-09-27 이 세션에서 어드민 쪽에 `마스터 + 가입 승인`을 한 벌 구현했다가 **커밋 전에 폐기**했다.
스키마·scrypt 형식·마스터 판정·잠금 규칙이 프리패스 데이터 구현의 복제였다 — 두 번째 계정 창고였다.
폐기한 것: `src/server/accounts.ts` · `src/app/login/LoginCard.tsx` · `src/app/system/accounts/**` ·
`auth.ts`/`require-admin.ts`/`login/actions.ts` 의 `a1.` 세션 경로.

### 프리패스 데이터 구현 관측 (2026-09-27, 커밋 전 untracked)

`dashboard/api/_lib/{auth,store}.mjs` · `dashboard/api/[...path].mjs` · 컬렉션 `dashboard_accounts`.
이메일+비밀번호(scrypt N=16384) · HMAC 서명 세션 쿠키 `fpd_session` 12시간 · 8회 실패 15분 잠금 ·
`status` `PENDING`/`APPROVED`/`REJECTED` · 마스터는 `DASHBOARD_MASTER_ID` 이며 정의상 승인됨.

**그쪽이 더 나은 점 — 유지할 것.** `login` 은 없는 계정에도 `hashPassword` 를 한 번 돌려
응답 시간으로 계정 존재 여부가 새지 않게 한다.

**합칠 것 하나.** `register` 가 이미 있는 계정에 `409 ACCOUNT_EXISTS` 를 돌려준다
(`dashboard/api/[...path].mjs:99`). 로그인은 계정 열거를 막아 놨는데 **가입이 그 구멍을 연다** —
아이디를 넣어 보는 것만으로 누가 가입돼 있는지 훑을 수 있다. 가입도 로그인과 같은 답을 돌려줘야 한다.

### 어드민이 갖다 쓰려면 프리패스 데이터에 있어야 할 것

현재 그 코드는 자기 대시보드 페이지 전용이라 다른 앱이 쓸 문이 없다.

1. 다른 앱이 부를 인증·세션 검증 엔드포인트. 지금 세션 쿠키는 `SameSite=Strict` + 그 origin 전용이라
   어드민으로 넘어가지 않는다.
2. 계정 창고가 어느 Firestore 프로젝트인지 고정 — `DASHBOARD_FIREBASE_SERVICE_ACCOUNT_JSON` 만 있고
   `.env.example`·문서·Vercel 프로젝트가 모두 없다.
3. `consumer-gateway.ts` 의 capability와 `docs/DATA-DOMAIN-CATALOG.md` 에 신원 도메인 추가.
4. `docs/FIREBASE-ACCESS-MIGRATION-MAP.md` 의 「사용자 신원은 각 앱이 가진다」는 문장은 이 결정과
   반대다. 계정을 데이터가 통합하면 그 문장부터 고쳐야 한다.

### 그때까지 어드민의 상태

`/login` 은 구글 워크스페이스 문 하나로 서 있고, OAuth 클라이언트가 없어 **아직 아무도 로그인할 수 없다.**
이는 의도된 대기 상태다. 프리패스 데이터 로그인이 서면 그 방식에 맞춘다.
**그 전에 어드민에 임시 로그인을 만들지 않는다** — 임시로 낸 문은 안 닫힌다.

## 4-C. 공용 로그인 화면을 입혔다 (2026-09-27)

대표: 「로그인화면 갖고오자」

이 절은 위 4-A(구글 워크스페이스 단일 문)를 **대체한다.**

### 따른 정본

- 화면: freepass-data `dashboard/public/login/` → `src/app/login/shared/` 로 **고치지 않고** 옷긴 것.
  `SHARED-LOGIN-DESIGN.md` §3 — 「앱은 브랜드와 정책만 넘긴다. 화면을 고치지 않는다」
- 계약: freepass-data `docs/IDENTITY-AND-ACCESS.md`
- 순서: 두 문서 모두 §5 에서 **2번이 freepass-admin** 이며,
  「구글 OAuth 와 허용목록을 걷어내고 붙인다 · APPROVAL」 이다. 그대로 했다.

### 구조

```
비밀번호·재설정·세션취소  → Firebase Authentication
승인·역할·앱별 grant     → 프리패스 데이터 Firestore `identity_accounts`
```

- 이 앱은 비밀번호를 저장하지도, 자기 토큰을 만들지도, 자기 허용목록을 두지도 않는다(계약 §2).
- `APPROVED` 이어도 grant 에 `freepass-admin` 이 없으면 거부한다.
- 권한을 못 읽으면 «거부»다(fail-closed). 최대 5분만 들고 있는다(계약 §4).
- 세션은 **Firebase 가 발급하는 세션 쿠키**다 — 어드민은 서버가 쪽을 그리므로
  감사 대시보드처럼 요청마다 ID 토큰을 붙일 수 없다. 발급도 취소도 Firebase 쪽이라 §2 를 깨지 않는다.
  ★계약 §6 의 「앱 부류별 세션 길이」는 열려 있다. 5일은 어드민의 제안이며,
  감사 대시보드 이전이 운영에서 돌면 공용 계약에 맞춘다.

### 걷어낸 것

`src/server/google-login.ts` · `src/app/login/google/**` · 그 테스트 ·
`SESSION_SECRET` · `GOOGLE_OAUTH_CLIENT_ID/SECRET` · `GOOGLE_WORKSPACE_DOMAIN` 읽기.
`deploy:check` 는 이제 공용 신원 값을 요구하고, 위 폐기물이 환경에 남아 있으면 «지우라»고 경고한다.

### 쉽게 놓칠 것 하나 — 쪽의 문을 같이 세웠다

proxy 는 모든 요청 앞에서 돌기 때문에 firebase-admin 을 실지 않는다 — 쿠키 «꼴»만 본다.
그랬면 꼴만 맞춘 가짜 쿠키가 proxy 를 지나 **쪽까지 닿는다.** 서버 액션은 `requireAdmin` 이 막지만
쪽 자체는 막히지 않아, 운영에서라면 실데이터가 그려졌을 것이다.
그래서 `AdminChrome` 이 `authEnforced() && !나` 일 때 `/login` 으로 돌려보낸다 — 관리자 쪽은 전부 이 틀을 거친다.

### 런타임 검사에서 바뀜 것과, 빈 자리

- 예전에는 g1 꼴 쿠키를 직접 만들어 «로그인한» 길을 걸었다. 이제 세션은 Firebase 가 발급하므로
  우리가 만들 수 없다 — 만들 수 있으면 그게 사고다. 검사를 **«위조가 거부되는지»** 로 바꿨다.
- ⚠ **남은 구멍**: 로그인 뒤의 route error boundary·재시도 검사는 이제 돌지 않는다.
  되살리려면 Firebase Auth 에뮬레이터가 필요하며 별도 작업이다. 검사 영수증에도 `coverageGaps` 로 남긴다.
- 외부 요청 허용목록을 **비웠다** — 글꼴도 Firebase SDK 도 우리가 서비스한다(CDN 없음).

### 아직 안 된 것

로그인은 **아직 못 한다.** `IDENTITY_FIREBASE_*` 값이 없기 때문이고, 그 값은
계정이 어느 Firebase 프로젝트에 서느냐가 정해져야 나온다. 그것은 프리패스 데이터가 정한다
(계약 §5 — 감사 대시보드가 1번, 어드민이 2번).
설정이 없으면 로그인 화면은 **까닭만 적고 닫힌다** — 다른 문을 내주지 않는다.

## 4-D. grant 검사를 잠시 내려둔다 (2026-09-27) — 되돌릴 자리

대표: 「승인만 받으면 들어오게」

### 왜 내렸나

계약 §4 는 「`APPROVED` 여도 그 앱 grant 가 없으면 거절」이다. 그러나 프리패스 데이터의
`decisionRecord` 가 승인할 때 `grants` 를 `['audit-dashboard']` 로 **통째로 덮어쓴다**
(`store.mjs` 도 `.update()` 라 병합이 아니라 교체다).

그쪽 함수를 그대로 돌린 시뮬레이션(2026-09-27):

```
① 마스터 가입        grants=["audit-dashboard"]                    어드민=X
② 동료 승인        grants=["audit-dashboard"]                    어드민=X
③ 손으로 grant 추가  grants=["audit-dashboard","freepass-admin"]   어드민=O
④ 마스터 재승인      grants=["audit-dashboard"]                    어드민=X  ← 지워진다
```

`freepass-admin` 을 grants 에 넣는 코드가 어디에도 없고, 손으로 넣어도 다음 승인에 지워진다.
그 상태로 계약을 지키면 **대표를 포함해 아무도** 들어오지 못한다.

### 무엇을 받아들였나

이 문은 지금 「진짜 동료인가」까지만 묻는다.
**감사 대시보드만 쓰라고 승인한 사람도 미수·계약·정산을 다 본다.** 그 차이를 알고 받아들인 결정이다.

### 되돌릴 자리

`src/server/identity.ts` 의 `authorityOf` 한 줄 — `&& grants.includes(APP_GRANT)` 를 되살리면 끝난다.
조건은 프리패스 데이터가 grants 를 **앱별로 병합**하도록 고치는 것이다.

말없이 바뀌지 않게 두 곳이 고정한다.
- `freepass-data-boundary.test.ts` — 지금 상태(`status === 'APPROVED'` 만 본다)를 둥 다 검사한다.
  되돌리는 것도 여기를 같이 고쳐야 하므로 양방향 모두 의도적인 수정이 된다.
- `npm run identity:journey` — ④ 번이 바로 그 결정을 걷는다.

## 4-E. 로컬에서 돌리는 법 (2026-09-27 — 실제로 걸어본 순서)

로컬에서는 **두 가지를 동시에 가질 수 없다.** 신원과 업무자료가 같은 Firestore 를 쓰는데
`FIRESTORE_EMULATOR_HOST` 는 그 둘을 «같이» 에뮬레이터로 보낸다. 그래서 모드가 둘이다.

### ① 로그인까지 걸어보기

```bash
npm run local:setup          # .env.local 을 만든다
npm run local:emulators      # 창 하나
npm run dev                  # 창 둘
# http://localhost:3000/login → 「계정 만들기」로 가입
npm run local:approve -- <가입한 이메일>
# 같은 화면에서 로그인 → 들어간다
```

`local:approve` 가 대신하는 둘:
① 로컬에는 메일이 오지 않으므로 «메일 인증됨» 으로 바꿔 주고,
② 승인 화면은 프리패스 데이터 것이므로 `identity_accounts` 에 `APPROVED` 를 써 준다.
★에뮬레이터가 안 떠 있으면 아무것도 하지 않고 멈춘다 — 운영을 건드리지 않는다.

목록은 **0건이 맞다.** Firestore 도 에뮬레이터라 상품·접수가 없다.

### ② 실제 자료 보기

```bash
npm run local:setup -- --data --force
npm run dev
# http://localhost:3000/intake  — 로그인 없이 실제 freepasserp5 를 «읽기만» 한다
```

개발에서는 `ADMIN_AUTH` 가 꺼져 있어 로그인을 건너뛴다(배포에서는 늘 켜져 있고 끔 수 없다).
실측(2026-09-27): 상품 686 · 접수·정산원장 471 · 환수 23 · 전자계약 74.

### 이 순서는 말로 적은 것이 아니다

2026-09-27 에 브라우저로 끝까지 걸었다 — 공용 화면이 뜨고, `basic` 구성으로 가입되고,
「인증 메일을 보냈습니다」 가 나오고, 승인 뒤 로그인하면 `/intake` 3열 화면으로 들어간다.

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
