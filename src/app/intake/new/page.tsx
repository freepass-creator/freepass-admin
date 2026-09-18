import Link from 'next/link';
import { productById, settlements, today } from '../../../server/erp5';
import { writeEnabled } from '../../../adapters/erp5/settlement-repository';
import { sp, vocab, won } from '../../_fn/fmt';
import { vehicleName } from '../../_fn/product';
import IntakeForm, { type IntakeDefaults, type IntakeOptions } from './IntakeForm';

export const dynamic = 'force-dynamic';

/** 이름 → 가장 많이 쓴 코드. ★코드를 지어내지 않는다 — 원장에 이미 있는 짝만 쓴다. */
function codeMap(pairs: [string | null, string | null][]): Record<string, string> {
  const m = new Map<string, Map<string, number>>();
  for (const [name, code] of pairs) {
    if (!name || !code) continue;
    const c = m.get(name) ?? new Map<string, number>();
    c.set(code, (c.get(code) ?? 0) + 1);
    m.set(name, c);
  }
  return Object.fromEntries([...m].map(([n, c]) => [n, [...c].sort((a, b) => b[1] - a[1])[0][0]]));
}

export default async function NewIntake({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const productId = sp(q.product);
  const offerId = sp(q.offer);

  const [rows, product] = await Promise.all([
    settlements.list().then((xs) => xs.map((x) => x.row)),
    productId ? productById(productId) : Promise.resolve(null),
  ]);
  const offer = product?.offers.find((o) => o.id === offerId);

  const options: IntakeOptions = {
    channels: vocab(rows.map((r) => r.channel)),
    channelCode: codeMap(rows.map((r) => [r.channel, r.channelCode])),
    agents: vocab(rows.map((r) => r.agent)),
    agentCode: codeMap(rows.map((r) => [r.agent, r.agentCode])),
    agentChannel: codeMap(rows.map((r) => [r.agent, r.channel])),
    suppliers: vocab(rows.map((r) => r.supplier)),
    supplierCode: codeMap(rows.map((r) => [r.supplier, r.supplierCode])),
    products: vocab(rows.map((r) => r.product)),
    rentKinds: vocab(rows.map((r) => r.rentKind)),
    contractTypes: vocab(rows.map((r) => r.contractType)),
    payKinds: vocab(rows.map((r) => r.payKind)),
  };

  const defaults: IntakeDefaults = {
    receivedAt: today(),
    plate: product?.registration?.vehicleNumber ?? '',
    model: product ? [product.vehicle.modelId, product.vehicle.subModelId].filter(Boolean).join(' ') : '',
    supplier: product?.supplierName ?? '',
    supplierCode: product?.supplierId ?? '',
    term: offer ? String(offer.termMonths) : '',
    rent: offer ? String(offer.monthlyRent) : '',
    deposit: offer?.deposit !== undefined ? String(offer.deposit) : '',
  };

  return (
    <>
      <p><Link href="/intake">← 계약접수</Link></p>
      <h1>새 접수</h1>
      {product
        ? <p className="fn-box">고른 상품 — <b>{vehicleName(product)}</b> · {product.registration?.vehicleNumber} · {product.supplierName ?? product.supplierId}
            {offer ? <> · {offer.termMonths}개월 월 {won(offer.monthlyRent)} · 보증금 {won(offer.deposit)}</> : <span className="fn-err"> · 요금을 못 찾았습니다({offerId})</span>}
            {' '}<Link href={`/products/${encodeURIComponent(product.id)}`}>상품 보기</Link></p>
        : <p className="fn-muted">상품 없이 직접 넣습니다. 상품에서 고르려면 <Link href="/products">상품찾기</Link> → 상세 → 「이 요금으로 접수」.</p>}
      {!writeEnabled() && <p className="fn-err">ERP5 쓰기가 꺼져 있어 「접수 저장」 은 저장되지 않습니다 (.env.local ERP5_WRITE=on).</p>}
      <p className="fn-muted">★같은 차량번호 + 접수일이 원장에 이미 있으면 새로 만들지 않고 그 줄을 엽니다.</p>
      <IntakeForm defaults={defaults} options={options} />
    </>
  );
}
