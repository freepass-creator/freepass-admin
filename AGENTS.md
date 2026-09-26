# freepass-admin — AI/Developer Rules

## -2. FUNCTION AUTHORITY — 2026-09-26

기능 작업의 단일 진입점은 `docs/FUNCTION-AUTHORITY.md`다. **기능 런타임 정본은 `main` 한 곳**이며 과거 브랜치/PR/모델별 작업 가지를 정본으로 해석하지 않는다.

- 현재 접수 정본: `Intake / settlement_rows / src/domain/settlement/**`
- 과거 `src/domain/application/**` + `src/services/applications.ts`: **LEGACY_QUARANTINED**. 신규 런타임 의존 금지.
- 데이터 출입구: `src/server/freepass-data.ts` 하나. `src/server/erp5.ts`는 호환 alias일 뿐 신규 진입점이 아니다.
- 취소 기준: **계약금 수납 전=접수취소 / 계약금 수납 후·인도 전=계약취소 / 인도 후=계약해지+환수 검토**.
- 계약금 수납과 차량 보증금(deposit)은 다른 사실이다.
- diverged 과거 브랜치를 통째로 merge하지 않는다. 필요한 의미와 테스트만 current main에 선별 이식한다.

기능을 새 파일/새 엔진/새 상태머신으로 만들기 전에 반드시 current main의 기존 정본을 확장할 수 있는지 먼저 확인한다.

### Branch lifecycle
- `main`만 정본이다. 작업 브랜치는 임시 staging/evidence이며 독립 정본이 아니다.
- 새 작업은 current `main`에서 시작하고, 검증 후 `main`으로 수렴한다.
- PR이 병합되면 해당 작업 브랜치는 삭제한다. 완료된 브랜치를 보관용 정본처럼 남기지 않는다.
- 다른 브랜치를 base로 쌓는 stacked PR은 필요한 경우에만 쓰며, 상위 브랜치에 흡수되면 자식 브랜치를 즉시 삭제한다.
- 현재 `feat/intake-contract-condition-choices-20260923`는 **HOLD / NON-CANONICAL**이다. current main에 없는 계약조건 원자가 있어 보존했을 뿐이며 신규 작업의 기준으로 읽지 않는다.


## -1. UI DESIGN RECOVERY HOLD — 2026-09-26

**중요:** 2026-09-25 HARD LOCK의 시각 기준선은 재검증 중이다. 실제 승인 UI 계보(`claude/erp-platform-ui-ux-hvfyfa`, PR #92)를 current main과 대조해 복구하기 전까지 현 main의 시각 결과를 최종 정본이라고 가정하지 않는다. 새 디자인 발명, PR #92/관련 UI 이력 삭제, 현행 시각을 기준으로 한 추가 polish는 금지한다.


UI/UX 작업은 **반드시** 아래 순서로 시작한다.

1. `docs/ui/DESIGN-AUTHORITY.md`
2. `docs/ui/ADMIN-UI-UX-SSOT.md`
3. `docs/ui/admin-ui-ux-ssot.json`
4. `docs/ui/SALES-APP-BASELINE.md`
5. `src/app/_design/*` + `src/app/_design/admin-final.css`

이 다섯 범위 밖의 과거 시각 자료는 구현 근거가 아니다.

### 금지
- 삭제된 `docs/ui/mockups/**`, `UI-HISTORY.md`, 2026-09-16 rail/topbar/mockup 계열을 Git history에서 찾아 복원하지 않는다.
- 과거 PR/스크린샷/리뷰 문서를 “기존 디자인”이라고 해석해 현재 화면에 되살리지 않는다.
- Claude/Codex/GPT 등 모델 고유 기억이나 임의 미감을 현재 Product Profile보다 우선하지 않는다.
- 새 버튼 높이/반경/색/카드/내비게이션 문법을 별도로 만들지 않는다.
- 정본과 충돌하면 임의 fallback 하지 말고 **FAIL / DECISION REQUIRED**로 남긴다.

시각 규격 변경은 사용자의 명시 승인 후 `DESIGN-AUTHORITY.md` + MD/JSON SSOT + 공통 부품 + UI 회귀검사를 같은 변경에서 갱신해야 한다.

## 0. Mandatory Work handoff
모든 Work/개발 AI는 작업 시작 전에 아래 순서로 현재 기준을 읽는다.
1. `AGENTS.md`
2. `docs/WORK-INBOX.md` — Chat R&D의 최신 개발 반영 요약
3. `docs/FUNCTION-AUTHORITY.md` — 기능 작업 단일 정본 진입점
4. `docs/memory/EMAIL-RND-CONSOLIDATED.md` — Gmail에서 누적된 FreePass R&D·사업배경·폐기 이력의 장기 기억
5. `docs/MASTER-v1.md` — 장기 제품 기준
6. 해당 작업의 PR / Issue / AI Core Gate

메일 원문 출처 추적이 필요하면 `docs/memory/EMAIL-RND-INDEX.md`에서 Gmail message id와 제목을 확인한다.

`docs/WORK-INBOX.md`가 ChatGPT 채팅과 Work 사이의 공용 최신 인수인계판이다. `EMAIL-RND-CONSOLIDATED.md`는 과거 이메일의 의미를 잃지 않기 위한 장기 기억이며 최신 결정보다 우선하지 않는다. Work는 채팅 내용을 자동으로 안다고 가정하지 말고, 이 파일들의 최신 결정을 개발에 반영한다. 서로 충돌하는 내용이 있으면 사용자의 최신 명시 결정과 AI Core Gate를 확인하고 임의 해석하지 않는다.

## 0.5 Project control documents
AI Core/DevCenter의 운영 규격을 이 프로젝트에 적용한다. 기능 작업 전 다음 파일도 현재 revision에서 확인한다.

- `PROJECT.md` — 프로젝트 범위와 backend 우선순위
- `project.json` — AI Core Project Capsule snapshot. revision이 바뀌면 stale 여부를 확인한다.
- `docs/SSOT.md` — 코드/도메인/데이터 정본 지도
- `docs/DECISIONS.md` — 사용자 확정 및 구조 결정
- `docs/HANDOFF.md` — 현재 backend gap과 다음 순서
- `docs/RELEASE.md` — 검증·배포·rollback gate
- `contracts/BACKEND-BOUNDARIES.md` — Domain/Service/Port/Adapter/Repository 경계

이 문서들은 `docs/MASTER-v1.md`의 업무 의미를 대체하지 않는다. 새로운 두 번째 SSOT를 만들지 말고 각 문서의 소유 범위를 지킨다.

## 1. Source of truth
이 저장소가 freepass-admin(관리자 화면) 개발의 코드 SSOT다. 개발 상세 기준은 `docs/MASTER-v1.md`를 먼저 읽는다. 이후 사용자의 명시적 변경이 있으면 변경 이유와 영향을 기록한 뒤 반영한다. 과거 저장소·과거 메일의 규칙을 현재 MASTER보다 우선하지 않는다.

## 2. Absolute isolation
- 기존 FreePass ERP 저장소의 코드/DB/API/Firebase/시트/환경변수/인증을 자동 연결·복사·fallback하지 않는다.
- 기존 시스템은 사용자가 명시적으로 요청한 범위에서 읽고 설계/UX 참고만 할 수 있다.
- 신규 외부 연결은 명시적 승인 전에는 추가하지 않는다.

## 3. Repository scope — ADMIN only

이 저장소(`freepass-admin`)는 **관리자 전용 한 판**이다. 관리자가 상품을 찾고, 접수하고, 계약하고, 정산하는 데까지가 범위다.

저장소 이름 규격:

| 저장소 | 화면 |
|---|---|
| `freepass-admin` | ADMIN — 내부 관리자 (이 저장소) |
| `freepass-sales` | SALES — 제휴 영업자 |
| (아직 없음) | WHITE LABEL — 영업회사 BI/CI B2C |

SALES / WHITE LABEL 화면을 이 저장소 안에 만들지 않는다. 화이트라벨을 네 번째 제품으로 쪼개지도 않는다 — 엔진은 하나이고 회사별 BI/CI는 설정으로 가른다.

`freepasserp.com` 도메인은 **운영 중인 `freepasserp4` 저장소가 갖고 있다**(`lib/brand.ts`의 `BRAND`). 이 저장소를 그 도메인 이름으로 부르지 않는다.

## 4. Current priority — ADMIN vertical slice
현재 우선 개발은 `Canonical Product → Search/Filter → Product Detail → Intake → 인도 → Performance → 공급사 청구/수금 + 영업채널 지급 → Settlement`다. 계약/전자계약은 이 운영 흐름의 계약 사실·증빙 계층이며 별도 운영 원장을 만들지 않는다. ADMIN PC는 `상품목록 1/3 | 상품상세 1/3 | 업무패널 1/3`을 기본 골격으로 한다. 상품의 `접수하기`는 오른쪽 업무패널만 신규접수로 전환한다.

## 5. Search first
검색 가능성과 정확성이 상품 데이터 설계의 최우선 목적이다. 차량/제원/Offer/Policy 필드를 의미 없이 합치지 않는다. 서로 다른 Offer의 값을 섞어 존재하지 않는 계약조건을 만들지 않는다. 목록에서 일치한 Offer는 상세와 접수까지 유지한다.

## 6. Vehicle master
모델 정보는 원산지 → 제조사 → 모델 → 세부모델 → 세부트림까지만 관리한다. 연료/배기량 등은 모델 계층에 추가하지 않는다. 공급사 정보가 부족하면 확인된 가장 깊은 노드까지만 매칭하고 하위를 추측하지 않는다. MODEL/SUB_MODEL/TRIM/UNMATCHED를 구분한다.

## 7. Adapter
공급사 RAW는 보존한다. 최초 승인된 매핑은 재사용한다. 같은 표현을 매 수집마다 AI가 재해석하지 않는다. 새 표현·모순·양식 변경은 검수 대상으로 올린다. Adapter는 Candidate를 만들며 승인되지 않은 값을 Canonical로 직접 확정하지 않는다.

## 8. Offers and Policies
대여기간은 고정 컬럼이 아니라 반복 가능한 Offer다. Policy는 확장 가능하게 정의하되 이름 난립을 허용하지 않는다. FreePass Policy Definition에 매핑한다. 새 정책 때문에 Product 테이블에 임의 컬럼을 계속 추가하지 않는다.

## 9. Intake / legacy Application
현재 런타임 접수 정본은 `Intake / settlement_rows`다. 과거 `src/domain/application/**`, `src/services/applications.ts`, file/json Application Repository는 LEGACY_QUARANTINED이며 신규 런타임 기능이 의존하지 않는다. 유효한 불변식·idempotency·audit 규칙은 현재 Intake에 없는지 확인한 뒤 의미와 회귀테스트만 이식한다.

접수 저장 시 당시 상품과 선택 Offer/Policy의 필요한 값을 Snapshot으로 보존한다. 현재 상품 변경으로 과거 접수 조건을 조용히 변경하지 않는다. 진행 체크는 계약서/필수서류/잔금/인도와 취소를 중심으로 하며 `차량준비`를 만들지 않는다.

## 9.5 Backend evidence discipline
- UI/UX의 현재 시각 권위는 이 문서 상단 `UI DESIGN HARD LOCK`과 `docs/ui/DESIGN-AUTHORITY.md`뿐이다. AI Core/DevCenter 및 `.ai-core/ui-ux.consumer.json`은 의미·상호작용 계약으로만 사용하며, 과거 revision/승인 번호를 시각 정본으로 해석하지 않는다. 구현 후 현행 Visual QA/Quality Receipt 없이는 PILOT/CONFORMANT를 주장하지 않는다.
- backend write는 가능하면 `UI → Service → Domain → Port → Adapter/Repository` 경계를 통과한다.
- 운영 저장소 연결 전 transaction, concurrency, idempotency, unique number, retry/failure semantics를 계약과 테스트로 먼저 고정한다.
- 상태 변경/취소/정산 같은 민감 작업은 actor와 audit evidence를 남길 수 있는 경계를 마련한다.
- `DESIGNED / CODED / TESTED / PERSISTENCE VERIFIED / DEPLOYMENT VERIFIED / USER APPROVED`를 같은 완료 상태로 합치지 않는다.

## 10. Development discipline
- 확정되지 않은 업무규칙을 추측 구현하지 않는다.
- 기능을 통과시키기 위해 검증/테스트를 느슨하게 바꾸지 않는다.
- UI가 보인다는 이유만으로 데이터/권한/검색 검증 없이 완료 처리하지 않는다.
- 변경은 작고 검증 가능한 단위로 커밋한다.
- 미확정 사항은 `DECISION REQUIRED`로 남긴다.
- 완료 상태는 `DESIGNED / CODED / STATIC CHECKED / TESTED / PERSISTENCE VERIFIED / DEPLOYMENT VERIFIED / USER APPROVED`를 구분한다.
