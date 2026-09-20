export const ADMIN_ACTION_BAR_LABELS={
  productDetail:{
    secondary:'공유',
    primary:'이 조건으로 접수하기',
  },
  intakeNew:{
    secondary:'그만두기',
    primary:'접수 저장',
  },
  intakeProgress:{
    secondary:'접수 취소',
    contract:'계약서 완료로 표시',
    documents:'필수서류 완료로 표시',
    balance:'잔금 완료로 표시',
    delivery:'인도 완료로 표시',
    delivered:'실적·정산 열기',
    deliveredCreate:'실적 생성 후 정산 열기',
  },
  performance:{
    salespersonSecondary:'이견 있음',
    salespersonPrimary:'확인',
    supplierSecondary:'이슈 등록',
    supplierPrimary:'공급사 확인 완료',
    reconfirmPrimary:'변경금액 재확인 완료',
    resolvePrimary:'이슈 해결',
    finalizePrimary:'정산 확정',
    finalizedPrimary:'정산 원장에서 보기',
  },
  billing:{
    secondary:'계산서 처리',
    collectPrimary:'수금 등록',
    toPayoutPrimary:'지급 원장으로',
  },
  payout:{
    secondary:'지급 보류',
    primary:'지급 등록',
  },
} as const;
