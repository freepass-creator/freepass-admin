import Link from 'next/link';
import { productList, settlements, today } from '../../server/erp5';
import { searchProducts } from '../../domain/search/search-products';
import type { ProductSearchQuery } from '../../domain/search/types';
import type { Offer } from '../../domain/product/types';
import { vehicleName } from '../_fn/product';
import { sp, txt, vocab, won } from '../_fn/fmt';
import { blockOf, intakeTaskOf, type SettlementRow } from '../../domain/settlement/types';
import { BUCKETS, bucketOf, type Bucket } from '../../domain/settlement/stage';
import { intakeAgeDays, sortIntakeRows } from '../../domain/settlement/intake-list';
import { OfferPicker } from '../_design/OfferPicker';
import { imgSrc } from '../../server/image-proxy';
import { ListRow, type RowStatus } from '../_design/ListRow';
import { Tag, 상품신원 } from '../_design/Badges';
import { DetailTabs } from '../_design/DetailTabs';
import { PhotoGallery } from '../_design/PhotoGallery';
import { ProductInfo } from '../_design/ProductInfo';
import { productSections } from '../../domain/catalog/sections';
import { 매칭, 매칭끝 } from '../_design/words';
import { IntakeDetailPanel, NewIntakePanel } from '../intake/panels';
import { FilterSheet, type FacetAxis } from '../_design/FilterSheet';
import { 고른값 } from '../_design/pick';
import { standingFixed, tallyMatch } from '../_design/facet-standing';
import { ActionBar, EmptyState, PanelHeader, SearchField } from '../_design/Primitives';
import {
  STATUS_ORDER, lead, 대여료구간, 보증금구간, 요금축, 차축, 상품축이름, 요금맞음,
  많은순, mergeProductSelections, offerWithinSearchLimits, parseProductSearch, productMeetsSearchRequirements, 보증금, 정책말,
  type 상품축, type 요금축 as 요금축Type, type 차축 as 차축Type,
} from './workspace-config';


/**
 * ★★★**상품·접수 한 화면 — 대표 확정 판 셋 모양 위에 진짜 ERP5 를 얹는다** (2026-09-18)
 *   대표: 「야 디자인 아까 그 형태 어디 갔어」 — 확정 판 셋(상품 목록 | 상품 상세 | 접수)이 기능 뼈대(맨 표)로
 *   바뀌어 있었다. 나눔: **데이터는 기능 세션**(productList · searchProducts · lead · settlements),
 *   **모양은 디자인**(이 파일의 JSX · globals.css · src/app/_design). 아래 데이터 줄은 기능 쪽이 쓴 그대로다.
 *   ★마크업은 확정본(`src/app/design/page.tsx`)의 이름을 그대로 쓴다 — 그래야 확정 옷(globals.css)이 그대로 입혀진다.
 * 고르기는 주소로 한다(`?id=` · `?offer=`) — 서버 화면이라 새로 고쳐도, 링크로 보내도 같은 자리가 선다.
 * 폰은 `?v=list|detail|work` 로 판을 한 장씩(규칙 ⑧).
 */

/** 실제 Canonical product shape에 붙는 차 축 판정은 workspace 가까이에 둔다. */
type 상품 = Awaited<ReturnType<typeof productList>>['rows'][number];
const 차맞음: Record<차축Type, (p: 상품, k: string) => boolean> = {
  status: (p, k) => p.status === k,
  kind: (p, k) => p.productKind === k,
  perk: (p, k) => (p.perks ?? []).includes(k),
  supplier: (p, k) => (p.supplierName ?? p.supplierId) === k,
  cls: (p, k) => p.vehicleClass === k,
  fuel: (p, k) => p.specs.fuel === k,
};

/** 사진 URL은 서버 proxy 규칙을 반드시 거친다. */
const 사진 = (p: { photoUrl?: string }): string | undefined =>
  p.photoUrl && p.photoUrl.trim() ? imgSrc(p.photoUrl) : undefined;

export async function ProductWorkspace({ q, mode, base }: {
  q: Record<string, string | string[] | undefined>; mode: 'find' | 'intake'; base: string;
}) {
  const parsedSearch = parseProductSearch(sp(q.q));
  const text = parsedSearch.text.toLowerCase();
  /** URL facet + 검색창에서 읽은 업무조건은 같은 축으로 합쳐 한 번만 판정한다. */
  const explicitPsel = Object.fromEntries(상품축이름.map(([a]) => [a, 고른값(sp(q[a]))])) as Record<상품축, string[]>;
  const psel = mergeProductSelections(explicitPsel, parsedSearch.inferred);
  let all: Awaited<ReturnType<typeof productList>>;
  try { all = await productList(); }
  catch (e) {
    return <><h1>상품찾기</h1><p className="fn-err">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></>;
  }
  const { rows } = all;

  /*
   * ★요금 축(기간 · 대여료 · 보증금)은 «한 요금이 모두» 만족해야 걸린다(S-02) — 그래서 차가 아니라 요금을 거른다.
   *   남은 요금이 곧 matchedOffers 다(S-03 — 상세·접수는 여기서 고른다). 여러 구간은 하나의 범위로 못 적어
   *   도메인 질의(monthlyRent: {min,max})에 못 넣으므로, 도메인이 돌려준 요금을 같은 규칙으로 한 번 더 거른다.
   */
  const pool = searchProducts(rows, {} as ProductSearchQuery);
  const 남은요금 = (h: (typeof pool)[number], skip?: 상품축) => h.matchedOffers.filter((o) =>
    요금축.every((a) => a === skip || !psel[a].length || psel[a].some((k) => 요금맞음[a](o, k)))
    && offerWithinSearchLimits(o, parsedSearch.limits));
  const 통과 = (h: (typeof pool)[number], skip?: 상품축) =>
    productMeetsSearchRequirements(h.product, parsedSearch.requirements)
    && 차축.every((a) => a === skip || !psel[a].length || psel[a].some((k) => 차맞음[a](h.product, k)))
    && 남은요금(h, skip).length > 0;
  const searched = text ? pool.filter(({ product: p }) =>
    `${vehicleName(p)} ${p.registration?.vehicleNumber ?? ''} ${p.supplierName ?? ''} ${p.supplierId}`
      .toLowerCase().includes(text)) : pool;
  const hits = searched.filter((h) => 통과(h)).map((h) => {
    const matchedOffers = 남은요금(h);
    return { ...h, matchedOffers, matchedOfferIds: matchedOffers.map((o) => o.id) };
  });
  const sorted = hits
    .map((h) => ({ ...h, lead: lead(h.matchedOffers) }))
    .sort((a, b) => (STATUS_ORDER[a.product.status ?? ''] ?? 9) - (STATUS_ORDER[b.product.status ?? ''] ?? 9)
      || (a.lead?.monthlyRent ?? Infinity) - (b.lead?.monthlyRent ?? Infinity));
  /* ★쪽을 나누지 않는다 — 목록은 쭉 구른다(대표 2026-09-18 「스크롤이 쭉쭉쭉 되어야 함」). 사진은 화면에 올 때 부른다(lazy) */
  const shown = sorted;

  const statuses = vocab(rows.map((p) => p.status));
  const perkList = vocab(rows.flatMap((p) => p.perks ?? []));
  /** "무보증"은 상품 badge가 아니라 실제 Offer 보증금 0원 조건이다. 검색창과 퀵필터가 같은 Offer 축을 써야 한다. */
  const hasNoDepositOffer = pool.some((h) => h.matchedOffers.some((o) => o.deposit === 0));
  /** "만21세" 퀵필터는 최소연령이 21세 이하인 상품 전체다. 정확히 "만21세" 라벨만 찾으면 18~20세 가능 상품을 놓친다. */
  const age21Perks = perkList.filter((perk) => {
    const m = /^만(\d{2})세$/.exec(perk);
    const age = m ? Number(m[1]) : 0;
    return age >= 18 && age <= 21;
  });
  /**
   * ★교차 집계 — 원본 `shopFacets` 짜임: 줄(명단·차례)은 «전체»가 정하고, 숫자는 «제 축을 뺀 지금 조건»으로 센다.
   *   누를 때 줄이 안 사라지고 안 뛴다 — 숫자만 오르내린다(대표 2026-09-10 「0이라고 해줘야지」).
   */
  const 값명단: Record<상품축, { k: string; label: string }[]> = {
    status: 많은순(pool.map((h) => h.product.status ?? '')).sort((a, b) => (STATUS_ORDER[a] ?? 9) - (STATUS_ORDER[b] ?? 9))
      .map((k) => ({ k, label: k })),
    kind: 많은순(pool.map((h) => h.product.productKind ?? '')).map((k) => ({ k, label: k })),
    perk: 많은순(pool.flatMap((h) => h.product.perks ?? [])).map((k) => ({ k, label: k })),
    term: [...new Set(pool.flatMap((h) => h.matchedOffers.map((o) => o.termMonths)))].sort((a, b) => a - b)
      .map((m) => ({ k: String(m), label: `${m}개월` })),
    rent: 대여료구간.map((b) => ({ k: b.k, label: b.label })),
    dep: 보증금구간.map((b) => ({ k: b.k, label: b.label })),
    mile: [...new Set(pool.flatMap((h) => h.matchedOffers.map((o) => o.annualMileageKm).filter((x): x is number => typeof x === 'number')))]
      .sort((a, b) => a - b).map((km) => ({ k: String(km), label: `연 ${(km / 10000).toLocaleString('ko-KR')}만km` })),
    supplier: 많은순(pool.map((h) => h.product.supplierName ?? h.product.supplierId)).map((k) => ({ k, label: k })),
    cls: 많은순(pool.map((h) => h.product.vehicleClass ?? '')).map((k) => ({ k, label: k })),
    fuel: 많은순(pool.map((h) => h.product.specs.fuel ?? '')).map((k) => ({ k, label: k })),
  };
  const 걸림 = (a: 상품축, h: (typeof pool)[number], k: string, 요금: Offer[]) =>
    (요금축 as readonly string[]).includes(a) ? 요금.some((o) => 요금맞음[a as 요금축Type](o, k)) : 차맞음[a as 차축Type](h.product, k);
  const 상품판축: FacetAxis[] = 상품축이름.map(([a, label]) => {
    const keys = 값명단[a].map((x) => x.k);
    const name = new Map(값명단[a].map((x) => [x.k, x.label]));
    const base = tallyMatch(pool, keys, (h, k) => 걸림(a, h, k, h.matchedOffers));
    const live = tallyMatch(searched.filter((h) => 통과(h, a)), keys, (h, k) => 걸림(a, h, k, 남은요금(h, a)));
    return { key: a, label, options: standingFixed(keys, base, live).map((o) => ({ key: o.key, label: name.get(o.key) ?? o.key, count: o.count })) };
  });

  /* ── 고른 차 · 고른 요금 · 접수 목록 — 모양을 위해 «고르기»만 더한다(값은 위에서 센 그대로) ── */
  const selId = sp(q.id);
  const sel = sorted.find((h) => h.product.id === selId) ?? sorted[0];
  const view = (['list', 'detail', 'work'] as const).find((v) => v === sp(q.v) && (v !== 'work' || mode === 'intake')) ?? (selId ? 'detail' : 'list');
  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])));
    for (const [k, v] of Object.entries(extra)) { if (v) u.set(k, v); else u.delete(k); }
    return `${base}?${u}`;
  };
  /** 퀵 단추 — 그 축의 고른 값 안에서 하나를 켜고 끈다(세부검색과 같은 주소 칸을 쓴다) */
  const 켜끔 = (cur: string[], v: string) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(',');
  const 묶음켜끔 = (cur: string[], vals: string[]) => {
    const on = vals.length > 0 && vals.every((v) => cur.includes(v));
    return (on ? cur.filter((x) => !vals.includes(x)) : [...new Set([...cur, ...vals])]).join(',');
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
  /**
   * ★접수 목록 칸 = 계약이 앉는 자리 다섯(기능 stage.ts · 대표 2026-09-18 「접수 → 분납실적/완납실적 → 완납·인도 기준 청구·지급」)
   *   당월접수 · 미완료 · 분납실적 · 완납실적 · 취소. 옛 「진행중 / 인도완료」 가름은 버렸다.
   *   처음 여는 칸 = 당월접수(이달의 일). ★미완료(지난달 이전 접수인데 아직 인도 전)는 오래 있을수록 위험 — 단추·줄을 붉게.
   */
  const iv = (BUCKETS as string[]).includes(sp(q.iv)) || sp(q.iv) === 'all' ? sp(q.iv) : '당월접수';
  const 칸의 = new Map(irows.map((r) => [r, bucketOf(r)] as const));
  const 칸수 = Object.fromEntries(BUCKETS.map((b) => [b, irows.filter((r) => 칸의.get(r) === b).length])) as Record<Bucket, number>;
  const 진행 = (r: SettlementRow) => iv === 'all' || 칸의.get(r) === iv;
  /** 접수 줄의 상태 칸 — 칸(bucket)이 곧 상태. 당월접수는 인도 여부로 한 번 더 가른다 */
  const 접수상태 = (r: SettlementRow, b?: Bucket): RowStatus =>
    b === '취소' ? { icon: 'circle-slash', label: '취소', tone: 'grey' }
      : b === '미완료' ? { icon: 'clock', label: '미완료', tone: 'red' }
        : b === '완납실적' ? { icon: 'circle-check', label: '완납', tone: 'green' }
          : b === '분납실적' ? { icon: 'repeat', label: '분납', tone: 'navy' }
            : r.progress.delivered ? { icon: 'truck', label: '인도', tone: 'green' }
              : { icon: 'clipboard', label: '접수', tone: 'navy' };
  /** 접수 판의 세부검색 축 — 상품 판과 같은 두 칸 조건판 · 같은 셈(주소 칸은 i 로 시작) */
  const 접수축: [string, string, (r: SettlementRow) => string][] = [
    ['im', '접수월', (r) => String(r.receivedAt ?? '').slice(0, 7)],
    ['isup', '공급사', (r) => r.supplier ?? ''],
    ['ich', '영업채널', (r) => r.channel ?? ''],
    ['iag', '영업담당', (r) => r.agent ?? ''],
    ['ipr', '상품구분', (r) => r.product ?? ''],
    ['itask', '다음 할 일', (r) => intakeTaskOf(r)],
  ];
  const isel = Object.fromEntries(접수축.map(([a]) => [a, 고른값(sp(q[a]))])) as Record<string, string[]>;
  const i통과 = (r: SettlementRow, skip?: string) => 접수축.every(([a, , of]) => a === skip || !isel[a].length || isel[a].includes(of(r)));
  const isearched = irows.filter(진행)
    .filter((r) => !iq || [r.plate, r.customer, r.model, r.supplier, r.channel, r.agent].join(' ').toLowerCase().includes(iq));
  const ishown = sortIntakeRows(isearched.filter((r) => i통과(r)), iv as Bucket | 'all');
  const 오늘 = today();
  const 지연표시 = (r: SettlementRow) => {
    if (칸의.get(r) !== '미완료') return undefined;
    const days = intakeAgeDays(r, 오늘);
    return days === null ? '지연' : `지연 ${days}일`;
  };
  const 접수판축: FacetAxis[] = 접수축.map(([a, label, of]) => {
    const keys = a === 'im' ? [...new Set(irows.map(of).filter(Boolean))].sort().reverse() : 많은순(irows.map(of));
    const base = tallyMatch(irows, keys, (r, k) => of(r) === k);
    const live = tallyMatch(isearched.filter((r) => i통과(r, a)), keys, (r, k) => of(r) === k);
    return { key: a, label, options: standingFixed(keys, base, live).map((o) => ({ key: o.key, label: o.key, count: o.count })) };
  });
  /** 한 폼이 다른 판의 거름을 지우지 않게 — 제 칸이 아닌 주소 칸은 숨은 칸으로 들고 간다 */
  const 숨김 = (own: string[]) => Object.entries(q)
    .filter(([k, v]) => !own.includes(k) && k !== 'page' && sp(v))
    .map(([k, v]) => <input key={k} type="hidden" name={k} value={sp(v)} />);

  const car = sel?.product;
  return (
    <>
      <section className="workspace" data-phone={view} data-mode={mode}>
        {/* ── 상품 목록 — 찾기 ─────────────────────────────────── */}
        <section className="panel product-panel" data-panel-role="list">
          {/* ★틀고정 — 머리 · 검색창 · 퀵 단추는 서 있고 목록만 구른다(대표 「각 스크롤에 틀고정 될 것」) */}
          <div className="dz-listtop">
          <PanelHeader title="상품 목록" count={`${sorted.length.toLocaleString()}대`} />
          {/**
            * ★★검색은 «창 하나» — 대표 2026-09-18 「검색창이랑 검색창 안에 세부 검색되게 해주고, 그 검색창 밑에 퀵버튼 필터」
            *   ⚠ 앞서 고르기 칸 넷 + 찾기 + 지우기가 두 줄로 섰다(목업은 창 하나 + 퀵 단추 한 줄이었다).
            *   세부검색(공급사 · 기간 · 월 대여료)은 창 «안» 오른쪽 끝에서 펼친다. Enter 는 창에서 바로 찾는다.
            */}
          <div className="dz-find">
            <form className="searchbox dz-searchbox" action={base}>
              {숨김(['q', 'id', 'offer'])}
              <SearchField name="q" defaultValue={sp(q.q)} placeholder="차번 · 모델 · 공급사" />
            </form>
            {/* ★세부검색 = 화이트라벨 두 칸 조건판(창 «안» 오른쪽 끝) — 고르면 바로 걸린다 */}
            <FilterSheet axes={상품판축} count={sorted.length} unit="대" />
          </div>
          {parsedSearch.tokens.length > 0 && (
            <div className="chips dz-search-recognized" aria-label="검색에서 읽은 조건">
              {parsedSearch.tokens.map((x) => <span key={`${x.axis}:${x.key}`}>{x.label}</span>)}
            </div>
          )}
          {/**
            * ★퀵 단추는 «여섯»만 — 대표 2026-09-18 「퀵필터 그렇게까지 필요없다」
            *   ⚠ 출고상태·상품구분·혜택을 다 세웠더니 19개였다. 남긴 것은 대표가 짚은 것 —
            *     「지금 나갈 차」(즉시출고)와 「혜택조건(무심사, 21세, 경력무관)」 + 무보증.
            *   나머지(출고상태 전부 · 상품구분 · 다른 혜택)는 버리지 않고 «세부검색» 으로 옮겼다.
            *   데이터에 없는 단추는 안 세운다(지어낸 단추가 없다). 두 화면 같은 줄이다.
            */}
          <div className="quick-filters">
            <Link className={상품축이름.every(([a]) => !explicitPsel[a].length) && parsedSearch.tokens.length === 0 ? 'active' : ''}
              href={keep({ ...Object.fromEntries(상품축이름.map(([a]) => [a, ''])), q: parsedSearch.text, page: '' })}>전체</Link>
            {statuses.includes('즉시출고') && (
              <Link className={explicitPsel.status.includes('즉시출고') ? 'active' : ''} href={keep({ status: 켜끔(explicitPsel.status, '즉시출고'), page: '' })}>즉시출고</Link>
            )}
            {['무심사', '경력무관'].filter((x) => perkList.includes(x)).map((x) => (
              <Link key={x} className={explicitPsel.perk.includes(x) ? 'active' : ''} href={keep({ perk: 켜끔(explicitPsel.perk, x), page: '' })}>{x}</Link>
            ))}
            {age21Perks.length > 0 && (
              <Link className={age21Perks.every((x) => explicitPsel.perk.includes(x)) ? 'active' : ''}
                href={keep({ perk: 묶음켜끔(explicitPsel.perk, age21Perks), page: '' })}>만21세</Link>
            )}
            {hasNoDepositOffer && (
              <Link className={explicitPsel.dep.includes('d0') ? 'active' : ''}
                href={keep({ dep: 켜끔(explicitPsel.dep, 'd0'), page: '' })}>무보증</Link>
            )}
          </div>
          </div>
          <div className="list">
            {shown.map(({ product: p, lead: o }) => (
              <ListRow key={p.id} href={keep({ id: p.id, offer: o?.id ?? '', v: 'detail' })}
                selected={!!sel && p.id === sel.product.id}
                thumb={사진(p) ?? null}
                product
                title={p.vehicle.subModelId || p.vehicle.modelId || vehicleName(p) || p.id}
                badges={[txt(p.status)]}
                mainValue={o ? `월 ${Math.round(o.monthlyRent / 10000).toLocaleString('ko-KR')}만 원` : '요금 없음'}
                meta={[txt(p.registration?.vehicleNumber), txt(p.productKind)].filter((x) => x !== '—').join(' · ') || '—'}
                value={o ? `${o.termMonths}개월 · 보증 ${o.deposit ? `${Math.round(o.deposit / 10000).toLocaleString('ko-KR')}만 원` : '없음'}` : '—'} />
            ))}
            {shown.length === 0 && <EmptyState>조건에 맞는 차가 없습니다.</EmptyState>}
          </div>
        </section>

        {/* ── 상품 상세 — 확정 목업(/design) 그대로: 공유 · 요약/상세정보 · 사진 · 이름 · 요약 네 칸 · 기간 단추 · 선택 Offer · 접수 ── */}
        <section className="panel detail-panel" data-panel-role="detail">
          <PanelHeader title="상품 상세" backHref={keep({ v: 'list' })} backLabel="상품 목록으로" />
          {car ? (
            <>
              <DetailTabs key={`상세-${car.id}-${sel.matchedOfferIds.join('|')}`}
                initialOffer={sel.matchedOffers.some((x) => x.id === sp(q.offer)) ? sp(q.offer) : sel.lead?.id}
                /**
                 * ★접수하기 — 늘 켜져 있다 (대표 2026-09-18 「상품 상세가 나오는 거고 거기서 접수를 누르면
                 *   접수하기 화면으로 바로 이동」). 접수는 늘 `/intake` 한 곳에 산다 — 지금 쪽이 그 쪽(mode==='intake')이면
                 *   같은 쪽 오른쪽 판만 바꾸고(keep), 상품찾기(mode==='find')면 «다른 쪽»으로 건너간다(cross).
                 *   ⚠ keep() 은 base(`/products`)로 주소를 짓는다 — 상품찾기에서 그대로 쓰면 없는 주소가 된다.
                 */
                applyBase={mode === 'intake'
                  ? keep({ w: 'new', product: car.id, offer: '', ic: '', v: 'work' })
                  : `/intake?${new URLSearchParams({ w: 'new', product: car.id, v: 'work' })}`}
                summary={<>
                  {/* 사진 — 큰 사진 + 넘기기(erp4 상세 사진 칸). 주소는 여기서 imgSrc 로 감싸 준다 */}
                  <PhotoGallery key={`사진-${car.id}`} alt={vehicleName(car) || car.id} link={car.photoLink}
                    photos={(car.photos?.length ? car.photos : car.photoUrl ? [car.photoUrl] : []).filter((x) => x && x.trim()).map((x) => imgSrc(x)).filter((x): x is string => !!x)} />
                  <div className="vehicle-title">
                    <div>
                      <h2>{vehicleName(car) || car.id}</h2>
                      <p>{txt(car.registration?.vehicleNumber)} · {car.supplierName ?? car.supplierId}</p>
                      {!매칭끝(car.vehicle.matchLevel) && (
                        <p className="dz-note">차종 {매칭(car.vehicle.matchLevel)}{car.vehicle.matchNote ? ` — ${car.vehicle.matchNote}` : ''}</p>
                      )}
                    </div>
                    <Tag {...상품신원(txt(car.status), 'status')}>{txt(car.status)}{car.statusReason ? ` · ${car.statusReason}` : ''}</Tag>
                  </div>
                  {/* ★검색 조건이 걸렸으면 그 조건을 만족한 요금만 — 기능 쪽 규칙(S-03, matchedOffers) 그대로 */}
                  {/* ★key = 차 — 차를 바꾸면 기간 고르기를 새로 세운다.
                        ⚠ 없으면 앞 차의 고른 요금을 쥔 채 남아, 새 차에서 아무 기간도 안 켜지고 값 한 줄·접수하기가 사라졌다(실측). */}
                  <OfferPicker key={`기간-${car.id}-${sel.matchedOfferIds.join('|')}`} offers={sel.matchedOffers} initial={sp(q.offer) || sel.lead?.id}
                    perks={car.perks} perksNote={정책말(car.policyState)} />
                </>}
                info={<>
                  <div className="vehicle-title">
                    <div><h2>{vehicleName(car) || car.id}</h2><p>{txt(car.registration?.vehicleNumber)} · {car.supplierName ?? car.supplierId}</p></div>
                    <Tag {...상품신원(txt(car.status), 'status')}>{txt(car.status)}</Tag>
                  </div>
                  {/* ★상세정보 — erp4 읽는 차례로 묶었다(차량 → 대여료 → 운전자 → 보험 → 계약 → 영업 전용 → 기타) · 원자는 기능 쪽 productSections 그대로 */}
                  <ProductInfo sections={productSections(car)} offers={car.offers} />
                </>}
              />
            </>
          ) : <EmptyState>왼쪽에서 차를 고르면 여기 뜹니다.</EmptyState>}
        </section>

        {/* ── 접수 목록 — 상품 목록 판과 같은 규격 (계약접수에서만) ─────────────── */}
        {mode === 'intake' && sp(q.w) === 'new' && <section className="panel work-panel" data-panel-role="work">
          <NewIntakePanel rows={irows} productId={sp(q.product)} offerId={sp(q.offer)} back={keep({ w: '', product: '', ic: '' })} />
        </section>}
        {mode === 'intake' && sp(q.w) !== 'new' && sp(q.ic) && <section className="panel work-panel" data-panel-role="work">
          <IntakeDetailPanel code={sp(q.ic)} created={!!sp(q.created)} exists={!!sp(q.exists)} back={keep({ ic: '', created: '', exists: '' })}
            newHref={keep({ w: 'new', product: '', offer: '', ic: '', created: '', exists: '', v: 'work' })} />
        </section>}
        {mode === 'intake' && sp(q.w) !== 'new' && !sp(q.ic) && <section className="panel work-panel" data-panel-role="work">
          <div className="dz-listtop">
          <PanelHeader title="접수 목록" count={`${ishown.length.toLocaleString()}건`} />
          <div className="dz-find">
            <form className="searchbox dz-searchbox" action={base}>
              {숨김(['iq'])}
              <SearchField name="iq" defaultValue={sp(q.iq)} placeholder="고객 · 차번 · 모델 · 공급사 · 채널" />
            </form>
            <FilterSheet axes={접수판축} count={ishown.length} unit="건" />
          </div>
          <div className="quick-filters">
            <Link className={iv === 'all' ? 'active' : ''} href={keep({ iv: 'all' })}>전체</Link>
            {BUCKETS.map((b) => (
              <Link key={b} className={`${iv === b ? 'active' : ''}${b === '미완료' && 칸수[b] ? ' warn' : ''}`}
                href={keep({ iv: b === '당월접수' ? '' : b })}>{b} <small>{칸수[b]}</small></Link>
            ))}
          </div>
          </div>
          {intakeErr ? <EmptyState>ERP5 접수를 못 읽었습니다 — {intakeErr}</EmptyState> : (
            <div className="list">
              {ishown.map((r, i) => (
                <ListRow key={`${r.plate ?? '차번없음'}-${r.receivedAt}-${i}`}
                  href={keep({ ic: r.id, w: '', v: 'work' })} status={접수상태(r, 칸의.get(r))}
                  title={txt(r.customer)} mainValue={r.rent ? `월 ${Math.round(r.rent / 10000).toLocaleString('ko-KR')}만 원` : '—'}
                  badge={r.progress.cancelled ? '취소' : (blockOf(r) ?? '끝')}
                  tone={칸의.get(r) === '미완료' ? 'warn' : !r.progress.cancelled && blockOf(r) ? 'act' : 'plain'}
                  flag={지연표시(r)}
                  meta={[r.plate, r.model, r.product, r.term ? `${r.term}개월` : ''].filter(Boolean).join(' · ') || '—'}
                  value={`청구 ${r.money.claim === null ? '—' : `${won(r.money.claim)}원`} · 지급 ${r.money.pay === null ? '—' : `${won(r.money.pay)}원`}`} />
              ))}
              {ishown.length === 0 && <EmptyState>조건에 맞는 접수가 없습니다.</EmptyState>}
            </div>
          )}
          {/* ★하단바 — 접수 목록에서는 [+ 신규 접수] 하나(대표 2026-09-18 「신규접수 버튼도 하단으로 옮기는 게 맞지 않나」)
                누르면 같은 자리에 [취소] [접수 저장] 이 선다 — 판이 바뀌면 바도 따라 바뀐다 */}
          <ActionBar>
            <Link className="primary" href={keep({ w: 'new', product: '', offer: '', ic: '', v: 'work' })}>+ 신규 접수</Link>
          </ActionBar>
        </section>}
      </section>

    </>
  );
}
