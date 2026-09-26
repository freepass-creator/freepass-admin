# FreePass Admin Functional Authority

상태: **ACTIVE / CANONICAL**
기준일: **2026-09-26**

이 문서는 FreePass Admin의 **기능 개발 정본 진입점**이다. 기능 구현·감사·고도화·브랜치 정리에서 서로 다른 과거 문서나 브랜치가 충돌하면 사용자의 최신 명시 결정과 이 문서를 먼저 따른다.

## 1. 한 축 원칙

- 기능 런타임의 코드 정본은 **`main` 한 곳**이다.
- PR/작업 브랜치는 검토·이식·검증을 위한 임시 작업면이며, merge되기 전에는 기능 정본이 아니다.
- 이미 `main`에 흡수된 브랜치는 개발 근거로 다시 사용하지 않는다.
- 오래 갈라진(diverged) 브랜치는 통째로 merge하지 않는다. 현재 정본과 대조해 필요한 의미·테스트만 선별 이식한다.
- 같은 기능을 새 Domain/Service/Repository 이름으로 두 번째 구현하지 않는다.

## 2. Canonical business flow

```text
FreePass Data
  ↓
Product / Offer / Policy
  ↓
상품찾기
  ↓
접수(Intake)
  ↓
계약금 수납 사실
  ↓
인도
  ↓
실적
  ↓
공급사 청구/수금 + 영업채널 지급
  ↓
정산 완료
```

계약·전자계약은 이 운영 흐름의 계약 사실/증빙 계층이다. 일반 운영 원장을 별도로 하나 더 만들지 않는다.

## 3. 접수 기능 정본

현재 런타임 접수 정본은 다음이다.

- Domain: `src/domain/settlement/intake.ts` + `src/domain/settlement/**`
- Persistence: FreePass Data gateway 뒤의 `settlement_rows`
- Runtime actions: `src/app/intake/**`
- Gateway: `src/server/freepass-data.ts`

아래 과거 Application 계층은 **LEGACY_QUARANTINED**다.

- `src/domain/application/**`
- `src/services/applications.ts`
- `ApplicationRepository`
- file/json Application repository

이 계층을 신규 런타임 기능의 출발점으로 사용하지 않는다. 다만 snapshot 불변성, idempotency, actor/audit처럼 유효한 규칙은 현재 Intake 정본에 없는지 확인한 뒤 **의미와 회귀테스트만** 현재 정본으로 이식할 수 있다.

## 4. 취소·해지 판정 정본

판정 기준은 전자서명 여부가 아니라 **계약금 실제 수납 사실**과 **인도 사실**이다.

```text
계약금 수납 전
  → 접수취소

계약금 수납 후 + 인도 전
  → 계약취소

인도 후
  → 계약해지
  → 환수 검토
  → 필요한 경우 별도 Clawback
```

중요:
- 여기서 **계약금**은 고객에게 받은 계약금 수납 사실이다.
- 상품 조건의 **보증금(deposit)** 과 계약금은 다른 값이다. 보증금 금액 존재 여부로 계약취소 단계를 추론하지 않는다.
- 계약금 수납은 금액·일시·operation/receipt를 추적할 수 있는 사실로 모델링해야 한다.
- 계약해지는 기존 실적·청구·수금·지급 이력을 되돌리지 않는다.
- 환수 여부/금액은 해지만으로 자동 계산하지 않고 별도 검토 후 확정한다.

## 5. 데이터 출입구

Admin의 운영 데이터 출입구는 **FreePass Data 하나**다.

```text
UI / Service
  ↓
src/server/freepass-data.ts
  ↓
Repository / Adapter
  ↓
Firestore
```

- `src/server/erp5.ts`는 과거 import 호환용 alias일 뿐 새 기능의 진입점이 아니다.
- UI/Service가 `adapters/erp5/*` 또는 Firebase Admin SDK를 직접 호출하지 않는다.
- RTDB는 사용하지 않는다.
- Catalog의 Legacy/Shadow/New reader 공존은 FreePass Data 전환 검증을 위한 의도된 migration 구조이며 별도 상품 정본이 아니다.

## 6. 기능별 소유 위치

| 관심사 | 기능 정본 |
|---|---|
| 상품/Offer/Policy 소비 | FreePass Data consumer boundary |
| 검색/필터 의미 | `src/domain/search/**` |
| 접수/인도/실적 사실 | `src/domain/settlement/**` |
| 청구/수금/지급/정산 | `src/domain/settlement/**` |
| 계약취소/계약해지 규칙 | `src/domain/contracts/**` + Intake/Settlement guard |
| 환수 | `src/domain/settlement/clawback.ts` |
| 데이터 조립점 | `src/server/freepass-data.ts` |
| UI/UX | 별도 Design Authority를 따름 |

## 7. 브랜치/PR 처리 규칙

- **main = 기능 정본.**
- `ahead=0`인 기능 브랜치/PR은 흡수 완료 또는 폐기 후보로 보고 다시 개발하지 않는다.
- 오래 diverged된 기능 브랜치는 보관 증거일 뿐 정본이 아니다.
- 유효한 변경이 남아 있으면 브랜치 전체가 아니라 변경 단위로 현재 main에 이식하고 테스트한다.
- UI 복구, 전자계약 전담, 운영개시 전담처럼 명시적으로 분리된 작업도 **자기 범위의 staging**일 뿐 전체 기능 정본을 대체하지 않는다.
- 하나의 canonical path를 동시에 여러 PR이 수정하지 않는다.

## 8. 고도화 규칙

새 기능 작업은 항상 다음 순서로 한다.

1. 이 문서와 `docs/DECISIONS.md`의 최신 결정을 확인한다.
2. 현재 `main` 코드에서 해당 기능의 기존 정본을 찾는다.
3. 새 구현을 만들기 전에 기존 기능을 확장할 수 있는지 확인한다.
4. 과거 브랜치에서 가져올 것이 있으면 의미/테스트만 선별한다.
5. Domain → Service → Port → Adapter/Repository 경계를 지킨다.
6. 같은 업무 사실이 두 저장소/두 aggregate/두 상태머신에 생기지 않는지 검사한다.
7. 테스트와 증거가 main에 들어간 뒤에만 해당 변경을 기능 정본으로 취급한다.
