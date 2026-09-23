/**
 * PC 상품찾기 — 규격 `platform/inventory.html`(목록) + `platform/contract-detail.html`(상세 패널) 구성 그대로
 *   ④ 헤더 → ⑤ KPI → [⑥ 조회조건 · ⑦ 툴바 · 그리드 · 바닥] 한 카드 → (고르면) 오른쪽 상세 패널.
 *   데이터는 기능 쪽 그대로(productList · lead). 요금 조건(기간 · 월 대여료)은 «한 요금이 모두» 만족해야 걸리고,
 *   그 요금(Offer)이 상세와 접수까지 이어진다(AGENTS §5 — 요금을 섞지 않는다).
 */
import Link from 'next/link';
import { productList } from '../../server/erp5';
import type { CanonicalProduct, Offer } from '../../domain/product/types';
import { lead, STATUS_ORDER } from '../products/workspace-config';
import { sp, txt } from '../_fn/fmt';
import { Badge, CardHead, Field, hrefWith, Kpis, PageHeader, Props, Screen, Seg, Select, won0, type Tone } from './parts';

type Q = Record<string, string | string[] | undefined>;
/** 차명 — 세부모델(없으면 모델)이 이름, 제조사 · 트림은 보조. 모델명을 두 번 찍지 않는다. */
const carName = (p: CanonicalProduct) => p.vehicle.subModelId || p.vehicle.modelId;
const carFull = (p: CanonicalProduct) => [p.vehicle.manufacturerId, carName(p), p.vehicle.trimId].filter(Boolean).join(' ');
const STATUS: string[] = ['즉시출고', '출고가능', '출고협의', '출고불가'];
const TONE: Record<string, Tone> = { 즉시출고: 'ok', 출고가능: 'info', 출고협의: 'warn', 출고불가: 'err' };
const TERMS = ['12', '24', '36', '48', '60'];
const RENTS: [string, number][] = [['50만원 이하', 500_000], ['80만원 이하', 800_000], ['100만원 이하', 1_000_000], ['150만원 이하', 1_500_000]];
const PAGE = 15;

const offersFor = (p: CanonicalProduct, term: string, rentMax: number) =>
  p.offers.filter((o) => (!term || String(o.termMonths) === term) && (!rentMax || o.monthlyRent <= rentMax));

export async function ProductsScreen({ q, base = '/products' }: { q: Q; base?: string }) {
  let rows: CanonicalProduct[];
  try { rows = (await productList()).rows; }
  catch (e) { return <Screen name="products"><PageHeader crumb={['홈', '상품찾기']} title="상품찾기" desc={<span className="erp-field-error">ERP5 를 못 읽었습니다 — {(e as Error).message}</span>} /></Screen>; }

  const text = sp(q.q).trim().toLowerCase();
  const kind = sp(q.kind), st = sp(q.st), term = sp(q.term), perk = sp(q.perk);
  const rentMax = Number(sp(q.rent)) || 0;
  const kinds = [...new Set(rows.map((p) => p.productKind).filter(Boolean) as string[])].sort();
  const perks = [...new Set(rows.flatMap((p) => p.perks ?? []))].sort();

  const hits = rows
    .filter((p) => !text || [carFull(p), p.registration?.vehicleNumber, p.supplierName, p.productKind, p.extColor].join(' ').toLowerCase().includes(text))
    .filter((p) => !kind || p.productKind === kind)
    .filter((p) => !perk || (p.perks ?? []).includes(perk))
    .map((p) => ({ p, offer: lead(offersFor(p, term, rentMax)) }))
    .filter((h): h is { p: CanonicalProduct; offer: Offer } => !!h.offer);
  const count = (s: string) => hits.filter((h) => (h.p.status ?? '') === s).length;
  const shown = hits.filter((h) => !st || h.p.status === st)
    .sort((a, b) => (STATUS_ORDER[a.p.status ?? ''] ?? 9) - (STATUS_ORDER[b.p.status ?? ''] ?? 9) || a.offer.monthlyRent - b.offer.monthlyRent);
  const page = Math.max(1, Number(sp(q.page)) || 1);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const slice = shown.slice((page - 1) * PAGE, page * PAGE);
  const suppliers = new Set(rows.map((p) => p.supplierName ?? p.supplierId)).size;

  const selId = sp(q.id);
  const sel = shown.find((h) => h.p.id === selId) ?? (selId ? hits.find((h) => h.p.id === selId) : undefined);
  const selOffers = sel ? offersFor(sel.p, term, rentMax).sort((a, b) => a.termMonths - b.termMonths) : [];
  const selOffer = sel ? (selOffers.find((o) => o.id === sp(q.offer)) ?? sel.offer) : undefined;

  const grid = (
    <section className="erp-card erp-card--fill">
      <form className="erp-filter" data-region="filter" role="search" action={base}>
        <Field label="차번 / 차명 / 공급사"><input className="erp-input" name="q" defaultValue={sp(q.q)} placeholder="차량번호, 차명, 공급사" /></Field>
        <Field label="상품구분"><Select name="kind" value={kind} options={kinds} /></Field>
        <Field label="계약기간 기준">
          <select className="erp-input" name="term" defaultValue={term}><option value="">전체</option>{TERMS.map((t) => <option key={t} value={t}>{t}개월</option>)}</select>
        </Field>
        <Field label="월 대여료">
          <select className="erp-input" name="rent" defaultValue={sp(q.rent)}><option value="">전체</option>{RENTS.map(([l, v]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
        <Field label="우대조건"><Select name="perk" value={perk} options={perks} /></Field>
        {st ? <input type="hidden" name="st" value={st} /> : null}
        <div className="erp-filter-actions">
          <Link className="erp-btn erp-btn--ghost" href={base}>초기화</Link>
          <button className="erp-btn erp-btn--primary" type="submit">조회</button>
        </div>
      </form>
      <div className="erp-toolbar" data-region="grid-toolbar">
        {perk ? <Link className="erp-chip" href={hrefWith(base, q, { perk: null, page: null })}>우대조건: {perk} ×</Link> : null}
        {kind ? <Link className="erp-chip" href={hrefWith(base, q, { kind: null, page: null })}>상품구분: {kind} ×</Link> : null}
        {!perk && !kind ? <span className="erp-chip">공급사 {suppliers}곳 · 상품 {rows.length}대</span> : null}
        <span className="erp-toolbar-spacer" />
        <Seg label="출고상태" items={[
          { key: 'all', label: `전체 ${hits.length}`, href: hrefWith(base, q, { st: null, page: null, id: null }), on: !st },
          ...STATUS.map((s) => ({ key: s, label: `${s} ${count(s)}`, href: hrefWith(base, q, { st: s, page: null, id: null }), on: st === s })),
        ]} />
      </div>
      <div className="erp-grid-scroll" data-region="grid">
        <table className="erp-grid">
          <thead><tr>
            <th>차량번호</th><th>차명 / 트림</th><th>연식 · 주행</th><th>색상</th><th>공급사</th><th>상품구분</th>
            <th className="erp-num">기간</th><th className="erp-num">월 대여료</th><th className="erp-num">보증금</th><th>우대조건</th><th>출고상태</th>
          </tr></thead>
          <tbody>
            {slice.map(({ p, offer }) => {
              const href = hrefWith(base, q, { id: p.id, offer: offer.id });
              return (
                <tr key={p.id} aria-selected={sel?.p.id === p.id} data-href={href}>
                  <td><Link className="erp-row-link" href={href}>{txt(p.registration?.vehicleNumber)}</Link></td>
                  <td>{carName(p)}<span className="erp-cell-sub">{p.vehicle.manufacturerId} · {txt(p.vehicle.trimId)}</span></td>
                  <td>{p.specs.modelYear ?? '—'} · {typeof p.specs.mileageKm === 'number' ? `${p.specs.mileageKm.toLocaleString('ko-KR')}km` : '—'}</td>
                  <td>{txt(p.extColor)}</td>
                  <td>{txt(p.supplierName ?? p.supplierId)}</td>
                  <td>{txt(p.productKind)}</td>
                  <td className="erp-num">{offer.termMonths}개월</td>
                  <td className="erp-num erp-strong">{won0(offer.monthlyRent)}</td>
                  <td className="erp-num">{offer.deposit ? won0(offer.deposit) : <span className="erp-tag erp-tag--primary">무보증</span>}</td>
                  <td><span className="erp-tags">{(p.perks ?? []).slice(0, 3).map((k) => <span key={k} className="erp-tag erp-tag--primary">{k}</span>)}</span></td>
                  <td>{p.status ? <Badge tone={TONE[p.status] ?? 'neutral'}>{p.status}</Badge> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="erp-grid-foot">
        <span>총 <b>{shown.length}</b>대</span><span>·</span><span>대표 요금 = 조건에 맞는 요금 중 최저 월 대여료</span>
        <nav className="erp-pager" aria-label="페이지">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={hrefWith(base, q, { page: String(n) })} aria-current={n === page ? 'page' : undefined}>{n}</Link>
          ))}
        </nav>
      </div>
    </section>
  );

  return (
    <Screen name="products">
      <PageHeader crumb={['홈', '업무', '상품찾기']} title="상품찾기"
        desc="차량 · 가격 · 대여조건 · 정책을 조합해 실제로 함께 적용되는 상품을 찾습니다. 고른 요금 그대로 접수까지 이어집니다."
        actions={<>
          <Link className="erp-btn erp-btn--ghost" href="/intake">접수 목록</Link>
          {sel && selOffer
            ? <Link className="erp-btn erp-btn--primary" href={`/intake?w=new&product=${encodeURIComponent(sel.p.id)}&offer=${encodeURIComponent(selOffer.id)}&v=work`}>이 상품 접수하기</Link>
            : <span className="erp-btn erp-btn--primary" aria-disabled="true" title="목록에서 상품을 고르면 접수할 수 있습니다">이 상품 접수하기</span>}
        </>} />
      <Kpis items={[
        { label: '전체 상품', side: `${suppliers}개 공급사`, value: rows.length.toLocaleString('ko-KR'), unit: '대', delta: `조건에 맞는 상품 ${hits.length}대` },
        { label: '즉시출고', side: '바로 계약 가능', value: String(rows.filter((p) => p.status === '즉시출고').length), unit: '대' },
        { label: '출고협의', side: '공급사 회신 필요', value: String(rows.filter((p) => p.status === '출고협의').length), unit: '대' },
        { label: '출고불가', side: '확인 필요', value: String(rows.filter((p) => p.status === '출고불가').length), unit: '대', alert: rows.some((p) => p.status === '출고불가') },
      ]} />
      {sel && selOffer ? (
        <div className="erp-cols">
          {grid}
          <div className="erp-stack">
            <section className="erp-card">
              <CardHead title={carFull(sel.p) || sel.p.id} right={sel.p.status ? <Badge tone={TONE[sel.p.status] ?? 'neutral'}>{sel.p.status}</Badge> : null} />
              <div className="erp-card-body">
                <Props pairs={[
                  ['차량번호', txt(sel.p.registration?.vehicleNumber)], ['공급사', txt(sel.p.supplierName ?? sel.p.supplierId)],
                  ['상품구분', txt(sel.p.productKind)], ['연식 · 주행', `${sel.p.specs.modelYear ?? '—'} · ${typeof sel.p.specs.mileageKm === 'number' ? `${sel.p.specs.mileageKm.toLocaleString('ko-KR')}km` : '—'}`],
                  ['연료', txt(sel.p.specs.fuel)], ['색상', `${txt(sel.p.extColor)} / ${txt(sel.p.intColor)}`],
                ]} />
              </div>
            </section>
            <section className="erp-card">
              <CardHead title="요금" sub={term || rentMax ? '조건에 맞는 요금만' : '기간별'} />
              <table className="erp-grid erp-grid--dense">
                <thead><tr><th>기간</th><th className="erp-num">월 대여료</th><th className="erp-num">보증금</th></tr></thead>
                <tbody>
                  {selOffers.map((o) => (
                    <tr key={o.id} aria-selected={o.id === selOffer.id}>
                      <td><Link className="erp-row-link" href={hrefWith(base, q, { offer: o.id })}>{o.termMonths}개월</Link></td>
                      <td className="erp-num erp-strong">{won0(o.monthlyRent)}</td>
                      <td className="erp-num">{o.deposit ? won0(o.deposit) : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="erp-card">
              <CardHead title="우대조건 · 정책" />
              <div className="erp-card-body"><span className="erp-tags">{(sel.p.perks ?? []).map((k) => <span key={k} className="erp-tag erp-tag--primary">{k}</span>)}{!(sel.p.perks ?? []).length ? <span className="erp-muted">표시할 조건 없음</span> : null}</span></div>
            </section>
          </div>
        </div>
      ) : grid}
    </Screen>
  );
}
