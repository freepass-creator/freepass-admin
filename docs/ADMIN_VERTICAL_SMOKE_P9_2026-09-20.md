# FreePass Admin Vertical Smoke P9 — 2026-09-20

Status: `FULL CORE FLOW SMOKE IMPLEMENTED / RUNNER EXECUTION PENDING`

## 목적

P0~P8에서 나뉘어 구현한 기능이 같은 Adapter/Service 조합에서 처음부터 끝까지 실제로 연결되는지 한 번에 검증한다.

명령:

```bash
npm run admin:smoke
```

## 격리

Smoke는 운영 Firebase/ERP5를 사용하지 않는다.

매 실행마다 OS 임시 디렉터리를 만들고 다음 개발 Adapter만 사용한다.

- FileProductRepository
- FileApplicationRepository
- FileOperationsRepository

검증 후 임시 디렉터리를 삭제한다.

## 시나리오

1. Canonical Product 저장
2. repository version 확정
3. 상품 + Offer로 신규접수
4. 같은 submissionId 재접수 → 기존 1건 replay
5. 계약서 완료
6. 필수서류 완료
7. 잔금 완료
8. 인도 완료
9. Application 재조회
10. 차량번호 Snapshot 확인
11. Performance 생성
12. 같은 Application Performance 중복 생성 방지
13. 공급사 받을 돈 / 영업채널 줄 돈 입력
14. 영업채널 확인
15. 공급사 확인
16. Settlement 확정
17. 같은 Performance Settlement 중복 생성 방지
18. Billing 생성
19. Billing 중복 생성 방지
20. 부분수금
21. 완납 전 지급 차단
22. 잔여 수금
23. 영업채널 지급
24. Repository instance를 새로 열어 재기동 상황 재현
25. Application / Performance / Settlement / Billing / Ledger 재조회
26. 미수 0
27. 미지급 0
28. Margin 일치

## PASS evidence

성공 시 stdout JSON:

```json
{
  "schema": "freepass-admin-vertical-smoke/v1",
  "status": "PASS",
  "evidence": {
    "applicationStatus": "DELIVERED",
    "performanceStatus": "FINALIZED",
    "collectionOutstanding": 0,
    "payoutOutstanding": 0
  }
}
```

실제 ID/금액은 smoke fixture 값이며 운영 데이터가 아니다.

## CI

backend-check 순서:

1. npm ci
2. typecheck
3. test
4. admin:smoke
5. admin:readiness
6. build

readiness 자체도:
- `admin:smoke` package script 존재
- workflow에서 `npm run admin:smoke` 실행

을 검사한다.

## 현재 검증 경계

GitHub Actions는 현재 반복적으로 job step 0 상태에서 종료되는 runner-entry 장애가 있다.

따라서 P9는:
- smoke 코드 구현: 완료
- CI workflow 연결: 완료
- readiness 정적 enforcement: 완료
- 실제 Actions smoke PASS: runner 실행 전까지 HOLD

로 구분한다.
