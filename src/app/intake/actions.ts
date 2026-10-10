'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { freepassDataProducts, productByIdFresh } from '../../server/freepass-data';
import { catalogLookupHold, plateOffers, type PlateOffer } from '../ledger/model';
import { settlements, today, WriteDisabledError } from '../../server/erp5';
import { currentActor, requireAdmin } from '../../server/require-admin';
import { readDataFee, type DataFee } from '../../domain/settlement/fee';
import { FACT_LABEL, validateIntake, type FactChange, type FactKey, type IntakeInput, type ProgressChange } from '../../domain/settlement/intake';
import type { Axis, LifeChange } from '../../domain/settlement/lifecycle';
import { adjustPatch, adjustmentFromInput, promotionFromInput, promotionPatch } from '../../domain/settlement/adjust';
import { buildIntakeCatalogSnapshot } from '../../domain/settlement/catalog-snapshot';
import { directIntakeRentKind, resolveLedgerKindSelection } from '../../domain/settlement/product-kind';
import { savedIntakeHref } from '../products/list-rows';

/**
 * **써도 되는지 물은 뒤 부른다** — 관리자 액션 10개가 첫 줄에서 requireAdmin() 을 부르는 모양은
 *   그대로 둔다(액션마다 돌려주는 꼴이 달라 — FormState · FeePreview … 한 틀로 못 묶는다).
 *   대신 «쓰기가 실패했을 때 무슨 말을 하나» 는 여기 한 곳에서 정한다 — 8곳이 똑같은 삼항연산자를 복사해 갖고 있었다.
 */
function writeError(fallback: string, e: unknown): string {
  return e instanceof WriteDisabledError ? (e as Error).message : `${fallback} — ${(e as Error).message}`;
}

/**
 * 화면 → 원장. ★여기는 «받아서 넘기기» 만 한다. 규칙은 domain/settlement/intake.ts 가 쥔다.
 */
export type FormState = { errors: string[] };

const S = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const N = (f: FormData, k: string) => {
  const t = S(f, k).replace(/[,\s원]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export async function createIntakeAction(_: FormState, f: FormData): Promise<FormState> {
  const r = await createIntakeFrom(f);
  if ('errors' in r) return r;
  /*
   * ★이미 있던 줄이면 새로 안 만들고 그 줄로 보낸다 (대표 「있으면 안 올리면 되잖아」)
   * ★계약접수 쪽을 떠나지 않는다 — 대표 «절대 법칙» 「상단 메뉴를 누르지 않는 이상 다른 페이지로 가지 않는다」.
   *   가운데는 방금 만든 접수 상세, 오른쪽은 접수 목록을 유지한다. 검색/상품/Offer 문맥도 보존한다.
   */
  redirect(savedIntakeHref(S(f, 'returnContext'), r.code, r.created));
}

/**
 * 접수 관리(/ledger) — 차량번호로 프리패스 상품 조건을 찾는다. 읽기만 한다.
 * ★FreePass Data ACTIVE 정본만 쓰고, policyParity·commercialCoverage 가 COMPLETE 가 아니면 «보류» 한다
 *   (총괄·Codex 결정 2026-10-03 — 원장은 봉인 저장까지 가므로 정본 없는 값을 불러오지 않는다. 구 DB/데모 fallback 없음).
 *   연결 실패도 보류다 — 값을 추측하지 않고 직접 입력을 유지한다.
 * 고른 조건은 저장 때 createIntakeFrom 이 상품을 다시 읽어 확인·봉인한다(다르면 저장을 막는다).
 */
export async function ledgerPlateLookupAction(plate: string): Promise<{ offers: PlateOffer[]; message: string; held?: boolean }> {
  const denied = await requireAdmin();
  if (denied) return { offers: [], message: denied };
  if (typeof plate !== 'string' || !plate.trim() || plate.length > 30) return { offers: [], message: '차량번호를 확인해 주세요' };
  let catalog: Awaited<ReturnType<typeof freepassDataProducts.list>>;
  try {
    catalog = await freepassDataProducts.list();
  } catch {
    return { offers: [], held: true, message: catalogLookupHold(null)! };
  }
  const hold = catalogLookupHold(catalog.meta);
  if (hold) return { offers: [], held: true, message: hold };
  const offers = plateOffers(catalog.rows, plate);
  return { offers, message: offers.length ? `${offers.length}개 조건이 있습니다 — 고르면 조건이 채워집니다` : '프리패스 상품에 없는 차량입니다 — 직접 입력합니다' };
}
/** 접수표(/ledger) — 같은 저장 규칙, 화면을 옮기지 않고 결과만 돌려준다. */
export type LedgerCreateState = FormState & { code?: string; created?: boolean };
export async function ledgerCreateAction(_: LedgerCreateState, f: FormData): Promise<LedgerCreateState> {
  const r = await createIntakeFrom(f);
  if ('errors' in r) return r;
  revalidatePath('/ledger');
  return { errors: [], code: r.code, created: r.created };
}

async function createIntakeFrom(f: FormData): Promise<FormState | { code: string; created: boolean }> {
  { const g = await requireAdmin(); if (g) return { errors: [g] }; }
  let input: IntakeInput = {
    receivedAt: S(f, 'receivedAt'), plate: S(f, 'plate'), model: S(f, 'model'),
    supplier: S(f, 'supplier'), supplierCode: S(f, 'supplierCode'),
    customer: S(f, 'customer'),
    channel: S(f, 'channel'), channelCode: S(f, 'channelCode'),
    agent: S(f, 'agent'), agentCode: S(f, 'agentCode'),
    product: S(f, 'product'), rentKind: S(f, 'rentKind'), contractType: S(f, 'contractType'),
    term: N(f, 'term'), rent: N(f, 'rent'), deposit: N(f, 'deposit'), price: N(f, 'price'),
    payKind: S(f, 'payKind'),
    intakeRequestId: S(f, 'intakeRequestId') || undefined,
    sourceProductId: S(f, 'sourceProductId') || undefined,
    sourceProductVersion: N(f, 'sourceProductVersion'),
    sourceOfferId: S(f, 'sourceOfferId') || undefined,
    sourceSnapshotId: S(f, 'sourceSnapshotId') || undefined,
    paper: f.get('paper') === 'on', delivered: f.get('delivered') === 'on', deliveredAt: S(f, 'deliveredAt'),
    note: S(f, 'note'),
    /* 프로모션 — 금액 · 영업자 몫(%) · 사유. ★몫을 비우면 100% (대표 「기본 100%」) */
    promotion: promotionFromInput(f.get('promoAmount'), f.get('promoSharePct'), S(f, 'promoReason')),
    /* 폼 입력은 저장값과 대조할 뿐 수수료를 덮어쓰지 않는다. */
    ...((S(f, 'feeClaim') || S(f, 'feePay')) ? { feeManual: { claim: N(f, 'feeClaim'), pay: N(f, 'feePay'), reason: S(f, 'feeReason') } } : {}),
  };
  if (!input.sourceProductId && !input.sourceOfferId) {
    const directRentKind = directIntakeRentKind(input.product);
    if (directRentKind) input = { ...input, rentKind: directRentKind };
  }

  /* 상품에서 온 접수는 browser hidden 값만 믿지 않는다.
   * 저장 직전에 FreePass Data Catalog consumer boundary를 다시 읽어 같은 version/snapshot/Offer인지 확인한다.
   * 현재 OBSERVE 단계에서는 이 fresh read가 legacy ERP5 bridge를 사용하지만 use case는 그 저장소를 모른다.
   *
   * 계약조건은 authoritative Product/Offer 값으로 다시 묶는다. */
  if (input.sourceProductId || input.sourceOfferId) {
    if (!input.sourceProductId || !input.sourceOfferId || input.sourceProductVersion === null || !input.sourceSnapshotId) {
      return { errors: ['상품 접수의 Product/Version/Offer/Snapshot 정보가 불완전합니다 — 상품을 다시 골라 주세요'] };
    }
    let product;
    try { product = await productByIdFresh(input.sourceProductId); }
    catch (e) { return { errors: [`상품을 다시 확인하지 못했습니다 — ${(e as Error).message}`] }; }
    if (!product) return { errors: ['선택한 상품이 더 이상 없습니다 — 상품을 다시 골라 주세요'] };
    if (input.sourceProductVersion !== null && input.sourceProductVersion !== product.version) {
      return { errors: [`상품이 변경되었습니다 (v${input.sourceProductVersion} → v${product.version}) — 조건을 다시 확인해 주세요`] };
    }
    if (input.sourceSnapshotId && input.sourceSnapshotId !== product.sourceSnapshotId) {
      return { errors: ['상품 원천 Snapshot이 변경되었습니다 — 조건을 다시 확인해 주세요'] };
    }
    const offer = product.offers.find((x) => x.id === input.sourceOfferId);
    if (!offer) return { errors: ['선택한 Offer가 더 이상 없습니다 — 기간/조건을 다시 골라 주세요'] };
    const ledgerKind = resolveLedgerKindSelection(product.productKind, input.product, input.rentKind);
    if (ledgerKind && !ledgerKind.ok) return { errors: [ledgerKind.error] };
    const catalogSnapshot = buildIntakeCatalogSnapshot(product, offer, new Date().toISOString());
    input = {
      ...input,
      plate: product.registration?.vehicleNumber ?? '',
      model: [product.vehicle.modelId, product.vehicle.subModelId].filter(Boolean).join(' '),
      supplier: offer.supplierName ?? offer.supplierId ?? product.supplierName ?? product.supplierId,
      supplierCode: offer.supplierId ?? product.supplierId,
      ...(ledgerKind?.ok ? { product: ledgerKind.product, rentKind: ledgerKind.rentKind } : {}),
      term: offer.termMonths,
      rent: offer.monthlyRent,
      deposit: offer.deposit ?? null,
      // FreePass Data 차량가가 있으면 정본이 이긴다. 없을 때만 접수 화면의 차량가액을 수수료 기준값으로 보충한다.
      price: product.consumerPrice ?? input.price,
      sourceProductVersion: product.version,
      sourceSnapshotId: product.sourceSnapshotId,
      catalogSnapshotDigest: catalogSnapshot.digest,
      catalogSnapshot,
    };
  }

  const errors = validateIntake(input, today());
  if (errors.length) return { errors };

  let res: { code: string; created: boolean };
  try { res = await settlements.createIntake(input, await currentActor()); }
  catch (e) {
    return { errors: [writeError('저장하지 못했습니다', e)] };
  }
  revalidatePath('/intake');
  return res;
}

export async function progressAction(_: FormState, f: FormData): Promise<FormState> {
  { const g = await requireAdmin(); if (g) return { errors: [g] }; }
  const code = S(f, 'code');
  const kind = S(f, 'kind');
  const on = S(f, 'on') === '1';
  let change: ProgressChange;
  if (kind === 'plate') change = { kind, plate: S(f, 'plate') };
  else if (kind === 'paidRounds') {
    const t = S(f, 'rounds');
    change = { kind, rounds: t ? Number(t) : null };
  } else if (kind === 'paper') change = { kind, on };
  else if (kind === 'delivered') change = { kind, on, deliveredAt: S(f, 'deliveredAt') };
  else if (kind === 'cancelled') change = { kind, on, reason: S(f, 'reason') };
  else return { errors: [`모르는 진행 칸: ${kind}`] };

  try {
    const r = await settlements.setProgress(code, change, await currentActor());
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [writeError('저장하지 못했습니다', e)] };
  }
  revalidatePath(`/intake/${code}`);
  revalidatePath('/intake');
  // 계약서/차량번호/인도 상태는 실적·정산 eligibility와 직결된다.
  revalidatePath('/settlement');
  return { errors: [] };
}

/**
 * 프로모션 · 가감 — 접수 뒤에 얹거나 고친다. 폼 칸:
 *   code · promoAmount · promoSharePct(0~100, 비우면 100) · promoReason · claimAdjust · payAdjust · adjustReason
 * ★보낸 칸만 고친다 — 프로모션 칸이 없으면 프로모션을, 가감 칸이 없으면 가감을 안 건드린다.
 */
export async function moneyAction(_: FormState, f: FormData): Promise<FormState> {
  { const g = await requireAdmin(); if (g) return { errors: [g] }; }
  const code = S(f, 'code');
  const patch: Record<string, unknown> = {};
  if (f.has('promoAmount')) {
    const p = promotionFromInput(f.get('promoAmount'), f.get('promoSharePct'), S(f, 'promoReason'));
    if (p.amount && p.agentShare === null) return { errors: ['프로모션 영업자 몫은 0~100% 로 넣습니다'] };
    Object.assign(patch, promotionPatch(p));
  }
  if (f.has('claimAdjust') || f.has('payAdjust')) {
    const a = adjustmentFromInput(f.get('claimAdjust'), f.get('payAdjust'), f.get('adjustReason'));
    if (!a.ok) return { errors: [a.error] };
    Object.assign(patch, adjustPatch(a.adjust));
  }
  try {
    const r = await settlements.setMoney(code, patch, await currentActor());
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [writeError('저장하지 못했습니다', e)] };
  }
  revalidatePath('/intake');
  revalidatePath('/settlement');
  return { errors: [] };
}

/**
 * 청구서(공급사) · 지급명세(영업채널) 발행. 폼 칸: month(YYYY-MM) · axis(공급사|영업채널) · party
 * ★발행하면 그 줄들의 청구월이 박히고(달이 닫힌다) 청구 축은 「청구」, 지급 축은 「통보」 로 간다.
 */
export async function issueInvoiceAction(_: FormState, f: FormData): Promise<FormState & { invoiceNo?: string }> {
  { const g = await requireAdmin(); if (g) return { errors: [g] }; }
  const axis = S(f, 'axis') as Axis;
  if (axis !== '공급사' && axis !== '영업채널') return { errors: ['축은 공급사 또는 영업채널'] };
  try {
    const r = await settlements.issueInvoice(S(f, 'month'), axis, S(f, 'party'), await currentActor());
    if (!r.ok) return { errors: [r.error] };
    revalidatePath('/settlement');
    revalidatePath('/intake');
    return { errors: [], invoiceNo: r.invoice.invoiceNo };
  } catch (e) {
    return { errors: [writeError('발행하지 못했습니다', e)] };
  }
}

/**
 * 한 줄의 다음 걸음. 폼 칸: code · kind 와 그에 딸린 칸
 *   confirm(axis) · correct(axis, amount, memo) · uncorrect(axis) · invoice(on=1|0, biz, day)
 *   collected(amount, day) · paid(amount, day) · hold(on=1|0) · billMonth(month)
 */
export async function lifecycleAction(_: FormState, f: FormData): Promise<FormState> {
  { const g = await requireAdmin(); if (g) return { errors: [g] }; }
  const kind = S(f, 'kind');
  const axis = S(f, 'axis') as Axis;
  const num = (k: string) => { const t = S(f, k).replace(/[,\s원]/g, ''); return t ? Number(t) : NaN; };
  let change: LifeChange;
  switch (kind) {
    case 'confirm': case 'uncorrect':
      if (axis !== '공급사' && axis !== '영업채널') return { errors: ['축은 공급사 또는 영업채널'] };
      change = { kind, axis }; break;
    case 'correct':
      if (axis !== '공급사' && axis !== '영업채널') return { errors: ['축은 공급사 또는 영업채널'] };
      change = { kind, axis, amount: S(f, 'amount') ? num('amount') : null, memo: S(f, 'memo') }; break;
    case 'invoice': change = { kind, on: S(f, 'on') === '1', biz: S(f, 'biz'), day: S(f, 'day') }; break;
    case 'collected': change = { kind, amount: num('amount'), day: S(f, 'day') }; break;
    case 'paid': change = { kind, amount: num('amount'), day: S(f, 'day') }; break;
    case 'hold': change = { kind, on: S(f, 'on') === '1' }; break;
    case 'billMonth': change = { kind, month: S(f, 'month') }; break;
    default: return { errors: [`모르는 걸음: ${kind}`] };
  }
  const operationId = S(f, 'operationId');
  if ((kind === 'collected' || kind === 'paid') && !/^[A-Za-z0-9_-]{16,128}$/.test(operationId)) {
    return { errors: ['수금·지급 요청 식별자가 없습니다 — 화면을 새로 열어 다시 처리합니다'] };
  }
  try {
    const r = await settlements.setLifecycle(S(f, 'code'), change, operationId || undefined, await currentActor());
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [writeError('저장하지 못했습니다', e)] };
  }
  revalidatePath('/settlement');
  revalidatePath('/intake');
  return { errors: [] };
}

/** 관리자 전용 미리보기: 선택 Offer/기간의 저장값을 기존 Catalog에서 읽는다. */
export type FeePreview =
  | { status: 'READ'; termKey: string | null; supplierBillingFee: DataFee; channelPayoutFee: DataFee }
  | { status: 'ERROR'; why: string };
export async function previewFeeAction(f: FormData): Promise<FeePreview> {
  { const g = await requireAdmin(); if (g) return { status: 'ERROR', why: g }; }
  try {
    const productId = S(f, 'sourceProductId'), offerId = S(f, 'sourceOfferId');
    if (!productId || !offerId) return { status: 'READ', termKey: null, supplierBillingFee: readDataFee(undefined), channelPayoutFee: readDataFee(undefined) };
    const product = await productByIdFresh(productId);
    const offer = product?.offers.find((o) => o.id === offerId);
    if (!offer) return { status: 'ERROR', why: '선택한 상품 조건을 다시 확인해 주세요' };
    return { status: 'READ', termKey: offer.termKey ?? null,
      supplierBillingFee: readDataFee(offer.supplierBillingFee), channelPayoutFee: readDataFee(offer.channelPayoutFee) };
  } catch {
    return { status: 'ERROR', why: '프리패스 데이터 저장 수수료를 읽지 못했습니다' };
  }
}

/** 접수 뒤 수수료 고치기. 폼 칸: code · feeClaim · feePay(비우면 그쪽 안 바꿈) · feeReason(필수) */
export async function feeAction(_: FormState, f: FormData): Promise<FormState> {
  { const g = await requireAdmin(); if (g) return { errors: [g] }; }
  try {
    const r = await settlements.setFee(S(f, 'code'), S(f, 'feeClaim') ? N(f, 'feeClaim') : null, S(f, 'feePay') ? N(f, 'feePay') : null, S(f, 'feeReason'), await currentActor());
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [writeError('저장하지 못했습니다', e)] };
  }
  revalidatePath('/intake');
  revalidatePath('/settlement');
  return { errors: [] };
}

/**
 * 접수 뒤 기본 사실 고치기. 폼 칸: code + 바꿀 칸만(FACT_LABEL 의 키 — customer · model · supplier · supplierCode …).
 * ★보낸 칸만 견준다 · 접수일과 수수료 금액은 여기서 못 바꾼다 · 막을 때는 도메인 factPatch 가 정한다.
 */
export async function factsAction(_: FormState, f: FormData): Promise<FormState> {
  { const g = await requireAdmin(); if (g) return { errors: [g] }; }
  const change: FactChange = {};
  for (const k of Object.keys(FACT_LABEL) as FactKey[]) if (f.has(k)) change[k] = S(f, k);
  try {
    const r = await settlements.setFacts(S(f, 'code'), change, await currentActor());
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [writeError('저장하지 못했습니다', e)] };
  }
  revalidatePath('/intake');
  revalidatePath('/ledger');
  revalidatePath('/settlement');
  return { errors: [] };
}

/**
 * 계약해지 환수 검토 — 금액을 만들지 않고 「환수 필요 / 환수 없음」 판단만 확정한다.
 * 실제 환수 금액은 환수 필요로 확정된 뒤 clawbackAction에서 사람이 입력한다.
 */
export async function terminationClawbackReviewAction(_: FormState, f: FormData): Promise<FormState> {
  { const g = await requireAdmin(); if (g) return { errors: [g] }; }
  const decision = S(f, 'decision');
  if (decision !== 'REQUIRED' && decision !== 'NOT_REQUIRED') {
    return { errors: ['환수 검토 결과는 환수 필요 또는 환수 없음이어야 합니다'] };
  }
  const operationId = S(f, 'operationId');
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(operationId)) {
    return { errors: ['환수 검토 요청 식별자가 없습니다 — 화면을 새로 열어 다시 처리합니다'] };
  }
  try {
    const r = await settlements.reviewTerminationClawback(
      S(f, 'code'),
      { decision, reason: S(f, 'reason'), operationId },
      await currentActor(),
    );
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [writeError('환수 검토를 저장하지 못했습니다', e)] };
  }
  revalidatePath('/settlement');
  revalidatePath('/intake');
  return { errors: [] };
}

/**
 * 환수 세우기 — 대표 「환수가 생기는경우가 있을수도 있으니까 그건 열어두고」.
 * 폼 칸: code · at(환수일 YYYY-MM-DD) · supplierAmt(공급사에 돌려줄 것) · agentAmt(영업채널에서 돌려받을 것) · reason(필수)
 * ★금액은 사람이 넣는다(조건이 공급사마다 다르다). 그 달 청구·지급에서 빠진다.
 */
export async function clawbackAction(_: FormState, f: FormData): Promise<FormState> {
  { const g = await requireAdmin(); if (g) return { errors: [g] }; }
  const n = (k: string) => { const v = N(f, k); return v === null ? null : v; };
  try {
    const r = await settlements.createClawback(S(f, 'code'), { at: S(f, 'at'), supplierAmt: n('supplierAmt'), agentAmt: n('agentAmt'), reason: S(f, 'reason') }, await currentActor());
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [writeError('저장하지 못했습니다', e)] };
  }
  revalidatePath('/settlement');
  revalidatePath('/intake');
  return { errors: [] };
}

/**
 * **청구 링크 만들기** (관리자) — 폼 칸: month · axis · party → { url }
 * ★토큰은 이 응답에서 «한 번만» 보인다(ERP5 에는 해시만). 잃어버리면 새로 만든다(옛 링크는 죽는다).
 * 보낼 주소 = CLAIM_LINK_BASE(배포 주소) + /c/<토큰>. 외부 발송용 절대주소가 아니면 토큰 자체를 만들지 않는다.
 */
export async function createClaimLinkAction(_: FormState, f: FormData): Promise<FormState & { url?: string; warn?: string }> {
  { const g = await requireAdmin(); if (g) return { errors: [g] }; }
  const axis = S(f, 'axis') as Axis;
  if (axis !== '공급사' && axis !== '영업채널') return { errors: ['축은 공급사 또는 영업채널'] };
  const rawBase = (process.env.CLAIM_LINK_BASE ?? '').trim().replace(/\/$/, '');
  let base: string;
  try {
    const u = new URL(rawBase);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol');
    base = u.toString().replace(/\/$/, '');
  } catch {
    return { errors: ['외부 청구 링크 주소(CLAIM_LINK_BASE)가 설정되지 않았습니다 — 링크를 만들지 않았습니다'] };
  }
  try {
    const r = await settlements.createClaimLink(S(f, 'month'), axis, S(f, 'party'), await currentActor());
    if (!r.ok) return { errors: [r.error] };
    revalidatePath('/settlement');
    return { errors: [], url: `${base}/c/${r.token}`, ...(r.warn ? { warn: r.warn } : {}) };
  } catch (e) {
    return { errors: [writeError('만들지 못했습니다', e)] };
  }
}

/** 청구 링크 거두기 (관리자) — 폼 칸: month · axis · party */
export async function revokeClaimLinkAction(_: FormState, f: FormData): Promise<FormState> {
  { const g = await requireAdmin(); if (g) return { errors: [g] }; }
  const axis = S(f, 'axis') as Axis;
  try {
    const r = await settlements.revokeClaimLink(S(f, 'month'), axis, S(f, 'party'), await currentActor());
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [writeError('거두지 못했습니다', e)] };
  }
  revalidatePath('/settlement');
  return { errors: [] };
}
