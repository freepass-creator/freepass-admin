export type ContractPaymentInput = {
  amount: number;
  operationId: string;
  receiptId?: string;
};

export type ContractPaymentFact = {
  amount: number;
  receivedAt: number;
  operationId: string;
  receiptId: string | null;
  by: string | null;
};

export type ContractPaymentDispositionFact = {
  refundedAmount: number;
  supplierRevenueAmount: number;
  offsetAmount: number;
  decidedAt: number;
  reason: string;
  operationId: string;
  by: string | null;
};

export type ContractPaymentDispositionState =
  | { state: 'NOT_APPLICABLE' }
  | { state: 'PENDING'; payment: ContractPaymentFact }
  | { state: 'RESOLVED'; payment: ContractPaymentFact; fact: ContractPaymentDispositionFact }
  | { state: 'INCONSISTENT'; reason: string };

export type ContractPaymentDispositionInput = Pick<ContractPaymentDispositionFact,
  'refundedAmount' | 'supplierRevenueAmount' | 'offsetAmount' | 'reason' | 'operationId'>;

export type ContractPaymentState =
  | { state: 'NONE' }
  | { state: 'RECEIVED'; fact: ContractPaymentFact }
  | { state: 'INCONSISTENT'; reason: string };

export type ContractPaymentPlan =
  | { ok: true; idempotent: boolean; patch: Record<string, unknown>; fact: ContractPaymentFact }
  | { ok: false; error: string };

const S = (v: unknown) => String(v ?? '').trim();
const B = (v: unknown) => v === true || v === 'true' || v === 'TRUE' || v === 'Y' || v === '참' || v === 1;
const OP = /^[A-Za-z0-9_-]{16,128}$/;

export function contractPaymentStateOf(raw: Record<string, unknown>): ContractPaymentState {
  const amount = Number(raw.contractPaymentAmount);
  const receivedAt = Number(raw.contractPaymentReceivedAt);
  const operationId = S(raw.contractPaymentOperationId);
  const receiptId = S(raw.contractPaymentReceiptId) || null;
  const by = S(raw.contractPaymentBy) || null;

  const hasAny = raw.contractPaymentAmount !== undefined && raw.contractPaymentAmount !== null
    || raw.contractPaymentReceivedAt !== undefined && raw.contractPaymentReceivedAt !== null
    || !!operationId || !!receiptId || !!by;
  if (!hasAny) return { state: 'NONE' };

  if (!Number.isInteger(amount) || amount <= 0) {
    return { state: 'INCONSISTENT', reason: '계약금 수납 금액이 없거나 올바르지 않습니다.' };
  }
  if (!Number.isFinite(receivedAt) || receivedAt <= 0) {
    return { state: 'INCONSISTENT', reason: '계약금 수납 시각이 없거나 올바르지 않습니다.' };
  }
  if (!OP.test(operationId)) {
    return { state: 'INCONSISTENT', reason: '계약금 수납 operation ID가 없거나 올바르지 않습니다.' };
  }
  return {
    state: 'RECEIVED',
    fact: { amount, receivedAt, operationId, receiptId, by },
  };
}

export const contractPaymentReceived = (raw: Record<string, unknown>) =>
  contractPaymentStateOf(raw).state === 'RECEIVED';

export function contractPaymentDispositionStateOf(raw: Record<string, unknown>): ContractPaymentDispositionState {
  const payment = contractPaymentStateOf(raw);
  if (payment.state === 'INCONSISTENT') return payment;
  if (payment.state === 'NONE') return { state: 'NOT_APPLICABLE' };
  const cancelled = B(raw.cancelled) || Number(raw.contractCancelledAt ?? 0) > 0;
  const values = [raw.contractPaymentRefundedAmount, raw.contractPaymentSupplierRevenueAmount, raw.contractPaymentOffsetAmount];
  const decidedAt = Number(raw.contractPaymentDispositionAt);
  const operationId = S(raw.contractPaymentDispositionOperationId);
  const reason = S(raw.contractPaymentDispositionReason);
  const by = S(raw.contractPaymentDispositionBy) || null;
  const hasAny = values.some((v) => v !== undefined && v !== null) || decidedAt > 0 || !!operationId || !!reason || !!by;
  if (!hasAny) return cancelled ? { state: 'PENDING', payment: payment.fact } : { state: 'NOT_APPLICABLE' };
  if (!cancelled) return { state: 'INCONSISTENT', reason: '계약취소 전인데 계약금 처리 결과가 기록되어 있습니다.' };
  const [refundedAmount, supplierRevenueAmount, offsetAmount] = values.map(Number);
  if (![refundedAmount, supplierRevenueAmount, offsetAmount].every((n) => Number.isInteger(n) && n >= 0)) {
    return { state: 'INCONSISTENT', reason: '계약금 반환·공급사 귀속·상계 금액이 올바르지 않습니다.' };
  }
  if (refundedAmount + supplierRevenueAmount + offsetAmount !== payment.fact.amount) {
    return { state: 'INCONSISTENT', reason: '계약금 처리 금액 합계가 수납액과 일치하지 않습니다.' };
  }
  if (!(decidedAt > 0) || !OP.test(operationId) || !reason) {
    return { state: 'INCONSISTENT', reason: '계약금 처리의 시각·사유·요청 식별자가 불완전합니다.' };
  }
  return { state: 'RESOLVED', payment: payment.fact, fact: { refundedAmount, supplierRevenueAmount, offsetAmount, decidedAt, reason, operationId, by } };
}

export function planContractPaymentDisposition(raw: Record<string, unknown>, input: ContractPaymentDispositionInput, nowMs: number) {
  const payment = contractPaymentStateOf(raw);
  if (payment.state !== 'RECEIVED') return { ok: false as const, error: payment.state === 'NONE' ? '계약금 수납 사실이 없습니다.' : payment.reason };
  if (!(B(raw.cancelled) || Number(raw.contractCancelledAt ?? 0) > 0)) return { ok: false as const, error: '계약취소된 건에서만 계약금 처리 결과를 확정합니다.' };
  if (B(raw.delivered)) return { ok: false as const, error: '인도 후 건은 계약금 취소처리가 아니라 계약해지·환수 절차입니다.' };
  if (!Number.isFinite(nowMs) || nowMs <= 0 || !OP.test(input.operationId.trim()) || !input.reason.trim()) {
    return { ok: false as const, error: '계약금 처리 시각·사유·요청 식별자를 확인해 주세요.' };
  }
  const amounts = [input.refundedAmount, input.supplierRevenueAmount, input.offsetAmount];
  if (!amounts.every((n) => Number.isInteger(n) && n >= 0)) return { ok: false as const, error: '처리 금액은 0원 이상의 정수로 입력합니다.' };
  if (amounts.reduce((a, b) => a + b, 0) !== payment.fact.amount) return { ok: false as const, error: '반환액 + 공급사 귀속액 + 상계액은 계약금 수납액과 같아야 합니다.' };
  const current = contractPaymentDispositionStateOf(raw);
  if (current.state === 'INCONSISTENT') return { ok: false as const, error: current.reason };
  if (current.state === 'RESOLVED') {
    const same = current.fact.operationId === input.operationId.trim()
      && current.fact.refundedAmount === input.refundedAmount
      && current.fact.supplierRevenueAmount === input.supplierRevenueAmount
      && current.fact.offsetAmount === input.offsetAmount
      && current.fact.reason === input.reason.trim();
    return same ? { ok: true as const, idempotent: true, patch: {}, fact: current.fact }
      : { ok: false as const, error: '이미 확정된 계약금 처리 결과가 있습니다.' };
  }
  const fact: ContractPaymentDispositionFact = { ...input, reason: input.reason.trim(), operationId: input.operationId.trim(), decidedAt: nowMs, by: null };
  return { ok: true as const, idempotent: false, fact, patch: {
    contractPaymentRefundedAmount: fact.refundedAmount,
    contractPaymentSupplierRevenueAmount: fact.supplierRevenueAmount,
    contractPaymentOffsetAmount: fact.offsetAmount,
    contractPaymentDispositionAt: fact.decidedAt,
    contractPaymentDispositionReason: fact.reason,
    contractPaymentDispositionOperationId: fact.operationId,
  } };
}

export function planContractPayment(
  raw: Record<string, unknown>,
  input: ContractPaymentInput,
  nowMs: number,
): ContractPaymentPlan {
  if (!Number.isFinite(nowMs) || nowMs <= 0) {
    return { ok: false, error: '계약금 수납 처리 시각이 올바르지 않습니다.' };
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, error: '계약금은 1원 이상의 정수 금액으로 기록합니다.' };
  }
  const operationId = input.operationId.trim();
  if (!OP.test(operationId)) {
    return { ok: false, error: '계약금 수납 요청 식별자가 올바르지 않습니다.' };
  }
  const receiptId = input.receiptId?.trim() || null;
  if (receiptId && receiptId.length > 128) {
    return { ok: false, error: '계약금 수납 영수증 식별자가 너무 깁니다.' };
  }
  if (B(raw.cancelled) || Number(raw.contractCancelledAt ?? 0) > 0) {
    return { ok: false, error: '취소된 접수에는 계약금 수납을 새로 기록할 수 없습니다.' };
  }
  if (Number(raw.contractTerminatedAt ?? 0) > 0) {
    return { ok: false, error: '계약해지된 건에는 계약금 수납을 새로 기록할 수 없습니다.' };
  }

  const current = contractPaymentStateOf(raw);
  if (current.state === 'INCONSISTENT') {
    return { ok: false, error: `기존 계약금 수납 기록이 불완전합니다 — ${current.reason}` };
  }
  if (current.state === 'RECEIVED') {
    const same = current.fact.operationId === operationId
      && current.fact.amount === input.amount
      && current.fact.receiptId === receiptId;
    if (same) return { ok: true, idempotent: true, patch: {}, fact: current.fact };
    return { ok: false, error: '이미 다른 계약금 수납 기록이 있습니다 — 기존 수납 기록을 확인해 주세요.' };
  }

  const fact: ContractPaymentFact = {
    amount: input.amount,
    receivedAt: nowMs,
    operationId,
    receiptId,
    by: null,
  };
  return {
    ok: true,
    idempotent: false,
    fact,
    patch: {
      contractPaymentAmount: fact.amount,
      contractPaymentReceivedAt: fact.receivedAt,
      contractPaymentOperationId: fact.operationId,
      contractPaymentReceiptId: fact.receiptId,
    },
  };
}
