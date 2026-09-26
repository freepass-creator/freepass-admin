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
