# v1 Core Architecture

## Goal
공급사별 제각각인 원문을 한 번 freepasserp.com Canonical 언어로 확정하고, 같은 상품/검색 엔진을 ADMIN·SALES·WHITE LABEL이 사용한다.

```text
Supplier RAW
    ↓
Supplier Adapter
    ↓
Mapping + Validation
    ↓
Canonical Product SSOT
    ↓
Common Search
    ├── SALES ──────→ Product search/detail only
    ├── WHITE LABEL → Existing surface, separately revised
    └── ADMIN
            ↓
        Application
            ↓
 contract / documents / delivery / cancel
            ↓
        Settlement
```

`Application` 이후의 신규 업무 흐름은 ADMIN만 수행한다. SALES는 상품 검색과 상품 상세 확인까지만 허용한다. WHITE LABEL은 기존 시스템을 활용해 별도로 수정하며 신규 ADMIN mutation 권한을 공유하지 않는다.

## Authentication boundary
Firebase Auth 세션 쿠키의 검증된 uid를 기준으로 서버가 `staffAccounts/{uid}`의 ACTIVE 역할을 다시 읽는다. 요청 body/header/localStorage의 role, source, actorId는 권한 근거가 아니다. ADMIN 화면과 SALES 화면 모두 서버에서 capability를 검사하고, 모든 Command/Server Action도 같은 검사를 반복한다.

Firestore 브라우저 접근은 ADMIN·SALES 모두 catch-all deny다. SALES 상품은 서버가 Canonical Product에서 비민감 Projection을 만들어 전달한다. Firebase Admin SDK는 Rules를 우회하므로 서버 서비스와 IAM이 최종 데이터 경계다. 신규 Firebase 프로젝트 값 세 개를 명시하지 않으면 Admin SDK는 fail closed하며 기존 ERP 자격증명이나 로컬 ADC로 fallback하지 않는다.

현재 수준은 서버 경계 코드와 로컬 Firestore Emulator Rules 테스트까지다. 신규 Firebase 프로젝트 ID/리전/Auth provider/초기 ADMIN 발급이 확정되지 않았으므로 실제 Auth·Firestore 연결과 배포는 하지 않았다.

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
