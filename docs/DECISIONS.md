# FreePass Admin Decision Log

중요한 변경은 결과만 남기지 않고 결정 이유와 비목표를 함께 기록한다.

---

## DEC-2026-09-19-01 — UI/UX는 AI Core/DevCenter 공통 규격 이후 적용
상태: USER CONFIRMED

### 결정
현재 Admin의 기능은 유지한다. UI/UX 독자 고도화는 멈추고 AI Core에서 공통 규격이 확정된 뒤 적용한다.

### 영향
- 이 단계의 변경은 UI/UX를 완료조건으로 삼지 않는다.
- Backend/domain 작업이 화면 리디자인을 강제하지 않는다.
- 기능 정합성 때문에 최소 화면 수정이 필요한 경우에도 기존 UX를 재설계하지 않는다.

---

## DEC-2026-09-19-02 — Backend boundary를 Domain / Service / Port / Adapter로 유지
상태: USER CONFIRMED / ADOPTED

### 결정
FreePass Admin의 실전 구조를 다음 기준으로 유지한다.

```text
UI → Service → Domain → Port → Adapter/Repository → External
```

### 이유
업무 의미와 Firebase/파일/공급사 포맷을 분리해 저장소와 외부 시스템을 교체해도 Domain 규칙이 흔들리지 않게 한다.

---

## DEC-2026-09-19-03 — AI Core는 통제, DevCenter는 공통 패턴, FreePass는 업무 의미 소유
상태: USER CONFIRMED

### 결정
- AI Core: 프로젝트·revision·승인·증거·진행 통제
- DevCenter: 공통 개발 규격·검증·재사용 패턴
- FreePass: Product/Search/Application/Settlement 업무 의미와 Domain Engine

### 비목표
FreePass 업무 엔진을 AI Core 저장소로 이동하지 않는다.

---

## DEC-2026-09-19-04 — Project SSOT와 Domain SSOT를 구분
상태: LEARNING ADOPTED FOR THIS PROJECT

### 결정
ADMIN / SALES / WHITE LABEL처럼 앱이 여러 개여도 같은 Product 업무 사실은 하나의 Domain SSOT를 소비할 수 있다.

### 이유
앱별 독립성을 위해 동일 상품 정본을 복제하면 데이터 드리프트가 발생한다.

---

## DEC-2026-09-19-05 — Adapter는 기술 Adapter와 업무 Adapter를 구분
상태: ADOPTED

### 기술 Adapter / Connector
Firebase, Google, GitHub, Vercel, HTTP/DB transport 등.

### 업무 Adapter
공급사 가격표, 차량 필드, 보증금 표현, 사진 규칙 등.

공통화할 것은 인터페이스·오류·버전·검증 방식이며 공급사 업무 규칙 자체는 FreePass Domain에 둔다.

---

## DEC-2026-09-19-06 — 운영 완료는 증거 상태를 분리해 표기
상태: ADOPTED

완료 상태를 하나로 합치지 않는다.

- DESIGNED
- CODED
- STATIC CHECKED
- TESTED
- PERSISTENCE VERIFIED
- DEPLOYMENT VERIFIED
- USER APPROVED

문서 또는 화면이 존재한다는 이유만으로 운영 완료 처리하지 않는다.

---

## DEC-2026-09-21-01 — F04는 과도기 병행, 최종 writer는 FreePass Admin
상태: USER CONFIRMED

### 결정
당분간 `[F04 사용중] 프리패스 정산원장`과 FreePass Admin을 병행한다.
최종적으로 신규 접수·실적·정산·청구·수금·지급은 FreePass Admin에서만 처리한다.

### 경계
- F04를 신규 Domain/Collection 구조로 복제하지 않는다.
- F04를 숨은 fallback SSOT로 사용하지 않는다.
- 연결은 명시적 Legacy Bridge/Adapter로 격리한다.
- 동일 건을 Admin과 F04가 동시에 수정하는 dual-writer 상태를 최종 구조로 허용하지 않는다.
- 전환기에는 stable id를 통해 양쪽 레코드를 대조한다.
- Admin 단독 전환 후 F04는 조회/검증/내보내기/보관 역할로 축소한다.

### 이유
현재 F04에 실제 접수·분납실적·완납실적·청구/지급 규칙과 과거 데이터가 있으므로 운영을 끊지 않고 이관해야 한다.
그러나 신규 Admin이 F04 탭 구조에 종속되면 F04 제거 시 다시 시스템을 만들어야 하므로 Domain 정본은 Admin 쪽에 둔다.

---

## DEC-2026-09-21-02 — FreePass Data 연동은 Catalog read와 Operational write를 분리
상태: USER CONFIRMED / ADOPTED

### 결정
FreePass Admin은 향후 FreePass Data를 중앙 Catalog SSOT consumer로 사용한다.
그러나 Product/Offer/Policy read cutover와 Application/Performance/Settlement write cutover를 같은 순간에 묶지 않는다.

### 전환 구조
1. 기존 ERP5 direct catalog read 유지
2. FreePass Data Admin Catalog를 shadow read
3. parity 검증
4. Product/Offer/Policy read만 FreePass Data로 전환
5. Application/Performance/Settlement writer는 Admin ERP5 namespace 유지
6. FreePass Data command contract가 해당 도메인까지 승인·검증된 뒤 writer를 별도 전환

### Domain 영향
- 공급사 정본은 selected Offer에 둔다.
- Data Offer/PriceTerm provenance를 Application Snapshot에 보존한다.
- 보증금은 숫자뿐 아니라 KNOWN/ZERO/UNKNOWN/NOT_APPLICABLE 상태를 보존한다.
- Product 하나에 여러 supplier Offer가 존재할 수 있음을 허용한다.

### 금지
- Admin이 FreePass Data internal Firestore collection을 직접 읽지 않는다.
- Data read cutover를 이유로 운영 writer를 자동 전환하지 않는다.
- Policy parity 없이 Data Catalog를 운영 read source로 승격하지 않는다.

---

## DEC-2026-09-21-03 — Data는 정산 입력 사실, Admin은 정산 계산·업무 소유
상태: ADOPTED

### 결정
FreePass Data는 Product/Offer/PriceTerm/Policy/VehiclePrice 등 버전된 사실을 공급한다.
FreePass Admin은 그 사실을 접수 Snapshot으로 고정하고 Performance/Settlement/Billing/Collection/Payout 업무와 정산 계산 경계를 소유한다.

### 기존 정산 엔진 활용
`fp-settlement`에서 운영 검증된 순수 수수료 규칙표와 계산 의미를 Admin의 `SettlementPricingProvider` 뒤로 역수입한다.
UI/Auth/Firestore/RTDB shim은 역수입하지 않는다.

### 공급사 식별
정산 규칙 조회는 supplierId를 사람 이름으로 가정하지 않는다.
`SettlementSupplierRuleKeyProvider`를 통해 안정 ID를 검증된 fee-rule key로 해소한다.

### 자동화 안전
- 숫자로 확정되는 기존 auto 규칙만 자동추천한다.
- 신차 형태 미확정, 차량가액 누락, 수동/조건분기 규칙은 REVIEW_REQUIRED.
- 자동추천 산출근거(engine revision/rule/source revision)를 Performance와 최종 Settlement에 보존한다.
- 수동 금액 수정/공급사 이슈로 금액이 바뀌면 이전 자동 산출근거를 유효한 근거로 유지하지 않는다.
