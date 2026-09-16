# freepass-admin

FreePass **관리자 화면**입니다. 관리자가 상품을 찾고, 접수하고, 계약하고, 정산하는 데까지가 이 저장소의 범위입니다.

기존 FreePass ERP(`freepasserp4` = 운영 중인 `freepasserp.com`)와 운영·데이터·인증·배포 의존성이 없는 독립 신규 프로젝트입니다.

## 저장소 규격

| 저장소 | 화면 |
|---|---|
| `freepass-admin` | ADMIN — 내부 관리자 (이 저장소) |
| `freepass-sales` | SALES — 제휴 영업자 |
| (아직 없음) | WHITE LABEL — 영업회사 BI/CI B2C |

화면은 나뉘어도 Canonical Product SSOT와 검색 기준은 하나를 씁니다. 권한과 노출 필드만 갈립니다.

## Core product model

- `RAW` — 공급사 원문 보존
- `ADAPTER / MAPPING` — 공급사 표현을 FreePass 표준으로 최초 매핑하고 재사용
- `VEHICLE MASTER` — 원산지 → 제조사 → 모델 → 세부모델 → 세부트림의 닫힌 마스터
- `OFFER` — 대여기간·대여료·보증금·약정주행거리 등 반복 가능한 계약 선택지
- `POLICY` — 카드결제·결제시점·최소연령·보증금 분납 등 확장 가능한 정책
- `CANONICAL PRODUCT` — 세 화면과 공통 검색이 사용하는 상품 SSOT
- `APPLICATION SNAPSHOT` — 접수 당시 상품/조건 보존

## Vehicle matching

차종마스터는 세부트림까지 유효 경로를 관리하지만 공급사 원문이 부족하면 확인된 가장 깊은 노드까지만 매칭합니다.

- 모델 매칭
- 세부모델 매칭
- 세부트림 매칭
- 미매칭 / 검수 필요

모르는 하위 정보를 추측해 채우지 않습니다.

## Search-first principle

개발 완료 기준은 상품을 많이 저장하는 것이 아니라, 사용자가 차량·가격·대여조건·정책을 조합해 실제로 함께 적용 가능한 상품을 정확하게 찾고 그 조건 그대로 상세와 접수까지 이어갈 수 있는 것입니다.

## Isolation rule

기존 프로젝트(`freepasserp4` 등)의 DB, Firebase, API, 시트, 환경변수, 인증정보를 연결하거나 fallback으로 사용하지 않습니다. 기존 구현은 별도 승인 범위에서 설계 참고만 가능합니다.
