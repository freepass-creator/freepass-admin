# FreePass Admin SSOT Map

상태: ACTIVE  
기준일: 2026-09-26

## 1. 정본 원칙
FreePass Admin은 정본을 종류별로 분리한다. 문서·코드·데이터·배포가 서로 같은 의미의 정본이라고 가정하지 않는다.

| 대상 | 정본 | 상태 |
|---|---|---|
| 제품 범위·장기 규칙 | `docs/MASTER-v1.md` | ACTIVE |
| 기능 개발 진입점 | `docs/FUNCTION-AUTHORITY.md` | ACTIVE / CANONICAL |
| 최신 개발 반영 | `docs/WORK-INBOX.md` | ACTIVE |
| 코드 | 이 저장소 `main` | ACTIVE |
| Domain 모델 | `src/domain/**` | ACTIVE |
| Use case/service | `src/services/**` | ACTIVE |
| Port 계약 | `src/ports/**` | ACTIVE |
| Adapter 구현 | `src/adapters/**` | ACTIVE, 개발용 포함 |
| 검색 의미 계약 | `docs/contracts/SEARCH-CONTRACT.md` + `src/domain/search/**` | ACTIVE |
| 장기 R&D 배경 | `docs/memory/EMAIL-RND-CONSOLIDATED.md` | REFERENCE |
| UI/UX 규격 | AI Core/DevCenter 공통 규격 확정 전 | HOLD |
| Product / Offer / Policy 데이터 정본 | **FreePass Data** | AUTHORITY · Admin read cutover HOLD |
| Admin Catalog 현재 읽기 | `AdminCatalogReader` → OBSERVE → freepasserp5 legacy bridge | TRANSITIONAL |
| Admin workflow persistence | `src/server/freepass-data.ts` → Repository/Adapter → Firestore (`freepasserp5` project id) | ACTIVE GATEWAY · Admin workflow meaning remains Admin-owned |
| 운영 Auth/Permission | 없음 | NOT VERIFIED |
| 운영 Release target | 없음 | NOT VERIFIED |

## 2. Domain SSOT
ADMIN / SALES / WHITE LABEL이 같은 상품을 소비할 수 있으나, 동일 상품 사실을 앱마다 복제해 각각 정본으로 만들지 않는다.

논리 구조:

```text
FreePass Data Canonical Product Domain SSOT
   ├─ Admin consumer (AdminCatalogReader)
   ├─ Sales consumer
   └─ White Label consumer
```

각 소비 앱은 독립 배포·권한·표시 정책을 가질 수 있다. 그러나 Product / Offer / Policy의 업무 의미는 Domain 계약을 통해 공유한다.

## 3. Canonical Product lineage

```text
Supplier RAW
 ↓
Supplier Adapter
 ↓
Mapping + Validation
 ↓
Canonical Product
 ↓
Search
 ↓
Application Snapshot
```

규칙:
- RAW는 재처리와 증거를 위해 보존한다.
- 승인된 매핑은 재사용한다.
- 미확인 하위 차량정보를 추측하지 않는다.
- 서로 다른 Offer의 가격/기간/정책을 합쳐 존재하지 않는 상품을 만들지 않는다.
- 접수 시점에는 선택한 Offer와 Product version을 Snapshot으로 보존한다.

## 4. Persistence 상태

상품 Catalog의 authority는 FreePass Data다. 현재 Admin read mode는 OBSERVE이며,
FreePass Data의 Admin 전용 consumer contract/ACTIVE release/policy parity/auth evidence가 열리기 전까지
freepasserp5 상품 reader는 **legacy bridge**로만 유지한다. collection path를 public contract로 사용하지 않는다.

접수·정산·전자계약 workflow는 Admin 소유 의미를 유지하며 현재 freepasserp5 adapter에 저장된다.
이 workflow persistence와 Catalog read cutover는 한 번에 바꾸지 않는다.

과거 JSON file Application store와 `src/domain/application/**` 계층은 LEGACY_QUARANTINED다. 현재 접수 런타임 정본은 Intake/`settlement_rows`이며 신규 기능은 과거 Application 계층에 의존하지 않는다.

운영 저장소 도입 전 최소 검증:
- transaction
- concurrent create/update
- idempotency
- unique human-readable number
- retry semantics
- failure rollback
- actor/audit persistence
- backup/recovery

## 5. 충돌 해결
충돌 시 우선순위:
1. 사용자의 최신 명시 결정
2. 기능 의미/브랜치 충돌은 `docs/FUNCTION-AUTHORITY.md`
3. 최신 WORK-INBOX
4. MASTER
5. 실제 Domain 계약과 테스트
6. 과거 메일/Mockup/Reference

기존 번호 체계와 무관하게 위 순서가 최신이다.

<!-- superseded-order-below -->

과거 표기의 우선순위(아래)는 위 최신 순서가 덮어쓴다.
1. 사용자의 최신 명시 결정
2. 최신 WORK-INBOX
3. MASTER
4. 실제 Domain 계약과 테스트
5. 과거 메일/Mockup/Reference

Mockup과 실제 Domain이 다르면 Mockup을 운영 기능으로 간주하지 않는다.

## 6. 금지
- 과거 ERP/Firebase를 편의상 숨은 fallback **정본**으로 사용
- FreePass Data 전환 모드가 SHADOW_READ 이상인데 legacy ERP5로 조용히 fallback
- generic ERP-public projection을 Admin 전용 Catalog contract로 가장
- UI mock data를 운영 data truth로 간주
- 여러 저장소가 동일 업무 사실의 정본을 동시에 주장
- runtime 검증 없이 문서만으로 production-ready 판정
