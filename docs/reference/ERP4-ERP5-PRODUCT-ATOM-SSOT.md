# ERP4 상품원자 → 같은 Firebase ERP5 버전 경로 (참고 전용)

작성일: 2026-09-14
상태: **VERIFIED BY READING / NOT CONNECTED TO v1**
출처: `freepass-creator/freepasserp4` (운영 레포). v1은 이 Firebase/컬렉션/시크릿을 연결하지 않는다.

> 사용자가 2026-09-14에 “ERP5 Firebase를 쓰면서 ERP4 상품원자를 당겨오는 것”을 확인하라고 지시했다. 이 문서는 그 경로의 실체다. 운영 fallback, 환경변수 복사, 기존 프로젝트 연결은 금지다.

---

## 1. 한 줄

ERP5는 **별도 Firebase 프로젝트가 아니다.** ERP4가 쓰는 같은 프로젝트(`freepasserp3`) 안에 버전 컬렉션을 만들고, Firestore `products`의 공개 원자만 단방향으로 복사한다.

운영 파인더/관리자 화면은 여전히 `products`를 직접 구독한다. `/erp5` UI는 2026-08-28 보류이며 이 SSOT 경로와 다른 실험 화면이다.

---

## 2. 실제 데이터 흐름

```text
공급사 Google Sheet (전용 Adapter)
        │  rent / rentVariants / depositPolicy
        ▼
ERP4 Firestore `products`          ← 운영 원자 SSOT (finder onSnapshot)
        │  exportProductForErp5() 공개 allowlist
        ▼
productMasterVersions/{versionId}/products/{erp4ProductId}
        │  --apply --activate 일 때만
        ▼
ssotState/products.activeVersionId
```

발행기: `scripts/publish-products-to-erp5-firestore.mts`  
계약: `lib/domain/erp5-product-ssot.ts`  
원자 역할표: `lib/domain/atom-fields.ts` (`공통 / 변동 / 정책 / 메타`, 나머지는 `비공통` 계산)  
해소기: `lib/domain/atom-projection.ts` (정책·회사명·요금을 한곳에서 join. 소비처는 포맷만)

차종마스터는 별 경로다. Google Sheet `차종마스터` + `vehicle-master` Encar 참조본 → `vehicleMasterVersions/*`. 상품 원자 발행과 섞지 않는다.

---

## 3. 2026-09-13 실게시 증거

GitHub Actions `ERP5 상품 SSOT 1회 게시` run `34774013116` (성공):

| 항목 | 값 |
|---|---|
| mode | `apply-draft` (`--apply`만, `--activate` 없음) |
| source | `freepasserp3/firestore/products` |
| target | `productMasterVersions/same-firebase-products-34774013116-1/products` |
| 복사 대수 | 1538 |
| 어댑터 원천 행 | IANKA 20 / IRON 51 / AUTOPLUS 177 / SONOGONG 103 |
| adapter_pricing 부착 | 298대 |
| coverage blockers | 320대 (listable 상품이 시트 원천과 안 맞음) |

활성 포인터 `ssotState/products`는 이 실행에서 바꾸지 않았다. blocker가 있으면 활성화 자체가 거절된다.

CI 회귀 `sim:erp5-product-ssot` 10/10 PASS. 값은 바꾸지 않고, 빈 기간은 버리고, 오토플러스는 제조사 없으면 국산 보증금 규칙을 추정하지 않는다.

---

## 4. ERP4 원자 역할 → v1 Canonical 대응

필드명을 v1 테이블에 그대로 복제하지 않는다. 의미만 옮긴다.

| ERP4 역할 | 예시 필드 | v1 위치 |
|---|---|---|
| 공통 · 차 정체 | origin, maker, model, sub_model, trim_name | Vehicle master. 확인된 깊이만. 빈 트림을 `기본형`으로 채우지 않음 |
| 공통 · 제원 | year, fuel_type, engine_cc, seats, drive_type, battery_capacity | `specs` |
| 공통 · 실차 | car_number, first_registration_date, ext_color, int_color, options, photo_link | `registration` / 표시. VIN은 ERP5 공개본에서 제외됨 |
| 변동 | status*, mileage, price | 상태/주행은 변동값. `price`는 ERP4 요금표이며 v1 Offer 행으로 분해해야 함 |
| 정책 | policy_code | Policy Definition 조인. 화면이 재해석하지 않음 |
| 메타 | provider_company_code, source*, listable, 검수상태, product_code | ADMIN 진단. 목록 기본 노출 금지 |
| 비공통 | 역할표에 없는 키, `원문` | 검수 신호. Canonical로 자동 승격 금지 |

ERP5 공개 allowlist에 추가로 붙는 것:

- `offer_terms`: 오토플러스 `termMonths × annualKm`, 손오공 `termMonths` + 월대여료×연수(최대×3)
- `adapter_pricing`: 시트 Adapter가 읽은 rent/variants/deposit. Firestore `products`만 보면 이 축이 빠질 수 있음

보내지 않는 것: 수수료·커미션·마진·원가, 계약/상담/고객, 전화·이메일·주소·계좌, 차대번호, 내부 `photo_cache`.

필수: `car_number` 없는 문서는 게시 거부.

---

## 5. v1이 가져오면 안 되는 ERP5 차종 규칙

차종 발행기는 빈 세부트림을 ERP5 투영에서만 `기본형`으로 채우고 `trimDefaulted: true`를 남긴다.

v1 MASTER/정제칸 규칙과 충돌한다. **v1은 빈 트림을 `기본형`으로 채우지 않는다.** 세부모델까지만 확정하고 트림은 비운다.

---

## 6. 에이전트 실수 방지

하지 말 것:

- v1에 `freepasserp3` / 기존 `GOOGLE_SA_JSON` / ERP4 환경변수를 연결
- Codex처럼 데모 상품을 Canonical SSOT인 양 구현
- `/erp5` 실험 UI를 v1 ADMIN 시안으로 가져오기
- ERP4 `price` blob을 월대여료 한 칸으로 납작하게 만들기
- 공개 allowlist 밖 필드(수수료, 고객, VIN)를 검색 카드에 노출
- 이 경로를 “v1 독립 Firebase 연결 완료”로 보고

해도 되는 것(승인된 다음 슬라이스):

- 위 원자 역할을 Search/Detail Projection 계약의 근거로 쓰기 (PR #4와 동일 철학)
- Adapter 가격축(`rentVariants`)을 v1 Offer 반복 객체로 설계
- 실제 연결은 **신규 Firebase**와 승인된 Source Contract 이후. 그때도 ERP4를 fallback으로 두지 않음

확인 상태: `DESIGNED`(참고 문서) / 연결 `NOT AUTHORIZED`.
