# 전자계약 현황 한 장 — C1020-426c822b

2026-10-21 PC1 Codex / **이번 범위: 별도 신용조회 동의서 초안·미리보기·PR. 실제 발송·운영 활성화·계약서 본문 수정 없음.**

정본: Admin `origin/main 5a9bf182ab4453692a4f1ebf0947c32c532eaf60`, ERP5 `origin/main e0e4372f263848e126d05753cd984dcd0863dfce`, AI Ops `origin/master 5319c85b`의 결정 장부·전체 자산 지도. 기존 로컬 Admin 가지 `3e76336a`는 보존. PR171은 CLOSED/미병합으로 조회했고 이번 건은 최신 main 기반 한 작업선이다. 오래된 project.json·backlog·지도는 실제 코드와 구분했다.

| 영역 | 현재 코드에서 확인한 것 | 운영 전 남은 것 |
|---|---|---|
| 화면 | Admin `/esign`: 목록·상세·서명창/서명본 링크. `/sign/[token]`: 고객정보, 약관·개별 동의, 서류, 서명. `EsignScreen.tsx`, `SignClient.tsx` | 실제 운영 고객 여정 검증. 10-17 UI 동결 결정에 따라 ADMIN 재설계 안 함 |
| 서명·승인 | `services/esign/service.ts`: 토큰 해시·기한·철회, snapshot, 원자 발행, 상태 CAS, 제출/승인 claim, 서명·서류 검증, 관리자 승인·봉인. 과거 backlog E1~E4를 그대로 미구현으로 세면 안 됨 | 운영 본인확인·증빙·실패/재시도 검증 |
| 발송 | `issue()`는 `/sign/{token}` 링크 생성과 발행 이력. 링크 발행을 SMS/알림톡 전달 완료로 세지 않음. ERP5 reference도 관리자 링크 복사 전달로 설명 | 실제 전달 채널·수신/전송 영수증·중복 방지 확인. 이번 발송 0 |
| 저장·PDF | `contract`, `esign_session`, `esign_private`, `esign_event`, issue lock. 문안 snapshot·동의시각·서명 해시·최종 PDF SHA/readback·원자 확정 구현. DB는 FreePass Data workflow 경계 | **Storage는 중요 차단:** `erp5App()`는 로컬 emulator만 허용. 운영 Storage 계약을 Data 경계로 연결·검증하기 전 ESIGN on 불가. 과거 emulator 통과는 운영 증거 아님 |
| 임대인 | Admin `template-fields.ts`: 공급사 상호/대표자/사업자번호/전화/주소/대여업등록번호 snapshot 투영. ERP5 `lib/reference/erp4-public-catalog.mjs`: partner ceo/phone/address/bank_account/bank_holder 등 | 필드 존재와 공급사 실제 법정정보 완비는 다름. 실제 값·권한·snapshot 전파 재조회 필요 |
| 공급사 대상 | ERP5 reference의 `contract_authoring=프리패스가 작성`, `esign_contract_enabled=사용`; 미설정 호환 정책 설명 존재. 전자계약층·추가서류·회사별 정책 필드 정의 | 이 파일은 reference이며 실제 적용/발송 증거 아님. 공급사별 대상 명단·설정값은 이번 원격 운영 데이터 미조회, UNKNOWN. 모든 공급사 자동 허용 금지 |
| 스위치 | `esign-scope.ts`, `proxy.ts`: ESIGN_ENABLED 기본 off, 고객 링크·발행/승인 API 닫힘; `/esign` 관리자 조회와 분리. 쓰기는 별도 ERP5_WRITE/Data gate | 운영 env 실측·실제 Storage·권한·대표 승인 필요. 이번 운영 env 변경 0 |
| 신용조회 | `buildConsentProfile()`는 신용조회일 때 조회기관·제공처가 특정된 별도 신용동의 연결 전 발행을 차단 | 선행 독립 문서·발송·본인확인·동의 기록 구현/운영 검증은 후속. 계약 내 privacy를 재활용한 동의로 대체하지 않음 |

결론: 계약 엔진·화면은 있으나 스위치만 켜서 쓸 상태로 입증되지 않았다. 특히 운영 Storage와 선행 신용조회 동의가 남아 있다. 뮤카는 10-20 결정 장부의 NICE 점수별 보증금 심사 목적을 반영하며, 점수 구간·보증금 수치 자체는 이 문서에서 새로 정하지 않는다.

## 동의서 초안·시안

- 문안/실제 화면 정본: `src/app/preview/credit-consent/page.tsx`, 경로 `/preview/credit-consent`.
- 기존 `src/app/sign/sign.css` 재사용. A4 한 장 문서 배치만 추가, 새로운 테마 없음. 수집이용·조회·제공은 세 선택군, 미선택 기본값. 실제 이름·전화·점수·서명 입력 없음.
- 처리 법인, 조회기관 계약, 정확한 전송 항목, 제공받는 자의 보유기간, 평점 영향, 문의/철회처, 동의 증빙 보존기간은 **미확정**. 제안된 30일 보유·7일/1회 조회는 법정기간이나 확정 정책이 아니다. 기관 확인과 대표 문안 확정 전 발송 불가.
- 개인 신청인만을 대상으로 한 초안. 법인/대리인/미성년·보증인 절차는 이 동의로 갈음하지 않는다. 고유식별정보가 실제 조회에 필요하면 해당 적법 근거·별도 동의/처리 경로를 먼저 확정한다.
- 제3자 제공과 처리위탁은 실제 계약 관계로 분류해야 한다. 공급사에 심사 결과를 넘긴다면 수신 법인별 목적·항목·기간·거부 안내를 별도 명시하고 따로 동의를 받는다. 포괄적인 '제휴사' 동의 금지.

## 독립 발송·기록 경계 — 설계, 아직 운영 구현 아님

1. 계약 없이 `CREDIT_INQUIRY_CONSENT` 문서 ID·문안 version/hash·조회주체/기관/항목/기간 snapshot을 발급한다. 계약 ID·계약 발송·계약 상태를 만들거나 바꾸지 않는다.
2. 독립 만료 토큰·발송 idempotency key·수신 대상·전달 영수증을 둔다. '링크 생성'과 '전송 수락/전달'을 구분한다. 기존 전자서명 암호화/토큰/증빙 패턴을 재사용하되 계약 세션으로 위장하지 않는다.
3. 본인확인 결과·항목별 agree/refuse/미선택·서버 수신시각·본인 서명 해시·문안 hash·철회 이력을 별도 증빙에 저장하고 readback한다. 거부를 동의 완료로 세지 않는다. 조회기관의 법정 동의 방식과 API 계약을 확인한다.
4. 모든 필수 동의·기관/기간·권한이 검증된 경우에만 동의 ID에 묶인 1회 조회. 만료·철회·중복·다른 신청/다른 법인 재사용 차단. 계약은 후속 별도 문서·발송·서명이며 이 동의를 계약 동의로 복사하지 않는다.
5. 저장은 FreePass Data의 기존 문서/증빙 경계 확장으로 진행하며 새 DB·RTDB·직접 Firebase credential을 만들지 않는다. 동의/서명 원문·점수는 공개 Git·캡처·알림 메시지에 남기지 않는다.

## 법령 대조 (2026-10-21, 시행 2026-09-11 본문)

- [개인정보 보호법 제15조 제2항](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1020398563): 목적·항목·보유기간·거부 권리/불이익 고지.
- [제17조 제2항](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1020398625): 제공받는 자·이용목적·제공항목·그 자의 보유기간·거부 안내 구분.
- [신용정보법 제32조 제2항](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1025127945): 조회를 통한 제공받기에 대한 개별 동의, 평점 하락 가능 시 고지. 단순 수집이용 체크 하나로 대신하지 않음.

## 실행·검증·인계

- academy:start READY / COMPOSE_OR_EXTEND. 기존 화면·CSS·문서·테스트 후보 확인. CREATE_NEW_JUSTIFIED: 기존 consents는 contractId/snapshot/rental_terms에 결합되어 계약 전 독립 문서가 될 수 없어 검토 전용 경로·스타일·본 보고서만 추가. 운영 동의 엔진은 이번에 만들지 않음.
- 위험: 중요 문안/미리보기 접근 경계. 실고객 데이터·운영 쓰기 없음. 실제 발송 활성화는 후속 승인/검증 대상.
- 검증 결과·캡처·PR·Vercel URL: 최종 검사 후 아래에 기록.
- next_start_here: 대표가 미리보기 문안 검토 → 실제 심사 법인/NICE 계약·항목·기간 확정 → Data Storage 및 독립 동의 저장/발송 구현·시험 → 별도 운영 승인. 본 PR은 합병/운영 활성화 요청이 아니다.

### 독립 검토 반영

- Claude 최초 사전 자문 REVIEW_TIMEOUT(300초), 범위를 문안 1개 파일로 줄인 재검토는 ANSWERED/exit 0. 권리 행사·철회 안내 및 심사 필수 표시를 반영했다. 추가 항목은 이 초안을 근거로 수집할 수 없음을 명시했다. 마케팅 금지·점수 이외 채무정보 제외는 초안의 의도된 최소수집 범위로 유지하며 기관 전문이 다르면 발송 전 문안 재검토한다. Claude의 '모든 권리 항목이 제15조 필수 고지'라는 해석은 그대로 법적 결론으로 채택하지 않았다.
- Codex CLI gpt-5.5는 계정 지원 오류 FAILED. gpt-6-astra 읽기 전용 재검토 exit 0/답변 파일 확인. PREVIEW PR 치명·중대 보안 결함 미발견, 운영준비 불가에 동의. A4 여백 누락 지적은 실인쇄 폭 718px 및 실제 PDF 페이지 검사로 보완. 검증 기록 누락은 최종 기록으로 보완.
- 리뷰 원문: 비공개 `C:/dev/ai-ops/state/C1020-426c822b-codex-review.md`. Claude 결과는 해당 실행 영수증 ANSWERED. 검토는 운영 승인/법률적 적법성 확정을 뜻하지 않는다.

### 최종 검증 (2026-10-21 07:57 KST)

- `npm ci`, `npm run typecheck`, `npm run ui:check`, `npm run data:check`, `npm run build`, `git diff --check` PASS. Vercel build READY.
- 관련 gate/service/submission/document/pdf 단위시험 42/42 PASS. 전체 `npm test`: **921개 중 911 PASS / 10 FAIL**. 실패는 기존 `src/adapters/esign/puppeteer-final-document-renderer.test.ts`의 template-script timeout, 브라우저 실행 경로 ENOENT 및 그에 따른 검증 실패. Windows Chrome 경로 지정 재시험 결과이며 완전 통과로 표시하지 않는다. 이 renderer·test·계약 template/service/consents는 기준 main과 diff 0. 실패 원인 확정/수정은 후속 전자계약 활성화 작업에 남김. 계약서 본문은 수정하지 않았다.
- 전체 로그: `C:/dev/ai-ops/state/C1020-426c822b-tests.log`; 관련 로그: `C:/dev/ai-ops/state/C1020-426c822b-related-tests.log`; 빌드 로그: `C:/dev/ai-ops/state/C1020-426c822b-build.log`.
- Vercel: https://freepass-admin-qxpy22l5h-freepass-projects.vercel.app/preview/credit-consent (dpl_2WeVv6nFvknLFzjunmk5MgqFJyYt, preview target). 기존 Vercel 보호 유지, 권한 있는 계정 또는 CLI의 공식 인증 접근 필요. 로그인 화면을 성공 캡처로 세지 않고 인증된 브라우저에서 본문을 확인했다.
- 실제 preview runtime: GET 200, POST 405, 고객 `/sign/...`와 `/api/esign/public/...` POST 404. ESIGN/ERP5_WRITE/Data workflow write를 해당 preview에서 off 지정. 운영 env 수정·배포·고객발송 없음.
- Visual QA 1440/1280/390: 가로넘침 0, 페이지 오류 0, 동의 3개 선택군(라디오 6개) 모두 미선택·disabled, 입력 가능한 개인정보/서명/폼 0. production 차단은 proxy 자동시험 404로 확인(운영에 신규 코드를 배포하지 않음).
- 실제 Chromium 인쇄 PDF를 pypdf로 **A4 1페이지**(594.96×841.92pt) 검증, PyMuPDF 렌더 PNG를 눈으로 확인. 문서 유효 높이 856.97px, 인쇄 가능 높이 1047px. PDF는 검토 초안이며 제출용 확정본 아님.
- 문안 PDF: `C:/dev/ai-ops/state/캡처C1020-426c822b-vercel-draft.pdf`
- 한 장 캡처: `C:/dev/ai-ops/state/캡처C1020-426c822b-vercel-one-page.png`
- 화면 캡처: `C:/dev/ai-ops/state/캡처C1020-426c822b-vercel-1440.png`, `캡처C1020-426c822b-vercel-1280.png`, `캡처C1020-426c822b-vercel-390.png` (모두 같은 state 폴더).
- 재현: `scripts/verify-credit-consent-preview.mts` (puppeteer-core·로컬 Chrome, Python pypdf/pymupdf). `PREVIEW_BASE_URL`, `PREVIEW_COOKIE_JAR`(공식 vercel curl 인증 cookie jar, 비공개), `PREVIEW_CAPTURE_PREFIX`로 대상 고정. 영수증 `C:/dev/ai-ops/state/캡처C1020-426c822b-vercel-qa.json`. 비밀값/고객자료는 PR에 포함하지 않음.
- 상태: 초안 CODED / 관련 STATIC CHECKED·TESTED / PREVIEW VERIFIED. 전체 TESTED·운영 PERSISTENCE VERIFIED·PRODUCTION DEPLOYMENT VERIFIED·USER APPROVED는 주장하지 않음. 검토용 Draft PR, merge/실발송 승인 요청 아님.

- 검토용 PR: https://github.com/freepass-creator/freepass-admin/pull/199 (DRAFT). 최초 구현 커밋 bb56c16561c7d618f1371af97e319ab7532f775c. main 병합 안 함. 최종 전달은 같은 건 C1020-426c822b의 대화채널로 한다.
