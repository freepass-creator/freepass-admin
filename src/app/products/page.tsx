import Link from 'next/link';
import { productList } from '../../server/erp5';
import { searchProducts } from '../../domain/search/search-products';
import type { ProductSearchQuery } from '../../domain/search/types';
import type { Offer } from '../../domain/product/types';
import { vehicleName } from '../_fn/product';
import { num, sp, txt, vocab, won } from '../_fn/fmt';
import { settlements } from '../../server/erp5';
import { blockOf, isOpenIntake, type SettlementRow } from '../../domain/settlement/types';
import { OfferPicker } from '../_design/OfferPicker';

export const dynamic = 'force-dynamic';

/**
 * ★★★**상품·접수 한 화면 — 대표 확정 판 셋 모양 위에 진짜 ERP5 를 얹는다** (2026-09-18)
 *   대표: 「야 디자인 아까 그 형태 어디 갔어」 — 확정 판 셋(상품 목록 | 상품 상세 | 접수)이 기능 뼈대(맨 표)로
 *   바뀌어 있었다. 나눔: **데이터는 기능 세션**(productList · searchProducts · lead · settlements),
 *   **모양은 디자인**(이 파일의 JSX · globals.css · src/app/_design). 아래 데이터 줄은 기능 쪽이 쓴 그대로다.
 *   ★마크업은 확정본(`src/app/design/page.tsx`)의 이름을 그대로 쓴다 — 그래야 확정 옷(globals.css)이 그대로 입혀진다.
 * 고르기는 주소로 한다(`?id=` · `?offer=`) — 서버 화면이라 새로 고쳐도, 링크로 보내도 같은 자리가 선다.
 * 폰은 `?v=list|detail|work` 로 판을 한 장씩(규칙 ⑧).
 */

type SP = Promise<Record<string, string | string[] | undefined>>;
const PAGE = 100;

/**
 * ★목록 한 줄의 «대표 요금» — 대표 2026-08-21 「대여료 «최저가» 기준」.
 *   인수형은 만기에 차를 사는 값이라 빼고 고른다. 인수형만 있으면 그걸 쓴다.
 *   ★검색 조건이 걸리면 «조건을 만족한 Offer» 안에서만 고른다 (S-03 — 다른 Offer 값을 섞지 않는다).
 */
function lead(offers: Offer[]): Offer | undefined {
  const plain = offers.filter((o) => !o.id.includes('인수형'));
  const pool = plain.length ? plain : offers;
  return pool.reduce<Offer | undefined>((a, b) => (!a || b.monthlyRent < a.monthlyRent ? b : a), undefined);
}


/** 지금 나갈 수 있는 것이 앞 */
const STATUS_ORDER: Record<string, number> = { 즉시출고: 0, 출고가능: 1, 출고협의: 2 };

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const text = sp(q.q).trim().toLowerCase();
  const supplier = sp(q.supplier);
  const status = sp(q.status);
  const term = Number(sp(q.term)) || 0;
  const max = Number(sp(q.max).replace(/,/g, '')) || 0;
  const page = Math.max(1, Number(sp(q.page)) || 1);

  let all: Awaited<ReturnType<typeof productList>>;
  try { all = await productList(); }
  catch (e) {
    return <><h1>상품찾기</h1><p className="fn-err">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></>;
  }
  const { rows, report } = all;

  const query: ProductSearchQuery = {};
  if (term) query.termMonths = [term];
  if (max) query.monthlyRent = { max };
  const hits = searchProducts(rows, query).filter(({ product: p }) => {
    if (supplier && (p.supplierName ?? p.supplierId) !== supplier) return false;
    if (status && p.status !== status) return false;
    if (!text) return true;
    return `${vehicleName(p)} ${p.registration?.vehicleNumber ?? ''} ${p.supplierName ?? ''} ${p.supplierId}`
      .toLowerCase().includes(text);
  });
  const sorted = hits
    .map((h) => ({ ...h, lead: lead(h.matchedOffers) }))
    .sort((a, b) => (STATUS_ORDER[a.product.status ?? ''] ?? 9) - (STATUS_ORDER[b.product.status ?? ''] ?? 9)
      || (a.lead?.monthlyRent ?? Infinity) - (b.lead?.monthlyRent ?? Infinity));
  const shown = sorted.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));

  const suppliers = vocab(rows.map((p) => p.supplierName ?? p.supplierId));
  const statuses = vocab(rows.map((p) => p.status));
  const terms = [...new Set(rows.flatMap((p) => p.offers.map((o) => o.termMonths)))].sort((a, b) => a - b);
  const link = (n: number) => `/products?${new URLSearchParams({ ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])), page: String(n) })}`;

  /* ── 고른 차 · 고른 요금 · 접수 목록 — 모양을 위해 «고르기»만 더한다(값은 위에서 센 그대로) ── */
  const selId = sp(q.id);
  const sel = sorted.find((h) => h.product.id === selId) ?? sorted[0];
  const view = (['list', 'detail', 'work'] as const).find((v) => v === sp(q.v)) ?? (selId ? 'detail' : 'list');
  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])));
    for (const [k, v] of Object.entries(extra)) { if (v) u.set(k, v); else u.delete(k); }
    return `/products?${u}`;
  };

  let irows: SettlementRow[] = [];
  let intakeErr = '';
  try { irows = (await settlements.list()).map((x) => x.row); } catch (e) { intakeErr = (e as Error).message; }
  const open = irows.filter(isOpenIntake).sort((x, y) => String(y.receivedAt).localeCompare(String(x.receivedAt)));
  const delivered = irows.filter((r) => r.progress.delivered && !r.progress.cancelled).length;
  const cancelled = irows.filter((r) => r.progress.cancelled).length;

  const car = sel?.product;
  const 사양: [string, string][] = car ? [
    ['공급사', car.supplierName ?? car.supplierId],
    ['출고상태', txt(car.status)],
    ['연식', car.specs.modelYear ? String(car.specs.modelYear) : '—'],
    ['주행거리', num(car.specs.mileageKm, 'km')],
    ['연료', txt(car.specs.fuel)],
    ['배기량', num(car.specs.displacementCc, 'cc')],
    ['인승', num(car.specs.seats)],
    ['구동', txt(car.specs.drivetrain)],
  ] : [];

  return (
    <>
      <section className="workspace" data-phone={view}>
        {/* ── 상품 목록 — 찾기 ─────────────────────────────────── */}
        <section className="panel product-panel">
          <div className="panel-head">
            <div><p className="eyebrow">PRODUCT</p><h1>상품 목록</h1></div>
            <span className="count">{sorted.length.toLocaleString()}대</span>
          </div>
          <form className="dz-find" action="/products">
            <label className="searchbox">⌕<input name="q" defaultValue={sp(q.q)} placeholder="차번 · 모델 · 공급사" /></label>
            <div className="dz-filters">
              <select name="supplier" defaultValue={supplier} aria-label="공급사"><option value="">공급사 전체</option>{suppliers.map((x) => <option key={x}>{x}</option>)}</select>
              <select name="status" defaultValue={status} aria-label="출고상태"><option value="">출고상태 전체</option>{statuses.map((x) => <option key={x}>{x}</option>)}</select>
              <select name="term" defaultValue={term || ''} aria-label="기간"><option value="">기간 전체</option>{terms.map((t) => <option key={t} value={t}>{t}개월</option>)}</select>
              <input name="max" defaultValue={sp(q.max)} placeholder="월 대여료 이하" aria-label="월 대여료 이하" inputMode="numeric" />
              <button type="submit">찾기</button>
              <Link href="/products" className="dz-clear">지우기</Link>
            </div>
          </form>
          <div className="list">
            {shown.map(({ product: p, lead: o }) => (
              <Link key={p.id} href={keep({ id: p.id, offer: o?.id ?? '', v: 'detail' })}
                className={`product-row${sel && p.id === sel.product.id ? ' selected' : ''}`}>
                <div className="grow">
                  <div className="row-title"><strong>{vehicleName(p) || p.id}</strong><span>{txt(p.status)}</span></div>
                  <p>{txt(p.registration?.vehicleNumber)} · {p.specs.modelYear ?? '—'} · {num(p.specs.mileageKm, 'km')} · {txt(p.specs.fuel)}</p>
                  <div className="price"><b>월 {won(o?.monthlyRent)}원</b><small>{o ? `${o.termMonths}개월` : '—'}</small></div>
                </div>
              </Link>
            ))}
            {shown.length === 0 && <p className="dz-empty">조건에 맞는 차가 없습니다.</p>}
          </div>
          <p className="dz-pager">
            {page > 1 ? <Link href={link(page - 1)}>← 앞</Link> : <span />}
            <span>{page} / {pages}쪽</span>
            {page < pages ? <Link href={link(page + 1)}>뒤 →</Link> : <span />}
          </p>
        </section>

        {/* ── 상품 상세 — 확인 → 기간 선택 → 접수 ───────────────────── */}
        <section className="panel detail-panel">
          <div className="panel-head">
            <div><p className="eyebrow">DETAIL</p><h1>상품 상세</h1></div>
            {car && <Link className="icon-btn" href={`/products/${encodeURIComponent(car.id)}`}>전부 보기</Link>}
          </div>
          {car ? (
            <>
              <div className="hero-car"><span>사진 없음</span></div>
              <div className="vehicle-title">
                <div><h2>{vehicleName(car) || car.id}</h2><p>{txt(car.registration?.vehicleNumber)} · {car.supplierName ?? car.supplierId}</p></div>
                <span className="status-dot">{txt(car.status)}</span>
              </div>
              <dl className="summary-grid">
                {사양.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              {/* ★검색 조건이 걸렸으면 그 조건을 만족한 요금만 — 기능 쪽 규칙(S-03, matchedOffers) 그대로 */}
              <OfferPicker productId={car.id} offers={sel.matchedOffers} initial={sp(q.offer) || sel.lead?.id} />
            </>
          ) : <p className="dz-empty">왼쪽에서 차를 고르면 여기 뜹니다.</p>}
        </section>

        {/* ── 접수 목록 — 지금 할 일 ──────────────────────────────── */}
        <section className="panel work-panel">
          <div className="panel-head">
            <div><p className="eyebrow">WORK</p><h1>접수 목록</h1></div>
            <Link className="new-app" href="/intake/new">+ 신규접수</Link>
          </div>
          <div className="work-tabs">
            <Link className="active" href="/intake?view=open">진행중 {open.length}</Link>
            <Link href="/intake?view=delivered">인도완료 {delivered}</Link>
            <Link href="/intake?view=cancelled">취소 {cancelled}</Link>
          </div>
          {intakeErr ? <p className="dz-empty">ERP5 접수를 못 읽었습니다 — {intakeErr}</p> : (
            <div className="application-list">
              {open.slice(0, 30).map((r, i) => (
                <Link key={`${r.plate ?? '차번없음'}-${r.receivedAt}-${i}`} className="application-card" href={`/intake?view=open&q=${encodeURIComponent(r.plate ?? '')}`}>
                  <div className="app-top"><div><b>{txt(r.customer)}</b><span>{txt(r.receivedAt)} · {txt(r.plate)}</span></div><strong>{txt(r.model)}</strong></div>
                  <div className="checks">
                    <span className={r.progress.paper ? 'done' : ''}>계약서</span>
                    <span className={r.progress.delivered ? 'done' : ''}>인도</span>
                  </div>
                  <p>{blockOf(r) ? `다음 할 일 · ${blockOf(r)}` : '할 일 없음'}</p>
                </Link>
              ))}
              {open.length === 0 && <p className="dz-empty">진행 중인 접수가 없습니다.</p>}
              {open.length > 30 && <Link className="dz-more" href="/intake?view=open">진행중 {open.length}건 전부 보기 →</Link>}
            </div>
          )}
        </section>
      </section>

      {/* 폰 — 판을 한 장씩(규칙 ⑧) */}
      <nav className="phone-tabs" aria-label="판 바꾸기">
        <Link className={view === 'list' ? 'active' : ''} href={keep({ v: 'list' })}>상품</Link>
        <Link className={view === 'detail' ? 'active' : ''} href={keep({ v: 'detail' })}>상세</Link>
        <Link className={view === 'work' ? 'active' : ''} href={keep({ v: 'work' })}>접수</Link>
      </nav>
    </>
  );
}
