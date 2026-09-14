# UI Component Contract v1

## 목적

UI 유행이나 담당 개발자가 바뀌어도 업무 규칙을 다시 만들지 않도록 시각 규격과 업무 상태를 분리한다.

## 원칙

- 기능 우선: 현재 상태에서 필요한 작업만 활성화한다.
- 업무 상태의 기준은 Domain selector이며 컴포넌트 내부에서 상태 규칙을 재작성하지 않는다.
- 버튼 문구는 실제 발생하는 업무 사실을 표현한다.
- 금액과 수치는 우측 정렬하고 tabular number를 사용한다.
- 되돌릴 수 없는 인도완료·정산확정과 금전 원장 추가는 실행 전 확인한다.
- 처리 결과와 오류는 작업 영역 가까이 `aria-live` 상태 메시지로 알린다.
- 색상·간격·높이·모서리·포커스는 `src/ui/tokens.css`에서 바꾼다.

## 공통 컴포넌트

| 컴포넌트 | 책임 | 변경 금지 범위 |
|---|---|---|
| `Button` | primary/secondary/danger/quiet, disabled, busy | 도메인 상태 판정 |
| `PanelHeader` | 패널 제목, 보조 상태, 우측 작업 | 화면 이동 규칙 |
| `Field` | 라벨과 필수 표시 | 값 검증 규칙 |
| `StatusBadge` | 상태의 짧은 시각 표시 | 상태 전이 |
| `EmptyState` | 선택·데이터 없음 안내 | 조회 조건 |

## 실적 Action Matrix

`getPerformanceActionAvailability()`가 유일한 UI 활성화 기준이다.

| Performance 상태 | 활성 작업 |
|---|---|
| `AWAITING_AMOUNTS` | 금액 저장 |
| `AWAITING_SALESPERSON_CONFIRMATION` | 금액 저장, 영업채널 확인, 이견 있음 |
| `AWAITING_SUPPLIER_REVIEW` | 공급사 확인, 공급사 이슈 |
| `SUPPLIER_ISSUE` | 이슈 해결 기록 |
| `AWAITING_SALESPERSON_RECONFIRMATION` | 변경 금액 수용 |
| `READY_TO_FINALIZE` | 정산 확정 |
| `FINALIZED` | 없음 |

## 다음 분리 경계

`AdminDashboard`의 데이터 저장이 Firestore로 전환될 때 화면 컴포넌트는 유지하고 command/repository만 교체한다. 다음 구조 개선은 ProductList, ProductDetail, ApplicationWork, PerformanceWork, SettlementWork 패널 순으로 분리한다.
