# ERP4 전자계약 → FreePass Admin 이식 지도

기준일: 2026-09-18  
소스: `freepass-creator/freepasserp4@main`  
대상: `freepass-creator/freepass-admin`

## 0. 결론

ERP4 전자계약은 새로 설계할 대상이 아니라 **기능 엔진을 이식할 대상**이다.

현재 FreePass Admin `/esign`은 ERP5 `contract`를 읽어 목록/상세/서명링크/PDF를 보여 주는 읽기 화면이다.
ERP4에는 이미 다음이 구현돼 있다.

- 계약 초안 생성
- 계약 종류/보험/만기 선택
- 발행 전 필수값/정책/회사정보 게이트
- 템플릿/필드맵
- 링크 발행
- 공개 고객 작성 페이지
- 개인 7단계 / 법인 5단계 고객 여정
- 필수서류 동적 요구
- 서명 이미지 검증
- 제출자료 validation
- 검토대기
- 보완요청
- 승인/봉인
- 최종 PDF 생성/보관
- 링크 해지/만료/재발행
- 진행 이벤트
- 동시 발행/승인 claim
- 발행 snapshot / signed snapshot
- 보안·UIUX·문서 회귀 테스트 다수

따라서 방향은:

> **Admin UI는 현재 디자인을 유지하고, ERP4 전자계약 도메인/서버 엔진만 이식한다.**

---

# 1. ERP4에서 확인한 실제 기능

## 관리자 상태

`lib/domain/esign-center.ts`

- 작성
- 발송 전
- 고객 작성 중
- 검토 대기
- 완료

별도 flag:
- 확인 필요
- 만료
- 해지
- 반려

## 전자서명 세부 상태

`lib/domain/esign-progress.ts`

- 미발송
- 발행
- 열람
- 진행중
- 서명완료
- 반려
- 만료

## 관리자 명령

`app/api/freepass-esign/contracts/[contractCode]/route.ts`

- `issue`
- `revoke`
- `reject`
- `approve`

실제 구현에는:
- 동시 발행 claim
- 동시 승인/반려 claim
- private seal 재검증
- 발행 시 최신 source 재확인
- snapshot 동결
- 링크 만료
- 재발행
- 보완요청
- 승인 후 PDF/봉인

이 들어 있다.

## 고객 공개 경로

`app/sign/[token]/page.tsx`
`app/api/freepass-esign/public/[token]/route.ts`

개인:
1. 요약 확인
2. 개인정보 입력
3. 운전면허증 촬영
4. 본인 셀카
5. 세부계약/약관
6. 부속서류
7. 전자서명/제출

법인:
- 신분증/셀카 단계 제외
- 대표이사/위임 임직원 구분
- 위임 시 위임장/재직증명서 동적 필수

고객 제출 후:
- 검토대기
- 관리자 승인/봉인
- 또는 같은 링크로 보완요청
- 완료 후 같은 링크에서 최종 계약서 확인

---

# 2. 그대로 이식 가치가 높은 모듈

아래는 업무 규칙/순수 함수 비중이 높아 우선 이식 후보다.

| ERP4 | Admin 권장 위치 | 처리 |
|---|---|---|
| `lib/domain/esign-progress.ts` | `src/domain/esign/progress.ts` | 거의 그대로 |
| `lib/domain/esign-contract-kind.ts` | `src/domain/esign/contract-kind.ts` | 거의 그대로 |
| `lib/domain/esign-required-documents.ts` | `src/domain/esign/required-documents.ts` | 거의 그대로 |
| `lib/domain/esign-signed-snapshot.ts` | `src/domain/esign/signed-snapshot.ts` | 거의 그대로 |
| `lib/domain/freepass-esign-consents.ts` | `src/domain/esign/consents.ts` | 정책 의존부만 adapter |
| `lib/server/freepass-esign-signature.ts` | `src/server/esign/signature.ts` | 그대로에 가까움 |
| `lib/server/freepass-esign-submission.ts` | `src/server/esign/submission.ts` | 그대로에 가까움 |
| `lib/domain/esign-templates.ts` | `src/domain/esign/templates.ts` | production gate 유지 |
| `lib/domain/esign-template-profile.ts` | `src/domain/esign/template-profile.ts` | 업체별 override 유지 |
| `lib/domain/esign-field-map.ts` | `src/domain/esign/field-map.ts` | template 정본과 같이 |
| `lib/domain/esign-template-fields.ts` | `src/domain/esign/template-fields.ts` | snapshot 경계 유지 |
| `lib/server/freepass-contract-html.ts` | `src/server/esign/contract-html.ts` | template path 수정 |
| `lib/server/freepass-esign-document.ts` | `src/server/esign/document.ts` | storage adapter 분리 |

---

# 3. 통째로 복사하면 안 되는 것

## 3-1. RTDB 저장 구조

ERP4 서버 엔진은 다음과 강하게 결합돼 있다.

- `v4/contracts`
- `v4/esign_sessions`
- `v4/esign_private`
- `v4/esign_contract_seals`
- `v4/esign_events`
- `v4/esign_issue_claims`

FreePass Admin 신규 기능에서 이 구조를 다시 만들지 않는다.

### Admin 권장 Firestore 구조

예:

```
contract/{contractId}
esign_session/{sessionId}
esign_private/{sessionId}
esign_event/{eventId}
esign_seal/{contractId}
esign_document/{documentId}
```

또는 contract 하위 subcollection.

핵심:
- 계약 본문
- 공개 고객 상태
- private 고객 제출자료
- 발행 snapshot
- signed snapshot
- 이벤트
- 문서 메타

를 분리한다.

## 3-2. ERP4 대형 UI 컴포넌트

그대로 복사 금지:

- `components/EsignSendCenter.tsx` 약 1,558줄
- `components/FreepassEsignPanes.tsx` 약 1,109줄
- `app/sign/[token]/page.tsx` 약 80KB

이들은 ERP4의:
- WorkPage
- store
- tenant
- auth context
- ERP4 UI atoms
- 정책 navigation

등과 결합돼 있다.

### 원칙

**업무 규칙은 이식하고 화면은 현재 FreePass Admin 디자인으로 다시 연결한다.**

---

# 4. Admin /esign에 붙일 실제 행동

현재 Admin 화면:
- 계약 목록
- 계약 상세
- 서명 URL 열기
- 완료 PDF 열기

추가할 행동은 상태별로 최소화한다.

## 발송 전

상세 하단:
- 계약서 미리보기
- 고객 링크 발행

필요하면:
- 계약 조건 확인
- 발행 blocker 표시

## 발행 / 열람 / 진행중

- 고객 링크 복사
- 고객 화면 미리보기
- 링크 해지
- 진행 단계 확인

## 검토 대기

- 제출자료 확인
- 본인확인/서류 확인
- 승인·봉인
- 보완요청

## 완료

- 최종 PDF 열기
- 다운로드
- 계약 snapshot/서명시각 읽기
- 수정 불가

완료본 수정은 금지.
수정 필요 시 새 revision / 새 계약.

---

# 5. 상태 SSOT

Admin은 raw `sign_status`를 직접 화면 규칙으로 쓰지 말고
ERP4 `esignCenterStage()` / `esignStage()`를 이식해 한 곳에서 계산한다.

권장 Admin queue:

- 작성
- 발송 전
- 고객 작성 중
- 검토 대기
- 완료
- 확인 필요(flag)

기존 Admin 필터:
- 전자서명
- 발행
- 열람
- 진행중
- 서명완료
- 미연결

은 상세 상태/검색용으로 유지할 수 있지만,
업무 queue는 위 5단계가 더 적합하다.

---

# 6. 기존 Admin Contract SSOT와 연결

현재 Admin:
`src/adapters/erp5/contract-repository.ts`

이미 ERP5 `contract`에서 읽는 필드:
- contract_code
- contract_status
- sign_status
- esign_contract_kind
- esign_insurance_side
- 차량 snapshot
- customer_name
- agent_name
- provider_company_code
- rent_amount_snapshot
- rent_month_snapshot
- contract_date
- sign_sent_at
- sign_signed_at
- esign_sign_url
- signed_pdf_url

따라서 새 전자계약 기능에서도 **새 Contract 엔티티를 만들지 않는다.**

> ERP5 `contract` = 계약 SSOT  
> e-sign session/seal/private/event/document = 계약에 붙는 전자계약 상태

---

# 7. 이식 순서

## Phase 1 — Domain port
화면/DB 없이 먼저 이식.

1. progress
2. contract-kind
3. required-documents
4. consents
5. submission validator
6. signature validator
7. templates/profile/field-map
8. snapshot/seal

ERP4 sim 테스트도 해당 모듈과 같이 옮긴다.

## Phase 2 — Firestore ports

인터페이스:

```ts
EsignSessionRepository
EsignPrivateRepository
EsignSealRepository
EsignEventRepository
EsignDocumentRepository
```

ERP5 Firestore adapter 구현.

**신규 발행에서 RTDB 금지.**

기존 ERP4 발행 계약을 계속 보여줘야 하면:
- legacy RTDB read-only adapter
- 신규 write는 Firestore only

의 dual-read migration은 허용 가능.

## Phase 3 — Admin server actions

- issue
- revoke
- reject
- approve
- preview document
- final PDF
- handover

ERP4의 1,000줄 API route를 통째로 옮기지 않고 service 함수로 분해한다.

## Phase 4 — Admin /esign UI 연결

현재 디자인/Panel/ListRow/ActionBar 그대로 사용.

## Phase 5 — Customer sign route

ERP4 고객 여정을 이식하되,
Admin 내부 디자인과 혼합하지 않는다.

고객 public surface는 별도 UI system으로 유지한다.

---

# 8. 반드시 같이 가져와야 할 안전장치

ERP4에서 이미 해결한 것이라 삭제하지 않는다.

- sign token 원문 대신 hash 기준
- 발행 snapshot 동결
- consent profile 동결
- signed snapshot
- 발행 후 live master 변경 영향 차단
- 동시 issue claim
- 동시 approve/reject claim
- 링크 만료/해지
- 재발행 시 이전 session 폐기
- 고객 공개 경로와 private 제출자료 분리
- 서명 이미지 최소 ink 검증
- PDF sha/hash 검증
- 발행 후 원본 변경 detection
- test/sample template production gate
- soft delete / test contract 제외

---

# 9. ERP4에서 그대로 가져오기 전에 반드시 재검증할 항목

`docs/ESIGN-MANUAL.md`가 현재도 위험으로 표시하는 것:

1. 주민등록번호 수집/암복호 경로
2. 신용조회 계약의 동의서/조회기관 특정
3. 고객 작성 중 이탈 시 서버 부분저장 없음
4. 일부 부속서류의 작성 시점 미확정
5. 샘플/업체별 template 운영 승인 상태

이 항목은 **migration gate**로 둔다.

특히 주민등록번호는
“옛 코드가 있으니 복사”가 아니라
현재 법적/보안 근거와 저장 경계를 다시 확인한 뒤 연다.

---

# 10. 가져오지 말아야 할 것

- ERP4 UI layout
- ERP4 sidebar/work page 구조
- ERP4 RTDB write path
- ERP4 tenant/store 직접 참조
- 1,000줄 API route monolith
- 1,500줄 send center monolith
- raw 주민번호 저장 가능성
- 현재 Admin 디자인을 덮는 별도 e-sign 디자인

---

# 11. 최종 권장 구조

```
FreePass Admin
│
├─ /esign                         현재 Admin UI
│
├─ src/domain/esign/              ERP4 검증된 순수 규칙
│   ├ progress
│   ├ contract-kind
│   ├ required-documents
│   ├ consents
│   ├ templates
│   ├ field-map
│   └ snapshots
│
├─ src/services/esign/
│   ├ issue
│   ├ revoke
│   ├ submit
│   ├ reject
│   ├ approve
│   └ document
│
├─ src/ports/esign/
│   └ repositories
│
├─ src/adapters/erp5/esign/
│   └ Firestore implementations
│
└─ /sign/[token]                  고객 public surface
```

**한 줄 결론**

> ERP4 전자계약은 버릴 것이 아니라 **UI를 제외한 엔진 대부분을 살리고, 저장층만 ERP5 Firestore 방식으로 갈아끼워 FreePass Admin에 연결**하는 것이 맞다.
