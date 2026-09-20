# FreePass Admin Core Readiness P5 — 2026-09-20

Status: `MACHINE CHECK ADDED / CI RUNNER EXTERNAL HOLD`

## 목적

Admin 핵심 수직흐름이 다시 데모·레거시 의존성으로 퇴행하지 않게 정적 readiness contract를 둔다.

검사 명령:

```bash
npm run admin:readiness
```

## 검사 대상

### 실제 진입점

- `/`는 `/products`로 이동
- 과거 하드코딩 `PRODUCTS` 데모가 루트에 없어야 함

### 서버 페이지 인증

아래 페이지는 모두 operational data를 읽기 전에 `requireAdminPageActor()`를 호출해야 한다.

- `/products`
- `/intake`
- `/intake/new`
- `/settlement`

### Actor 권한

- Runtime ActorProvider는 session 기반
- ERP4/freepasserp3 Auth fallback 금지
- production Auth 미지정은 UNBOUND
- Admin 권한은 UID 기준
- email-only 관리자 권한 금지

### ERP5 persistence

- 정확한 project_id = `freepasserp5`
- Admin write namespace 필수
- `ERP5_WRITE=on` 명시 전 mutation 금지
- Product repository는 read-only
- Application sequence/create는 transaction
- Performance/Settlement 생성도 transaction

### Environment contract

다음 값의 존재를 `.env.example`에서 확인한다.

- `FPA_REPOSITORY_MODE=erp5`
- `ERP5_ADMIN_NAMESPACE`
- `ERP5_WRITE=on`
- `FPA_AUTH_MODE=firebase`
- `FPA_AUTH_PROJECT_ID`
- `FPA_ADMIN_UIDS`

## CI

`.github/workflows/backend-check.yml` 순서:

1. npm ci
2. typecheck
3. test
4. admin:readiness
5. build

현재 GitHub Actions는 최근 job이 step 0으로 끝나는 runner-entry 장애가 반복되고 있다.

따라서 checker가 CI workflow에 연결되었다는 사실과 실제 GitHub Actions PASS는 구분한다.

Runner가 실제 step을 실행하기 전까지 CI VERIFIED로 승격하지 않는다.

## 현재 핵심업무 체인

- P0: Domain — 상품검색 / 접수 / 실적 / 정산
- P1: 실제 상품찾기 / 접수 Repository 연결
- P2: Performance / Settlement / Billing / Ledger
- P3: ERP5 Firestore Adapter
- P4: Admin Auth / Actor
- P5: Machine Readiness Gate

전자계약은 이 핵심 체인 이후 독립 후순위로 유지한다.
