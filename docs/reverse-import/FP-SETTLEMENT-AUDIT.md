# fp-settlement Reverse Import Audit

기준일: 2026-09-21
대상:
- `freepass-creator/freepass-admin` P12 continuation
- `freepass-creator/fp-settlement` main
- `[F04 사용중] 프리패스 정산원장`
- `freepasserp4` settlement fee/ledger reference

## 결론

`fp-settlement`를 별도 최종 제품으로 다시 키우지 않는다.
최종 운영 제품은 FreePass Admin이고, fp-settlement에서 검증된 **순수 정산 계산 엔진**과 운영 규칙만 선별 역수입한다.

FreePass Admin에서 이미 더 앞선 기능을 fp-settlement 코드로 되돌리지 않는다.

## FreePass Admin P12가 이미 소유하는 것

- Canonical Product / same-Offer Search / Application Snapshot
- ERP5 namespaced persistence + transaction boundary
- verified Admin Actor/Auth boundary
- Performance 검토 사슬: 영업채널 확인 → 공급사 Cross Check → 필요 시 재확인 → 관리자 확정
- Settlement durable object
- Billing → invoice evidence → collection
- 부분수금
- 영업채널 지급 + AFTER_FULL_COLLECTION gate
- append-only ledger + REVERSAL 정정
- Reference Master
- semantic submission idempotency
- 50건 paging/운영 검색
- vertical smoke/readiness gate

## fp-settlement에서 역수입할 가치가 확인된 것

정본 문: `lib/domain/settlement/engine.ts`

### 1. 금액 계산
- `claimOf` — 공급사 청구액
- `payOf` — 영업채널 지급액
- `claimBaseOf` / `payBaseOf`
- `incentiveOf`
- `invoiceMoneyOf` — VAT 가르기 포함
- `clawMoneyOf` — 환수 금액

### 2. 수수료 규칙
- `FEE_RULES`
- `FEE_TIMING`
- `SUPPLIER_ALIAS`
- `feeKindOf`
- `feeRuleFor`
- 자동 계산 불가 규칙은 사람 판정으로 남기는 `auto:false` 의미

### 3. 분납/청구월
- `billingMonth` / `billingMonthIn` / `lockedMonthsOf`
- `roundsOf` / `paidRoundsOf` / `paidRatioOf`
- `lastPaymentDate` / `instalmentDueDate` / `nextInstalment`
- `settlementMonthOf`

### 4. 생애주기/일정
- claim/pay 두 축 분리
- `billDate` / `dueDate` / `payDate` / `cyclePhase`
- `timelineOf` / `nextTodoOf`
- alerts

### 5. 원자 입력 규칙
- 인도완료 ↔ 인도일 ↔ 청구월 불변식 (`settlement-intake.ts`)
- F04/Firestore 원자 필드 의미
- `settlement_rows` / `settlement_clawbacks`의 과거 운영 데이터 의미

## 중요한 차이 — 합치면 안 되는 개념

### Ledger REVERSAL
잘못 등록한 수금/지급 거래를 정정하는 회계/원장 보정이다.
Admin P8 이후 append-only ledger에서 이미 구현되어 있다.

### Business CLAWBACK / 환수
실제 계약/실적이 깨져 공급사 청구액 또는 채널 지급액을 사업적으로 되돌리는 별도 정산 사건이다.
`fp-settlement`의 `settlement_clawbacks` 및 `clawMoneyOf` 의미를 참조한다.

둘은 같은 기능이 아니다. Admin에 환수를 넣을 때 REVERSAL로 대체하지 않는다.

## 통합 원칙

```text
Application/Performance Snapshot
        ↓
Admin Settlement Pricing Adapter
        ↓
Pure Settlement Engine (reverse-imported proven rules)
        ↓
Suggested supplierReceivable / channelPayable / VAT / billing month / evidence
        ↓
기존 Admin review chain
        ↓
FINALIZED Settlement → Billing → Invoice Evidence → Collection → Payout
```

- UI가 수수료를 직접 계산하지 않는다.
- Firestore Adapter가 수수료를 판단하지 않는다.
- F04 탭 구조를 Admin collection 구조로 복제하지 않는다.
- 기존 fp-settlement API route를 통째로 복사하지 않는다.
- `lib/server/firebase-admin.ts` 같은 legacy transport/RTDB shim은 역수입하지 않는다.
- 순수 Domain 계산만 가져온다.

## F04 과도기 병행

- F04는 과거/현재 운영 데이터의 migration source 및 대조 대상이다.
- Admin 신규 writer를 세운 뒤 F04 mirror/verification으로 단계 전환한다.
- 최종적으로 Admin 단일 writer로 닫는다.
- `정산코드` 및 새 stable IDs의 대응표를 Bridge가 관리한다.

## 다음 구현 순서

1. Admin `SettlementPricingPort` 계약 정의
2. Performance Snapshot → fp-settlement 계산 원자 mapping 명세/회귀 fixture 작성
3. fp-settlement pure engine의 최소 의존 파일을 Admin Domain으로 역수입 또는 package boundary로 추출
4. 현재 `setPerformanceAmounts` 수동 입력 앞에 자동 Suggested Amounts 제공
5. `auto:false` 규칙은 기존 공급사/영업채널 review chain으로 fail-closed
6. Business CLAWBACK Domain 구현 — ledger REVERSAL과 분리
7. F04 Legacy Bridge: 과거 row import + 신규 Admin → F04 mirror
8. 동일 샘플 계약을 F04/freepasserp4/fp-settlement/Admin 네 경로에서 비교하는 parity regression

## 보류

- fp-settlement의 UI/고전 스킨 역수입
- fp-settlement의 인증/서버 transport 역수입
- RTDB shim/fallback 역수입
- 기존 settlement_rows schema를 새 Admin storage schema로 채택
