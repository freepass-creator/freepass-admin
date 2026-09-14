# freepasserp.com v1 — AI/Developer Rules

## 0. Mandatory Work handoff
모든 Work/개발 AI는 작업 시작 전에 아래 순서로 현재 기준을 읽는다.
1. `AGENTS.md`
2. `docs/WORK-INBOX.md` — Chat R&D의 최신 개발 반영 요약
3. `docs/memory/EMAIL-RND-CONSOLIDATED.md` — Gmail에서 누적된 FreePass R&D·사업배경·폐기 이력의 장기 기억
4. `docs/MASTER-v1.md` — 장기 제품 기준
5. `docs/ai-core/AGENT-EXECUTION-PLAYBOOK.md` 와 `docs/ai-core/scope-lock.json` — 현재 허용 범위와 해맴 방지
6. 해당 작업의 PR / Issue / AI Core Gate

메일 원문 출처 추적이 필요하면 `docs/memory/EMAIL-RND-INDEX.md`에서 Gmail message id와 제목을 확인한다.

`docs/WORK-INBOX.md`가 ChatGPT 채팅과 Work 사이의 공용 최신 인수인계판이다. `EMAIL-RND-CONSOLIDATED.md`는 과거 이메일의 의미를 잃지 않기 위한 장기 기억이며 최신 결정보다 우선하지 않는다. Work는 채팅 내용을 자동으로 안다고 가정하지 말고, 이 파일들의 최신 결정을 개발에 반영한다. 서로 충돌하는 내용이 있으면 사용자의 최신 명시 결정과 AI Core Gate를 확인하고 임의 해석하지 않는다.

## 1. Source of truth
이 저장소가 freepasserp.com v1 개발의 코드 SSOT다. 개발 상세 기준은 `docs/MASTER-v1.md`를 먼저 읽는다. 이후 사용자의 명시적 변경이 있으면 변경 이유와 영향을 기록한 뒤 반영한다. 과거 저장소·과거 메일의 규칙을 현재 MASTER보다 우선하지 않는다.

## 2. Absolute isolation
- 기존 FreePass ERP 저장소의 코드/DB/API/Firebase/시트/환경변수/인증을 자동 연결·복사·fallback하지 않는다.
- 기존 시스템은 사용자가 명시적으로 요청한 범위에서 읽고 설계/UX 참고만 할 수 있다.
- 신규 외부 연결은 명시적 승인 전에는 추가하지 않는다.

## 3. Exactly three surfaces
- ADMIN
- SALES
- WHITE LABEL (B2C)
WHITE LABEL과 B2C를 별도 네 번째 제품으로 만들지 않는다. White Label 엔진은 하나이며 회사별 BI/CI는 설정으로 분리한다.

## 4. Current priority — ADMIN vertical slice
현재 우선 개발은 `Canonical Product → Search/Filter → Product Detail → Application → Application List → Application Detail → 계약서/서류/인도/취소`다. ADMIN PC는 `상품목록 1/3 | 상품상세 1/3 | 업무패널 1/3`을 기본 골격으로 한다. 상품의 `접수하기`는 오른쪽 업무패널만 신규접수로 전환한다.

## 5. Search first
검색 가능성과 정확성이 상품 데이터 설계의 최우선 목적이다. 차량/제원/Offer/Policy 필드를 의미 없이 합치지 않는다. 서로 다른 Offer의 값을 섞어 존재하지 않는 계약조건을 만들지 않는다. 목록에서 일치한 Offer는 상세와 접수까지 유지한다.

## 6. Vehicle master
모델 정보는 원산지 → 제조사 → 모델 → 세부모델 → 세부트림까지만 관리한다. 연료/배기량 등은 모델 계층에 추가하지 않는다. 공급사 정보가 부족하면 확인된 가장 깊은 노드까지만 매칭하고 하위를 추측하지 않는다. MODEL/SUB_MODEL/TRIM/UNMATCHED를 구분한다.

## 7. Adapter
공급사 RAW는 보존한다. 최초 승인된 매핑은 재사용한다. 같은 표현을 매 수집마다 AI가 재해석하지 않는다. 새 표현·모순·양식 변경은 검수 대상으로 올린다. Adapter는 Candidate를 만들며 승인되지 않은 값을 Canonical로 직접 확정하지 않는다.

## 8. Offers and Policies
대여기간은 고정 컬럼이 아니라 반복 가능한 Offer다. Policy는 확장 가능하게 정의하되 이름 난립을 허용하지 않는다. FreePass Policy Definition에 매핑한다. 새 정책 때문에 Product 테이블에 임의 컬럼을 계속 추가하지 않는다.

## 9. Applications
접수 저장 시 당시 상품과 선택 Offer/Policy의 필요한 값을 Snapshot으로 보존한다. 현재 상품 변경으로 과거 접수 조건을 조용히 변경하지 않는다. 진행 체크는 계약서/필수서류/인도와 취소를 중심으로 하며 `차량준비`를 만들지 않는다.

## 10. Development discipline
- 확정되지 않은 업무규칙을 추측 구현하지 않는다.
- 기능을 통과시키기 위해 검증/테스트를 느슨하게 바꾸지 않는다.
- UI가 보인다는 이유만으로 데이터/권한/검색 검증 없이 완료 처리하지 않는다.
- 변경은 작고 검증 가능한 단위로 커밋한다.
- 미확정 사항은 `DECISION REQUIRED`로 남긴다.
- 완료 상태는 `DESIGNED / CODED / STATIC CHECKED / TESTED / PERSISTENCE VERIFIED / DEPLOYMENT VERIFIED / USER APPROVED`를 구분한다.

## 11. Scope lock — 해맴 금지
P0는 `AGENTS.md` 4절과 `docs/ai-core/scope-lock.json`에 잠겨 있다. 사용자 한 줄 지시로 MASTER Phase나 P0 한 줄을 넓히지 않는다.

금지:
- 미머지 브랜치에서 `AGENTS.md` 3–4절, `MASTER-v1.md` Phase A–D, `WORK-INBOX` P0를 새 기준으로 다시 쓰기
- 검색·접수 Domain, 정산/청구/수금/지급, SALES 화면, Firebase Auth, 시각 UI를 한 PR에 섞기
- `DECISION REQUIRED`를 임시 Gate로 구현하고 완료처럼 보고하기
- 머지 전 작업을 `WORK-INBOX`에 `현재 구현됨`으로 올려 main 기준으로 만들기
- localStorage/메모리 시뮬레이션을 `PERSISTENCE VERIFIED`로 부르기

허용(지금):
- same-Offer / EXACT-PARTIAL / 공란≠0 Search Contract와 회귀테스트
- Application `productVersion` + `salesChannelId` + `assigneeId` + `customerName` + `submissionId` + Snapshot 참조분리 + idempotency
- 위 계약의 단위테스트 실행 증거

`기능 우선 / UI 보류`는 Phase A 검색·접수를 테스트로 고정하라는 뜻이다. Phase D 정산·SALES를 앞당기라는 뜻이 아니다. 자세한 절차는 `docs/ai-core/AGENT-EXECUTION-PLAYBOOK.md`를 따른다.
