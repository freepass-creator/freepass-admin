/**
 * ERP5 `settlement_rows` 한 문서 → 우리 실적 한 줄.
 *
 * ★옮기면서 «고치는» 것 둘 (docs/dev/LEDGER-ITEMS.md §2) —
 *   ① 요율 칸에 정액이 섞여 있다 → `FeeBasis` 로 갈라 담고 판정을 남긴다
 *   ② 청구금액 0 이 「청구 안 함」인지 「모름」인지 갈린다 → 아래 규칙대로 null 로 둔다
 */
import type {
  Block, ClaimStage, FeeBasis, IntakeCatalogSnapshot, Maybe, PayStage, SettlementRow, SettleTarget,
} from '../../domain/settlement/types';
import { boolOf as b, numOrNull as n, strOrNull as s } from './atom';
import { contractPaymentStateOf } from '../../domain/contracts/payment';

export type Erp5Row = Record<string, unknown>;

function catalogSnapshotOf(v: unknown): IntakeCatalogSnapshot | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const d = v as Record<string, unknown>;
  if (!d.product || typeof d.product !== 'object' || !d.offer || typeof d.offer !== 'object') return null;
  return v as IntakeCatalogSnapshot;
}

/**
 * ★요율이냐 정액이냐 — **1 이 가른다.**
 *   수수료율이 100% 를 넘는 일은 없고, 정액이 1원인 일도 없다.
 *   실측 : 비율 299(0.0325 꼴) · 정액 131(1,000,000 꼴) · 0 이 31.
 *   0 은 «요율 0%» 가 아니라 **안 적힌 것**이므로 UNKNOWN 이다.
 */
export function feeOf(raw: unknown, who: string): FeeBasis {
  const v = n(raw);
  if (v === null) return { mode: 'UNKNOWN', raw, note: `${who} 수수료가 안 적혀 있다` };
  if (v === 0) return { mode: 'UNKNOWN', raw, note: `${who} 수수료가 0 이다 — 「요율 0%」인지 「안 적음」인지 모른다` };
  if (v > 1) return { mode: 'FLAT', amount: v, note: '1 을 넘어 정액으로 읽었다' };
  return { mode: 'RATE', rate: v, note: '1 이하라 비율로 읽었다' };
}

const CLAIM_STAGES: ClaimStage[] = ['접수', '청구', '정정', '확인', '수금'];
const PAY_STAGES: PayStage[] = ['접수', '통보', '정정', '확인', '지급'];
const TARGETS: SettleTarget[] = ['양쪽', '공급', '영업'];
const pick = <T extends string>(v: unknown, all: T[], dflt: T): T => {
  const t = String(v ?? '').trim() as T;
  return all.includes(t) ? t : dflt;
};

/**
 * ★청구금액 0 을 어떻게 읽나.
 *
 *   461줄 중 53줄이 「지급은 나갔는데 청구가 0」이다.
 *   대표 2026-09-17 「5월은 이미 다 한거고」 — 즉 **끝난 달의 0 은 «처리 완료»** 다.
 *   그래서 0 을 무조건 「모름」으로 올리지 않는다. 가르는 기준은 하나다 —
 *
 *     청구가 «아직 안 끝난» 줄에서만 0 을 「모름(null)」으로 본다.
 *     끝난 줄(청구 단계를 지났고 지급까지 통보된 것)의 0 은 사실로 둔다.
 *
 *   ⚠ 이 규칙이 틀리면 화면이 「청구할 게 있다」고 거짓말한다. 판정을 줄에 남긴다.
 */
function claimOf(d: Erp5Row): { claim: Maybe<number>; why: Maybe<string> } {
  const v = n(d.claimWritten);
  if (v === null) return { claim: null, why: '청구금액 칸이 비어 있다' };
  if (v !== 0) return { claim: v, why: null };
  /* 지급 축이 통보를 지났다(통보·확인·지급) + 청구서가 나갔다 = 끝난 줄 */
  const done = ['통보', '확인', '지급'].includes(String(d.payStage ?? '')) && b(d.billed);
  if (done) return { claim: 0, why: null };                    /* 끝난 줄의 0 — 사실이다 */
  return { claim: null, why: '청구금액이 0 인데 아직 «안 끝난» 줄이다 — 모른다로 둔다' };
}

export function toSettlementRow(d: Erp5Row, docId: string): { row: SettlementRow; warnings: string[] } {
  const warnings: string[] = [];
  const { claim, why } = claimOf(d);
  if (why) warnings.push(why);

  const supplierFee = feeOf(d.supplierRate, '공급사');
  const channelFee = feeOf(d.agentRate, '영업채널');
  if (supplierFee.mode === 'FLAT') warnings.push('공급사 수수료가 정액이다');
  if (supplierFee.mode === 'UNKNOWN') warnings.push('공급사 수수료를 모른다');

  const plate = s(d.plate);
  const supplier = s(d.supplier);
  if (!plate) warnings.push('★차량번호가 없다 — 접수는 유지되지만 인도·정산 전에 차량번호를 배정해야 한다');
  if (!supplier) warnings.push('★공급사가 없다 — 청구할 곳이 없다');

  const ratio = n(d.settleRatio) ?? 1;
  const contractPaymentState = contractPaymentStateOf(d);
  if (contractPaymentState.state === 'INCONSISTENT') {
    warnings.push(`★계약금 수납 기록 불완전 — ${contractPaymentState.reason}`);
  }
  if (ratio !== 1 && !s(d.settleNote)) warnings.push(`정산비율이 ${ratio} 인데 까닭이 안 적혀 있다`);

  const row: SettlementRow = {
    id: s(d.code) ?? docId,
    plate, receivedAt: s(d.receivedAt), customer: s(d.customer),
    supplier, supplierCode: s(d.supplierCode),
    channel: s(d.channel), channelCode: s(d.channelCode),
    agent: s(d.agent), agentCode: s(d.agentCode), model: s(d.model),

    product: s(d.product), rentKind: s(d.rentKind), contractType: s(d.contractType),
    term: n(d.term), rent: n(d.rent), deposit: n(d.deposit),
    /* ★차량가액은 신차만 값이 있다. 0 을 「0원짜리 차」로 읽지 않는다 */
    price: n(d.price) || null,
    payKind: s(d.payKind),
    paidRounds: n(d.paidRounds) ?? n(d.rounds),
    catalogRef: {
      productId: s(d.sourceProductId),
      productVersion: n(d.sourceProductVersion),
      offerId: s(d.sourceOfferId),
      sourceSnapshotId: s(d.sourceSnapshotId),
      snapshotDigest: s(d.catalogSnapshotDigest),
    },
    catalogSnapshot: catalogSnapshotOf(d.catalogSnapshot),
    esignContractId: s(d.esignContractId),
    contractPayment: contractPaymentState.state === 'RECEIVED' ? contractPaymentState.fact : null,
    contractCancelledAt: n(d.contractCancelledAt),
    contractCancellationReason: s(d.contractCancellationReason),
    contractTerminatedAt: n(d.contractTerminatedAt),
    contractTerminationDate: s(d.contractTerminationDate),
    contractTerminationReason: s(d.contractTerminationReason),
    contractTerminationOperationId: s(d.contractTerminationOperationId),
    contractTerminationContractId: s(d.contractTerminationContractId),
    contractTerminationBy: s(d.contractTerminationBy),

    progress: {
      paper: b(d.paper),
      delivered: b(d.delivered), deliveredAt: s(d.deliveredAt),
      cancelled: b(d.cancelled),
      billed: b(d.billed), billMonth: s(d.billMonth), billedAt: s(d.billedAt),
      invoiceIssued: b(d.invoiceIssued), invoiceAt: s(d.invoiceAt), invoiceBiz: s(d.invoiceBiz),
      collected: b(d.collected), collectedAmt: n(d.collectedAmt),
      paid: b(d.paid), paidAmt: n(d.paidAmt),
      supplierOk: b(d.supplierOk), channelOk: b(d.channelOk),
      billHold: b(d.billHold), settleExclude: b(d.settleExclude),
    },
    claimStage: pick(d.claimStage, CLAIM_STAGES, '접수'),
    payStage: pick(d.payStage, PAY_STAGES, '접수'),
    supplierFee, channelFee,
    money: {
      claim, pay: n(d.payWritten),
      claimIncentive: n(d.claimIncentive) || null,
      payIncentive: n(d.payIncentive) || null,
      /* ★가감은 전용 원자. supplierFixAmt(정정금액)를 더하면 두 배가 된다 — 실측 정정금액 = 청구액 */
      claimAdjust: n(d.claimAdjust) || null,
      payAdjust: n(d.payAdjust) || null,
      adjustReason: s(d.adjustReason),
      promoShare: typeof d.promoShare === 'number' ? d.promoShare : null,
      promoReason: s(d.promoReason),
      carryClaim: n(d.carryClaim) || null,
      carryPay: n(d.carryPay) || null,
      carryMonth: s(d.carryMonth), carryNote: s(d.carryNote),
      prepaid: n(d.prepaid) || null,
      vatIncluded: b(d.vatIncluded),
    },
    settleTarget: pick(d.settleTarget, TARGETS, '양쪽'),
    settleRatio: ratio,
    note: s(d.note), settleNote: s(d.settleNote),
    source: { rowNo: n(d.sourceRow), tab: s(d.sourceTab), sheet: s(d.fromSheet) },
  };
  return { row, warnings };
}

/** 화면의 갈래 이름 — ★「무엇이 있나」가 아니라 「무엇을 하나」 */
export const BLOCK_ORDER: Block[] = [
  '계약서', '차량번호 없음', '공급사 없음', '인도',
  '청구금액 모름', '청구', '계산서', '수금',
  '영업채널 없음', '지급금액 모름', '지급',
];
