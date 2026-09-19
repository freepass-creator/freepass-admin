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
