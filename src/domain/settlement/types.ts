import type { PolicyValue } from '../product/types';

/**
 * 실적 한 줄 — ERP5 `settlement_rows` 461줄을 실측해 세운 꼴.
 *
 * ★열쇠는 «차량번호 + 접수일» 이다.
 *   같은 차가 재계약되면 접수일이 가른다(F04 실측 — `316라1593` 8/6 vs 8/13).
 *   차량번호만으로 묶으면 서로 다른 계약이 한 건으로 접힌다.
 *
 * 무엇을 넣고 무엇을 뺐는지와 그 까닭 : docs/dev/LEDGER-ITEMS.md
 */

/** ★「미확인」과 「0」을 가른다. 빈칸을 0 으로 만들지 않는다. */
export type Maybe<T> = T | null;

/**
 * ★수수료가 «비율» 인지 «정액» 인지.
 *
 *   ERP5 `supplierRate` 461줄 중 — 비율 299 · **정액 131** · 0 이 31.
 *   한 칸에 뜻이 둘이었다. 오토플러스는 `supplierRate = 1,000,000` 인데
 *   이걸 비율로 읽으면 20조원이 나온다(실측 175수1279).
 *
 *   그래서 갈라 담고, 무엇을 보고 그렇게 판정했는지 `note` 에 남긴다.
 */
export type FeeBasis =
  | { mode: 'RATE'; rate: number; note?: string }      // 0.0325 = 3.25%
  | { mode: 'FLAT'; amount: number; note?: string }    // 대당 1,000,000원
  | { mode: 'UNKNOWN'; raw: unknown; note?: string };  // 읽지 못했다

/** 청구가 어디까지 갔나 (ERP5 `claimStage`) — erp4 두 축: 접수 → 청구 → 확인 → 수금 · 곁길 정정 */
export type ClaimStage = '접수' | '청구' | '정정' | '확인' | '수금';
/** 지급이 어디까지 갔나 (ERP5 `payStage`) — 접수 → 통보 → 확인 → 지급 · 곁길 정정 */
export type PayStage = '접수' | '통보' | '정정' | '확인' | '지급';
/** 누구와 정산하나 (ERP5 `settleTarget`) */
export type SettleTarget = '양쪽' | '공급' | '영업';

/** 진행 — ★「상태」 하나가 아니라 «사실 여럿» 이다 */
export interface SettlementProgress {
  paper: boolean;            // 계약서
  delivered: boolean;        // 인도완료
  deliveredAt: Maybe<string>;
  cancelled: boolean;
  billed: boolean;           // 청구서를 «보냈나»
  billMonth: Maybe<string>;  // 2026-09
  billedAt: Maybe<string>;
  invoiceIssued: boolean;    // 계산서를 «끊었나»
  invoiceAt: Maybe<string>;
  invoiceBiz: Maybe<string>;
  /**
   * ★아래 넷은 461줄 중 «켜진 것이 거의 없다» (실측 2026-09-17) —
   *   collected 0 · paid 0 · supplierOk 0 · channelOk 38.
   *   칸은 있는데 아무도 안 채웠다. 화면은 이것을 「0건」이 아니라
   *   **「아직 안 씀」** 으로 말해야 한다. 안 그러면 「받을 게 없다」로 읽힌다.
   */
  collected: boolean;        // 돈이 «들어왔나» — 청구와 다른 축이다
  collectedAmt: Maybe<number>;
  paid: boolean;             // 돈을 «줬나»
  paidAmt: Maybe<number>;
  supplierOk: boolean;       // 공급사가 확인했나
  channelOk: boolean;        // 영업채널이 확인했나
  /** 청구 보류 (ERP5 `billHold`) — 실적은 섰는데 이번 달 청구에서 뺀다 */
  billHold: boolean;
  /** 정산 제외 (ERP5 `settleExclude`) — 청구·지급 어느 목록에도 안 선다 */
  settleExclude: boolean;
}

/** 돈 */
export interface SettlementMoney {
  /** ★0 과 null 이 다르다. null 은 「모른다」 — 461줄 중 53줄이 그렇다 */
  claim: Maybe<number>;      // 청구금액 (공급사에게 받을 것)
  pay: Maybe<number>;        // 지급액   (영업채널에 줄 것)
  claimIncentive: Maybe<number>;
  payIncentive: Maybe<number>;
  /**
   * 가감 — 이 건만 더하거나(+) 빼는(−) 돈. ERP5 `claimAdjust`·`payAdjust`·`adjustReason` (domain/settlement/adjust.ts).
   * ★사유 없는 가감은 다음 달에 아무도 못 읽는다.
   * ⚠ `supplierFixAmt`(정정금액)와 다르다 — 그건 상대가 요청한 «정정 금액» 이지 더할 돈이 아니다.
   */
  claimAdjust: Maybe<number>;
  payAdjust: Maybe<number>;
  adjustReason: Maybe<string>;
  /** 프로모션 영업자 몫 비율(0~1) · 사유 — 금액은 claimIncentive/payIncentive */
  promoShare: Maybe<number>;
  promoReason: Maybe<string>;
  /** 다음 달로 넘긴 것 */
  carryClaim: Maybe<number>;
  carryPay: Maybe<number>;
  carryMonth: Maybe<string>;
  carryNote: Maybe<string>;
  prepaid: Maybe<number>;
  /** ★참이면 적힌 값이 «총액» 이다. 모르고 부가세를 또 붙여 나간 적이 있다 */
  vatIncluded: boolean;
}

export interface IntakeCatalogSnapshot {
  capturedAt: string;
  /** capturedAt을 제외한 계약상품 사본의 deterministic SHA-256. 같은 선택 재시도 판정에 쓴다. */
  digest?: string;
  product: {
    id: string;
    version: number;
    sourceSnapshotId: string;
    supplierId: string;
    supplierName: Maybe<string>;
    productKind: Maybe<string>;
    status?: Maybe<string>;
    consumerPrice?: Maybe<number>;
    vehicle: {
      nodeId: string;
      originId: string;
      manufacturerId: string;
      modelId: string;
      subModelId: Maybe<string>;
      trimId: Maybe<string>;
      matchLevel: string;
    };
    specs?: {
      modelYear: Maybe<number>;
      mileageKm: Maybe<number>;
      fuel: Maybe<string>;
      displacementCc: Maybe<number>;
      seats: Maybe<number>;
      drivetrain: Maybe<string>;
      batteryKwh: Maybe<number>;
    };
    registration: {
      vehicleNumber: Maybe<string>;
      vin: Maybe<string>;
      firstRegistrationDate: Maybe<string>;
    };
    /** Product-scope 정책 원본. Offer 정책과 합치기 전 사본. */
    policyValues?: PolicyValue[];
  };
  offer: {
    id: string;
    termMonths: number;
    monthlyRent: number;
    deposit: Maybe<number>;
    prepayment: Maybe<number>;
    annualMileageKm: Maybe<number>;
    /** Offer-scope 정책 원본. */
    policyValues: PolicyValue[];
    /** 당시 실제 적용된 Product+Offer 정책 결과. */
    resolvedPolicyValues?: PolicyValue[];
  };
}

export interface SettlementRow {
  /* ── 뼈대 — 이게 없으면 줄이 성립하지 않는다 ─────────────── */
  id: string;                    // ERP5 `code` — stl_16tsb6
  plate: Maybe<string>;          // ★열쇠 ①
  receivedAt: Maybe<string>;     // ★열쇠 ②
  customer: Maybe<string>;
  supplier: Maybe<string>;       // 청구할 곳
  supplierCode: Maybe<string>;
  channel: Maybe<string>;        // 지급할 곳 (회사)
  channelCode: Maybe<string>;
  agent: Maybe<string>;          // 영업담당자 (사람)
  agentCode: Maybe<string>;
  model: Maybe<string>;

  /* ── 조건 — 수수료의 «기준값» ──────────────────────────── */
  product: Maybe<string>;        // 장기렌트 · 오플구독 · 선출고 · 구독 …
  rentKind: Maybe<string>;       // 재렌트 · 구독 · 신차렌트
  contractType: Maybe<string>;   // 전자약정 · 대면계약(출장)
  term: Maybe<number>;
  rent: Maybe<number>;
  deposit: Maybe<number>;
  price: Maybe<number>;          // 차량가액 — ★신차만 값이 있다. 0 을 찍지 않는다
  payKind: Maybe<string>;        // 일시납 · 2회분납 · 3회분납
  /**
   * 받은 회차 — ★사람이 «분납이 끊겼을 때» 멈춘 회차를 적는다(ERP5 `paidRounds`).
   *   안 적혀 있으면 기간 비례로 본다(stage.ts paidRoundsOf). 적혀 있어야 「끊겼다」 고 말할 수 있다.
   */
  paidRounds: Maybe<number>;

  /** 상품에서 생성된 접수라면 당시 Canonical Product/Offer 원본을 되짚는다. 직접접수는 전부 null. */
  catalogRef?: {
    productId: Maybe<string>;
    productVersion: Maybe<number>;
    offerId: Maybe<string>;
    sourceSnapshotId: Maybe<string>;
    snapshotDigest?: Maybe<string>;
  };
  /** 저장 순간의 계약상품 전체 조건. 현재 Catalog가 바뀌어도 이 사본은 변하지 않는다. */
  catalogSnapshot?: Maybe<IntakeCatalogSnapshot>;

  /** 전자계약/계약 취소 provenance. signed 문서는 지우지 않고 운영 원장만 후속 절차로 전환한다. */
  esignContractId?: Maybe<string>;
  contractCancelledAt?: Maybe<number>;
  contractCancellationReason?: Maybe<string>;
  contractCancellationOperationId?: Maybe<string>;
  contractCancellationContractId?: Maybe<string>;
  contractCancellationBy?: Maybe<string>;
  contractTerminatedAt?: Maybe<number>;
  contractTerminationDate?: Maybe<string>;
  contractTerminationReason?: Maybe<string>;
  contractTerminationOperationId?: Maybe<string>;
  contractTerminationContractId?: Maybe<string>;
  contractTerminationBy?: Maybe<string>;

  /* ── 진행 · 정산 ──────────────────────────────────────── */
  progress: SettlementProgress;
  claimStage: ClaimStage;
  payStage: PayStage;
  supplierFee: FeeBasis;
  channelFee: FeeBasis;
  money: SettlementMoney;
  settleTarget: SettleTarget;
  settleRatio: number;           // 1 · 0.5 — ★1 이 아니면 까닭이 있어야 한다

  /* ── 글 — 뜻이 안 굳은 말이 여기 있다. 버리지 않는다 ────── */
  note: Maybe<string>;
  settleNote: Maybe<string>;

  /** 어디서 왔나 — ★옮기는 동안만 쓰고 대조가 끝나면 뗀다 */
  source: { rowNo: Maybe<number>; tab: Maybe<string>; sheet: Maybe<string> };
}

/* ══ 읽는 법 — 화면과 셈이 «같은 함수» 를 써야 갈리지 않는다 ══ */

/** 실적이 섰나 — 인도가 찍혀야 실적이다 */
export const isPerformance = (r: SettlementRow) => r.progress.delivered && !r.progress.cancelled;

/** ★아직 «접수» 다 — 인도 전이라 실적이 안 섰다 */
export const isOpenIntake = (r: SettlementRow) => !r.progress.delivered && !r.progress.cancelled;

/**
 * 남는 것 — ★money.ts 의 marginOf 와 «같다»(프로모션·가감·비율까지). 전에는 청구 − 지급만 봐서 금액 줄과 어긋났다
 *   (디자인 세션 2026-09-18 알림). 옛 이름을 지우지 않고 같은 셈으로 돌린다.
 */
export { marginOf as margin } from './money';

/**
 * ★이 줄이 지금 «무엇에 막혀 있나». 없으면 null.
 *   상태 바구니가 아니라 «다음 손» 이다 — 누르기 전에 무엇을 할지 안다.
 */
export type Block =
  | '차량번호 없음' | '공급사 없음' | '영업채널 없음' | '계약서' | '인도'
  | '청구금액 모름' | '지급금액 모름' | '청구' | '계산서' | '수금' | '지급';

export function blockOf(r: SettlementRow): Maybe<Block> {
  if (r.progress.cancelled) return null;
  /* 직원 업무 순서: 계약 확인 → 차량번호 확정 → 인도 → 정산. 신차는 계약 시점에 차번이 없을 수 있다. */
  if (!r.progress.paper) return '계약서';
  if (!r.plate) return '차량번호 없음';
  /* 공급사도 원래 줄을 가르는 열쇠다. 다만 이미 수금된 축은 과거 필수정보 누락으로 다시 열지 않는다. */
  if (r.settleTarget !== '영업' && !r.progress.collected && !r.supplier) return '공급사 없음';
  if (!r.progress.delivered) return '인도';

  /* 정산대상별 축을 따로 본다. 영업-only 줄에 공급사를 요구하거나 공급-only 줄에 영업채널을 요구하면 안 된다. */
  if (r.settleTarget !== '영업' && !r.progress.collected) {
    if (r.money.claim === null) return '청구금액 모름';
    if (!r.progress.billed) return '청구';
    if (!r.progress.invoiceIssued) return '계산서';
    return '수금';
  }
  if (r.settleTarget !== '공급' && !r.progress.paid) {
    if (!r.channel) return '영업채널 없음';
    if (r.money.pay === null) return '지급금액 모름';
    return '지급';
  }
  return null;
}

/** 접수 목록의 업무 필터. 화면이 자체 판정을 만들지 않고 blockOf의 다음 손을 그대로 묶는다. */
export type IntakeTask = '계약' | '차량' | '인도' | '정산' | '완료' | '취소';

export function intakeTaskOf(r: SettlementRow): IntakeTask {
  if (r.progress.cancelled) return '취소';
  const block = blockOf(r);
  if (!block) return '완료';
  if (block === '계약서') return '계약';
  if (block === '차량번호 없음') return '차량';
  if (block === '인도') return '인도';
  return '정산';
}
