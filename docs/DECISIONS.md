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

## DEC-2026-09-25-01 — 상품찾기는 White Label과 Admin이 같은 기능 계약을 사용
상태: USER CONFIRMED / ADOPTED

### 결정
White Label 상품찾기는 Admin 상품찾기를 외부 고객면으로 노출한 관계로 본다.

공통으로 유지할 기능 의미:
- 같은 축 복수값 OR / 서로 다른 축 AND
- 기간·월대여료·보증금 등 계약조건은 동일 Offer 한 건에서 동시에 만족
- 필터 결과와 카드/상세/접수의 Offer 연속성
- URL 기반 검색/필터 상태
- 교차 facet count
- 고객용 검색축과 정렬 의미

Admin은 공급사·출고상태·내부 진단 같은 관리자 전용 축을 추가할 수 있다. 그러나 공통 상품조건을 별도 엔진에서 다른 의미로 재정의하지 않는다.

현재 확인된 의미 충돌:
- Admin `mile` = Offer 약정주행
- White Label `mile` = 차량 현재 주행거리

이 둘은 공통화 과정에서 별도 축으로 분리해야 하며 같은 이름으로 합치지 않는다.

---

## DEC-2026-09-25-02 — Admin 운영 중심축은 접수 → 실적 → 청구/수금·지급
상태: USER CONFIRMED / ADOPTED

### 결정
FreePass Admin의 운영 핵심을 다음으로 고정한다.

```text
상품찾기
→ 접수
→ 실적
→ 공급사 청구/수금
→ 영업채널 지급
→ 정산 완료
```

계약은 이 흐름의 증빙/계약 사실이며 별도 운영 중심축으로 확장하지 않는다.

---

## DEC-2026-09-25-03 — 접수취소와 계약해지의 업무 의미
상태: USER CONFIRMED / ADOPTED

### 접수취소
- 인도 전 접수가 종료된 사실이다.
- 전자계약이 연결되어 있어도 별도의 업무상 “계약취소” 단계로 보내지 않는다.
- e-sign 링크 철회/세션 정리/서명 증거 보존은 전자계약 기술 계층의 후처리다.

### 계약해지
- 인도 후 계약이 종료된 사실이다.
- 기존 실적·청구·수금·지급 이력을 되돌리지 않는다.
- 계약해지는 **환수 검토대상**을 만든다.
- 환수 여부와 금액은 공급사/계약 조건에 따라 관리자가 확정한다.
- 해지 사실만으로 환수 금액이나 환수 라인을 자동 생성하지 않는다.
- 확정된 환수는 별도 `settlement_clawbacks` 음수 라인으로 환수 발생월에 반영한다.


---

## DEC-2026-09-25-04 — FreePass Data는 Admin의 유일한 데이터 읽기/쓰기 게이트
상태: USER CONFIRMED / ADOPTED

### 결정
FreePass Admin의 모든 운영 데이터 접근은 **FreePass Data**를 통한다.

```text
FreePass Admin UI / Service
        ↓
FreePass Data Gateway
        ↓
Repository / Adapter
        ↓
Firestore project: freepasserp5
```

### 의미
- `freepasserp5`는 기술 저장소의 Firebase project id다.
- **FreePass Data**가 Admin이 의존하는 공식 데이터 계층/SSOT다.
- 상품/Offer/Policy/차량뿐 아니라 접수·실적·계약 사실·정산·청구·수금·지급·환수도 동일한 FreePass Data 경계를 통해 읽고 쓴다.
- Admin은 업무 규칙과 workflow 의미를 소유하지만 별도 persistence/두 번째 원장을 만들지 않는다.
- UI/Action/Service가 Firebase Admin SDK나 `adapters/erp5/*`를 직접 부르는 것을 금지한다.
- RTDB는 사용하지 않는다.

### 구현 경계
정본 조립점: `src/server/freepass-data.ts`.

`src/server/erp5.ts`는 과거 import 호환용 deprecated alias일 뿐이며 새 코드는 사용하지 않는다.

CI `freepass-data-boundary.test.ts`가 App/Server/Service의 직접 ERP5/Firebase adapter 접근을 차단한다.

### 쓰기
접수·실적·청구·지급·환수 mutation은 FreePass Data repository transaction을 통해 Firestore에 기록한다.
상품 기반 접수는 저장 직전 FreePass Data에서 Product/Offer를 fresh read하여 version/snapshot drift를 fail-closed 한다.

---

## DEC-2026-09-25-05 — 운영 개시 범위 (전자계약 제외 · Vercel · 권한 · 환수 상계)

1. **전자계약은 운영 개시에서 뺀다.** 코드는 유지하고 `ESIGN_ENABLED=on` 전까지 `/esign`(→ `/intake`), 고객 `/sign/*`, `/api/esign/*`, `/api/intake/{id}/contract`를 닫는다(`src/server/esign-scope.ts`, `src/proxy.ts`). 계약은 종이계약/기존 방식으로 진행하고, 접수의 계약서 체크가 그 사실을 기록한다.
2. **배포는 Vercel로 시작, 별도 도메인 없음.** Vercel이 주는 production `*.vercel.app` 주소를 `APP_BASE_URL` / `PUBLIC_BASE_URL` / `CLAIM_LINK_BASE`로 쓴다. 배포마다 바뀌는 preview 주소는 OAuth·청구 링크에 쓰지 않는다.
3. **Google Workspace 구성원은 모두 관리자다.** 역할 등급을 두지 않는다. 퇴사자는 Workspace에서 제거하면 새 로그인은 막히지만, 이미 발급된 세션(최대 5일)은 만료까지 유효하다 — 즉시 차단이 필요하면 `SESSION_SECRET` 교체(전원 재로그인).
4. **환수는 청구서·지급명세서에 마이너스 한 줄로 들어간다.** 정상 줄은 각자 제 금액으로 수금/지급 처리하고, 환수 줄은 같은 문서 안에서 상계로 회수된다. 통장 금액 = 정상 줄 합계 − 환수(부가세 포함) = 문서 total. 환수가 든 문서의 행별 수금/지급 잠금을 해제했다(`domain/settlement/lifecycle.ts`).

---

## DEC-2026-09-26-01 — 기능 개발 단일축과 취소/해지 판정 기준
상태: USER CONFIRMED / ADOPTED
대체 관계: **DEC-2026-09-25-03의 인도 전 취소 정의를 이 결정이 덮어쓴다.**

### 기능 개발 단일축
- 기능 런타임의 코드 정본은 main 한 곳이다.
- 기능 작업의 단일 진입점은 docs/FUNCTION-AUTHORITY.md다.
- 현재 접수 정본은 Intake / settlement_rows / src/domain/settlement/**다.
- 과거 src/domain/application/**, src/services/applications.ts, file/json Application Repository는 **LEGACY_QUARANTINED**다.
- 과거 diverged 브랜치는 통째로 merge하지 않고 current main에 없는 유효한 의미와 회귀테스트만 선별 이식한다.
- PR/작업 브랜치는 merge 전에는 staging/evidence일 뿐 기능 정본이 아니다.

### 접수취소 / 계약취소 / 계약해지
업무 판정축은 전자서명 여부가 아니라 **계약금 실제 수납 사실**과 **인도 사실**이다.

```text
계약금 수납 전
  → 접수취소

계약금 수납 후 + 인도 전
  → 계약취소

인도 후
  → 계약해지
  → 환수 검토
```

### 계약금과 보증금 구분
- 여기서 계약금은 고객에게 실제로 받은 **계약금 수납 사실**이다.
- 상품/Offer의 차량 **보증금(deposit)** 과 계약금은 다른 업무 사실이다.
- 보증금이 0원/유/무인지로 계약금 수납 여부를 추론하지 않는다.
- 계약금 수납은 최소한 금액, 수납시각, operation/receipt 식별자를 추적할 수 있는 사실로 모델링한다.

### 후속 처리
- 접수취소는 계약금 수납 전 접수 종료다.
- 계약취소는 계약금 수납 후 인도 전 계약 종료다. 계약금 환불/공제 등 금전 후속은 별도 규칙과 증거로 처리한다.
- 계약해지는 인도 후 종료이며 기존 실적·청구·수금·지급 이력을 되돌리지 않는다.
- 계약해지는 환수 검토대상을 만들지만 환수 여부/금액을 자동 확정하지 않는다.



---

## DEC-2026-09-26-02 — 접수 상세 · 분납 · 실적 전환을 F04 운영 의미와 정렬
상태: USER CONFIRMED / ADOPTED

### 접수 핵심 입력
상품에서 Product/Offer/기간을 고른 뒤 접수할 때 운영자가 반드시 확인하는 핵심값은:
- 영업채널
- 영업담당자
- 고객명
- 분납여부(일시납 / N회분납)

분납여부는 부가정보가 아니다. 인도 이후 실적 분류와 청구월을 결정하는 업무 원자이므로 접힌 선택영역에 숨기지 않고 필수값으로 받는다.

### 접수 상세의 역할
접수 상세는 별도 업무 원장을 만들지 않고 같은 Intake/settlement row의 진행 사실을 관리한다.

최소 상시 확인 사실:
- 계약서
- 차량번호
- 인도완료 / 인도일
- 분납여부
- 계산 청구월
- 다음회차일
- 납입회차
- 청구/지급 진행상태

### 실적 전환
F04 현행 운영 의미를 따른다.

```text
인도 전
  → 접수

인도 완료 + 일시납
  → 완납실적

인도 완료 + 분납
  → 분납실적

분납 만료/완납
  → 완납실적
```

같은 달 접수라는 이유로 인도완료 건을 접수에 계속 남기지 않는다.

### 청구월
청구월은 두 번째 계산기를 만들지 않고 `src/domain/settlement/stage.ts`의 기존 단일 엔진이 계산한다.
- 인도 전: 청구월 없음
- 일시납: 인도월
- 분납: 현행 시행일/분납 규칙에 따른 완납 청구월
- 확정/발행된 `billMonth`가 있으면 그 값이 이긴다
- 다음회차일은 인도일과 명시된 납입회차에서 파생한다

Google Sheet는 현행 업무 의미를 확인하는 운영 증거/참조이며 Admin/FreePass Data의 두 번째 SSOT가 아니다.
