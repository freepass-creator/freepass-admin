# ERP 표준 규격 적용 화면 (DEC-2026-09-23-01)

AI Core «ERP 표준 UI 규격 v1» 을 관리자 **PC 화면**에 그대로 적용한 캡처다(테마 1 `classic-*` · 테마 2 `retro-*`).

| 파일 | 화면 | 규격 구성 |
|---|---|---|
| `*-1-products` | 상품찾기 (+ 상세 패널) | platform/inventory.html |
| `*-2-intake` · `*-2b-intake-detail` | 계약접수 목록 · 접수 상세 | platform/contracts.html · contract-detail.html |
| `*-3-perf` | 실적 (접수 목록의 실적 칸) | platform/contracts.html + 금액 열 · 합계 |
| `*-4-settle` | 정산관리 | platform/settlements.html |
| `*-5-esign` | 전자계약 (업무 흐름과 별도) | platform/contracts.html + 전자서명 단계 |

- 규격 CSS 는 손으로 옮기지 않는다 — `node scripts/sync-erp-standard.mjs <ai-core>` 가 ai-core 정본에서 `src/app/_erp/erp-standard.css` 를 만든다(출처 revision 은 `erp-standard.source.json`).
- **데이터는 가상 예시**다 — `FPA_DEMO=on npm run dev` (개발 · 미리보기 전용, 운영에서는 강제로 꺼짐, 읽기 전용, 화면에 «가상 데이터» 표시).
- 폰(≤900px)은 기존 판 그대로다.
- 상태: CODED · STATIC CHECKED · TESTED. USER APPROVED / Design Hub Visual QA 는 아직이다.
