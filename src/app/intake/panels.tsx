/**
 * ★★★**계약접수 오른쪽 판 — 신규 접수 · 접수 상세가 «판 안에서» 선다** (대표 2026-09-18 절대 법칙)
 *   「어떤 페이지에서도 상단에 버튼 누르지 않는 이상 다른 페이지로 가지 않아. 절대 법칙이다」
 *   ⚠ 앞서 「+ 신규접수」 · 「이 상품 접수하기」 · 접수 줄이 각각 딴 쪽(/intake/new · /intake/[code])으로 넘어갔다.
 *   ⇒ 그 두 쪽의 내용을 «판 부품»으로 옮겼다. 계약접수 한 쪽 안에서 오른쪽 판만 바뀐다(처음 목업이 이렇게 했다).
 *     주소 약속: `?w=new&product=..&offer=..`(신규 접수) · `?ic=<접수코드>`(접수 상세)
 *   ⓘ 데이터 부르는 줄(원장·코드 짝·기본값·진행 체크)은 기능 세션이 쓴 그대로 옮겼다. 모양만 판 문법으로.
 */
import Link from 'next/link';
import { productById, settlements, today } from '../../server/erp5';
import { writeEnabled } from '../../adapters/erp5/settlement-repository';
import { blockOf, margin, type FeeBasis, type SettlementRow } from '../../domain/settlement/types';
import { num, txt, vocab, when, won, yes } from '../_fn/fmt';
import { vehicleName } from '../_fn/product';
import IntakeForm, { type IntakeDefaults, type IntakeOptions } from './new/IntakeForm';
import Progress from './[code]/Progress';

/** 이름 → 가장 많이 쓴 코드. ★코드를 지어내지 않는다 — 원장에 이미 있는 짝만 쓴다. (기능 세션 규칙 그대로) */
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

const fee = (f: FeeBasis) =>
  f.mode === 'RATE' ? `${(f.rate * 100).toFixed(2)}%` : f.mode === 'FLAT' ? `정액 ${won(f.amount)}` : `모름 (${f.note ?? ''})`;

const 칸 = (k: string, v: React.ReactNode) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>;

/** 오른쪽 판 — 신규 접수. 상품에서 왔으면 차·요금이 미리 채워진다. */
export async function NewIntakePanel({ rows, productId, offerId, back }: {
  rows: SettlementRow[]; productId: string; offerId: string; back: string;
}) {
  const product = productId ? await productById(productId) : null;
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
      <div className="panel-head">
        <div><p className="eyebrow">NEW APPLICATION</p><h1>신규 접수</h1></div>
        <Link className="icon-btn" href={back}>목록</Link>
      </div>
      {product ? (
        <div className="dz-picked">
          <span>접수 상품</span>
          <b>{vehicleName(product)}</b>
          <p>{txt(product.registration?.vehicleNumber)} · {product.supplierName ?? product.supplierId}</p>
          {offer
            ? <strong>{offer.termMonths}개월 · 월 {won(offer.monthlyRent)}원 · 보증금 {won(offer.deposit)}원</strong>
            : <p className="dz-warn">요금을 못 찾았습니다 — 기간을 다시 골라 주세요.</p>}
        </div>
      ) : <p className="dz-empty">상품 없이 직접 넣습니다. 상품에서 고르려면 가운데 상세에서 「이 상품 접수하기」.</p>}
      {!writeEnabled() && <p className="dz-warn">ERP5 쓰기가 꺼져 있어 「접수 저장」은 저장되지 않습니다.</p>}
      <p className="dz-empty">같은 차량번호 + 접수일이 원장에 이미 있으면 새로 만들지 않고 그 줄을 엽니다.</p>
      <div className="dz-form"><IntakeForm defaults={defaults} options={options} /></div>
    </>
  );
}

/** 오른쪽 판 — 접수 상세(진행 체크 · 접수 · 정산 읽기 · 고친 이력). */
export async function IntakeDetailPanel({ code, created, exists, back }: {
  code: string; created?: boolean; exists?: boolean; back: string;
}) {
  const hit = await settlements.get(code);
  if (!hit) {
    return (
      <>
        <div className="panel-head"><div><p className="eyebrow">APPLICATION</p><h1>접수 상세</h1></div><Link className="icon-btn" href={back}>목록</Link></div>
        <p className="dz-empty">이 접수를 못 찾았습니다 — {code}</p>
      </>
    );
  }
  const { row: r, warnings } = hit;
  const events = await settlements.events(r.plate, r.receivedAt);
  const 다음 = blockOf(r) ?? (r.progress.cancelled ? '취소됨' : '끝');
  return (
    <>
      <div className="panel-head">
        <div><p className="eyebrow">APPLICATION</p><h1>접수 상세</h1></div>
        <Link className="icon-btn" href={back}>목록</Link>
      </div>
      {created && <p className="dz-ok">ERP5 에 새 접수를 세웠습니다.</p>}
      {exists && <p className="dz-warn">같은 차량번호 + 접수일이 원장에 이미 있어 새로 만들지 않았습니다. 있던 줄입니다.</p>}
      <div className="vehicle-title">
        <div><h2>{txt(r.customer)}</h2><p>{txt(r.plate)} · {txt(r.model)} · 접수 {txt(r.receivedAt)}</p></div>
        <span className="status-dot">{다음 === '끝' || 다음 === '취소됨' ? 다음 : `다음 · ${다음}`}</span>
      </div>

      <h3 className="dz-sub">진행</h3>
      {!writeEnabled() && <p className="dz-warn">ERP5 쓰기가 꺼져 있어 눌러도 저장되지 않습니다.</p>}
      <Progress code={r.id} paper={r.progress.paper} delivered={r.progress.delivered}
        deliveredAt={r.progress.deliveredAt ?? ''} cancelled={r.progress.cancelled} today={today()} />

      <h3 className="dz-sub">접수</h3>
      <dl className="summary-grid">
        {칸('공급사', `${txt(r.supplier)}${r.supplierCode ? ` · ${r.supplierCode}` : ''}`)}
        {칸('영업채널', txt(r.channel))}
        {칸('영업담당', txt(r.agent))}
        {칸('상품구분', txt(r.product))}
        {칸('렌트구분', txt(r.rentKind))}
        {칸('계약방식', txt(r.contractType))}
        {칸('기간', num(r.term, '개월'))}
        {칸('렌탈료', r.rent === null || r.rent === undefined ? '—' : `${won(r.rent)}원`)}
        {칸('보증금', r.deposit === null || r.deposit === undefined ? '—' : `${won(r.deposit)}원`)}
        {칸('차량가액', r.price === null || r.price === undefined ? '—' : `${won(r.price)}원`)}
        {칸('분납여부', txt(r.payKind))}
        {칸('메모', txt(r.note))}
      </dl>

      <h3 className="dz-sub">정산 (읽기)</h3>
      <dl className="summary-grid">
        {칸('청구월', txt(r.progress.billMonth))}
        {칸('정산대상 · 비율', `${r.settleTarget} · ${r.settleRatio}`)}
        {칸('공급사 수수료', fee(r.supplierFee))}
        {칸('영업 수수료', fee(r.channelFee))}
        {칸('청구금액', won(r.money.claim))}
        {칸('지급액', won(r.money.pay))}
        {칸('남는 것', won(margin(r)))}
        {칸('청구 · 지급 단계', `${r.claimStage} · ${r.payStage}`)}
        {칸('청구서 보냄', `${yes(r.progress.billed)} ${txt(r.progress.billedAt)}`)}
        {칸('계산서', `${yes(r.progress.invoiceIssued)} ${txt(r.progress.invoiceAt)}`)}
        {칸('수금', `${yes(r.progress.collected)} ${won(r.progress.collectedAmt)}`)}
        {칸('지급', `${yes(r.progress.paid)} ${won(r.progress.paidAmt)}`)}
      </dl>
      {warnings.length > 0 && <><h3 className="dz-sub">살필 것</h3><ul className="dz-list-plain">{warnings.map((w) => <li key={w}>{w}</li>)}</ul></>}

      <h3 className="dz-sub">고친 이력 {events.length}</h3>
      {events.length === 0 ? <p className="dz-empty">남은 이력이 없습니다.</p> : (
        <div className="list">
          {events.map((e, i) => (
            <div key={i} className="dz-event">
              <b>{e.field}</b><span>{txt(e.from)} → {txt(e.to)}</span><small>{when(e.at)}</small>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
