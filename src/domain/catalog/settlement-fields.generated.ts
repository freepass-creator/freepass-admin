/* ★자동 생성 — 손으로 고치지 않는다. scripts/sync-field-catalog.mts 가 erp4 lib/domain/settlement-atom.ts (d11b963b) 에서 뽑았다. */
export const SETTLEMENT_FIELDS = [
  {
    "key": "code",
    "label": "원자 코드",
    "group": "정체",
    "type": "string",
    "note": "차번+접수일+채널로 지은 열쇠. 문서 id 와 같다"
  },
  {
    "key": "plate",
    "label": "차량번호",
    "group": "정체",
    "type": "string",
    "note": "지원금처럼 차가 없는 줄은 빈 값"
  },
  {
    "key": "model",
    "label": "모델명",
    "group": "정체",
    "type": "string"
  },
  {
    "key": "customer",
    "label": "임차인",
    "group": "정체",
    "type": "string"
  },
  {
    "key": "supplier",
    "label": "공급사",
    "group": "상대",
    "type": "string",
    "note": "청구하는 쪽"
  },
  {
    "key": "supplierCode",
    "label": "공급사코드",
    "group": "상대",
    "type": "string",
    "note": "PARTNER_CI 에서 이름으로 찾는다 — 이름이 바뀌어도 잇는다"
  },
  {
    "key": "channel",
    "label": "영업채널",
    "group": "상대",
    "type": "string",
    "note": "지급하는 쪽"
  },
  {
    "key": "channelCode",
    "label": "영업채널코드",
    "group": "상대",
    "type": "string"
  },
  {
    "key": "agent",
    "label": "영업담당자",
    "group": "상대",
    "type": "string"
  },
  {
    "key": "agentCode",
    "label": "영업자코드",
    "group": "상대",
    "type": "string"
  },
  {
    "key": "product",
    "label": "상품 구분",
    "group": "조건",
    "type": "string",
    "note": "요율을 고르는 첫 열쇠 — 선출고·신차발주·구독·장기렌트…"
  },
  {
    "key": "rentKind",
    "label": "렌트 구분",
    "group": "조건",
    "type": "string"
  },
  {
    "key": "contractType",
    "label": "계약 형태",
    "group": "조건",
    "type": "string"
  },
  {
    "key": "term",
    "label": "계약 기간",
    "group": "조건",
    "type": "number",
    "note": "개월"
  },
  {
    "key": "rent",
    "label": "렌탈료",
    "group": "조건",
    "type": "number"
  },
  {
    "key": "deposit",
    "label": "보증금",
    "group": "조건",
    "type": "number"
  },
  {
    "key": "price",
    "label": "차량가액",
    "group": "조건",
    "type": "number",
    "note": "신차 요율의 밑"
  },
  {
    "key": "payKind",
    "label": "납입 방식",
    "group": "조건",
    "type": "string"
  },
  {
    "key": "supplierRate",
    "label": "공급사 요율",
    "group": "요율·돈",
    "type": "number"
  },
  {
    "key": "agentRate",
    "label": "에이전시 요율",
    "group": "요율·돈",
    "type": "number"
  },
  {
    "key": "claimWritten",
    "label": "청구액(적힌)",
    "group": "요율·돈",
    "type": "number",
    "note": "★적힌 값이 이긴다 — 요율로 다시 세지 않는다"
  },
  {
    "key": "payWritten",
    "label": "지급액(적힌)",
    "group": "요율·돈",
    "type": "number"
  },
  {
    "key": "claimIncentive",
    "label": "공급사 인센티브",
    "group": "요율·돈",
    "type": "number",
    "note": "무보증 수수료 등 — 사다리 밖에서 붙는다"
  },
  {
    "key": "payIncentive",
    "label": "에이전시 인센티브",
    "group": "요율·돈",
    "type": "number"
  },
  {
    "key": "receivedAt",
    "label": "접수일",
    "group": "날",
    "type": "string",
    "note": "YYYY-MM-DD"
  },
  {
    "key": "deliveredAt",
    "label": "인도일",
    "group": "날",
    "type": "string"
  },
  {
    "key": "paper",
    "label": "계약서",
    "group": "날",
    "type": "boolean",
    "note": "계약서를 썼나"
  },
  {
    "key": "delivered",
    "label": "인도완료",
    "group": "날",
    "type": "boolean",
    "note": "차가 나갔나 — 나가야 청구월이 박힌다"
  },
  {
    "key": "cancelled",
    "label": "취소",
    "group": "날",
    "type": "boolean"
  },
  {
    "key": "billMonth",
    "label": "청구월",
    "group": "날",
    "type": "string",
    "note": "★이 줄이 «어느 달»에 서는가. 비면 어느 달에도 안 선다"
  },
  {
    "key": "settleTarget",
    "label": "정산 대상",
    "group": "정산 축",
    "type": "string",
    "note": "양쪽 · 공급 · 영업"
  },
  {
    "key": "settleRatio",
    "label": "정산 비율",
    "group": "정산 축",
    "type": "number",
    "note": "2회분납 1회차면 0.5"
  },
  {
    "key": "billHold",
    "label": "청구보류",
    "group": "정산 축",
    "type": "boolean",
    "note": "청구만 0 · 지급은 나간다"
  },
  {
    "key": "settleExclude",
    "label": "보류",
    "group": "정산 축",
    "type": "boolean",
    "note": "양쪽 다 0 — 당분간 안 센다"
  },
  {
    "key": "settledAlready",
    "label": "정산 완료",
    "group": "정산 축",
    "type": "boolean"
  },
  {
    "key": "vatIncluded",
    "label": "부가세 포함",
    "group": "정산 축",
    "type": "boolean",
    "note": "적힌 금액이 VAT 포함 — 낼 때 나눈다"
  },
  {
    "key": "settleNote",
    "label": "산정 조건",
    "group": "정산 축",
    "type": "string",
    "note": "축으로 옮긴 말을 «말로도» 남긴다"
  },
  {
    "key": "intakeKind",
    "label": "접수 갈래",
    "group": "정산 축",
    "type": "string",
    "note": "영업수수료 · 인센티브 · 업무지원비"
  },
  {
    "key": "stage",
    "label": "지금 어디",
    "group": "상태",
    "type": "string",
    "note": "두 축을 모은 한 낱말 — 물으면 이걸 답한다"
  },
  {
    "key": "claimStage",
    "label": "청구 축",
    "group": "상태",
    "type": "string",
    "note": "접수→청구→확인→수금. 공급사에게 «받는» 길"
  },
  {
    "key": "payStage",
    "label": "지급 축",
    "group": "상태",
    "type": "string",
    "note": "접수→통보→확인→지급. 영업채널에 «주는» 길"
  },
  {
    "key": "billed",
    "label": "청구서 나감",
    "group": "상태",
    "type": "boolean"
  },
  {
    "key": "billedAt",
    "label": "청구서 나간 날",
    "group": "상태",
    "type": "string"
  },
  {
    "key": "invoiceBiz",
    "label": "실린 계산서(사업자번호)",
    "group": "상태",
    "type": "string",
    "note": "[F06] 에서 어느 법인 장에 실렸나"
  },
  {
    "key": "invoiceIssued",
    "label": "계산서 발행",
    "group": "상태",
    "type": "boolean"
  },
  {
    "key": "invoiceAt",
    "label": "계산서 발행일",
    "group": "상태",
    "type": "string"
  },
  {
    "key": "collected",
    "label": "수금됨",
    "group": "상태",
    "type": "boolean",
    "note": "공급사가 돈을 냈다"
  },
  {
    "key": "collectedAt",
    "label": "수금한 날",
    "group": "상태",
    "type": "string"
  },
  {
    "key": "collectedAmt",
    "label": "수금액",
    "group": "상태",
    "type": "number",
    "note": "일부만 들어올 수 있다 — 청구액과 다를 수 있다"
  },
  {
    "key": "paid",
    "label": "지급됨",
    "group": "상태",
    "type": "boolean",
    "note": "영업채널에 돈을 줬다"
  },
  {
    "key": "paidAt",
    "label": "지급한 날",
    "group": "상태",
    "type": "string"
  },
  {
    "key": "paidAmt",
    "label": "지급액(실제)",
    "group": "상태",
    "type": "number"
  },
  {
    "key": "supplierOk",
    "label": "공급사 확인",
    "group": "상태",
    "type": "boolean",
    "note": "상대가 시트에서 켠 체크"
  },
  {
    "key": "supplierFix",
    "label": "공급사 정정요청",
    "group": "상태",
    "type": "boolean"
  },
  {
    "key": "supplierFixAmt",
    "label": "공급사 정정금액",
    "group": "상태",
    "type": "number"
  },
  {
    "key": "supplierMemo",
    "label": "공급사 메모",
    "group": "상태",
    "type": "string"
  },
  {
    "key": "channelOk",
    "label": "영업채널 확인",
    "group": "상태",
    "type": "boolean"
  },
  {
    "key": "channelFix",
    "label": "영업채널 정정요청",
    "group": "상태",
    "type": "boolean"
  },
  {
    "key": "channelFixAmt",
    "label": "영업채널 정정금액",
    "group": "상태",
    "type": "number"
  },
  {
    "key": "channelMemo",
    "label": "영업채널 메모",
    "group": "상태",
    "type": "string"
  },
  {
    "key": "stateAt",
    "label": "상태 거둔 때",
    "group": "상태",
    "type": "string"
  },
  {
    "key": "carryNote",
    "label": "다음 달에 할 말",
    "group": "이월",
    "type": "string",
    "note": "계산서 수정·가감처럼 이 달에 못 끝낸 것"
  },
  {
    "key": "carryMonth",
    "label": "넘길 달",
    "group": "이월",
    "type": "string"
  },
  {
    "key": "carryClaim",
    "label": "넘길 청구액",
    "group": "이월",
    "type": "number",
    "note": "다음 달에 «더» 청구할 몫 (손오공 잔여 회차 등)"
  },
  {
    "key": "carryPay",
    "label": "넘길 지급액",
    "group": "이월",
    "type": "number",
    "note": "그때 «같이» 나갈 몫 — 청구만 넘기면 영업자에게 못 준다"
  },
  {
    "key": "prepaid",
    "label": "미리 받은 몫",
    "group": "이월",
    "type": "number",
    "note": "그 달 청구에서 «빼야» 하는 선지급"
  },
  {
    "key": "note",
    "label": "비고",
    "group": "출처",
    "type": "string",
    "note": "축으로 못 옮긴 말"
  },
  {
    "key": "sourceTab",
    "label": "원천 탭",
    "group": "출처",
    "type": "string"
  },
  {
    "key": "sourceRow",
    "label": "원천 줄",
    "group": "출처",
    "type": "number"
  },
  {
    "key": "fromSheet",
    "label": "올린 원천",
    "group": "출처",
    "type": "string",
    "note": "묵은 줄을 걷을 때 «같은 원천 + 같은 달»로 가른다"
  },
  {
    "key": "createdAt",
    "label": "처음 만든 때",
    "group": "출처",
    "type": "number",
    "note": "한 번 서면 안 바뀐다 — 언제부터 있던 줄인지"
  },
  {
    "key": "updatedAt",
    "label": "올린 때",
    "group": "출처",
    "type": "number"
  }
] as const;
