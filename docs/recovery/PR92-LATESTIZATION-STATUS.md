# PR #92 최신화 진행판

상태: **RECOVERY / SINGLE-LINEAGE CONSOLIDATION**  
기준 PR: **#92** (`claude/erp-platform-ui-ux-hvfyfa`)  
통합 작업장: **#112** (`recovery/pr92-modernize-20260926`)  
목표: #92의 3패널 line-free UI를 보존하면서 이후의 기능·데이터·보안·운영 지식을 모두 흡수해 **한 개의 최신 정본**으로 만든다.

## 현재 진행률 — 80%

진행률은 임의 체감치가 아니라 아래 6개 gate의 가중치로 계산한다.

| Gate | 비중 | 현재 | 상태 |
|---|---:|---:|---|
| 1. #92 디자인 기준선 식별·보존 | 15% | 15% | 완료 |
| 2. 최신 core/data/runtime 지식 역이식 | 25% | 25% | 138개 비-디자인 파일 이식 완료 |
| 3. 최신 계약과 #92 UI 연결부 정합화 | 20% | 18% | typecheck 통과, 데이터·route 경계 정합화 마감 중 |
| 4. 테스트·FreePass Data·runtime gate | 20% | 10% | core-domain·persistence·dependency 통과, 전체 CI/runtime 재검증 중 |
| 5. 비사용 UI 자료·분기 제거 | 10% | 10% | 비사용 시각 자료 37개와 테마 분기 제거 완료 |
| 6. 실제 route Visual QA + #92 HEAD 승격 | 10% | 0% | 마지막 단계 |

## 지금까지 가져온 것

현재 main에서 #92 기반 통합 후보로 **138개 비-디자인 변경**을 역이식했다.

주요 범위:
- FreePass Data 단일 persistence gateway
- Admin Catalog switchboard / shadow reader
- 최신 Product Finder domain semantics
- 제조사 → 모델 → 세부모델 → 트림 hierarchy 검색
- Offer 단위 공급사 identity
- 접수 Catalog Snapshot + deterministic digest
- 접수 retry/idempotency 및 persistence 검증
- 계약 취소 / 계약 해지 domain 분리
- 정산 / 환수 / lifecycle 최신 규칙
- 전자계약 domain/service/renderer 최신 보안·무결성 규칙
- API route / loading / error boundary
- dependency audit / production runtime gate
- 운영·보안·release 문서

## #92에서 반드시 보존하는 것

PC 디자인 정본:
- `src/app/_erp/Workspace.tsx`
- `src/app/_erp/ProductsScreen.tsx`
- `src/app/_erp/SettlementScreen.tsx`
- `src/app/_erp/EsignScreen.tsx`
- `src/app/_erp/parts.tsx`
- `src/app/_erp/ProductDetail.tsx`
- `src/app/_erp/erp-standard.css`
- `src/app/_erp/shell.css`

핵심 UI:
- 계약접수 3패널
- 상품찾기 wide list + detail
- line-free Search / Panel / Control
- 얇고 평평한 surface
- 카드/퀵필터/선택 상태의 후반 고도화
- 실제 route 렌더 결과가 디자인 검증 기준

## 정리 완료

현재 트리에는 actual route와 현재 UI SSOT에 필요한 자료만 유지한다.
비사용 시각 자료, 테마 선택 경로, 과거 UI 매핑 포인터와 보조 규격 문서를 제거했다.

## 현재 검증

최근 확인:
- TypeScript typecheck: **PASS**
- Dependency audit: **PASS**
- FreePass Data persistence gate: **PASS 경험**
- Admin core-domain: **PASS**
- 전체 test/runtime: 최신 연결부 보정 후 재검증 중

남아 있는 마감 범위:
1. 개발 전용 FPA_DEMO를 FreePass Data 경계 안으로 격리
2. legacy /intake/list → canonical /intake 수렴
3. settlement/esign/products error boundary를 #92 route에 맞춰 연결
4. 전체 test/build/runtime PASS
5. 실제 `/products`, `/intake`, `/settlement` route 1440/1280/390 Visual QA
6. 통과한 통합 commit을 PR #92 원본 branch로 fast-forward
7. #112는 복구 증거로 종료

## 단일 계보 원칙

최종 승격 후:
- **최신 디자인 = PR #92 계보의 HEAD actual route**
- UI 변경은 오직 하나의 디자인 SSOT와 actual-route visual receipt를 같이 갱신한다.
- UI 변경은 #92 actual route 계보와 현재 UI SSOT 안에서만 수행한다.
