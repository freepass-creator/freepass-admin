# FreePass Admin Product Search P6 — 2026-09-20

Status: `FUNCTIONAL SEARCH HARDENING / NO UI REDESIGN`

## 목적

P3의 ERP5 Canonical Product read를 실제 상품찾기에서 반복 사용할 때 생기는 두 병목을 줄인다.

1. 매 요청마다 ERP5 products/policy 전체를 다시 읽는 문제
2. 검색 결과가 많을 때 모든 행을 한 번에 렌더링하는 문제

## Catalog cache

ERP5 ProductRepository를 `CachedProductRepository`로 감싼다.

- TTL: 60초
- warm list 안에서 `get(id)`도 우선 해결
- TTL 만료 후 다음 list에서 ERP5 재조회
- save가 호출되면 cache invalidate
- File 개발 Adapter는 기존 그대로 사용

차종마스터는 P3에서 별도로 5분 캐시를 유지한다.

## 검색 결과

- 50건/page
- 결과 총 건수와 현재 page 표시
- 이전/다음
- 검색조건 변경 시 1페이지부터 다시 계산
- 선택 상세는 전체 검색결과에서 product id로 유지

## 기간 빠른 필터

공통 업무 기간:

- 전체
- 1개월
- 6개월
- 12개월
- 24개월
- 36개월
- 60개월

필터는 기존 `ProductSearchQuery.termMonths`를 그대로 사용한다.
새 검색 규칙을 만들지 않는다.

## 유지되는 핵심 규칙

- 같은 Offer 안에서 조건 동시 만족
- 미확인 보증금 != 0원
- matched Offer id 유지
- 상세에서 선택한 Offer 그대로 접수로 전달
- product version 그대로 접수 stale-check에 전달

## 하지 않은 것

- 디자인 재구성
- 새로운 상품 필드 추정
- 사진/혜택 확장
- 영업채널/담당자 Master 추정
- 전자계약
