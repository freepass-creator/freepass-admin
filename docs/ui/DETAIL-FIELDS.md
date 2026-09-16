# 상세·목록에 무엇을 넣나 — 원자에서 끌어온 항목 규격

최종: 2026-09-16 · 규격(높이·폭·여백)은 [UI-SPEC.md](UI-SPEC.md)

> ★**새로 세지 않았다.** 아래는 전부 «이미 있는 것»을 읽어 온 것이다.
> 어긋나면 이 문서를 고친다. 딴 데 새 목록을 만들지 않는다.

## 0. 어디서 읽었나

| 무엇 | 어디 | 몇 개 |
|---|---|---|
| **상품 원자** | `freepasserp4/lib/intake/entities.ts` → `product` | **48** |
| **정책 원자** | 〃 `policy` | **50+** (보험·계약조건이 여기 다 있다) |
| **계약(접수) 원자** | 〃 `contract` | **90+** (`_snapshot` 붙은 것이 «굳는» 값) |
| **접수원장 시트** | `[F04 사용중] 프리패스 정산원장` `1BjGBq…8SR4` · 탭 `접수·취소·분납실적·완납실적` | 32열 |
| 읽는 코드 | `freepasserp4/lib/server/settlement-ledger-read.ts` — **한 곳** | |
| **화면 규격** | `teamjpkwork/lib/erp/화면들.ts` — 기둥·합계·상세·단추·폰줄 | |
| 칸 폭 실측 | 〃 `자` | 12가지 |
| 찾아간 길 | `aiops/docs/어디를보나.md` 128행 | |

★F04 머리글은 **1행이 아니라 「차량번호」가 있는 줄**이다(1행엔 탭 설명이 붙어 있다).

---

## 1. ★먼저 — 지금 시안과 «실제 원장»이 다르다

우리 시안은 진행을 **계약서 · 필수서류 · 인도** 셋으로 뒀다.
그런데 **F04 접수원장이 실제로 읽는 것은 넷**이다:

```
계약서(체크) · 인도일(날짜) · 취소(체크) · 환수(체크)
```

> ★「상태」 열은 **2026-09-01에 걷어냈다**. 체크 넷으로 읽는다. — `settlement-ledger-read.ts`

두 가지가 갈린다.

| | 시안 | F04 원장 | 판단 |
|---|---|---|---|
| **필수서류** | 있음 | **없음** | 원장엔 칸이 없다. fp4 `contract` 에는 `agent_docs_submitted`·`provider_docs_review` 로 있다 → **원자에는 있고 원장 시트에만 없다.** 시안대로 두되 원장 붙일 때 매핑이 필요 |
| **환수** | 없음 | **있음** (`환수일`·`환수금액`·`환수사유`) | ★**빠졌다.** 인도 뒤에 돈이 되돌아 나가는 자리라 실적·정산에 직접 닿는다. 넣어야 한다 |

그리고 fp4 `contract` 에는 진행 체크가 **열한 개**다:

```
출고문의 → 출고응답 → 서류제출 → 서류확인 → 계약금입금 → 잔금입금
→ 약정발송 → 약정작성완료 → 잔금확인 → 인도확인 → 출고완료
```

WORK-INBOX §6 은 「`차량준비` 는 우리 업무가 아니라 만들지 않는다」로 이걸 셋으로 줄였다.
**그 결정은 유효하다** — 다만 열한 개 중 **어느 것이 셋에 접히는지**를 적어 둔다:

| 우리 셋 | 접히는 fp4 단계 |
|---|---|
| **계약서** | 약정발송 · 약정작성완료 · (서명) |
| **필수서류** | 서류제출 · 서류확인 |
| **인도** | 인도확인 · 출고완료 |
| (안 쓴다) | 출고문의 · 출고응답 — 공급사 쪽 일이다 |
| **★따로 세워야** | 계약금입금 · 잔금입금 · 잔금확인 — 이건 **돈**이라 진행 체크가 아니라 정산에 붙는다 |

`DECISION REQUIRED` — **계약금·잔금을 접수상세에서 보나?** 지금 시안엔 없다.

---

## 2. 상품 상세 — 우리렌탈 다섯 섹션

대표가 준 우리렌탈 상세페이지의 다섯 섹션이 **fp4 원자에 그대로 있다.** 새로 만들 것이 없다.

### ① 차량 정보 — `product` 원자
```
선택옵션   options · supplier_options(원문) · fp_options(표준 ID)
색상       ext_color 외장 · int_color 내부      ← 색동그라미 드롭다운
차량 제원  year 연식 · mileage 주행거리 · fuel_type 연료 · engine_cc 배기량
           drive_type 구동 · transmission 변속기 · seats 인승
관리자만   car_number 차량번호 · vin 차대번호 · first_registration_date 최초등록일
           vehicle_status 상품상태 · accident_history 사고여부 · location 위치
           product_code 상품코드 · provider_name 공급사 · catalog_id 차종카탈로그
```
★**차종 계층은 넷까지만** — `maker → model → sub_model → trim_name`.
공급사 원문이 모자라면 확인된 데까지만 쓰고 아래는 **`미확인`** (AGENTS.md §6).
`supplier_vehicle_name`(공급사 차명 원문)은 **ADMIN 진단 영역**에만 둔다.

### ② 대여료 — `Offer` (우리 도메인)
```
기간 탭    12 · 24 · 36 · 48 · 60          ← 공급사가 «실제로 주는» 것만
행         약정주행거리  annual_mileage
열         보증금 0% · 보증금 10% · 선납금 30%
칸         월 대여료
주석       ※ VAT 포함 여부 — policy 에 칸이 없다 → DECISION REQUIRED
```
★**칸 하나 = Offer 하나**다. 기간을 탭으로 빼서 축을 고정했기 때문에
`§12 압축 가로표 폐기`와 부딪히지 않는다. 다만 **없는 조합은 빈칸**이고,
그 빈칸은 **「없음」이 아니라 「미확인」**이다 — 0원으로 읽히면 안 된다.

★도메인 보강 필요: `Offer.deposit` 은 **금액**만 있고 **비율(%)** 이 없다.
`prepayment` 도 금액이다. 우리렌탈처럼 가려면 비율을 넣어야 한다.

### ③ 보험 조건 — `policy` 원자 (그대로 있다)
```
대인   injury_compensation_limit · injury_deductible
대물   property_compensation_limit · property_deductible
자손   self_body_accident · self_body_deductible
자차   own_damage_compensation · own_damage_repair_ratio · own_damage_min_deductible
무보험 uninsured_damage · uninsured_deductible
운전자 basic_driver_age 연령 · license_period 경력 · driver_age_lowering 하향
       personal_driver_scope / business_driver_scope 운전범위
       additional_driver_allowance_count 추가운전 인원
포함   insurance_included
```
★**`[계약회사별]`** 이 붙은 항목들이다 — 공급사마다 다르다. 상품이 아니라 **정책**에 붙는다.

### ④ 계약 조건 — `policy` 원자
```
기간·거리 annual_mileage · max_annual_mileage
초과주행  over_mileage_rate_domestic / _imported · mileage_upcharge_per_10000km
중도해지  early_termination_rate_under1y / _over1y
결제      payment_method · payment_timing · payment_due_date
승계      succession_allowed · succession_fee
보증금    deposit_installment 분납 · deposit_card_payment 카드
정비      maintenance_service
심사      screening_criteria · credit_grade · disqualification_conditions 불가조건
제한      contracts_per_customer_limit 1인당 대수 · accident_termination_count
```

### ⑤ 기타 사항 — `policy` + `product`
```
대여지역  rental_region
탁송      delivery_fee
특이사항  sales_notes(영업) · policy_extra_terms(계약서)
필요서류  ★원자에 «없다» — 만들어야 한다 (개인: 신분증·면허증 / 법인: 사업자등록증·법인인감)
출고예상  ★원자에 «없다» — 만들어야 한다
```

### 상세 자리 — 좁은 칸(430px)에서

```
사진 + 썸네일(+N)
────────────────
칩: 제조사 · 공급사 · 확정도
차량명
세부트림
────────────────
월 대여료 (큰 숫자) · 보증금 · 약정주행
────────────────
대여 조건 표  ← 고르는 자리. 여기가 접수로 간다
────────────────
▸ 차량 정보   (펼침)
▸ 보험 조건   (접힘)
▸ 계약 조건   (접힘)
▸ 기타 사항   (접힘)
────────────────
[⋯] [공유]            [■ 접수 등록]
```
★**아코디언으로 접는다.** 다섯 섹션을 다 펴면 430px 칸에서 끝없이 내려간다.
차량 정보만 펴 두고 나머지는 접는다 — 우리렌탈 모바일이 그렇게 한다.

---

## 3. 접수 상세 — F04 원장 + `contract` 원자

```
굳은 것 (_snapshot)
  차량   car_number_snapshot · vehicle_name_snapshot · trim_name_snapshot · year_snapshot
  조건   rent_month_snapshot 기간 · rent_amount_snapshot 월대여료
         deposit_amount_snapshot 보증금 · annual_mileage_snapshot 약정주행
  가산   mileage_surcharge_snapshot 주행가산 · age_surcharge_snapshot 연령가산
  정책   policy_name_snapshot · credit_grade_snapshot 심사기준
  ★수수료 fee_rate_snapshot 공급사율 · payout_rate_snapshot 지급율  ← «동결» 이라고 원자가 말한다
  특약   special_terms_snapshot

사람
  고객   customer_name · customer_phone · customer_birth · customer_email
         customer_is_business 사업자 · customer_company_name · customer_business_number
  ★민감  customer_id 주민번호 · driver_license_no 면허번호 · customer_address
  비상   emergency_name · emergency_relation · emergency_phone
  영업   agent_name · agent_code · agent_channel_code
  공급사 provider_company_code

진행
  계약서 provider_agreement_sent → provider_agreement_done → sign_status
  서류   agent_docs_submitted → provider_docs_review
  인도   agent_handover_confirmed → provider_release_completed
  ★환수  환수일 · 환수금액 · 환수사유 (F04)
  취소   cancelled_at · contract_status

전자계약
  sign_status · sign_sent_at · sign_signed_at · signed_pdf_url · unsigned_pdf_url
  esign_provider · esign_revision · esign_document_sha256 · esign_verify_url

메모 — ★셋이 «따로» 다
  memo_agent 영업자 · memo_provider 공급사 · memo_admin 관리자
```

★**주민번호·면허번호·주소가 원자에 있다.** 화면에 그냥 뿌리면 안 된다.
WORK-INBOX §12 의 `AI Core 추가 결정 필요 ①`(개인정보 보관·권한·마스킹·파기)이 바로 이것이다.
→ **기본은 마스킹**, 볼 권한이 있을 때만 「보기」를 눌러 연다. 연 기록은 남긴다.

★**메모가 셋**이다. 한 칸에 합치면 영업자가 쓴 말이 공급사에게 보인다. 갈라 둔다.

---

## 4. 목록(표) 기둥 — 레트로 칸 폭을 그대로 쓴다

`teamjpkwork/lib/erp/화면들.ts` 의 `자` 는 **실측**이다. 새로 재지 않는다.

```
번호 42 · 짧은수 45 · 작은말 56 · 꼬리표 78 · 날짜 83 · 차번 74
돈 92 · 이름 116 · 연락처 98 · 차종 118 · 긴것(VIN) 146 · 자동 0
```
★`자동: 0` 은 **한 화면에 하나만**. 남는 자리를 다 가져간다.

### 상품 목록
| 키 | 이름 | 폭 | 맞 |
|---|---|---|---|
| `_thumb` | (사진) | 52 | c |
| `vehicle_name` | 차량 | 차종 118 | l |
| `trim` | 세부트림 | 자동 | l |
| `provider_name` | 공급사 | 이름 116 | l |
| `term` | 기간 | 짧은수 45 | r |
| `rent` | 월 대여료 | 돈 92 | r |
| `match` | 확정도 | 꼬리표 78 | c |

### 접수 목록
| 키 | 이름 | 폭 | 맞 |
|---|---|---|---|
| `_thumb` | (사진) | 52 | c |
| `customer_name` | 고객 | 이름 116 | l |
| `contract_code` | 접수번호 | 꼬리표 78 | l |
| `vehicle_name` | 차량 | 차종 118 | l |
| `channel` | 영업채널 | 이름 116 | l |
| `rent` | 월 대여료 | 돈 92 | r |
| `state` | 상태 | 꼬리표 78 | c |
| `received_at` | 접수일 | 날짜 83 | c |

★**합계**를 낼 칸: 상품 없음 · 접수 `rent`. 레트로 `화면` 은 `합계: string[]` 을 갖는다.

---

## 5. 폰 한 줄 — 레트로 `폰줄` 규격 그대로

> 대표(2026-09-05): 「모바일은 정보를 많이 볼 필요는 없잖아. **조회 위주**로 봐야 되는데」
> ★PC 표를 «접어서» 열다섯 칸을 다 보이면 그건 조회 화면이 아니라 자료 덤프다.

```ts
폰줄 = { 큰, 곁: string[], 값, 값곁 }
       무엇인가   흐린 곁값 둘까지   얼마인가   어떤가
```

| 화면 | 큰 | 곁 | 값 | 값곁 |
|---|---|---|---|---|
| 상품 | 차량명 | [세부트림, 공급사] | 월 대여료 | 확정도 |
| 접수 | 고객명 | [차량, 영업채널] | 월 대여료 | 상태 |
| 실적 | 고객명 | [차량, 공급사] | 우리 마진 | 단계 |
| 청구 | 공급사 | [청구월, 실적 건수] | 미수액 | 상태 |
| 지급 | 영업채널 | [지급월, 실적 건수] | 미지급액 | 상태 |
| 전자계약 | 고객명 | [차량, 받는 곳] | 발송일 | 상태 |

---

## 6. 정해야 할 것

| # | 무엇 | 왜 막혔나 |
|---|---|---|
| 1 | **환수를 접수상세에 넣나** | F04 원장에 있는데 시안에 없다. 돈이 되돌아 나가는 자리다 |
| 2 | **계약금·잔금을 접수에서 보나** | fp4 에 `agent_balance_paid`·`agent_final_paid` 가 있다. 진행 체크가 아니라 «돈» 이라 어디에 붙일지 |
| 3 | **보증금 비율(%)** | 우리렌탈은 `보증금 0% / 10%` 인데 `Offer.deposit` 은 금액뿐. 도메인 보강 필요 |
| 4 | **VAT 포함/별도** | `policy` 에 칸이 없다. 우리렌탈 상세엔 주석이 있다 |
| 5 | **필요서류 · 출고예상기간** | 원자에 없다. 만들어야 한다 |
| 6 | **민감정보 마스킹 기준** | 주민번호·면허번호·주소가 원자에 있다. 누가 언제 볼 수 있나 |
| 7 | **메모 셋의 노출** | 영업자·공급사·관리자 메모를 관리자 화면에서 다 보나 |
