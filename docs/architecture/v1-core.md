# v1 Core Architecture

## Goal
공급사별 제각각인 원문을 상품원자로 한 번 확정하고, 버전 Canonical SSOT를 ADMIN·SALES·WHITE LABEL이 같이 쓴다. 2026-09-14부터 이 원자 SSOT가 freepasserp.com의 제품 핵심이다.

```text
Supplier RAW
    ↓
Supplier Adapter (가격축 보존)
    ↓
Product atoms
  공통 / 변동 / 정책 / 메타
  비공통 = 계산(검수)
    ↓
Versioned Canonical Product SSOT
  (active pointer, not live overwrite)
    ↓
Common Search (same-Offer)
    ├── ADMIN
    ├── SALES
    └── WHITE LABEL (B2C)
            ↓
        Application Snapshot
            ↓
 contract / documents / delivery / cancel
            ↓
        Settlement
```

화면은 원자를 다시 해석하지 않고 해소된 값을 포맷만 한다. 기존 ERP Firebase는 이 그림의 운영 노드가 아니다.

## Vehicle
모델 계층은 `origin → manufacturer → model → subModel → trim`이다. 상품은 공급사 원문에서 확인된 가장 깊은 유효 노드에 연결할 수 있다. 모델까지만 확인된 상품도 정상 저장할 수 있으며 세부모델/트림을 추측하지 않는다.

연료·배기량·인승·구동·배터리 등은 모델 계층이 아니라 `specs`로 분리한다. 차량번호/VIN/최초등록일 등은 `registration` 영역으로 분리한다.

## Offer
기간은 고정 컬럼이 아니다. 같은 상품에 1/6/18/36개월 등 공급사가 제공하는 실제 조건을 Offer 행으로 여러 개 연결한다. 검색은 서로 다른 Offer의 값을 섞지 않는다.

## Policy
Policy Definition은 확장 가능하다. 카드결제, 카드수수료, 선불/후불, 최소연령, 보증금 분납 등은 Policy ID + typed value로 표현한다. 새 표현은 기존 Policy Definition으로 매핑하고, 새로운 업무 의미가 필요한 경우 승인 전 구현하지 않는다.

## Adapter
RAW는 증거/재처리용으로 보존한다. Adapter는 공급사별 양식의 위치·단위·범위·표현을 해석한다. 기존 승인 매핑을 우선 재사용하고 새 표현·모순·양식 변경은 REVIEW_REQUIRED로 올린다.

## Search
검색은 개발의 핵심 완료 기준이다. 모델/세부모델/세부트림의 부분 매칭을 지원하되, 상세도가 부족한 상품을 더 구체적인 차종이라고 거짓 확정하지 않는다. 가격/보증금/기간/약정주행거리/Offer 정책은 동일 Offer에서 동시에 만족해야 한다.
