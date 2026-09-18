/**
 * **계약 접수 한 건 → ERP5 `settlement_rows` 한 줄.**  화면을 모른다. 값과 규칙만.
 *
 * ★대표 2026-09-18 「상품이랑 정산도 다 여기서(ERP5) 관리할거야」 · 「당분간은 f04랑 erp입력을 병행」
 *   · 「있으면 안 올리면 되잖아 같은거는」
 *   ⇒ 같은 차번+접수일이 이미 있으면 «새로 안 만든다». 있던 줄을 돌려준다.
 *
 * ★칸 이름은 ERP5 원자 그대로다 (실측 461줄 · 70칸). 새 이름을 만들지 않는다.
 */
import { settlementCode } from './code';
import type { FeeResult } from './fee';
import { promotionPatch } from './adjust';
import type { Promotion } from './promotion';

export interface IntakeInput {
  receivedAt: string;   // YYYY-MM-DD
  plate: string;
  model: string;
  supplier: string;
  supplierCode: string;
  customer: string;
  channel: string;
  channelCode: string;
  agent: string;
  agentCode: string;
  product: string;      // 장기렌트 · 오플구독 · 선출고 · 구독 …
  rentKind: string;     // 재렌트 · 구독 · 신차렌트
  contractType: string; // 전자약정 · 대면계약(출장)
  term: number | null;
  rent: number | null;
  deposit: number | null;
  price: number | null;
  payKind: string;      // 일시납 · 2회분납 · 3회분납
  paper: boolean;
  delivered: boolean;
  deliveredAt: string;
  note: string;
  /** 프로모션 — 대표 2026-09-17 「접수할때 프로모션 업셀링 금액을 넣어야함」 · 영업자 몫 기본 100% */
  promotion?: Promotion;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ★최초 접수 필수값 (WORK-INBOX §12 · AGENTS §9) — 차량 · 영업채널 · 담당자 · 고객명.
 *   + 접수일 (열쇠의 반쪽이다).
 * ⚠ 전화번호는 받지 않는다 — ERP5 정산 원장에 그 칸이 없다.
 */
export function validateIntake(x: IntakeInput, today: string): string[] {
  const e: string[] = [];
  if (!x.plate.trim()) e.push('차량번호가 없습니다');
  if (!DAY.test(x.receivedAt)) e.push('접수일은 YYYY-MM-DD 로 넣습니다');
  else if (x.receivedAt > today) e.push(`접수일 ${x.receivedAt} 은 오늘(${today}) 뒤일 수 없습니다`);
  if (!x.customer.trim()) e.push('고객명이 없습니다');
  if (!x.channel.trim()) e.push('영업채널이 없습니다');
  if (!x.agent.trim()) e.push('영업담당이 없습니다');
  if (!x.supplier.trim()) e.push('공급사가 없습니다 — 청구할 곳이 없으면 정산이 안 섭니다');
  /* ★인도완료는 인도일과 «같이» 온다. 날짜 없이 켜면 청구월이 안 선다 (erp4 appendIntake 와 같은 규칙) */
  if (x.delivered && !DAY.test(x.deliveredAt)) e.push('인도완료를 켜려면 인도일을 같이 넣어야 합니다');
  if (x.promotion?.amount && x.promotion.agentShare === null) e.push('프로모션 영업자 몫은 0~100% 로 넣습니다');
  for (const [k, v] of [['계약기간', x.term], ['렌탈료', x.rent], ['보증금', x.deposit], ['차량가액', x.price]] as const) {
    if (v !== null && (!Number.isFinite(v) || v < 0)) e.push(`${k} 값을 읽지 못했습니다`);
  }
  return e;
}

/**
 * ERP5 원자 한 줄. ★기존 461줄은 70칸이 «늘 다 있다» — 새 줄도 같은 꼴로 세운다.
 *   빠진 칸이 있으면 읽는 쪽마다 「없음」 과 「빈 값」 을 따로 다뤄야 한다.
 *
 * @param fee 수수료표(ERP5 `settlement_fee_rules`)로 셈한 결과.
 *   ★AUTO 일 때만 요율·금액을 채운다. MANUAL(건별 책정 등)·NO_RULE·NO_BASE 는 0 으로 두고 까닭을 정산 메모에 남긴다 —
 *   가장 비슷한 규칙에 끼워 세면 조용한 오답이 된다(erp4 2026-09-08 신차발주 사고).
 */
export function intakeRecord(x: IntakeInput, nowMs: number, fee?: FeeResult, feeVersion?: string): Record<string, unknown> {
  const code = settlementCode(x.plate, x.receivedAt);
  const iso = new Date(nowMs).toISOString();
  const auto = fee?.status === 'AUTO' ? fee : null;
  const feeNote = !fee ? '수수료: 셈 안 함'
    : fee.status === 'AUTO' ? `수수료표 ${feeVersion ?? ''} · ${fee.rule.id}`.trim()
      : `수수료: ${fee.why}`;
  return {
    code,
    plate: x.plate.replace(/\s/g, ''), receivedAt: x.receivedAt,
    model: x.model.trim(), customer: x.customer.trim(),
    supplier: x.supplier.trim(), supplierCode: x.supplierCode.trim(),
    channel: x.channel.trim(), channelCode: x.channelCode.trim(),
    agent: x.agent.trim(), agentCode: x.agentCode.trim(),
    product: x.product.trim(), rentKind: x.rentKind.trim(), contractType: x.contractType.trim(),
    term: x.term ?? 0, rent: x.rent ?? 0, deposit: x.deposit ?? 0, price: x.price ?? 0,
    payKind: x.payKind.trim(),
    supplierRate: auto ? auto.rule.claim : 0, agentRate: auto ? auto.rule.pay : 0,
    claimWritten: auto ? auto.claim : 0, payWritten: auto ? auto.pay : 0,
    ...(x.promotion?.amount ? promotionPatch(x.promotion) : { claimIncentive: 0, payIncentive: 0 }),
    claimAdjust: 0, payAdjust: 0, adjustReason: '',
    paper: x.paper, delivered: x.delivered, deliveredAt: x.delivered ? x.deliveredAt : '',
    cancelled: false,
    billMonth: '', settleTarget: '양쪽', settleRatio: 1,
    billHold: false, settleExclude: false, settledAlready: false, vatIncluded: false,
    settleNote: feeNote, stage: '접수', claimStage: '접수', payStage: '접수',
    billed: false, billedAt: '', collected: false, collectedAt: '', collectedAmt: 0,
    paid: false, paidAt: '', paidAmt: 0,
    supplierOk: false, supplierFix: false, supplierFixAmt: 0, supplierMemo: '',
    channelOk: false, channelFix: false, channelFixAmt: 0, channelMemo: '',
    stateAt: iso, carryNote: '', carryMonth: '', note: x.note.trim(),
    sourceTab: '', sourceRow: 0, fromSheet: 'freepass-admin',
    createdAt: nowMs, updatedAt: nowMs,
    prepaid: 0, carryPay: 0, carryClaim: 0,
    invoiceAt: '', invoiceBiz: '', invoiceIssued: false,
    intakeKind: '영업수수료',
  };
}

/* ── 진행 체크 — 계약서 · 인도 · 취소 ─────────────────────────── */

export type ProgressChange =
  | { kind: 'paidRounds'; rounds: number | null }
  | { kind: 'paper'; on: boolean }
  | { kind: 'delivered'; on: boolean; deliveredAt?: string }
  | { kind: 'cancelled'; on: boolean; reason?: string };

export type ProgressEvent = { field: string; from: string; to: string };

/**
 * 바뀔 칸과 «이력» 을 같이 낸다. 이력의 `field` 는 erp4 가 남기던 대로 시트 열 이름이다
 * (`settlement_events` 실측 — 「인도일」 · 「인도완료」). 같은 말을 써야 한 이력으로 읽힌다.
 */
export function progressPatch(
  cur: Record<string, unknown>, c: ProgressChange,
): { ok: true; patch: Record<string, unknown>; events: ProgressEvent[] } | { ok: false; error: string } {
  const B = (v: unknown) => v === true || v === 'TRUE' || v === 'true';
  const S = (v: unknown) => String(v ?? '');
  if (B(cur.cancelled) && !(c.kind === 'cancelled' && !c.on)) return { ok: false, error: '취소된 줄입니다 — 취소를 먼저 풀어야 고칠 수 있습니다' };

  /*
   * 받은 회차 — ★분납이 «끊겼을 때» 사람이 멈춘 회차를 적는다. 비우면(null) 기간 비례로 돌아간다.
   *   인도 전에는 못 적는다(1회차는 인도 때 낸다). 회차 수를 넘지 못한다.
   */
  if (c.kind === 'paidRounds') {
    const n = (() => { const m = /(\d)\s*회/.exec(S(cur.payKind)); const k = m ? Number(m[1]) : 1; return k >= 2 ? k : 1; })();
    if (n < 2) return { ok: false, error: '분납 줄이 아닙니다 — 받은 회차는 분납에만 적습니다' };
    if (!B(cur.delivered)) return { ok: false, error: '인도 전입니다 — 1회차는 인도 때 냅니다' };
    if (c.rounds !== null && (!Number.isInteger(c.rounds) || c.rounds < 1 || c.rounds > n)) return { ok: false, error: `받은 회차는 1~${n} 사이입니다` };
    const before = cur.paidRounds === undefined || cur.paidRounds === null ? '' : S(cur.paidRounds);
    const after = c.rounds === null ? '' : String(c.rounds);
    if (before === after) return { ok: true, patch: {}, events: [] };
    return { ok: true, patch: { paidRounds: c.rounds }, events: [{ field: '받은회차', from: before, to: after }] };
  }
  if (c.kind === 'paper') {
    if (B(cur.paper) === c.on) return { ok: true, patch: {}, events: [] };
    return { ok: true, patch: { paper: c.on }, events: [{ field: '계약서', from: S(B(cur.paper)), to: S(c.on) }] };
  }
  if (c.kind === 'delivered') {
    if (c.on) {
      const day = S(c.deliveredAt).trim();
      if (!DAY.test(day)) return { ok: false, error: '인도완료를 켜려면 인도일을 같이 넣어야 합니다' };
      const ev: ProgressEvent[] = [];
      if (!B(cur.delivered)) ev.push({ field: '인도완료', from: 'false', to: 'true' });
      if (S(cur.deliveredAt) !== day) ev.push({ field: '인도일', from: S(cur.deliveredAt), to: day });
      return { ok: true, patch: ev.length ? { delivered: true, deliveredAt: day } : {}, events: ev };
    }
    /* ★인도를 끌 때 인도일은 «지우지 않는다» — 잘못 누른 것을 되돌릴 때 날짜를 잃는다 */
    if (!B(cur.delivered)) return { ok: true, patch: {}, events: [] };
    return { ok: true, patch: { delivered: false }, events: [{ field: '인도완료', from: 'true', to: 'false' }] };
  }
  /* 취소 — ★지우지 않는다. 사유를 메모에 덧붙여 남긴다 */
  if (c.on) {
    if (B(cur.cancelled)) return { ok: true, patch: {}, events: [] };
    const reason = S(c.reason).trim();
    if (!reason) return { ok: false, error: '취소 사유를 넣어야 합니다' };
    const note = [S(cur.note).trim(), `[취소] ${reason}`].filter(Boolean).join(' / ');
    return { ok: true, patch: { cancelled: true, note }, events: [{ field: '취소', from: 'false', to: 'true' }, { field: '취소사유', from: '', to: reason }] };
  }
  if (!B(cur.cancelled)) return { ok: true, patch: {}, events: [] };
  return { ok: true, patch: { cancelled: false }, events: [{ field: '취소', from: 'true', to: 'false' }] };
}
