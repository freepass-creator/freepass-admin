# freepasserp.com v1 — Functional MVP

## 목표

시각 완성보다 먼저 합성 상품 한 건이 접수부터 정산 잔액까지 이어지는지 검증한다.

## 현재 경계

- UI는 기존 1:1:1 업무 골격을 유지한다.
- 최초 접수 필수값은 차량/Offer, 영업채널, 담당자, 고객명 네 개다.
- 접수는 product version, Offer, Policy를 Snapshot으로 보존한다.
- 인도완료는 되돌리는 토글이 아니라 별도 delivery event fact다.
- Performance는 Application당 한 번만 생성한다.
- 영업자 확인 뒤 공급사 확인을 거쳐야 정산 확정할 수 있다.
- 받을액, 줄액, 마진은 분리한다.
- 수금과 지급은 서로 다른 append-only 배열이며 부분처리를 허용한다.
- VAT 미선택이면 정산 확정을 막는다.
- 임시 지급정책은 전액 수금 후 지급이다.

## 영속성 단계

현재 localStorage는 새로고침을 포함한 기능 시뮬레이션 전용이다. 고객명과 금액을 운영 데이터로 저장하는 수단이 아니다.

운영 영속성은 독립 Firebase 프로젝트 확정 후 다음 경계를 사용한다.

1. 브라우저는 Firebase Auth만 사용한다.
2. 모든 mutation은 Next.js 서버에서 Firebase Admin으로 수행한다.
3. Firestore 클라이언트 직접 쓰기는 deny-all Rules로 막는다.
4. Application, Delivery→Performance, Settlement, Collection, Payout은 transaction과 idempotency key를 사용한다.
5. 수금/지급 원장은 수정·삭제하지 않고 reversal/adjustment를 추가한다.
