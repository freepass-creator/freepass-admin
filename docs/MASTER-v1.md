# freepasserp.com v1 — FINAL MASTER DESIGN

Status: v1 development baseline

## 0. Product definition
freepasserp.com v1은 기존 FreePass ERP와 운영·데이터·인증·배포 의존성이 없는 독립 신규 프로젝트다. 기존 구현은 명시적으로 필요한 UX/업무 아이디어를 읽어 참고할 수 있지만 기존 DB, Firebase, API, 시트, 환경변수, 인증, fallback을 연결하지 않는다.

v1의 화면 제품은 정확히 세 개다.
1. ADMIN — FreePass 내부 관리자
2. SALES — 제휴 영업자
3. WHITE LABEL — 최종 고객용 B2C 엔진. 회사별 BI/CI는 설정으로 바꾼다.

역할별 현재 확정 범위:
- ADMIN: 상품 검색/상세, 계약 접수, 접수 관리, 실적, 정산, 청구, 수금, 지급
- SALES: 상품 검색과 상품 상세 확인만. 계약 접수 및 접수 이후 업무 접근 금지
- WHITE LABEL: 기존 시스템을 활용해 별도로 수정. 신규 ADMIN 업무 권한과 연결 금지

v1의 첫 제작 범위는 ADMIN의 핵심 수직 흐름이다.

> Canonical 상품 → 검색/필터 → 상품상세 → 접수 → 접수목록 → 접수상세 → 계약서/서류/인도/취소

2026-09-13 사용자 변경에 따라 UI 추가 개선보다 ADMIN 기능 검증을 우선하며, 위 흐름에 `인도 → 실적 → 영업채널/공급사 확인 기록 → 정산 확정 → 청구 → 수금 → 지급`을 이어서 구현한다. SALES/WHITE LABEL의 신규 운영화는 이 기반이 실제 데이터로 검증된 뒤 진행한다.

---

## 1. ADMIN 화면 골격 — 1:1:1
PC의 핵심 업무 화면은 같은 폭의 세 패널을 유지한다.

### LEFT — PRODUCT LIST
- 상품 검색
- 빠른조건
- 상세필터
- 필터 선택 칩/초기화
- 검색조건에 맞는 Offer 가격 표시
- 부분 차종 매칭의 정확/미확인 구분
- 선택 상품 강조

### CENTER — PRODUCT DETAIL
- 요약 / 상세정보 탭
- 사진 1장 중심 + 확대/추가사진
- 모델정보
- 제원/실차정보
- 선택된 Offer
- 보증금/약정주행거리/보험 등 계약조건
- 유효 Policy 배지
- 공유
- `접수하기`

접수목록에서 기존 접수를 열었을 때에는 현재 상품이 아니라 `접수 당시 조건` Snapshot임을 명확히 표시한다.

### RIGHT — WORK PANEL
같은 패널이 업무 문맥에 따라 변한다.
- 접수목록
- 신규접수
- 접수상세
- 이후 정산/청구

상품목록과 상품상세는 기본 문맥으로 유지하고, 접수하기를 누르면 오른쪽만 접수폼으로 전환한다.

모바일은 같은 정보 구조를 `LIST → DETAIL → WORK` 한 화면씩 사용한다. 접수/업무 목록은 필요 시 바로 진입할 수 있다.

---

## 2. 접수 UX
### 경로 A
상품목록 → 상품상세 → 접수하기 → 오른쪽 신규접수

선택한 `product_id + offer_id + product_version`을 접수폼에 전달한다.

### 경로 B
오른쪽 `+ 신규접수` → 상품검색 → 선택 → 같은 접수폼

접수폼을 두 벌 만들지 않는다.

### 저장 시 Snapshot
접수 저장 시 다음을 현재 상품과 분리해 보존한다.
- product id / supplier
- vehicle master ref 및 확인 깊이
- 필요한 제원
- 선택 Offer의 기간/대여료/보증금/약정주행거리 등
- 적용 Policy
- channel/source
- captured_at

현재 상품 가격이나 정책이 나중에 변경돼도 저장된 접수 조건을 조용히 바꾸지 않는다.

---

## 3. 접수 진행관리
FreePass가 직접 하지 않는 `차량준비` 같은 단계를 만들지 않는다.

사용자가 확인할 핵심 체크:
- 계약서 완료
- 필수서류 완료
- 인도 완료
- 취소

대표 상태:
- RECEIVED
- CONTRACTED
- DELIVERED
- CANCELLED

서류 완료는 별도 체크 사실로 유지한다. 상태와 체크값을 한 문자열에 뭉개지 않는다.

접수목록은 세로 스크롤 중심이며 각 카드/행에서 고객, 차량, 접수번호, 핵심 조건, 계약서/서류/인도 체크를 빠르게 파악한다. 접수 항목을 더블클릭하면 오른쪽 패널이 접수상세로 전환된다.

정정은 삭제가 아니라 변경자/시각/사유를 남기는 구조로 확장한다. 취소 후에는 진행체크를 일반 변경하지 않는다.

---

## 4. Canonical Product SSOT
공급사 원문은 FreePass 업무 화면의 SSOT가 아니다.

```text
Approved Supplier RAW
 → Snapshot
 → Supplier Adapter
 → Mapping + Validation
 → Canonical Product Version
 → Common Search
 → ADMIN / SALES / WHITE LABEL
```

RAW는 근거/재처리용으로 보존한다. 승인된 매핑은 반복 재사용한다. 같은 표현을 매번 AI가 다시 해석하지 않는다. 새 표현, 모순, 양식변경만 검수한다.

---

## 5. Vehicle Master
모델 계층은 여기까지만이다.

`원산지 → 제조사 → 모델 → 세부모델 → 세부트림`

연료/배기량을 모델명 계층에 추가하지 않는다.

차종마스터는 유효 관계를 가진 CLOSED MASTER다. `현대 + K5` 같은 불가능한 조합을 저장하지 않는다.

상품은 공급사 원문이 확인된 가장 깊은 유효 노드에 연결할 수 있다.
- MODEL
- SUB_MODEL
- TRIM
- UNMATCHED

따라서 `현대 쏘나타`만 있는 정상 상품도 모델까지만 연결해 저장한다. DN8이나 트림을 추측하지 않는다.

모델이 유일하게 확정되면 원산지와 제조사는 마스터 관계에서 파생한다. 원문과 모순되면 원문을 조용히 고치지 않고 충돌을 기록한다.

### 별도 사실 영역
제원: 연식, 연료, 배기량, 인승, 구동, 배터리 등 승인된 기술정보.

등록/실차: 차량번호, VIN, 최초등록일, 실제 주행거리, 실제 색상/옵션 등.

모델정보/제원/등록정보를 한 문자열에 합치지 않는다.

---

## 6. Offer
대여기간을 DB 고정 컬럼으로 만들지 않는다. 공급사가 제공하는 실제 선택지를 행/객체로 보존한다.

Offer 예:
- termMonths
- monthlyRent
- deposit
- prepayment
- annualMileageKm
- insurance/기타 승인 조건
- offer-scope policies

1/6/18/24/36/48/60개월 등 실제 제공값을 수용한다.

검색은 반드시 동일 Offer 하나가 기간·가격·보증금·약정주행거리·해당 정책을 동시에 충족하는지 판정한다. 서로 다른 Offer의 값을 합쳐 존재하지 않는 조건을 만들지 않는다.

---

## 7. Policy Engine
사업정책은 확장형으로 관리한다.

예:
- 최소연령 / 만21세 가능
- 운전경력
- 카드결제 가능
- 카드수수료
- 결제시점 선불/후불
- 보증금 분납
- 기타 신규 정책

Policy Definition은 안정된 ID, 표시명, 타입, 단위, 허용값, 검색가능 여부, 역할별 노출, 적용범위를 가진다.

지원 타입:
BOOLEAN / NUMBER / MONEY / PERCENTAGE / SINGLE_SELECT / MULTI_SELECT / TEXT / DATE

`카드 가능`, `카드결제 O` 같은 승인 표현은 같은 Policy로 매핑할 수 있지만 `카드 불가`, `보증금만 카드`, `승인 시 가능`을 같은 TRUE로 뭉개지 않는다.

새 정책 때문에 Product 테이블에 임의 컬럼을 계속 추가하지 않는다.

---

## 8. Search First
v1 상품영역의 가장 중요한 완료 기준은 검색이다.

검색축:
- 모델: 원산지/제조사/모델/세부모델/세부트림
- 제원/실차: 승인된 검색 필드
- 가격/계약: 기간/월대여료/보증금/선납금/약정주행거리
- Policy: 연령/결제/분납 등
- ADMIN 내부: 공급사/최신성/검수상태 등 권한 필드

같은 축의 복수값은 기본 OR, 서로 다른 축은 기본 AND로 하되 Policy별 의미가 다르면 정의된 연산을 따른다.

### 부분 차종 매칭
- 모델 검색: 모델 노드와 하위 확정 상품 포함
- 특정 세부모델/트림 검색: 해당 경로 확정 상품은 EXACT
- 상위까지만 확인된 상품은 허용된 화면에서 PARTIAL/정보미확인 후보로 별도 구분
- 다른 세부모델로 확인된 상품은 후보에도 섞지 않음

미확인 ≠ 불가, 공란 ≠ 0원, 미기재 ≠ 무제한.

### 검색 연속성
검색 결과는 `matched offer id`를 보존한다.
18개월 검색이면 카드도 18개월 가격을 표시하고, 상세도 18개월을 선택하며, 접수도 그 Offer를 기본값으로 이어간다.

---

## 9. Filter UX
기존 화이트라벨에서 사용자가 편하다고 평가한 검색 경험은 UX 참고 기준으로 삼는다. 기존 데이터 연결이나 코드를 의존성으로 가져오지 않는다.

모바일 상세필터의 우선 UX:
- 왼쪽: 필터 항목
- 오른쪽: 선택값
- 항목별 선택 개수
- 현재값을 복제한 Draft
- 닫기 = 적용하지 않음
- 결과보기 = Draft 적용
- 빠른조건과 상세필터가 같은 선택상태 공유

정책이 늘어나도 모든 필터를 첫 화면에 늘어놓지 않는다. 자주 쓰는 조건은 Quick Filter, 나머지는 상세필터. 필터 자체를 `카드`, `후불`, `분납` 등으로 찾아 해당 항목으로 이동하는 기능을 설계한다. 항목 찾기가 자동으로 조건을 선택하지는 않는다.

---

## 10. Supplier Adapter
어댑터 완료는 HTTP/시트 연결 성공이 아니다.

공통 구조:
```text
Connector
 → RAW Snapshot
 → Supplier/Format Adapter
 → Common Candidate
 → Mapping/Validation
 → Review/Version Commit
 → Search
```

공급사별 `Source Contract`에 출처, 탭/범위, 헤더, 상품경계, 상품키, 단위, 빈값 의미, 공통 안내 범위, 표현사전, 전체/변경분 의미, 최신성 기준을 버전으로 정의한다.

어댑터는 값만 복사하지 않는다. 승인된 양식에서 값 + 헤더 + 단위 + 공통안내 + 적용범위를 함께 해석해야 한다.

원칙:
- RAW 보존
- 승인된 표현 매핑 재사용
- 실제 가격/정책 변경은 갱신
- 양식 변경은 감지/검수
- 일부 수집 실패를 전체 재고 없음으로 해석하지 않음
- 오래된 실행이 최신 버전을 덮지 않음
- 원문 속 URL/명령을 실행하지 않음
- 기존 ERP fallback 금지

초기에는 Adapter가 Candidate를 만들고 공통 검증/검수 후 Canonical을 확정한다. 범용 AI 파서를 먼저 만들지 않는다.

---

## 11. Data ownership / planned collections
물리 DB는 Firebase 연결 전에 다시 검증하되 논리적 저장 단위는 아래를 기준으로 한다.

- vehicleMasterNodes
- vehicleMasterAliases
- policyDefinitions
- suppliers
- sourceContracts
- sourceSnapshots
- mappingRules
- canonicalProducts
- productVersions
- applications
- applicationEvents
- salesChannels
- whiteLabelConfigs
- later: settlementBatches / settlementItems / billing / payments

검색용 인덱스/캐시는 Canonical에서 재생성 가능한 읽기 모델이며 별도 편집 SSOT가 아니다.

---

## 12. ADMIN first build sequence
### Phase A — 지금
1. 1:1:1 Admin Shell
2. Product List/Search/Filter state
3. Product Detail Summary/Detail
4. Right Work Panel state machine
5. Product → Application form
6. Application Snapshot
7. Application List
8. Application Detail + 계약서/서류/인도/취소
9. 인도 → Performance 결정적 1회 생성
10. 영업채널/공급사 확인 사실 기록과 정산 확정 Gate
11. Billing / Collection / Payout 분리 및 잔액 계산

### Phase B — SSOT 실제화
12. Vehicle Master schema + sample master
13. Policy Definition schema
14. Canonical Product repository
15. Search contract + facet counts
16. Adapter Candidate/Review model
17. Firebase 독립 프로젝트 연결 및 Rules/Auth 설계

### Phase C — 실제 원천 1곳 수직검증
18. 승인된 공급사 샘플 Source Contract
19. Read-only Adapter
20. RAW → Candidate → Review → Canonical
21. ADMIN 검색 → 상세 → 접수까지 실제 데이터 검증
22. 실패/재수집/변경/부분매칭 테스트

### Phase D
23. SALES 실제 상품조회 Surface + Auth
24. WHITE LABEL 기존 Surface 수정 + Brand Config

---

## 13. Acceptance — ADMIN first vertical slice
첫 관리자 수직 흐름을 완료라고 부르려면 다음이 실제로 이어져야 한다.

1. Canonical 상품을 검색한다.
2. 필터의 실제 Offer 조건이 결과 카드에 표시된다.
3. 상품을 누르면 같은 Offer로 상세가 열린다.
4. `접수하기`를 누르면 오른쪽 패널만 접수폼으로 바뀐다.
5. 저장하면 Application Snapshot이 생성된다.
6. 접수목록에 새 접수가 나타난다.
7. 접수상세를 열어 계약서/서류/인도를 확인한다.
8. 취소는 사유와 함께 별도 상태가 된다.
9. 상품 현재값을 변경해도 기존 접수 Snapshot은 유지된다.
10. 다른 Offer의 조건을 섞어 검색/접수하지 않는다.
11. 모델까지만 확인된 상품은 모델 검색에서 찾되 세부모델을 추측하지 않는다.
12. 기존 ERP/Firebase/API/시트가 없어도 이 흐름이 동작한다.

---

## 14. Deferred decisions
아래는 실제 자료/운영기준 없이 임의 확정하지 않는다.
- Firebase 프로젝트 ID, 리전, Auth 방식, 운영 권한
- 실제 공급사 Source Contract
- 실제 차종마스터의 v1 이관 여부/방법
- SALES에 노출할 공급사명/내부 상품 메타의 세부 범위
- 보험/세금/정책의 세부 계산
- 서류완료와 계약완료의 업무상 강제관계
- 자동 Canonical 승인 범위
- 정산의 세무/법인/부분수금 상세

---

## 15. Change rule
이 문서는 v1 개발 기준이다. 이후 사용자가 기준을 변경하면 기존 내용을 조용히 재해석하지 말고 변경 이유와 영향을 기록한다. 확정되지 않은 기능은 `DECISION REQUIRED`로 남긴다.
