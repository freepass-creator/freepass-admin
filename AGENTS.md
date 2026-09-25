# freepass-admin — AI/Developer Rules

## -1. UI DESIGN HARD LOCK — 2026-09-25

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
3. `docs/memory/EMAIL-RND-CONSOLIDATED.md` — Gmail에서 누적된 FreePass R&D·사업배경·폐기 이력의 장기 기억
4. `docs/MASTER-v1.md` — 장기 제품 기준
5. 해당 작업의 PR / Issue / AI Core Gate

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
현재 우선 개발은 `Canonical Product → Search/Filter → Product Detail → Application → Application List → Application Detail → 계약서/필수서류/잔금/인도/취소`다. ADMIN PC는 `상품목록 1/3 | 상품상세 1/3 | 업무패널 1/3`을 기본 골격으로 한다. 상품의 `접수하기`는 오른쪽 업무패널만 신규접수로 전환한다.

## 5. Search first
검색 가능성과 정확성이 상품 데이터 설계의 최우선 목적이다. 차량/제원/Offer/Policy 필드를 의미 없이 합치지 않는다. 서로 다른 Offer의 값을 섞어 존재하지 않는 계약조건을 만들지 않는다. 목록에서 일치한 Offer는 상세와 접수까지 유지한다.

## 6. Vehicle master
모델 정보는 원산지 → 제조사 → 모델 → 세부모델 → 세부트림까지만 관리한다. 연료/배기량 등은 모델 계층에 추가하지 않는다. 공급사 정보가 부족하면 확인된 가장 깊은 노드까지만 매칭하고 하위를 추측하지 않는다. MODEL/SUB_MODEL/TRIM/UNMATCHED를 구분한다.

## 7. Adapter
공급사 RAW는 보존한다. 최초 승인된 매핑은 재사용한다. 같은 표현을 매 수집마다 AI가 재해석하지 않는다. 새 표현·모순·양식 변경은 검수 대상으로 올린다. Adapter는 Candidate를 만들며 승인되지 않은 값을 Canonical로 직접 확정하지 않는다.

## 8. Offers and Policies
대여기간은 고정 컬럼이 아니라 반복 가능한 Offer다. Policy는 확장 가능하게 정의하되 이름 난립을 허용하지 않는다. FreePass Policy Definition에 매핑한다. 새 정책 때문에 Product 테이블에 임의 컬럼을 계속 추가하지 않는다.

## 9. Applications
접수 저장 시 당시 상품과 선택 Offer/Policy의 필요한 값을 Snapshot으로 보존한다. 현재 상품 변경으로 과거 접수 조건을 조용히 변경하지 않는다. 진행 체크는 계약서/필수서류/잔금/인도와 취소를 중심으로 하며 `차량준비`를 만들지 않는다.

## 9.5 Backend evidence discipline
- UI/UX는 AI Core/DevCenter 공통 규격과 `.ai-core/ui-ux.consumer.json`을 따른다. 공통 규격 대기 HOLD는 해제됐지만, 승인 rev 5와 다른 새 디자인 방향을 독자 발명하지 않는다. 구현 후 Design Hub Visual QA/Quality Receipt 없이는 PILOT/CONFORMANT를 주장하지 않는다.
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
