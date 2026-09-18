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
import { imgSrc } from '../../server/image-proxy';
import { ListRow } from '../_design/ListRow';
import { DetailTabs } from '../_design/DetailTabs';
import { 매칭, 매칭끝, 정책이름표, 정책값글 } from '../_design/words';
import { IntakeDetailPanel, NewIntakePanel } from '../intake/panels';


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

/**
 * ★★★**메뉴마다 제 일에 특화** — 대표 2026-09-18
 *   「상품찾기는 상품 찾고 상세 화면 보는 거에 특화되어 있고, 접수는 접수 특화, 정산은 정산 특화,
 *    계약은 전자계약 날리는 거에 특화」 · 「이게 우리 메인인데 이거는 접수 화면이고」
 *   「상품찾기는 상품목록 패널 + 상품상세 패널만」 · 「상품목록 2개 패널 사이즈, 상품목록은 그대로」
 *
 *   mode 'intake' — 계약접수 = 메인. 판 셋: 상품 목록 | 상품 상세 | 접수 목록
 *   mode 'find'   — 상품찾기. 판 둘: 상품 목록(판 두 개 폭) | 상품 상세. 목록 카드는 그대로, 폭만 넓다.
 *   ★목록·상세는 «한 부품»이다 — 두 메뉴가 따로 지으면 같은 차가 두 화면에서 다르게 보인다.
 */
/**
 * 대표 사진 — 기능 쪽 `photoUrl`. ★반드시 `imgSrc()` 로 감싼다(기능 세션 실측):
 *   구글 드라이브 썸네일은 브라우저가 바로 부르면 18장 중 16장이 깨진다 — 우리 서버(/api/img)를 거치면 18/18.
 *   바로 뜨는 곳(소카·롯데 등)은 imgSrc 가 그대로 돌려준다.
 */
const 사진 = (p: { photoUrl?: string }): string | undefined =>
  p.photoUrl && p.photoUrl.trim() ? imgSrc(p.photoUrl) : undefined;

/**
 * 상품구분(`productKind`) · 혜택조건(`perks`) — 기능 쪽 도메인 칸(3bd7fc6).
 *   대표 「배차상태 상품구분 / 혜택조건(무심사, 21세, 경력무관) 이런 거는 한눈에 보이면 좋은데」
 *   ★판정은 도메인 한 곳(adapters/erp5/perks.ts) — 화면은 받은 글자를 «받은 차례 그대로» 그린다.
 *     차례가 뜻이다: 심사 → 분납가능 → 무보증 → 만N세 → 경력무관 → 무사고(사장님 2026-08-28 「맨 앞에 심사조건」).
 */

/**
 * 정책이 얼마나 믿을 만한가 — 심사·혜택은 정책에서 나오므로 «추정» 정책이면 혜택도 추정이다(기능 세션).
 *   칸이 없으면 «모름» — 「없음」과 다르다.
 */
const 정책상태 = (s?: 'CONFIRMED' | 'INFERRED' | 'MISSING'): string =>
  s === 'CONFIRMED' ? '확정' : s === 'INFERRED' ? '추정' : s === 'MISSING' ? '없음' : '모름';
/** 혜택 칩 옆에 붙는 한 마디 — 확정이면 안 붙인다 */
const 정책말 = (s?: 'CONFIRMED' | 'INFERRED' | 'MISSING'): string | undefined =>
  s === 'INFERRED' ? '정책 추정' : s === 'MISSING' ? '정책 없음' : undefined;

export async function ProductWorkspace({ q, mode, base }: {
  q: Record<string, string | string[] | undefined>; mode: 'find' | 'intake'; base: string;
}) {
  const text = sp(q.q).trim().toLowerCase();
  const supplier = sp(q.supplier);
  const status = sp(q.status);
  /** 퀵 단추로 거는 두 축 — 상품구분 · 혜택(도메인이 정한 글자 그대로 맞춘다) */
  const kind = sp(q.kind);
  const perk = sp(q.perk);
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
    if (kind && p.productKind !== kind) return false;
    if (perk && !(p.perks ?? []).includes(perk)) return false;
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
  const kinds = vocab(rows.map((p) => p.productKind));
  const perkList = vocab(rows.flatMap((p) => p.perks ?? []));
  const terms = [...new Set(rows.flatMap((p) => p.offers.map((o) => o.termMonths)))].sort((a, b) => a - b);
  const link = (n: number) => `${base}?${new URLSearchParams({ ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])), page: String(n) })}`;

  /* ── 고른 차 · 고른 요금 · 접수 목록 — 모양을 위해 «고르기»만 더한다(값은 위에서 센 그대로) ── */
  const selId = sp(q.id);
  const sel = sorted.find((h) => h.product.id === selId) ?? sorted[0];
  const view = (['list', 'detail', 'work'] as const).find((v) => v === sp(q.v) && (v !== 'work' || mode === 'intake')) ?? (selId ? 'detail' : 'list');
  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])));
    for (const [k, v] of Object.entries(extra)) { if (v) u.set(k, v); else u.delete(k); }
    return `${base}?${u}`;
  };

  let irows: SettlementRow[] = [];
  let intakeErr = '';
  if (mode === 'intake') {
    try { irows = (await settlements.list()).map((x) => x.row); } catch (e) { intakeErr = (e as Error).message; }
  }
  /**
   * ★★접수 목록 판 = 상품 목록 판과 «같은 규격» — 대표 2026-09-18
   *   「접수목록도 동일하게 목록 패널은 규격 동일한 거야. 그게 상품이냐 접수냐의 차이인 거고,
   *    필터도 동일하게 있어야 하고, 검색창도 마찬가지고, 몇 건인지도 마찬가지고」
   *   판 머리(이름 + 건수) → 검색창(안에 세부검색) → 퀵 단추 → 목록 한 줄. 상품 판과 차례·모양이 같다.
   *   주소 칸은 i 로 시작한다(iq · iv · im · isup · ich) — 상품 쪽 거름과 안 섞이게.
   */
  const iq = sp(q.iq).trim().toLowerCase();
  const iv = sp(q.iv) || 'open';
  const im = sp(q.im);
  const isup = sp(q.isup);
  const ich = sp(q.ich);
  const 진행 = (r: SettlementRow) =>
    iv === 'open' ? isOpenIntake(r)
      : iv === 'delivered' ? r.progress.delivered && !r.progress.cancelled
        : iv === 'cancelled' ? r.progress.cancelled : true;
  const ishown = irows
    .filter(진행)
    .filter((r) => !im || String(r.receivedAt ?? '').startsWith(im))
    .filter((r) => !isup || r.supplier === isup)
    .filter((r) => !ich || r.channel === ich)
    .filter((r) => !iq || [r.plate, r.customer, r.model, r.supplier, r.channel, r.agent].join(' ').toLowerCase().includes(iq))
    .sort((x, y) => String(y.receivedAt).localeCompare(String(x.receivedAt)));
  const imonths = [...new Set(irows.map((r) => String(r.receivedAt ?? '').slice(0, 7)).filter(Boolean))].sort().reverse();
  const isups = vocab(irows.map((r) => r.supplier));
  const ichs = vocab(irows.map((r) => r.channel));
  /** 한 폼이 다른 판의 거름을 지우지 않게 — 제 칸이 아닌 주소 칸은 숨은 칸으로 들고 간다 */
  const 숨김 = (own: string[]) => Object.entries(q)
    .filter(([k, v]) => !own.includes(k) && k !== 'page' && sp(v))
    .map(([k, v]) => <input key={k} type="hidden" name={k} value={sp(v)} />);

  const car = sel?.product;
  return (
    <>
      <section className="workspace" data-phone={view} data-mode={mode}>
        {/* ── 상품 목록 — 찾기 ─────────────────────────────────── */}
        <section className="panel product-panel">
          <div className="panel-head">
            <div><p className="eyebrow">PRODUCT</p><h1>상품 목록</h1></div>
            <span className="count">{sorted.length.toLocaleString()}대</span>
          </div>
          {/**
            * ★★검색은 «창 하나» — 대표 2026-09-18 「검색창이랑 검색창 안에 세부 검색되게 해주고, 그 검색창 밑에 퀵버튼 필터」
            *   ⚠ 앞서 고르기 칸 넷 + 찾기 + 지우기가 두 줄로 섰다(목업은 창 하나 + 퀵 단추 한 줄이었다).
            *   세부검색(공급사 · 기간 · 월 대여료)은 창 «안» 오른쪽 끝에서 펼친다. Enter 는 창에서 바로 찾는다.
            */}
          <form className="dz-find" action={base}>
            {숨김(['q', 'status', 'kind', 'perk', 'supplier', 'term', 'max', 'id', 'offer'])}
            <div className="searchbox dz-searchbox">
              <span aria-hidden>⌕</span>
              <input name="q" defaultValue={sp(q.q)} placeholder="차번 · 모델 · 공급사" />
              <details className="dz-find-more" open={false}>
                <summary>세부검색{supplier || term || max || kind || (status && status !== '즉시출고') || (perk && !['무심사', '만21세', '경력무관', '무보증'].includes(perk)) ? ' ●' : ''}</summary>
                <div className="dz-find-panel">
                  <label>출고상태<select name="status" defaultValue={status}><option value="">전체</option>{statuses.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label>상품구분<select name="kind" defaultValue={kind}><option value="">전체</option>{kinds.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label>혜택<select name="perk" defaultValue={perk}><option value="">전체</option>{perkList.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label>공급사<select name="supplier" defaultValue={supplier}><option value="">전체</option>{suppliers.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label>기간<select name="term" defaultValue={term || ''}><option value="">전체</option>{terms.map((t) => <option key={t} value={t}>{t}개월</option>)}</select></label>
                  <label>월 대여료 이하<input name="max" defaultValue={sp(q.max)} placeholder="800000" inputMode="numeric" /></label>
                  <div className="dz-find-go"><Link href={base} className="dz-clear">지우기</Link><button type="submit">찾기</button></div>
                </div>
              </details>
            </div>
          </form>
          {/**
            * ★퀵 단추는 «여섯»만 — 대표 2026-09-18 「퀵필터 그렇게까지 필요없다」
            *   ⚠ 출고상태·상품구분·혜택을 다 세웠더니 19개였다. 남긴 것은 대표가 짚은 것 —
            *     「지금 나갈 차」(즉시출고)와 「혜택조건(무심사, 21세, 경력무관)」 + 무보증.
            *   나머지(출고상태 전부 · 상품구분 · 다른 혜택)는 버리지 않고 «세부검색» 으로 옮겼다.
            *   데이터에 없는 단추는 안 세운다(지어낸 단추가 없다). 두 화면 같은 줄이다.
            */}
          <div className="quick-filters">
            <Link className={!status && !kind && !perk ? 'active' : ''} href={keep({ status: '', kind: '', perk: '', page: '' })}>전체</Link>
            {statuses.includes('즉시출고') && (
              <Link className={status === '즉시출고' ? 'active' : ''} href={keep({ status: status === '즉시출고' ? '' : '즉시출고', page: '' })}>즉시출고</Link>
            )}
            {['무심사', '만21세', '경력무관', '무보증'].filter((x) => perkList.includes(x)).map((x) => (
              <Link key={x} className={perk === x ? 'active' : ''} href={keep({ perk: perk === x ? '' : x, page: '' })}>{x}</Link>
            ))}
          </div>
          <div className="list">
            {shown.map(({ product: p, lead: o }) => (
              <ListRow key={p.id} href={keep({ id: p.id, offer: o?.id ?? '', v: 'detail' })}
                selected={!!sel && p.id === sel.product.id}
                thumb={사진(p) ?? null}
                title={vehicleName(p) || p.id}
                badges={[p.productKind, txt(p.status)]}
                flag={매칭끝(p.vehicle.matchLevel) ? undefined : 매칭(p.vehicle.matchLevel)}
                meta={`${txt(p.registration?.vehicleNumber)} · ${p.specs.modelYear ?? '—'} · ${num(p.specs.mileageKm, 'km')} · ${txt(p.specs.fuel)}`}
                value={o ? `월 ${won(o.monthlyRent)}원 · ${o.termMonths}개월` : '—'}
                chips={p.perks} />
            ))}
            {shown.length === 0 && <p className="dz-empty">조건에 맞는 차가 없습니다.</p>}
          </div>
          <p className="dz-pager">
            {page > 1 ? <Link href={link(page - 1)}>← 앞</Link> : <span />}
            <span>{page} / {pages}쪽</span>
            {page < pages ? <Link href={link(page + 1)}>뒤 →</Link> : <span />}
          </p>
        </section>

        {/* ── 상품 상세 — 확정 목업(/design) 그대로: 공유 · 요약/상세정보 · 사진 · 이름 · 요약 네 칸 · 기간 단추 · 선택 Offer · 접수 ── */}
        <section className="panel detail-panel">
          <div className="panel-head">
            <div><p className="eyebrow">DETAIL</p><h1>상품 상세</h1></div>
            <button className="icon-btn" type="button">공유</button>
          </div>
          {car ? (
            <>
              <DetailTabs
                summary={<>
                  <div className="hero-car">
                    {사진(car)
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={사진(car)} alt={vehicleName(car) || car.id} />
                      : <span>사진 없음{car.photoLink ? <> · <a href={car.photoLink} target="_blank" rel="noreferrer">원본 사진 보기</a></> : null}</span>}
                    <small>SSOT</small>
                  </div>
                  <div className="vehicle-title">
                    <div>
                      <h2>{vehicleName(car) || car.id}</h2>
                      <p>{txt(car.registration?.vehicleNumber)} · {car.supplierName ?? car.supplierId}</p>
                      {!매칭끝(car.vehicle.matchLevel) && (
                        <p className="dz-note">차종 {매칭(car.vehicle.matchLevel)}{car.vehicle.matchNote ? ` — ${car.vehicle.matchNote}` : ''}</p>
                      )}
                    </div>
                    <span className="status-dot">{txt(car.status)}{car.statusReason ? ` · ${car.statusReason}` : ''}</span>
                  </div>
                  {/* ★검색 조건이 걸렸으면 그 조건을 만족한 요금만 — 기능 쪽 규칙(S-03, matchedOffers) 그대로 */}
                  <OfferPicker offers={sel.matchedOffers} initial={sp(q.offer) || sel.lead?.id}
                    perks={car.perks} perksNote={정책말(car.policyState)}
                    applyBase={mode === 'intake' ? keep({ w: 'new', product: car.id, offer: '', ic: '', v: 'work' }) : undefined} />
                </>}
                info={<>
                  <div className="vehicle-title">
                    <div><h2>{vehicleName(car) || car.id}</h2><p>{txt(car.registration?.vehicleNumber)}</p></div>
                    <span className="status-dot">{txt(car.status)}{car.statusReason ? ` · ${car.statusReason}` : ''}</span>
                  </div>
                  <h3 className="dz-sub">차량</h3>
                  <dl className="summary-grid">
                    {([
                      ['공급사', car.supplierName ?? car.supplierId], ['출고상태', txt(car.status)],
                      ['상품구분', txt(car.productKind)], ['심사', txt(car.credit)],
                      ['외장색', txt(car.extColor)], ['내장색', txt(car.intColor)],
                      ['차급', txt(car.vehicleClass)], ['차량가', car.consumerPrice ? `${won(car.consumerPrice)}원` : '—'],
                      ['정책', 정책상태(car.policyState)], ['입고일', txt(car.firstSeenAt)],
                      ['연식', car.specs.modelYear ? String(car.specs.modelYear) : '—'], ['주행거리', num(car.specs.mileageKm, 'km')],
                      ['연료', txt(car.specs.fuel)], ['배기량', num(car.specs.displacementCc, 'cc')],
                      ['인승', num(car.specs.seats)], ['구동', txt(car.specs.drivetrain)],
                      ['최초등록일', txt(car.registration?.firstRegistrationDate)], ['차대번호', txt(car.registration?.vin)],
                      ['차종 매칭', 매칭(car.vehicle.matchLevel) + (!매칭끝(car.vehicle.matchLevel) && car.vehicle.matchNote ? ` — ${car.vehicle.matchNote}` : '')], ['상품코드', car.id],
                    ] as [string, string][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                  </dl>
                  <h3 className="dz-sub">옵션{car.optionsUnverified ? ' · 미확인' : ''}</h3>
                  <p className="dz-para">{txt(car.options)}</p>
                  {(car.sourceUrl || car.ticaLink) && (
                    <p className="dz-links">
                      {car.sourceUrl && <a href={car.sourceUrl} target="_blank" rel="noreferrer">공급사 원본 보기</a>}
                      {car.ticaLink && <a href={car.ticaLink} target="_blank" rel="noreferrer">롯데 T카 보기</a>}
                    </p>
                  )}
                  <h3 className="dz-sub">정책 {car.productPolicies.length}</h3>
                  {car.productPolicies.length === 0
                    ? <p className="dz-empty">붙은 정책이 없습니다 — 「없다」가 아니라 ERP5 에 정책 코드가 안 걸렸거나 못 찾은 것입니다.</p>
                    : <dl className="summary-grid">
                        {car.productPolicies.map((v, i) => <div key={i}><dt>{정책이름표(v.policyId)}</dt><dd>{정책값글(v)}</dd></div>)}
                      </dl>}
                </>}
              />
            </>
          ) : <p className="dz-empty">왼쪽에서 차를 고르면 여기 뜹니다.</p>}
        </section>

        {/* ── 접수 목록 — 상품 목록 판과 같은 규격 (계약접수에서만) ─────────────── */}
        {mode === 'intake' && sp(q.w) === 'new' && <section className="panel work-panel">
          <NewIntakePanel rows={irows} productId={sp(q.product)} offerId={sp(q.offer)} back={keep({ w: '', product: '', ic: '' })} />
        </section>}
        {mode === 'intake' && sp(q.w) !== 'new' && sp(q.ic) && <section className="panel work-panel">
          <IntakeDetailPanel code={sp(q.ic)} created={!!sp(q.created)} exists={!!sp(q.exists)} back={keep({ ic: '', created: '', exists: '' })} />
        </section>}
        {mode === 'intake' && sp(q.w) !== 'new' && !sp(q.ic) && <section className="panel work-panel">
          <div className="panel-head">
            <div><p className="eyebrow">WORK</p><h1>접수 목록</h1></div>
            <div className="dz-head-right">
              <Link className="new-app" href={keep({ w: 'new', product: '', offer: '', ic: '', v: 'work' })}>+ 신규접수</Link>
              <span className="count">{ishown.length.toLocaleString()}건</span>
            </div>
          </div>
          <form className="dz-find" action={base}>
            {숨김(['iq', 'iv', 'im', 'isup', 'ich'])}
            <div className="searchbox dz-searchbox">
              <span aria-hidden>⌕</span>
              <input name="iq" defaultValue={sp(q.iq)} placeholder="고객 · 차번 · 모델 · 공급사 · 채널" />
              <details className="dz-find-more">
                <summary>세부검색{im || isup || ich ? ' ●' : ''}</summary>
                <div className="dz-find-panel">
                  <label>진행<select name="iv" defaultValue={iv}>
                    <option value="open">진행중</option><option value="delivered">인도완료</option>
                    <option value="cancelled">취소</option><option value="all">전체</option>
                  </select></label>
                  <label>접수월<select name="im" defaultValue={im}><option value="">전체</option>{imonths.map((m) => <option key={m}>{m}</option>)}</select></label>
                  <label>공급사<select name="isup" defaultValue={isup}><option value="">전체</option>{isups.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label>영업채널<select name="ich" defaultValue={ich}><option value="">전체</option>{ichs.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <div className="dz-find-go"><Link href={keep({ iq: '', iv: '', im: '', isup: '', ich: '' })} className="dz-clear">지우기</Link><button type="submit">찾기</button></div>
                </div>
              </details>
            </div>
          </form>
          <div className="quick-filters">
            {([['all', '전체'], ['open', '진행중'], ['delivered', '인도완료'], ['cancelled', '취소']] as const).map(([v, label]) => (
              <Link key={v} className={iv === v ? 'active' : ''} href={keep({ iv: v === 'open' ? '' : v })}>{label}</Link>
            ))}
          </div>
          {intakeErr ? <p className="dz-empty">ERP5 접수를 못 읽었습니다 — {intakeErr}</p> : (
            <div className="list">
              {ishown.map((r, i) => (
                <ListRow key={`${r.plate ?? '차번없음'}-${r.receivedAt}-${i}`}
                  href={keep({ ic: r.id, w: '', v: 'work' })}
                  title={txt(r.customer)} badge={r.progress.cancelled ? '취소' : (blockOf(r) ?? '끝')}
                  tone={!r.progress.cancelled && blockOf(r) ? 'act' : 'plain'}
                  meta={[r.plate, r.model, r.supplier].filter(Boolean).join(' · ') || '—'}
                  value={r.rent ? `월 ${won(r.rent)}원` : '—'} aside={txt(r.receivedAt)} />
              ))}
              {ishown.length === 0 && <p className="dz-empty">조건에 맞는 접수가 없습니다.</p>}
            </div>
          )}
        </section>}
      </section>

      {/* 폰 — 판을 한 장씩(규칙 ⑧) */}
      <nav className="phone-tabs" aria-label="판 바꾸기">
        <Link className={view === 'list' ? 'active' : ''} href={keep({ v: 'list' })}>상품</Link>
        <Link className={view === 'detail' ? 'active' : ''} href={keep({ v: 'detail' })}>상세</Link>
        {mode === 'intake' && <Link className={view === 'work' ? 'active' : ''} href={keep({ v: 'work' })}>접수</Link>}
      </nav>
    </>
  );
}
