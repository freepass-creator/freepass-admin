# FreePass Admin — Project Entry

## Mission
FreePass Admin은 내부 관리자가 하나의 Canonical Product 기준으로 상품을 찾고, 조건을 확인하고, 접수하고, 계약 진행과 정산까지 처리하기 위한 관리자 제품이다.

## Functional authority

기능 고도화의 단일 진입점은 `docs/FUNCTION-AUTHORITY.md`다. 코드 정본은 `main`이며, 과거 기능 브랜치/PR은 merge 전 정본이 아니다. 접수 런타임은 Intake/`settlement_rows`를 사용하고 과거 Application aggregate는 LEGACY_QUARANTINED다.

## Current priority
2026-09-21 기준 AI Core UI/UX Contract와 Development Center Design Hub 실행 경계가 확정되어 **공통 규격 대기 HOLD는 해제**됐다.

다만 이 프로젝트가 새 디자인 방향을 독자 발명하는 것은 금지한다. 사용자 승인 시각 기준은 `docs/ui/mockups/admin-product-to-application.html` rev 5(SHA-256 `6d2c26dc171d0c519d8ba5d8f9d7ab4be29cfeb371f6c8e639606863b62cef7d`)이고, `.ai-core/ui-ux.consumer.json`과 `.devcenter/design-authority.json`이 현재 mapping 경계를 고정한다.

기능 우선순위는 그대로 유지하면서 실제 UI를 Domain/Service에 연결하고, 승인된 시각 기준으로 점진 이식한 뒤 Design Hub Visual QA/Quality Receipt를 받는다.

현재 우선순위는 백엔드와 업무 엔진의 정합성이다.

1. Canonical Product / Offer / Policy
2. Search Engine
3. Intake / delivery / performance workflow
4. Contract-payment fact + cancellation guard
5. Claim / collection / pay / settlement lifecycle
6. Port / Adapter / Repository
7. Persistence / transaction / idempotency
8. Auth / permission / actor / audit evidence

## Users
- 내부 관리자
- 운영 담당자

SALES와 WHITE LABEL은 별도 애플리케이션이다. 이 저장소에 화면을 합치지 않는다.

## Product boundaries
- 이 저장소는 FreePass Admin 코드 SSOT다.
- 기존 freepasserp4의 DB/API/Firebase/시트/인증정보를 자동 연결하거나 fallback으로 사용하지 않는다.
- 공급사 원문은 FreePass 업무 Adapter를 통해 Canonical Product 후보로 변환한다.
- ADMIN / SALES / WHITE LABEL이 같은 상품 업무 사실을 소비하더라도 앱별로 별도 상품 정본을 만들지 않는다.
- 업무 사실의 정본은 Domain SSOT가 소유하고 소비 앱은 계약을 통해 사용한다.

## Backend architecture

```text
UI
 ↓
Application Service
 ↓
Domain Engine
 ↓
Port
 ↓
Adapter / Repository
 ↓
DB / External System
```

원칙:
- Domain은 업무 의미와 상태 전이를 소유한다.
- Service는 use case의 실행 순서를 소유한다.
- Port는 Domain이 요구하는 의미 계약을 소유한다.
- Adapter는 공급사/프로젝트/저장소 차이를 흡수한다.
- Repository는 영속성 경계를 구현한다.
- Connector는 HTTP/DB/API 전송을 담당하며 업무 의미를 갖지 않는다.
- UI가 DB 구조나 공급사 포맷을 직접 알지 않게 한다.

## Authoritative documents
우선순위는 다음과 같다.

1. 사용자의 최신 명시 결정
2. `docs/WORK-INBOX.md`
3. `docs/MASTER-v1.md`
4. `docs/SSOT.md`
5. 현재 Domain/Service/Port/Adapter 코드
6. `docs/memory/EMAIL-RND-CONSOLIDATED.md` — 장기 배경, 최신 결정보다 우선하지 않음

## Non-goals
- UI/UX 공통 규격을 이 저장소가 독자 확정하지 않는다.
- AI Core가 FreePass 업무 로직을 소유하게 만들지 않는다.
- FreePass 업무 Adapter를 본사 공통 서비스로 이동하지 않는다.
- 운영 persistence/Auth가 검증되기 전 프로토타입을 운영 완료로 표기하지 않는다.
- 기존 ERP를 신규 Admin의 숨은 데이터 소스로 사용하지 않는다.

## Status
- Product/domain model: ACTIVE DEVELOPMENT
- Search/Application domain: CODED / PARTIALLY TESTED
- Production persistence: NOT VERIFIED
- Production auth/permission: NOT VERIFIED
- Audit trail: DESIGN REQUIRED
- Settlement domain: PARTIAL / MOCKUP-HEAVY
- UI/UX adoption: MAPPED to AI Core/Design Hub / NOT PILOT / NOT CONFORMANT
