# FreePass Admin Auth / Actor P4 — 2026-09-20

Status: `AUTH ADAPTER IMPLEMENTED / PRODUCTION CONFIG REQUIRED / NO DEPLOYMENT CLAIM`

## 목적

상품조회·접수·실적·정산 화면과 mutation을 실제 관리자 세션에 묶는다.

Persistence 연결과 Auth 연결은 서로 다른 권한 경계다.

ERP5 Firestore가 연결되었다고 사용자가 관리자가 되는 것이 아니다.

## 금지한 것

- ERP4/freepasserp3 로그인 재사용
- legacy Firebase credential fallback
- 이메일 주소만으로 관리자 승격
- request body/header/localStorage의 actor id 신뢰
- production dev-admin fallback
- Auth 미설정 상태에서 production 접근 허용

## Auth project

production은 반드시 별도 값을 명시한다.

```
FPA_AUTH_MODE=firebase
FPA_AUTH_PROJECT_ID=<auth project id>
FPA_AUTH_WEB_API_KEY=<web api key>
FPA_AUTH_SERVICE_ACCOUNT_JSON=...
FPA_ADMIN_UIDS=<uid-1,uid-2>
```

Service Account의 project_id는 `FPA_AUTH_PROJECT_ID`와 정확히 같아야 한다.

프로젝트 이름을 코드가 추측하지 않는다.

## 관리자 권한

초기 P4 권한 정본:

`FPA_ADMIN_UIDS`

- 검증된 Firebase session의 uid가 allowlist에 있어야 ADMIN
- 이메일은 권한 근거가 아님
- UID allowlist가 비어 있으면 fail-closed

추후 Staff SSOT가 승인되면 ActorProvider 뒤 구현만 교체한다.

## 로그인

브라우저에 Firebase Admin credential은 노출하지 않는다.

1. 로그인 화면이 CSRF nonce를 받음
2. email/password를 same-origin session endpoint로 전송
3. 서버가 Firebase Identity Toolkit sign-in
4. Admin SDK로 ID token 재검증
5. auth_time 5분 이내 확인
6. UID allowlist 확인
7. 12시간 HttpOnly/SameSite=Strict session cookie 발급

오류 응답은 계정 존재 여부/권한 상세를 구분해 노출하지 않는다.

## 요청 Actor

모든 write Service는 기존 `ActorProvider`를 계속 사용한다.

P4 이후 production ActorProvider:

`verified session cookie → Firebase uid → UID allowlist → { id: uid, type: ADMIN }`

클라이언트가 actorId를 선택할 수 없다.

## 화면 보호

다음 서버 페이지는 데이터 조회 전에 관리자 Actor를 요구한다.

- `/products`
- `/intake`
- `/intake/new`
- `/settlement`

세션이 없거나 무효면 `/login`으로 이동한다.

Server Action도 같은 ActorProvider를 사용하므로 직접 action endpoint를 호출해도 인증을 우회할 수 없다.

## 루트 진입

과거 하드코딩 demo였던 `/`는 제거하고 `/products`로 redirect한다.

따라서 Admin 기본 동선은:

`상품찾기 → 접수 → 실적/정산`

이다.

## 개발 모드

development 기본은 dev actor다.

- local 기능검증 편의용
- production에서는 절대 선택되지 않음
- production에서 FPA_AUTH_MODE 미지정 = UNBOUND / fail-closed

## 남은 production gate

코드 구현과 production 활성화는 다르다.

아직 필요한 외부 설정:

- 실제 독립 Auth project 확정
- Web API key
- Service Account
- 승인된 Admin UID
- HTTPS 배포 환경
- 실제 로그인/세션 smoke

이 증거 전에는 production auth VERIFIED로 올리지 않는다.
