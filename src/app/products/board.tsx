import Link from 'next/link';
import { LiveSearch } from './LiveSearch';
import './board.css';
import { productView } from './workspace';
import { 상품축이름 } from './workspace-config';
import { sp, txt, won } from '../_fn/fmt';
import { erp5Ready } from '../../adapters/erp5/firestore';
import { FilterSheet } from '../_design/FilterSheet';
import { Share } from '../_design/Share';
import { productSections } from '../../domain/catalog/sections';
import { 꼴, 있음 } from '../_design/Sections';
import type { CanonicalProduct, Offer } from '../../domain/product/types';
import { settlements } from '../../server/erp5';
import { buildIntakeOptions } from '../intake/intake-options';
import { intakeDefaults } from '../intake/intake-defaults';
import { BoardIntakeForm } from './BoardIntakeForm';
import { BoardList } from './BoardList';
import { PAGE, firstWindow, flat, productRows, 이름, 공급사, 요금줄, 사진들 } from './list-rows';
import { moreProductRows } from './list-actions';
import { IntakeDetail, IntakeList } from '../intake/IntakeSide';
import { NewIntakePanel } from '../intake/panels';
import type { SettlementRow } from '../../domain/settlement/types';
import { previewFeeAction, type FeePreview } from '../intake/actions';

/**
 * ★★★ 상품찾기 새 판 — 목업(docs/ui/mockups/admin-mobile-five-functions.html) 마크업 그대로 (대표 2026-09-22 「판갈이」)
 *   PC: 상품목록 | 상품상세 | 신규 계약접수 — 셋 다 1/3. 폰: 한 판씩(?v=list|detail|work), 위는 그 판의 상태표시줄 하나.
 *   카드를 위에서 아래로 죽죽 쌓는다 — 탭·아코디언 없음. 데이터·거름은 옛 판과 같은 `productView` 를 쓴다.
 *   동선(대표 2026-09-22): 상세에서 기간 카드를 누르고 [접수하기] → 오른쪽 접수 칸이 열린다 → [취소] [저장하기].
 *   저장은 /intake 신규 접수와 같은 createIntakeAction(BoardIntakeForm) — 저장되면 그 접수(/intake?ic=…)로 간다.
 */

const 결 = (status?: string) => (status === '즉시출고' || status === '출고가능' ? 'good' : status ? 'warn' : '');
const 요금곁 = (o: Offer) => [
  o.deposit ? `보증금 ${won(o.deposit)}원` : '무보증',
  o.prepayment ? `선납 ${won(o.prepayment)}원` : '',
  o.annualMileageKm ? `연 ${o.annualMileageKm.toLocaleString('ko-KR')}km` : '',
].filter(Boolean).join(' · ');

/* 사진 없는 자리 — 목업의 차량 자리 그림 그대로 */
function CarArt() {
  return (
    <svg viewBox="0 0 168 78" role="img" aria-label="차량 대표사진 없음">
      <ellipse cx="84" cy="70" rx="70" ry="4.5" fill="rgba(0,0,0,.09)" />
      <path d="M8 56V45c0-6 4-9 12-10.5L44 31c8-11 19-15 35-15h29c14 0 23 4 31 14l14 6c6 2 8 5 8 11v9Z" fill="#263954" stroke="rgba(0,0,0,.14)" />
      <path d="M50 31c7-9 15-12 28-12h7v13Z" fill="#8c99a3" opacity=".82" />
      <path d="M91 19h16c11 0 17 3 22 11l-38 2Z" fill="#8c99a3" opacity=".82" />
      <circle cx="46" cy="56" r="12.5" fill="#1b2126" /><circle cx="46" cy="56" r="4.8" fill="#aeb7be" />
      <circle cx="129" cy="56" r="12.5" fill="#1b2126" /><circle cx="129" cy="56" r="4.8" fill="#aeb7be" />
    </svg>
  );
}


/**
 * mode — 'find'(상품 · /products): 오른쪽 = 신규 계약접수.
 *        'intake'(계약접수 메인 · /intake): 오른쪽 = 접수 목록 → 접수 상세(?ic=) · [접수하기](?w=new) = 신규 계약접수.
 *   (대표 2026-09-22 「접수는 상품찾기 상품상세 접수목록이 있는 페이지」) — 왼쪽 두 판은 두 모드가 같다.
 */
export async function ProductsBoard({ q, mode = 'find' }: { q: Record<string, string | string[] | undefined>; mode?: 'find' | 'intake' }) {
  const base = mode === 'intake' ? '/intake' : '/products';
  const data = erp5Ready();
  const pv = await productView(q);
  if ('error' in pv) {
    return (
      <div className="pb" data-phone="list">
        <p className="pb-error">ERP5 를 못 읽었습니다 — {pv.error}</p>
      </div>
    );
  }
  const { sorted, 상품판축, statuses, perkList, explicitPsel, parsedSearch } = pv;

  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])));
    for (const k of ['created', 'exists']) u.delete(k);   // 한 번 알린 것은 다음 주소로 안 끌고 간다
    for (const [k, v] of Object.entries(extra)) { if (v) u.set(k, v); else u.delete(k); }
    const s = u.toString();
    return s ? `${base}?${s}` : base;
  };
  const 켜끔 = (cur: string[], v: string) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(',');
  const 숨김 = Object.entries(q)
    .filter(([k, v]) => !['q', 'id', 'offer', 'v'].includes(k) && sp(v))
    .map(([k, v]) => <input key={k} type="hidden" name={k} value={sp(v)} />);

  const selId = sp(q.id);
  const sel = sorted.find((h) => h.product.id === selId) ?? sorted[0];
  const car = sel?.product;
  const offers = sel?.matchedOffers ?? [];
  const chosen = offers.find((o) => o.id === sp(q.offer)) ?? sel?.lead ?? offers[0];
  const ic = mode === 'intake' ? sp(q.ic) : '';
  const view = (['list', 'detail', 'work'] as const).find((v) => v === sp(q.v))
    ?? (mode === 'intake' && (ic || sp(q.w)) ? 'work' : selId ? 'detail' : 'list');
  /* 접수 칸은 [접수하기]를 눌러야 열린다 — PC 에서 두 판에 주 버튼이 같이 서지 않게(AI Core: 판마다 주 버튼 하나) */
  const 접수중 = (mode === 'intake' ? sp(q.w) === 'new' : view === 'work') && !!car && !!chosen;
  /* 차 없이 직접 접수 — 상품 목록을 거치지 않는 견적출고 · 신차발주(기능 쪽 NewIntakePanel 그대로) */
  const 직접접수 = mode === 'intake' && sp(q.w) === 'direct';
  /* 계약접수 메인 — 오른쪽 접수 목록 · 상세가 원장 줄을 쓴다(신규 접수의 채널·담당 선택지도 같은 줄에서) */
  let 원장: SettlementRow[] = [];
  let 원장오류 = '';
  if (mode === 'intake' || 접수중) {
    try { 원장 = (await settlements.list()).map((x) => x.row); } catch (e) { 원장오류 = (e as Error).message; }
  }
  let 접수: ReturnType<typeof intakeDefaults> | null = null;
  let 접수선택지: ReturnType<typeof buildIntakeOptions> | null = null;
  let 접수오류 = '';
  let 수수료: FeePreview | null = null;
  if (접수중) {
    접수 = intakeDefaults(car, chosen.id, { customer: sp(q.customer), channel: sp(q.channel), agent: sp(q.agent) });
    if (!접수.choices.length || 접수.choices.includes(접수.defaults.product ?? '')) {
      const f = new FormData();
      const d = 접수.defaults;
      for (const [k, v] of Object.entries({ supplier: d.supplier, product: d.product ?? '', model: d.model, term: d.term, rent: d.rent, price: d.price ?? '' })) f.set(k, v);
      수수료 = await previewFeeAction(f);
    }
    접수선택지 = buildIntakeOptions(원장);
    접수오류 = 원장오류;
  }
  const 즉시 = sorted.filter((h) => h.product.status === '즉시출고').length;
  const 전체켜짐 = 상품축이름.every(([a]) => !explicitPsel[a].length) && parsedSearch.tokens.length === 0;
  const 퀵 = [
    ...(statuses.includes('즉시출고') ? [{ label: '즉시출고', on: explicitPsel.status.includes('즉시출고'), href: keep({ status: 켜끔(explicitPsel.status, '즉시출고') }) }] : []),
    ...['무심사', '만21세', '경력무관', '무보증'].filter((x) => perkList.includes(x))
      .map((x) => ({ label: x, on: explicitPsel.perk.includes(x), href: keep({ perk: 켜끔(explicitPsel.perk, x) }) })),
  ];
  /* 목록 — 첫 화면은 PAGE 줄만(고른 줄이 뒤면 거기까지). 나머지는 끝에 닿으면 moreProductRows 로 받는다 */
  const 목록 = productRows(sorted, q, base);
  /* 걸어 둔 조건 — 빠른 조건(위 칩)에 없는 것만 ✕ 칩으로 보인다. 누르면 그 조건 하나만 풀린다 */
  const 퀵값 = new Set(퀵.map((c) => c.label));
  const 걸린조건 = 상품판축.flatMap((ax) => explicitPsel[ax.key as keyof typeof explicitPsel]
    .filter((k) => !((ax.key === 'status' || ax.key === 'perk') && 퀵값.has(k)))
    .map((k) => ({
      key: `${ax.key}:${k}`,
      label: `${ax.label} ${ax.options.find((o) => o.key === k)?.label ?? k}`,
      href: keep({ [ax.key]: 켜끔(explicitPsel[ax.key as keyof typeof explicitPsel], k) }),
    })));
  const 사진 = car ? 사진들(car) : [];
  const 스펙 = car ? [
    car.specs.fuel, car.specs.drivetrain, car.specs.seats ? `${car.specs.seats}인승` : undefined,
    car.specs.modelYear ? `${car.specs.modelYear}년식` : undefined,
  ].filter((x): x is string => !!x).slice(0, 3) : [];
  const 구역 = car ? productSections(car)
    .map((s) => ({ ...s, items: s.items.filter(있음) }))
    .filter((s) => s.items.length > 0) : [];
  const 상태 = <span className={`sync${data.ok ? '' : ' warn'}`}>{data.ok ? '연결 정상' : '데이터 설정 필요'}</span>;

  /* 폰 상태표시줄 — 그 판의 제목 하나(목업 statusbar) */
  const 폰머리 = {
    list: { title: <>상품찾기<span>{sorted.length}대</span></>, sub: 즉시 ? `즉시출고 ${즉시}대` : '판매 가능' },
    detail: { title: <>상품 상세</>, sub: car ? `${txt(car.status)} · 계약조건 선택` : '차를 고르세요' },
    work: 접수중 ? { title: <>신규 계약접수</>, sub: '작성 중 · 저장 전' }
      : ic ? { title: <>접수 상세</>, sub: '진행 · 다음 업무' }
        : { title: <>접수 목록</>, sub: '진행 중부터' },
  }[view];
  /* 상품찾기의 [접수하기] → 계약접수 메인으로 넘어가 그 차의 신규 접수 칸을 연다(같은 거름 조건을 들고 간다) */
  const 접수로 = (() => {
    const u = new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])));
    if (car) u.set('id', car.id);
    if (chosen) u.set('offer', chosen.id);
    u.set('w', 'new'); u.set('v', 'work'); u.delete('ic');
    return `/intake?${u}`;
  })();
  /* 폰 — 계약접수의 «접수 목록»도 탭 홈이다(하단 메뉴가 선다) */
  const 탭홈 = mode === 'intake' && view === 'work' && !ic && !접수중 && !직접접수;

  return (
    <div className="pb" data-phone={view} data-mode={mode} data-home={탭홈 ? 'true' : undefined}>
      <header className="statusbar">
        <div><h1>{폰머리.title}</h1><small>{폰머리.sub}</small></div>
        {상태}
      </header>

      <div className="web-workspace">
        {/* ── 상품 목록 ─────────────────────────────── */}
        <section className="web-panel pb-list">
          <header className="web-panel-head">
            <h2>상품찾기</h2><span>{sorted.length}대</span><small>{즉시 ? `즉시출고 ${즉시}대` : '판매 가능'}</small>
          </header>
          <div className="list-tools">
            <form className="search" action={base}>
              {숨김}
              <div className="search-field">
                <LiveSearch name="q" defaultValue={sp(q.q)} label="검색" placeholder="차량·공급사·조건 검색" reset={[]} />
              </div>
              <FilterSheet axes={상품판축} count={sorted.length} unit="대" />
            </form>
            <div className="chips" role="group" aria-label="빠른 조건">
              <Link className={`chip${전체켜짐 ? ' on' : ''}`}
                href={keep({ ...Object.fromEntries(상품축이름.map(([a]) => [a, ''])), q: parsedSearch.text })}>
                전체{전체켜짐 && <span className="sr-only"> (선택됨)</span>}
              </Link>
              {퀵.map((c) => (
                <Link key={c.label} className={`chip${c.on ? ' on' : ''}`} href={c.href}>
                  {c.label}{c.on && <span className="sr-only"> (선택됨)</span>}
                </Link>
              ))}
            </div>
            {걸린조건.length > 0 && (
              <div className="applied" aria-label="걸어 둔 조건">
                {걸린조건.map((c) => (
                  <Link key={c.key} className="applied-chip" href={c.href} aria-label={`${c.label} 조건 풀기`}>
                    <span>{c.label}</span><span aria-hidden="true">✕</span>
                  </Link>
                ))}
                <Link className="applied-clear" href={keep({ ...Object.fromEntries(상품축이름.map(([a]) => [a, ''])), q: '' })}>모두 지우기</Link>
              </div>
            )}
            </div>
            <div className="web-scroll">
            <BoardList rows={firstWindow(목록, car?.id)} total={목록.length} page={PAGE} more={moreProductRows.bind(null, flat(q), base)} selectedId={car?.id} />
          </div>
        </section>

        {/* ── 상품 상세 ─────────────────────────────── */}
        <section className="web-panel pb-detail">
          <header className="web-panel-head"><h2>상품 상세</h2><small>{car ? txt(car.status) : ''}</small></header>
          <div className="web-scroll">
            {car ? (
              <>
                <article className="product-hero">
                  <div className="product-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {사진[0] ? <img src={사진[0]} alt={이름(car)} /> : <CarArt />}
                    {사진.length > 0 && <span className="photo-count">대표사진 · 1/{사진.length}</span>}
                  </div>
                  <div className="product-hero-body">
                    <div className="product-hero-title">
                      <h3>{이름(car)}</h3>
                      {car.status ? <span className={`tag ${결(car.status)}`}>{car.status}</span> : null}
                    </div>
                    <p>{[공급사(car), car.registration?.vehicleNumber].filter(Boolean).join(' · ')}</p>
                    <div className="product-rent"><span>선택 대여료</span><strong>{chosen ? `월 ${won(chosen.monthlyRent)}원` : '—'}</strong></div>
                    {스펙.length > 0 && <div className="quick-specs">{스펙.map((x) => <span key={x}>{x}</span>)}</div>}
                  </div>
                </article>

                <div className="section" role="group" aria-labelledby="pb-offer-title">
                  <h4 id="pb-offer-title">계약조건 선택</h4>
                  {offers.map((o) => {
                    const on = !!chosen && o.id === chosen.id;
                    return (
                      <Link key={o.id} href={keep({ id: car.id, offer: o.id, v: 'detail' })}
                        className={`offer${on ? ' on' : ''}`} aria-current={on ? 'true' : undefined}>
                        <strong>{요금줄(o)}{on && <span className="sr-only"> (선택됨)</span>}</strong>
                        <small>{요금곁(o)}</small>
                      </Link>
                    );
                  })}
                  {offers.length === 0 && <p className="empty">받은 요금이 없습니다.</p>}
                </div>

                {구역.map((s) => (
                  <div key={s.key} className="section">
                    <h4>{s.title === '차량' ? '차량 정보' : s.title}</h4>
                    <div className="facts">
                      {s.items.map((it) => <div key={it.key} className="fact"><span>{it.label}</span><b>{꼴(it)}</b></div>)}
                    </div>
                  </div>
                ))}
              </>
            ) : <p className="empty">왼쪽에서 차를 고르면 여기 뜹니다.</p>}
          </div>
          {car && (
            <div className="web-actions pb-detail-actions">
              <Link className="tertiary only-phone" href={keep({ v: 'list' })}>목록</Link>
              <Share />
              {mode === 'find'
                ? <Link className="primary" href={접수로}>접수하기</Link>
                : 접수중
                  ? <Link className="secondary is-on" href={keep({ v: 'work' })} aria-current="step">접수 중<span className="sr-only"> (오른쪽 접수 칸)</span></Link>
                  : <Link className="primary" href={keep({ id: car.id, offer: chosen?.id ?? '', v: 'work', w: 'new', ic: '' })}>접수하기</Link>}
            </div>
          )}
        </section>

        {/* ── 접수 — 계약접수 메인에서만(상품찾기는 두 판) ── */}
        {mode === 'intake' && (
          <section className="web-panel pb-work">
            <header className="web-panel-head">
              {직접접수 ? <><h2>직접 접수</h2><small>차 없이 · 견적출고 · 신차발주</small></>
                : 접수중 ? <><h2>신규 계약접수</h2><small>작성 중 · 저장 전</small></>
                : ic ? <><h2>접수 상세</h2><small>진행 · 다음 업무</small></>
                  : <><h2>접수 목록</h2><span>{원장.length}건</span><small>{원장.filter((r) => !r.progress.cancelled && !r.progress.delivered).length}건 진행 중</small></>}
            </header>
            {직접접수 ? (
              <div className="web-scroll pb-legacy">
                <NewIntakePanel rows={원장} productId="" offerId="" back={keep({ w: '', ic: '', v: 'work' })} />
              </div>
            ) : 접수중 && 접수 && 접수선택지 ? (
              <BoardIntakeForm key={`${car.id}:${chosen.id}`} defaults={접수.defaults} options={접수선택지} choices={접수.choices}
                cancelHref={keep({ w: '', v: 'detail' })} fee={수수료}>
                <article className="row context-card" aria-label="선택 상품">
                  <span className={`thumb${사진[0] ? ' photo' : ' car'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {사진[0] ? <img src={사진[0]} alt="" /> : null}
                  </span>
                  <span className="row-body">
                    <span className="row-title"><b>{이름(car)}</b>{car.perks?.[0] ? <span className="tag">{car.perks[0]}</span> : null}</span>
                    <span className="meta">{[공급사(car), car.registration?.vehicleNumber, txt(car.status)].filter(Boolean).join(' · ')}</span>
                    <span className="value">{요금줄(chosen)}</span>
                  </span>
                </article>
                {접수오류 && <p className="pb-errs" role="alert">원장 선택지를 못 읽었습니다 — {접수오류}</p>}
              </BoardIntakeForm>
            ) : 원장오류 ? (
              <div className="web-scroll"><p className="pb-errs" role="alert">접수 원장을 못 읽었습니다 — {원장오류}</p></div>
            ) : ic ? (
              <IntakeDetail code={ic} keep={keep} created={!!sp(q.created)} exists={!!sp(q.exists)} />
            ) : (
              <IntakeList q={q} keep={keep} all={원장} />
            )}
          </section>
        )}
      </div>
    </div>
  );
}
