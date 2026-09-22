# FreePass Admin SSOT Map

상태: ACTIVE  
기준일: 2026-09-19

## 1. 정본 원칙
FreePass Admin은 정본을 종류별로 분리한다. 문서·코드·데이터·배포가 서로 같은 의미의 정본이라고 가정하지 않는다.

| 대상 | 정본 | 상태 |
|---|---|---|
| 제품 범위·장기 규칙 | `docs/MASTER-v1.md` | ACTIVE |
| 최신 개발 반영 | `docs/WORK-INBOX.md` | ACTIVE |
| 코드 | 이 저장소 `main` | ACTIVE |
| Domain 모델 | `src/domain/**` | ACTIVE |
| Use case/service | `src/services/**` | ACTIVE |
| Port 계약 | `src/ports/**` | ACTIVE |
| Adapter 구현 | `src/adapters/**` | ACTIVE, 개발용 포함 |
| 검색 의미 계약 | `docs/contracts/SEARCH-CONTRACT.md` + `src/domain/search/**` | ACTIVE |
| 장기 R&D 배경 | `docs/memory/EMAIL-RND-CONSOLIDATED.md` | REFERENCE |
| UI/UX 규격 | AI Core/DevCenter 공통 규격 확정 전 | HOLD |
| 운영 Product read model | `freepasserp5` Firestore `products` + `policy` | CODED · runtime credential verification required |
| 운영 Application DB | 없음 | NOT VERIFIED |
| 운영 Auth/Permission | 없음 | NOT VERIFIED |
| 운영 Release target | 없음 | NOT VERIFIED |

## 2. Domain SSOT
ADMIN / SALES / WHITE LABEL이 같은 상품을 소비할 수 있으나, 동일 상품 사실을 앱마다 복제해 각각 정본으로 만들지 않는다.

논리 구조:

```text
Canonical Product Domain SSOT
   ├─ Admin consumer
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
- 접수 시점에는 선택한 Offer와 Product version 및 `sourceSnapshotId`를 Snapshot으로 보존한다.
- `sourceSnapshotId`는 조회 시각이 아니라 ERP5 원문과 Canonical 변환 결과의 SHA-256에 묶는다. 같은 상품을 다시 읽으면 유지되고, 가격·정책·차종 매핑 결과가 바뀌면 달라져야 한다.
- 목록의 `queryRevision`은 정렬된 `productId + sourceSnapshotId` 집합으로 만든다. 검색 결과·건수·필터는 이 revision 하나를 함께 사용한다.

## 4. Persistence 상태
현재 JSON file store는 개발 검증용 Adapter다. 운영 persistence 정본으로 선언하지 않는다.

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
2. 최신 WORK-INBOX
3. MASTER
4. 실제 Domain 계약과 테스트
5. 과거 메일/Mockup/Reference

Mockup과 실제 Domain이 다르면 Mockup을 운영 기능으로 간주하지 않는다.

## 6. 금지
- 과거 ERP/Firebase를 편의상 숨은 fallback 정본으로 사용
- UI mock data를 운영 data truth로 간주
- 여러 저장소가 동일 업무 사실의 정본을 동시에 주장
- runtime 검증 없이 문서만으로 production-ready 판정
