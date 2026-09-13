# freepasserp.com v1 — AI/Developer Rules

## 1. Source of truth
이 저장소가 freepasserp.com v1 개발의 코드 SSOT다. 대화나 과거 저장소의 규칙이 이 문서와 충돌하면 구현하지 말고 결정이 필요하다고 표시한다.

## 2. Absolute isolation
- 기존 FreePass ERP 저장소의 코드/DB/API/Firebase/시트/환경변수/인증을 자동 연결·복사·fallback하지 않는다.
- 기존 시스템은 사용자가 명시적으로 요청한 범위에서 읽고 설계 참고만 할 수 있다.
- 신규 외부 연결은 명시적 승인 전에는 추가하지 않는다.

## 3. Exactly three surfaces
- ADMIN
- SALES
- WHITE LABEL (B2C)

WHITE LABEL과 B2C를 별도 네 번째 제품으로 만들지 않는다. White Label 엔진은 하나이며 회사별 BI/CI는 설정으로 분리한다.

## 4. Search first
검색 가능성과 정확성이 상품 데이터 설계의 최우선 목적이다. 차량/제원/Offer/Policy 필드를 의미 없이 합치지 않는다. 서로 다른 Offer의 값을 섞어 존재하지 않는 계약조건을 만들지 않는다.

## 5. Vehicle master
모델 정보는 원산지 → 제조사 → 모델 → 세부모델 → 세부트림까지만 관리한다. 연료/배기량 등은 모델 계층에 추가하지 않는다. 공급사 정보가 부족하면 확인된 가장 깊은 노드까지만 매칭하고 하위를 추측하지 않는다.

## 6. Adapter
공급사 RAW는 보존한다. 최초 승인된 매핑은 재사용한다. 같은 표현을 매 수집마다 AI가 재해석하지 않는다. 새 표현·모순·양식 변경은 검수 대상으로 올린다.

## 7. Policies
Policy는 확장 가능하게 정의하되 이름 난립을 허용하지 않는다. FreePass Policy Definition에 매핑한다. 새 정책 때문에 Product 테이블에 임의 컬럼을 계속 추가하지 않는다.

## 8. Applications
접수 저장 시 당시 상품과 Offer/Policy의 필요한 값을 Snapshot으로 보존한다. 현재 상품 변경으로 과거 접수 조건을 조용히 변경하지 않는다.

## 9. Development discipline
- 확정되지 않은 업무규칙을 추측 구현하지 않는다.
- 기능을 통과시키기 위해 검증/테스트를 느슨하게 바꾸지 않는다.
- UI가 보인다는 이유만으로 데이터/권한/검색 검증 없이 완료 처리하지 않는다.
- 변경은 작고 검증 가능한 단위로 커밋한다.
