## 0-INTAKE-CONTROLS. 2026-09-30 — 입력창/드롭다운 규격

- 목적: 사용자 승인에 따라 기존 3패널의 접수 폼을 입력창과 native select 중심으로 통일.
- 대상 revision: main `711ce0d`; work `work/freepass-admin/intake-controls-20260930`, 단일 Codex writer.
- 변경: BoardIntakeForm 상품구분·채널·담당자 select, 누락된 필수 분납여부와 기존 저장 계약의 메모 노출. 직접접수 채널·담당자도 동일 문법. 기존 데이터/코드 매핑·기본값·수기 fallback·Offer snapshot·수수료는 유지.
- 남음: 연락처/연령 변경/주행거리 변경은 별도 Intake 저장 계약이 없으므로 가짜 필드를 만들지 않음. 운영 배포·실데이터 쓰기는 이번 범위 밖.
- 검증: academy READY, typecheck/ui:check/build PASS, 관련 단위 검사 102건 PASS. 실제 읽기 전용 demo route에서 1440/1280/390/360/412 가로 overflow 없음, 입력/select PC 32px·mobile 44px, 담당→채널 자동 연결 및 payKind 빈값 required 검사 확인. 브라우저 error log 0. 전체 npm test는 전자계약 PDF의 Windows Chromium ENOENT로 FAIL. agent-browser 실행은 Windows 앱 제어 정책으로 차단돼 내장 브라우저로 확인했고 보호정책은 변경하지 않음. Claude 읽기 전용 검토는 장시간 응답 미수신으로 해당 호출을 종료(REVIEW_TIMEOUT); 독립 검토 PASS 아님. main 통합은 검토 및 전체 검사 gate 해결 뒤 진행.
- next_start_here: 이 worktree의 변경 검증 및 main 통합. 새 접수 옵션의 persistence는 별도 계약 검토 후 구현.

## 0-LOGIN-REPAIR. 2026-09-30 — 운영 로그인 복구 검증 / 데이터 요청 토큰 후속

- 목적: 운영 로그인 복구, `freepass admin` 앱 이름 복원, 설정 누락 재배포 차단.
- 기준 revision: `932dd42f71d5a33b8794f9523cecff11702eefa1`; work branch `work/freepass-admin/login-repair-20260930`.
- 운영 관측: 브라우저 비밀번호 인증 이후 `/api/session` 401. Production deployment와 프로젝트 설정 모두 신원 전용 서버 자격증명이 빠져 있음. 사용자 비밀번호/토큰은 기록하지 않음.
- 변경: 로그인·내부 내비게이션 앱 이름, 신원 설정 누락 503 안내, Production build preflight, 기존 인증 emulator CI 여정 연결, 회귀 검사.
- 검증: 관련 검사 64건, typecheck, UI SSOT, build PASS. 로컬 actual `/login` 렌더와 브라우저 오류 0 확인. 전체 테스트의 Windows Chromium 환경 실패는 별도이며 운영 복구 PASS로 간주하지 않음.
- 후속: 승인된 전용 계정/최소 역할은 생성됨. 장기 키 생성·저장은 도구 정책이 실행 전 차단했고 사용자 관리 키 0개를 확인했다. 사용자 연결 해결 요청에 따라 기존 identity 모듈·Google auth library·Vercel OIDC 방식을 확장해 키 없는 인증을 검증 중이다. 장기 키 명령은 재시도하지 않는다.
- 운영 확인: PR #159, main `de927a0`, deployment `dpl_FttBD45MQDjdA6PCsrv8uzRKrsWP`. Production preflight PASS, 전용 WIF provider/단일 production principal/4개 권한/환경값 readback, 사용자 관리 키 0개. 승인 계정 실제 로그인 → `/intake` 진입 → 새로고침 후 인증 유지 확인. `freepass admin` 이름 복원 확인. 비밀번호/토큰/고객원문 기록 없음.
- 독립 검토: Claude는 Firebase Auth custom Credential + 제한된 승인문서 REST GET 설계에 동의했으며 최종 `e79a833` delta에 blocking security issue 없음. 정책 분리·운영 키 금지·REST 경로 검사를 반영했다. Linux operational run `36648175976`의 code/browser/persistence 전부 PASS.
- 후속 발견: 로그인 뒤 기존 업무데이터 호출에서 `FREEPASS_DATA_GCP_OIDC_CONFIG_INCOMPLETE`. `cloud-run-auth.ts`가 `process.env.VERCEL_OIDC_TOKEN`만 읽고 있었음. 공식 `getVercelOidcToken()`으로 요청 컨텍스트의 최신 토큰을 읽도록 기존 전송만 수정한다. 업무계정/IAM/쓰기 승인/데이터 모드는 바꾸지 않는다.
- next_start_here: 데이터 요청 토큰 후속 배포 후 기존 `/intake` 화면을 읽기 전용 확인하고 실제 3단 화면을 캡처한다. 로그인 복구와 상품 데이터 렌더 검증을 합쳐 완료로 표현하지 않는다.

---

## 0-CATALOG-PARITY. 2026-09-29 — 운영 읽기 전용 parity 증거 경로

- Catalog serving mode는 계속 `OBSERVE`이며 사용자 상품 결과를 바꾸지 않는다.
- `/system/data-status`가 운영 서버의 기존 비밀 경계를 이용해 compatibility Catalog와 FreePass Data
  ACTIVE Admin Catalog를 같은 intake-critical comparator로 읽기 전용 비교한다.
- 비교 실행은 60초 공유 캐시와 8초 제한을 사용한다. 원문 transport 오류나 비밀값은 화면에 표시하지 않는다.
- `READY / HOLD / NOT_CONFIGURED`와 `MATCH / MISMATCH`를 분리해 상태와 데이터 차이를 섞지 않는다.
- CODED / STATIC CHECKED / TESTED. Production parity 결과와 Catalog stage 전환 승인은 아직 별도다.

next_start_here: main 배포 후 로그인된 `/system/data-status`에서 Release identity, 양쪽 행 수,
누락/추가/변경 수와 policy/commercial coverage를 재조회한다. `MATCH`만으로 cutover하지 않는다.

---

## 0-LIVE-INTAKE. 2026-09-29 — 운영 접수 쓰기 개통

`0-PREDEPLOY`의 쓰기 OFF 상태를 현재 운영 상태로 사용하지 않는다. 사용자 승인 후 FreePass Admin의
접수 저장 경계를 FreePass Data Admin 전용 런타임으로 개통했다.

- 운영 Admin: `https://freepass-admin.vercel.app`
- Admin 업무데이터 경로: Vercel OIDC → private `freepass-data-admin` Cloud Run → FreePass Data
  Admin workflow transaction → `freepasserp5` Firestore
- Admin 운영 런타임의 `ERP5_FIREBASE_SERVICE_ACCOUNT_JSON`은 제거했다. Admin이 업무데이터 Firebase
  자격증명을 직접 소유하거나 RTDB fallback을 사용하지 않는다.
- 운영 write gate: Admin의 `ERP5_WRITE=on`, `FREEPASS_DATA_ADMIN_WORKFLOW_WRITE=on`과 Data Admin
  runtime의 `FREEPASS_DATA_ADMIN_WORKFLOW_WRITE=on`을 모두 확인했다. 비밀값은 문서에 기록하지 않는다.
- 개통 전 `settlement_*`, partner, contract 관련 10개 컬렉션 889건을 비공개 GCS로 export하고 별도 임시
  Firestore DB에 복원했다. 원본/복원 컬렉션별 건수가 모두 일치했고 임시 DB는 검증 후 삭제했다.
- 비고객 접수 `stl_4qw4uanayc`를 실제 경계로 생성했다. 같은 요청 재시도는 `created=false`로 중복 없이
  같은 접수를 반환했고, 검증 직후 취소 처리 및 감사이력 재조회까지 확인했다.
- FreePass Admin production deployment: `dpl_D3qMSdWhoUjgpZDDSFcaAeMB2MCq` (`READY`).
- FreePass Data Admin deploy 재시도 안전성은 FreePass Data PR #240 / merge
  `26991b8f44e966592dd7b118bc6c89bd47ce2df0`에 반영했다.

현재 구분:
- `CODED / TESTED / PERSISTENCE VERIFIED / DEPLOYMENT VERIFIED`: 완료
- 실제 고객 접수: 운영자가 로그인 후 수행. 개통 검증에서 실제 고객정보는 생성하지 않음
- Catalog semantic cutover는 계속 `OBSERVE`; 이것은 Admin workflow read/write 개통과 별도 상태
- 전자계약은 계속 `ESIGN_ENABLED=off`

next_start_here: Claude/Codex는 반드시 current main 또는 이 문서가 포함된 최신 clean worktree를 root로
지정한다. `C:\dev\freepass-admin`의 오래된 checkout 상태나 `0-PREDEPLOY`만 보고 쓰기 OFF로 판정하지 않는다.

---

## 0-F04-INTAKE. 2026-09-26 — 접수 → 실적 → 정산 운영 보강

사용자 최신 결정과 실제 [F04 사용중] 프리패스 정산원장 / 프리패스 당월 계약접수를 대조해 접수 흐름을 보강한다.

- 상품/Offer/기간 선택 후 접수 핵심 입력: 영업채널 · 영업담당 · 고객명 · **분납여부**
- 분납여부는 필수이며 접수 기본 영역에 노출
- 접수 상세에서 계약서 · 인도 · 인도일 · 분납여부 · 계산 청구월 · 다음회차일 · 납입회차를 한 눈에 확인
- F04 매뉴얼과 동일하게 인도완료 즉시 접수에서 빠짐
  - 일시납 → 완납실적
  - 분납 → 분납실적
- 청구월 계산은 기존 `stage.ts` 하나만 사용하고 Sheet 계산을 두 번째 정본으로 만들지 않음
- F04 실사용 분납값: 일시납 / 2회분납 / 3회분납 중심, 과거 값은 조회 호환
- PR #125에서 코드/회귀테스트/Firestore/Next runtime 검증 후 main 병합

정본 결정: `DEC-2026-09-26-02`

---

## 0-PREDEPLOY. 2026-09-26 — 배포 직전 동결(종료된 이력)

> 이 절의 Vercel 미생성·쓰기 OFF·다음 단계는 당시 기록이며 실행 지시가 아니다.
> 현재 운영 상태와 다음 시작점은 위 `0-LIVE-INTAKE` 및 `registry/active-work.json`을 따른다.

- PR #121 UI 정본 main 반영 완료
- PR #122 운영 확정분 main 반영 완료
- PR #120 운영개시 준비 main 반영 완료
- 코드/테스트/build/Firestore·Storage emulator/Next runtime/actual-route Visual QA PASS
- 현재 개발 ACTIVE branch 없음; main만 배포 후보
- 전자계약은 launch scope 밖: `ESIGN_ENABLED=off`
- 첫 배포 당시 `ERP5_WRITE=off`, Catalog `OBSERVE`였음 — 현재 쓰기 상태는 상단 `0-LIVE-INTAKE`로 대체됨
- 연결된 Vercel team `freepass-projects`의 project count는 0으로 관측됨
- 다음 단계는 Vercel 프로젝트 생성·GitHub 연결·production env/OAuth/service account/IAM 바인딩 후 live smoke
- 첫 배포 시도 전 일반 고도화 금지. 배포 차단 결함만 current main에서 short-lived fix branch로 처리

---

# WORK-INBOX — Chat R&D → Work 개발 반영용

최종 갱신: 2026-09-29
프로젝트: freepass-admin (구 freepasserp.com 저장소)
목적: ChatGPT 채팅에서 사용자와 확정한 R&D 내용을 Work가 자동 추측하지 않고, GitHub에서 한 곳만 읽고 개발에 반영하도록 만드는 공용 인수인계 문서.

> Work 작업 시작 전 반드시 이 문서와 `AGENTS.md`, `docs/MASTER-v1.md`를 읽는다. 이 문서는 대화 전체를 복사하는 곳이 아니라 **현재 개발에 영향을 주는 최신 결정·시뮬레이션·HOLD·다음 작업**만 요약한다.



## 0-AAAAA. 2026-09-26 당시 ACTIVE 브랜치 — 종료된 이력

> 이 절은 2026-09-26 당시 기록이다. 현재 ACTIVE 작업선은
> `docs/BRANCH-WORKFLOW.md`와 `registry/active-work.json`만 따른다. 아래 두 브랜치를 재개하지 않는다.

브랜치는 더 이상 Function/UIUX/E-sign 고정 lane으로 재사용하지 않는다. 브랜치는 현재 변경을 격리하는 임시 작업 공간이며, 완료 후 main merge + 폐기한다.

당시 ACTIVE branch(현재 종료):
- `work/ui/finalize-baseline` — UI/UX 최종 확정
- `work/release/operational-launch` — 운영 개시

과거 branch:
- `work/function` — ARCHIVE / 신규 개발 금지
- `work/esign` — ARCHIVE / 신규 개발 금지
- `work/uiux` — REFERENCE-ONLY UI donor / 신규 개발 금지

AI 인계:
- 새 AI가 와도 새 branch를 만들지 않는다.
- 해당 ACTIVE branch HEAD와 branch-local work order를 읽고 같은 branch에서 이어간다.
- 한 시점에 writer는 branch당 1명.
- 새 병렬 작업이 실제로 필요할 때만 최신 main에서 새 임시 branch를 만들며, 먼저 `docs/BRANCH-WORKFLOW.md`와 `registry/active-work.json`을 갱신한다.

현재 merge 순서:
1. UI/UX 최종화 → Visual QA → 사용자 승인 → main
2. 운영개시 branch에 최신 main(UI 최종본 포함) 반영
3. production auth / FreePass Data read-write / smoke / rollback 검증
4. 운영 개시 → main

정본: `docs/BRANCH-WORKFLOW.md`
machine registry: `registry/active-work.json`

---

## 0-AAAA. 2026-09-26 기능 단일축 + 취소/해지 최신 확정

기능 작업은 이제 docs/FUNCTION-AUTHORITY.md와 current main 한 축만 사용한다.

### 기능 정본
- 코드 정본: main
- 접수 정본: Intake / settlement_rows / src/domain/settlement/**
- 데이터 진입점: src/server/freepass-data.ts
- 과거 src/domain/application/** + src/services/applications.ts + file/json Application Repository는 **LEGACY_QUARANTINED**
- 과거 기능 브랜치는 통째로 merge하지 않는다. current main에 없는 의미/테스트만 선별 이식한다.
- PR/작업 브랜치는 merge 전 staging/evidence이며 정본이 아니다.

### 취소 / 해지 — 이 기준이 아래 0-A의 인도 전 취소 설명을 덮어쓴다

```text
계약금 수납 전
  → 접수취소

계약금 수납 후 + 인도 전
  → 계약취소

인도 후
  → 계약해지
  → 환수 검토
```

- 판정 기준은 전자계약 서명 여부가 아니라 **계약금 실제 수납 사실**이다.
- 계약금과 상품의 차량 보증금(deposit)은 완전히 다른 사실이다.
- 보증금 값으로 계약금 수납 여부를 추론하지 않는다.
- 계약금 수납은 금액/일시/operation 또는 receipt 식별자를 가진 별도 업무 사실로 보존한다.
- 계약해지는 기존 실적·청구·수금·지급을 되돌리지 않고 환수 검토만 연다.

상세 기능 권위: docs/FUNCTION-AUTHORITY.md
결정 기록: docs/DECISIONS.md의 DEC-2026-09-26-01

---

## 0-AAA. 2026-09-25 Product/Offer → Intake sealed snapshot — 최신 확정

상품찾기에서 선택한 `Product + matched Offer`는 접수 저장 시 FreePass Data에서 **fresh read**한 뒤 sealed snapshot으로 고정한다.

새 상품접수 저장 규칙:
- 브라우저 hidden 값의 가격/보증금/기간을 정본으로 믿지 않는다.
- `sourceProductId + productVersion + sourceSnapshotId + sourceOfferId`를 FreePass Data fresh read와 대조한다.
- 선택 Offer의 기간/대여료/보증금/선납/연약정주행을 snapshot에 고정한다.
- Product 정책 원본과 Offer 정책 원본을 **두 겹 그대로** 보존한다.
- 당시 실제 적용된 resolved policy도 별도로 보존한다.
- 차량 identity/spec/등록정보/차량가/상품상태도 계약상품 사본에 보존한다.
- `capturedAt`을 제외한 사본에 deterministic SHA-256 `catalogSnapshotDigest`를 계산한다.
- 같은 상품·같은 날의 재시도는 Product/version/Offer/source snapshot/digest가 모두 같을 때만 idempotent 성공이다.
- 하나라도 다르면 기존 접수를 조용히 재사용하지 않고 conflict로 막는다.
- sealed snapshot 없는 상품접수는 Repository 경계에서 저장을 거부한다.

Firestore Emulator 증거:
- 동일 sealed Product/Offer 재시도 → 실제 접수 1건만 생성
- 같은 Product/날짜 + 다른 Offer → conflict, 기존 접수 유지
- sealed snapshot 없는 상품접수 → write 전 거부

---

## 0-AA. 2026-09-25 FreePass Data 읽기/쓰기 경계 — 최신 확정

사용자 최신 확정:

> Admin은 Firebase를 직접 소비하지 않는다. 상품을 포함한 모든 운영 데이터는 **FreePass Data를 통해 가져오고, FreePass Data를 통해 쓴다.**

정확한 구조:

```text
FreePass Admin
  ├─ 상품찾기
  ├─ 접수
  ├─ 실적
  ├─ 계약 사실
  ├─ 청구/수금
  ├─ 지급
  └─ 환수
        ↓
FreePass Data Gateway
        ↓
Repository / Adapter
        ↓
Firestore (project id: freepasserp5)
```

- `freepasserp5`는 Firebase 기술 project id다.
- 사람이 보는/설계에서 부르는 공식 데이터 계층은 **FreePass Data**다.
- Admin은 업무 규칙과 workflow 의미를 소유한다. 그러나 별도의 DB/원장/캐시 정본을 만들지 않는다.
- Product/Offer/Policy뿐 아니라 Intake/Performance/Contract fact/Settlement/Claim/Collection/Pay/Clawback도 FreePass Data persistence를 사용한다.
- 화면·Server Action·Service에서 Firebase Admin SDK 또는 `adapters/erp5/*` 직접 접근 금지.
- 정본 조립점은 `src/server/freepass-data.ts`.
- `src/server/erp5.ts`는 deprecated compatibility alias다.
- RTDB는 금지.
- CI `freepass-data-boundary.test.ts`가 App/Server/Service 우회를 차단한다.
- 상품 기반 접수는 저장 직전 FreePass Data fresh read로 Product/Offer version/snapshot drift를 확인한다.

아래 과거 문서의 “FreePass Data는 Product/Offer/Policy만 공급하고 Admin workflow/ledger는 별도 persistence”라는 표현과 충돌하면 **이 절이 우선**한다.  
업무 의미 소유권과 persistence 소유권을 구분한다: **Admin이 workflow 의미를 소유하고, FreePass Data가 authoritative persistence gateway를 소유한다.**

---

## 0-A. 2026-09-25 기능 기준 재정렬 — 이 절이 계약 중심 해석보다 우선

사용자 최신 확정:

```text
화이트라벨 상품찾기
        ≒
Admin 상품찾기
(같은 상품검색 기능 계약)
        ↓
접수
        ↓
실적
   ↙          ↘
공급사 청구/수금   영업채널 지급
        ↘      ↙
          정산

인도 전 종료 = 접수취소
인도 후 계약해지 = 환수 검토대상
```

### 상품찾기
- White Label은 Admin의 상품찾기 기능을 외부 고객면으로 꺼내 보여 주는 관계로 본다.
- 따라서 **검색 의미, 필터 의미, Offer 선택, 같은-Offer 가격 조건, 결과 정렬의 핵심 기능은 가능한 한 같은 계약을 사용**한다.
- Admin이 추가로 가질 수 있는 것은 공급사·출고상태·내부 진단처럼 **내부 전용 축/표시**다. 공통 고객 상품조건의 의미를 별도 구현으로 갈라 새 규칙을 만들지 않는다.
- 현재 코드 대조에서 공통 원칙(축 내 OR/축 간 AND, 동일 Offer 가격조건, URL 상태, 교차 facet count)은 대체로 일치한다.
- 현재 드리프트: Admin의 `mile`은 Offer 약정주행(`annualMileageKm`)인데 White Label의 `mile`은 차량 현재 주행거리다. 이름만 같고 의미가 다르므로 공통화 전에 분리/정리한다.
- White Label에 있고 Admin에 빠진 고객 검색축(차종 대분류, 제조사, 심사, 연식 등)과 정렬 기능은 parity 검증 대상으로 둔다.
- 상세 대조 증거: `docs/reviews/PRODUCT-FINDER-PARITY-2026-09-25.md`.

### Admin 운영 핵심
- Admin의 운영 본체는 **접수 → 실적화 → 공급사 청구/수금 + 영업채널 지급**이다.
- 계약은 이 흐름의 증빙/사실이지 별도 운영 중심축이 아니다.
- 정산 원장은 공급사 청구축과 영업채널 지급축을 분리 유지한다.

### 취소 / 해지 / 환수
- **접수취소:** 인도 전 접수가 끝난 사실. 전자계약 연결 여부가 별도의 업무상 “계약취소” 흐름을 만들지 않는다.
- 전자계약 링크 철회·세션 정리·서명 증거 보존은 e-sign 기술 계층의 후처리이며 접수취소의 업무 의미를 바꾸지 않는다.
- **계약해지:** 인도 후 종료 사실. 기존 청구/지급/수금 이력은 보존하며 **환수 검토대상**이 된다.
- 해지했다고 환수금액을 자동 생성하지 않는다. 공급사/계약별 조건이 다르므로 관리자가 실제 환수 여부·금액·사유를 확정해 `settlement_clawbacks`에 별도 음수 라인으로 기록한다.
- 이미 청구·지급한 과거 월을 해지 때문에 재작성하지 않는다. 환수는 환수 발생월에 반영한다.

이 절의 기능 의미가 아래 과거 “계약취소/계약해지 독립 lifecycle” 해석과 충돌하면 **이 절을 따른다**.

---

## 0. 2026-09-22 최신 Chat → Work 인계 — 반드시 먼저 반영

이 절이 이 문서 안의 오래된 9/16~9/19 상태보다 우선한다. 상세 근거는 `docs/HANDOFF.md`의 **2026-09-22 AI Core 재감사 — 상품 → 접수 → 계약 → 정산** 절을 본다.

현재 판정:
- FreePass Admin 공식 범위는 **상품 찾기 → 접수 → 계약 → 정산**까지다.
- 접수/정산은 ERP5 live repository 기준으로 90점대 수준까지 올라왔다.
- 과거의 "Settlement 상당 부분 Mockup" 판정은 current main 기준으로 폐기한다.
- 전자계약은 ERP5 `contract / esign_session / esign_private / esign_event / Storage`에 연결되어 **고객 제출 → pending_review**까지 올라왔다.

다음 Codex/Work P0는 정확히 두 개다.

1. **Intake/Application → Contract handoff 고정**
   - 접수 당시 Product/Offer/Policy Snapshot을 계약 생성의 원천으로 사용
   - `application_id/intake_id`, `source_product_id`, `source_offer_id`, snapshot revision/digest, immutable contract snapshot 보존
   - 동일 사실 재입력 최소화
   - revision/source mismatch fail-closed
   - idempotent contract create

2. **Esign finalization 완성**
   - `pending_review → admin approve/finalize → signed`
   - 승인된 immutable snapshot으로 최종 PDF 생성
   - Storage path + SHA-256 + template/agreement version 보존
   - Contract/EsignSession 최종 상태와 audit/receipt 연결
   - 중복 승인/PDF 생성 방지
   - signed 후 일반 edit/revoke 차단

그 다음:
- handoff/finalization concurrency·idempotency·recovery tests
- Offer 선택 → Intake → Contract → Esign → signed/PDF → Settlement 전체 journey integration test
- Data Status에 contract/esign finalization readiness 추가

**주의(2026-09-25 superseded):** Admin은 Intake/Contract/Settlement의 **업무 의미와 workflow 규칙**을 소유하지만, 해당 사실의 조회/영속화는 FreePass Data gateway를 통한다. 별도의 Admin persistence/두 번째 원장을 만들지 않는다.

관련 최신 커밋:
- Admin audit handoff: `45a90b18b3609dbb54f50dd3080aaa025baf6a3f`
- Esign ERP5 runtime baseline: `da5bf6fc552706bfbc6338f5fad85fbe61b29d5e`

---

## 1. 사업 구조 — 가장 먼저 이해할 것

freepass-admin은 단순 상품목록 ERP가 아니다.

```text
공급사 상품 RAW
 → Adapter / Mapping / Validation
 → Canonical Product SSOT
 → 영업자에게 판매 가능한 상품 제공
 → 고객 접수
 → 계약서 / 필수서류 / 잔금 / 인도
 → 실적 생성
 → 영업자 실적 1차 확인
 → 공급사 Cross Check
 → 필요 시 영업자 재확인
 → 최종 정산 확정
 → 공급사 청구 / 계산서
 → 수금
 → 영업채널 지급
 → FreePass Margin
```

핵심 수익구조:
- 공급사로부터 받을 돈
- 영업채널에 줄 돈
- 그 차액 = FreePass 마진

`청구확정`, `계산서`, `수금`, `지급`은 서로 다른 상태다. 하나의 완료값으로 합치지 않는다.

---

## 2. 현재 첫 개발 P0

전체 사업 중 첫 번째 실제 완성 목표는 ADMIN 수직 흐름이다.

```text
Canonical Product
 → Search / Filter
 → Product Detail
 → matched Offer
 → 신규접수
 → Application Snapshot
 → 접수목록
 → 접수상세
 → 계약서 / 필수서류 / 잔금 / 인도 / 취소
```

SALES / WHITE LABEL / 정산 전체 구현을 이 흐름보다 먼저 벌리지 않는다.

---

## 3. ADMIN UI/UX 핵심

Desktop 기본:

```text
상품목록 1/3 | 상품상세 1/3 | 업무패널 1/3
```

역할:
- 목록 = 찾기
- 상세 = 확인
- 업무패널 = 실행

상품 상세에서 `이 상품으로 접수하기`를 누르면 LEFT/CENTER는 유지하고 RIGHT만 신규접수로 전환한다.

접수 중 다른 상품을 목록에서 구경해도 Draft의 접수 대상 상품은 자동 변경되면 안 된다. 접수상품 변경은 명시적 동작이어야 한다.

모바일은 desktop 3열 압축이 아니라 `LIST → DETAIL → WORK` 독립 화면 흐름으로 간다.

UI 시각 구현은 사용자 승인 이미지 revision을 기준으로 한다. 이미지 승인 전 신규 시각 변경을 완료라고 보고하지 않는다.

---

## 4. ERP4 원자 기반 최소 노출 원칙

ERP4 실제 atom 구조에서 확인한 철학을 참고한다. 기존 ERP4 DB/코드/Firebase를 v1 운영 의존성으로 연결하지 않는다.

원자 분류:
- 모델/차 정체
- 제원
- 등록/실차
- 변동값(상태, 주행, 가격 등)
- Offer
- Policy
- 메타/원문/검수정보

화면 원칙:
- 목록에는 찾는 데 필요한 최소 원자만 노출
- 상세에서 확인용 원자 확장
- 원문/source row/내부 메타/검수 근거는 ADMIN 진단 영역으로 제한
- 데이터에 존재한다는 이유만으로 화면에 전부 표시하지 않음
- 부분 차종 매칭을 완성된 트림처럼 꾸미지 않음
- `미확인 ≠ 0 / 불가 / 무제한`

관련 설계 PR: #4

---

## 5. Search Contract — P0

현재 main의 문자열 검색은 Prototype이다. 실제 검색 완료로 간주하지 않는다.

필수 규칙:
- 같은 축 복수값 기본 OR
- 다른 축 기본 AND
- 모델 / 세부모델 / 트림 EXACT-PARTIAL 구분
- 다른 세부모델로 확정된 상품을 PARTIAL에 섞지 않음
- 기간/월대여료/보증금/약정주행거리/Offer-scope Policy는 **같은 Offer 하나**에서 동시에 만족해야 함
- 서로 다른 Offer를 섞어 가짜 조건 생성 금지
- 검색에서 일치한 `offer_id`를 카드 → 상세 → 접수까지 유지
- 보증금 공란은 0원/무보증 검색에 포함 금지

기능 시뮬레이션: PR #4의 `docs/qa/admin-functional-simulation-v1.md`

---

## 6. 접수 Contract — 현재 R&D 결정

현재 설계상 초기 접수 핵심 필드:
- 차량 / 선택 Offer
- 영업채널
- 담당자
- 고객명

연락처 필수 여부 등 아직 확정되지 않은 값은 `DECISION REQUIRED`로 둔다.

접수 저장 시 Snapshot:
- product_id
- explicit product_version 필요
- selected offer_id + 당시 Offer 조건
- 적용 Policy
- vehicle match level
- supplier/source context 필요한 범위
- captured_at

현재 상품 변경이 과거 접수를 변경하면 안 된다.

서버 측 중복 저장 방지(idempotency/submission id) 계약이 필요하다. 버튼 disabled만으로 완료 처리하지 않는다.

접수 상태/사실:
- RECEIVED
- CONTRACTED
- DELIVERED
- CANCELLED
- 별도 체크: 계약서 / 필수서류 / 잔금 / 인도

`차량준비` 단계는 FreePass 업무가 아니므로 만들지 않는다.

---

## 7. 실적 → 청구 → 수금 → 지급 사업 시뮬레이션

인도완료된 접수가 실적 후보가 된다. 중복 Performance 생성 금지.

운영 순서:
1. 영업자 실적 1차 확인
   - 버튼 예: `확인`, `이견 있음`
2. 공급사 Cross Check
   - 버튼 예: `공급사 확인 완료`, `이슈 등록`
3. 공급사 이슈가 영업자 지급액/인정 실적에 영향을 주면 영업자 재확인
   - 버튼 예: `재확인 요청`
   - 영업자: `수용`, `이견 유지`
4. 관리자 최종 확정
   - 버튼 예: `정산 확정`
5. 공급사 청구
   - `청구서 생성`
   - `계산서 처리`
6. 수금
   - `수금 등록`
7. 영업채널 지급
   - `지급 등록`
   - `지급 보류`
8. 금액 표시
   - 청구액 / 수금액 / 미수액
   - 확정 지급액 / 실제 지급액 / 미지급액
   - 우리 마진

부분수금/일부지급을 정상 상태로 지원한다.

상세 R&D는 AI Core PR #6의 사업 운영 모델 및 E2E 시뮬레이션을 참고한다.

---

## 8. 현재 AI Core Gate

통합 기준:
- PR #6 — AI Core Gate 01
- Issue #5 — P0 통합 순서와 HOLD 기준

현재 중요한 Gap:
- main ADMIN UI는 Prototype
- 실제 same-Offer Search Contract 미구현
- Application explicit productVersion 필요
- salesChannelId / assigneeId 계약 필요
- idempotent create 필요
- 독립 Firebase persistence 미검증
- 첫 실제 공급사 Adapter 미연결

병렬 작업:
- PR #2: Snapshot `MULTI_SELECT.value` 참조분리 — 코드/테스트 작성, 실행 검증 대기
- PR #3: UI Profile / review packet — 사용자 exact image 승인 및 evidence gate
- PR #4: Atom Projection + 기능 시뮬레이션
- PR #6: AI Core 통합 통제판

---

## 9. Work 시작 절차

매 작업 시작 시:

1. `git fetch` 후 현재 main과 자신의 branch/PR base 확인
2. `AGENTS.md`
3. `docs/WORK-INBOX.md`
4. `docs/MASTER-v1.md`
5. 해당 작업과 관련된 PR / Issue / AI Core Gate 확인
6. 같은 파일을 다른 AI가 수정 중인지 확인
7. 구현 후 완료 상태를 구분해서 보고

완료 상태 표준:
- DESIGNED
- CODED
- STATIC CHECKED
- TESTED
- PERSISTENCE VERIFIED
- DEPLOYMENT VERIFIED
- USER APPROVED

`CODED`를 `DEPLOYMENT VERIFIED`처럼 보고하지 않는다.

---

## 10. Chat R&D 반영 규칙

이 채팅에서 새로운 사업/UX/상태/버튼 결정이 생기면 ChatGPT는:

1. 대화에서 의미를 정리
2. 기능 시뮬레이션으로 반례 확인
3. 다음 중 맞는 곳에 기록
   - 사업구조 → Business Operating Model
   - 데이터 의미 → MASTER / Domain contract
   - UI 노출 → UI Projection contract
   - 기능 흐름 → Functional simulation
   - 테스트 가능한 규칙 → Regression test
   - 우선순위/충돌 → AI Core Gate
4. `docs/WORK-INBOX.md`의 최신 요약을 갱신
5. 필요 시 Work 대상 Issue/PR에 링크 댓글 남김

따라서 Work는 **이 채팅 자체를 읽을 필요 없이 WORK-INBOX에서 현재 결정을 확인**할 수 있어야 한다.

---

## 11. 지금 Work가 먼저 할 일

1. PR #2 테스트 실제 실행 후 merge 판단
2. same-Offer / EXACT-PARTIAL / unknown!=0 / matched Offer continuity Search 회귀테스트
3. Application Contract에 productVersion + salesChannelId + assigneeId + idempotency 반영
4. 사용자 승인 ADMIN 이미지 기준으로 UI 구현
5. 독립 Firebase 연결 후 실제 저장/재조회/중복방지 검증
6. 승인 공급사 1곳 RAW→Canonical→검색→접수 수직연결

---

## 한 문장

> Work는 기능을 임의로 늘리지 말고, 공급사 원문이 판매 가능한 Canonical 상품이 되어 영업되고, 접수·인도·실적·청구·수금·지급까지 이어지는 사업 흐름 안에서 현재 P0를 구현한다. Chat의 최신 R&D는 이 WORK-INBOX를 통해 전달받는다.

---

## 12. ADMIN UI/UX — 현재 정본

UI/UX 판단은 아래 현재 문서와 actual route 구현만 사용한다.

1. `docs/ui/DESIGN-AUTHORITY.md`
2. `docs/ui/ADMIN-UI-UX-SSOT.md`
3. `docs/ui/admin-ui-ux-ssot.json`
4. `src/app/_erp/*` actual route 구현

현재 핵심은 **3패널 line-free operational UI**다.
기능·데이터 최신화는 이 visual grammar 안에서 반영하고, 실제 route Visual QA로 확인한다.
