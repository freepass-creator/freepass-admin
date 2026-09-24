/**
 * PC 계약접수 — 판 셋: 상품목록 | 상품상세 | 접수목록. ai-core `design/erp-standard/reference/side-by-side.html`
 *   레퍼런스를 새로 설계하지 않고 그대로 옮겨, 실제 데이터 · 기능만 그 자리에 맞춘다(대표 2026-09-24 「아까
 *   패널 세로 패널 가로로 하나 하나 하나 있는 거 그걸로 만들었잖아 근데 왜 자꾸 새로이 설계를 하냐고 거기에
 *   그 UI에다가 내용 기능을 맞춰야지」). 아이콘 · 퀵 필터 · 검색창 · 담당자 참고 카드까지 레퍼런스의 마크업
 *   구조를 그대로 따른다 — `/intake/page.tsx` 자신의 주석 「판 셋: 상품 목록 | 상품 상세 | 접수 목록」이
 *   가리키는 화면이 이거다. 접수 상세(?ic=) · 신규 접수 폼(?w=new)은 그대로 IntakeScreen 이 맡는다 — 여기는
 *   이 화면 자신의 쿼리만 있을 때 서는 기본 landing 이다.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { productList, settlements, today } from '../../server/erp5';
import type { CanonicalProduct } from '../../domain/product/types';
import { lead, STATUS_ORDER, 많은순 } from '../products/workspace-config';
import { standingFixed, tallyMatch } from '../_design/facet-standing';
import { FilterSheet, type FacetAxis } from '../_design/FilterSheet';
import { 고른값 } from '../_design/pick';
import { BUCKETS, bucketOf, type Bucket } from '../../domain/settlement/stage';
import { sortIntakeRows } from '../../domain/settlement/intake-list';
import { marginOf } from '../../domain/settlement/money';
import type { SettlementRow } from '../../domain/settlement/types';
import { NewIntakePanel } from '../intake/panels';
import { writeEnabled } from '../../adapters/erp5/settlement-repository';
import { sp, txt } from '../_fn/fmt';
import { SettlementDetail } from './SettlementDetail';
import {
  Badge, hrefWith, Panel, PanelBody, PanelFoot, PanelHead, QuickFilter, RowCard, RowCards, Screen, SearchBar, Tile, TileGroup, won0, type Tone,
} from './parts';

type Q = Record<string, string | string[] | undefined>;
const carName = (p: CanonicalProduct) => p.vehicle.subModelId || p.vehicle.modelId;
const STATUS_TONE: Record<string, Tone> = { 즉시출고: 'ok', 출고가능: 'info', 출고협의: 'warn', 출고불가: 'err' };
const INTAKE_TONE: Record<Bucket, Tone> = { 당월접수: 'info', 미완료: 'warn', 분납실적: 'neutral', 완납실적: 'ok', 취소: 'err' };
const 실적칸: Bucket[] = ['분납실적', '완납실적'];
const IPAGE = 15;
/** 44px 정사각 썸네일 안 보조 글씨 — §5-4 규격대로 「당월」·「미완」처럼 짧은 두 글자만 쓴다. */
const INTAKE_SHORT: Record<Bucket, string> = { 당월접수: '당월', 미완료: '미완', 완납실적: '완납', 분납실적: '분납', 취소: '취소' };

/** 차 아이콘 — ai-core 레퍼런스 side-by-side.html 의 svg path 그대로(새로 그리지 않는다). */
function CarIcon() {
  return (
    <svg viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M8 42h104M14 42l6-14c2-5 6-8 12-9l22-3c8-1 16 1 22 6l12 10 14 3c4 1 6 4 6 7M30 42a8 8 0 1 0 16 0M78 42a8 8 0 1 0 16 0M40 20l4 14h24l-6-15" />
    </svg>
  );
}
/** 접수 상태 썸네일 아이콘 — 레퍼런스는 당월(반짝임) · 미완(시계) 둘만 그렸다. 완납/분납/취소는 같은
 *  획 규칙(24 격자 · 획 없이 stroke)으로 새 상태에 맞춰 하나씩 늘린다(레퍼런스 주석의 안내 그대로). */
const INTAKE_ICON_PATH: Record<Bucket, ReactNode> = {
  당월접수: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />,
  완납실적: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />,
  미완료: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 2" /></>,
  분납실적: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 2" /></>,
  취소: <><circle cx="12" cy="12" r="8" /><path d="m9 9 6 6M15 9l-6 6" /></>,
};
function StatusIcon({ b }: { b: Bucket }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{INTAKE_ICON_PATH[b]}</svg>;
}

export async function WorkspaceScreen({ q }: { q: Q }) {
  if (sp(q.wiv) === '실적') return <PerformanceWorkspace q={q} />;
  return <IntakeWorkspace q={q} />;
}

async function IntakeWorkspace({ q }: { q: Q }) {
  const base = '/intake';

  let products: CanonicalProduct[];
  try { products = (await productList()).rows; }
  catch { products = []; }
  const text = sp(q.pq).trim().toLowerCase();
  const pst = sp(q.pst);
  /*
   * 상세 필터 — 접수목록과 같은 규칙(FilterSheet · facet-standing · 많은순, §5-1 「검색창 옆에는
   * 필터 버튼」). 상품찾기도 목록 판이니 똑같이 공급사 · 상품구분 두 축을 고른다(대표 2026-09-24
   * 「목록 카드는 … 왜 규격화를 안 하고 자꾸 맘대로 만드냐」).
   */
  const 상품축: [string, string, (p: CanonicalProduct) => string][] = [
    ['psup', '공급사', (p) => p.supplierName ?? p.supplierId ?? ''],
    ['pkind', '상품구분', (p) => p.productKind ?? ''],
  ];
  const pSel = Object.fromEntries(상품축.map(([a]) => [a, 고른값(sp(q[a]))])) as Record<string, string[]>;
  const p통과 = (p: CanonicalProduct, skip?: string) => 상품축.every(([a, , of]) => a === skip || !pSel[a].length || pSel[a].includes(of(p)));
  const textFiltered = products
    .filter((p) => !text || [carName(p), p.registration?.vehicleNumber, p.supplierName ?? p.supplierId].filter(Boolean).join(' ').toLowerCase().includes(text))
    .filter((p) => lead(p.offers))
    .map((p) => ({ p, offer: lead(p.offers)! }));
  const all = textFiltered
    .filter((h) => p통과(h.p))
    .sort((a, b) => (STATUS_ORDER[a.p.status ?? ''] ?? 9) - (STATUS_ORDER[b.p.status ?? ''] ?? 9) || a.offer.monthlyRent - b.offer.monthlyRent);
  const readyCount = all.filter((h) => h.p.status === '즉시출고').length;
  const hits = pst ? all.filter((h) => h.p.status === pst) : all;
  const 상품전체 = products.filter((p) => lead(p.offers));
  const 상품판축: FacetAxis[] = 상품축.map(([a, label, of]) => {
    const keys = 많은순(상품전체.map(of));
    const base = tallyMatch(상품전체, keys, (p, k) => of(p) === k);
    const live = tallyMatch(textFiltered.map((h) => h.p).filter((p) => p통과(p, a)), keys, (p, k) => of(p) === k);
    return { key: a, label, options: standingFixed(keys, base, live).map((o) => ({ key: o.key, label: o.key, count: o.count })) };
  });
  const selId = sp(q.id);
  const sel = hits.find((h) => h.p.id === selId) ?? hits[0];
  const selOffers = sel ? sel.p.offers.slice().sort((a, b) => a.termMonths - b.termMonths) : [];
  const selOffer = sel ? (selOffers.find((o) => o.id === sp(q.offer)) ?? sel.offer) : undefined;

  let intake: Awaited<ReturnType<typeof settlements.list>>;
  try { intake = await settlements.list(); }
  catch { intake = []; }
  const rows = intake.map((x) => x.row);
  const now = new Date(`${today()}T12:00:00+09:00`);
  /*
   * 접수목록(3번째 판) — 「상품 찾기 말고는 다 세개 패널로」(대표 2026-09-24) — 예전 IntakeScreen 단독
   * 훑어보기 화면(전체 조회조건 · 상태 탭 · 페이지네이션)을 이 판 하나로 합친다. 판이 compact 라
   * erp-panel--compact CSS 가 카드의 facts · steps 는 이미 숨긴다 — 여기 남는 차이는 금액 뿐이다.
   */
  const itext = sp(q.wiq).trim().toLowerCase();
  const iv = (BUCKETS as string[]).includes(sp(q.wiv)) || sp(q.wiv) === 'all' ? sp(q.wiv) : '당월접수';
  const perfView = 실적칸.includes(iv as Bucket);
  /*
   * 상세 필터 — 화이트라벨·레트로의 두 칸 조건판(FilterSheet, §5-1 「검색창 옆에는 필터 버튼」)을
   * 그대로 쓴다(대표 2026-09-24 「필터는 화이트 라벨 열리는 방식 있잖아 … 좌측에 항목 있고 그 항목
   * 누르면 체크박스」) — 새로 짓지 않고 ProductWorkspace 가 이미 쓰는 규칙(facet-standing · 많은순)
   * 그대로 옮긴다. 여러 값을 고르는 축이라 단일값 대신 고른값(콤마 조인)으로 받는다.
   */
  const 접수축: [string, string, (r: SettlementRow) => string][] = [
    ['wisup', '공급사', (r) => r.supplier ?? ''],
    ['wich', '영업채널', (r) => r.channel ?? ''],
  ];
  const iSel = Object.fromEntries(접수축.map(([a]) => [a, 고른값(sp(q[a]))])) as Record<string, string[]>;
  const i통과 = (r: SettlementRow, skip?: string) => 접수축.every(([a, , of]) => a === skip || !iSel[a].length || iSel[a].includes(of(r)));
  const iTextSearched = rows.filter((r) => !itext || [r.customer, r.plate, r.model, r.supplier, r.channel, r.agent].join(' ').toLowerCase().includes(itext));
  const iSearched = iTextSearched.filter((r) => i통과(r));
  const iInView = (r: SettlementRow) => iv === 'all' || bucketOf(r, now) === iv;
  const iShown = sortIntakeRows(iSearched.filter(iInView), iv as Bucket | 'all');
  const ipage = Math.max(1, Number(sp(q.wpage)) || 1);
  const ipages = Math.max(1, Math.ceil(iShown.length / IPAGE));
  const islice = iShown.slice((ipage - 1) * IPAGE, ipage * IPAGE);
  const iCount = (b: Bucket) => iSearched.filter((r) => bucketOf(r, now) === b).length;
  const 접수판축: FacetAxis[] = 접수축.map(([a, label, of]) => {
    const keys = 많은순(rows.map(of));
    const base = tallyMatch(rows, keys, (r, k) => of(r) === k);
    const live = tallyMatch(iTextSearched.filter((r) => i통과(r, a)), keys, (r, k) => of(r) === k);
    return { key: a, label, options: standingFixed(keys, base, live).map((o) => ({ key: o.key, label: o.key, count: o.count })) };
  });
  const iTitle = perfView ? '실적' : '접수목록';

  /*
   * 가운데 판 — 상품상세 ↔ 접수상세 ↔ 입력·저장(신규접수 폼) 셋 중 하나로 등힌다(erp-panel--flip, §5-4).
   * 접수목록에서 줄을 클릭(?ic=)하거나 상품상세에서 접수하기(?w=new)를 눌러도 이 3패널 화면을 벗어나지
   * 않는다(대표 2026-09-24 「그 패널이 어딘가엔 두 개, 어딘가에는 세개 이렇게 들어갈 수 있는 거야」).
   */
  const icId = sp(q.ic);
  const cur = icId ? rows.find((r) => r.id === icId) : undefined;
  const newMode = !cur && sp(q.w) === 'new';

  return (
    <Screen name="intake-workspace">
    <div className="erp-workspace">
      <Panel compact>
        <PanelHead kind="목록" title="상품찾기" count={`전체 ${hits.length}건`} />
        <SearchBar base={base} q={q} name="pq" placeholder="차량번호 · 차명 · 공급사" keep={['id', 'offer', 'pst']}
          filter={<FilterSheet axes={상품판축} count={hits.length} unit="대" label="필터" />} />
        <QuickFilter label="퀵 필터" items={[
          { key: 'all', label: `전체 ${all.length}`, href: hrefWith(base, q, { pst: null, id: null }), on: !pst },
          { key: 'ready', label: `즉시출고 ${readyCount}`, href: hrefWith(base, q, { pst: '즉시출고', id: null }), on: pst === '즉시출고' },
        ]} />
        <PanelBody>
          <RowCards label="상품 목록">
            {hits.map(({ p, offer }) => (
              <RowCard key={p.id} href={hrefWith(base, q, { id: p.id, offer: offer.id })} current={sel?.p.id === p.id}
                tone={STATUS_TONE[p.status ?? ''] ?? 'neutral'} thumb={<CarIcon />}
                title={carName(p)} badge={p.status ? <Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{p.status}</Badge> : null}
                plate={txt(p.registration?.vehicleNumber)} car={`${txt(p.vehicle.manufacturerId)} · ${txt(p.supplierName ?? p.supplierId)}`}
                facts={[['상품구분', txt(p.productKind)], ['기간', `${offer.termMonths}개월`]]}
                amount={won0(offer.monthlyRent)} unit="원/월" />
            ))}
          </RowCards>
        </PanelBody>
      </Panel>

      <Panel flip={!!cur || newMode}>
        {cur ? (
          <SettlementDetail cur={cur} base={base} q={q} now={now} />
        ) : newMode ? (
          <>
            <PanelHead kind="입력" title="접수 내용" count={writeEnabled() ? '저장 가능' : '저장 꺼짐'} />
            <PanelBody>
              <div className="erp-embed">
                <NewIntakePanel rows={rows} productId={sp(q.product)} offerId={sp(q.offer)} back={hrefWith(base, q, { w: null, product: null, offer: null })} hideHeader />
              </div>
            </PanelBody>
          </>
        ) : (
          <>
            <PanelHead kind="상세내용" title={sel ? `${txt(sel.p.registration?.vehicleNumber)} ${carName(sel.p)}` : '상품상세'} count="고른 상품" />
            <PanelBody>
              {sel ? (
                <div className="erp-detail-body">
                  <div className="erp-hero-tile erp-tile">
                    <div className="photo"><CarIcon /></div>
                    <div className="erp-hero-info">
                      <h2 className="name">{carName(sel.p)} {sel.p.status ? <Badge tone={STATUS_TONE[sel.p.status] ?? 'neutral'}>{sel.p.status}</Badge> : null}</h2>
                      <p className="sub"><b>{txt(sel.p.registration?.vehicleNumber)}</b>{txt(sel.p.vehicle.manufacturerId)} · {txt(sel.p.supplierName ?? sel.p.supplierId)}</p>
                      <p className="erp-hero-line">{sel.p.specs.modelYear ?? '—'}식 · {typeof sel.p.specs.mileageKm === 'number' ? `${sel.p.specs.mileageKm.toLocaleString('ko-KR')}km` : '—'} · {txt(sel.p.extColor)} · {txt(sel.p.productKind)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="erp-subtitle erp-subtitle--lead">대여료</p>
                    <TileGroup>
                      {selOffers.map((o) => (
                        <Tile key={o.id} href={hrefWith(base, q, { offer: o.id })} pressed={selOffer?.id === o.id}
                          lede={`${o.termMonths}개월`} figure={`${won0(o.monthlyRent)}원`}
                          note={o.deposit ? `보증금 ${won0(o.deposit)}원` : '보증금 없음'} />
                      ))}
                    </TileGroup>
                  </div>

                  {(sel.p.perks ?? []).length ? (
                    <div>
                      <p className="erp-subtitle">담당자 참고</p>
                      <div className="erp-tile-group">
                        <div className="erp-info-card erp-tile">
                          <h3 className="erp-tile-title">우대조건 · 정책</h3>
                          <dl>
                            <div><dt>우대조건</dt><dd><span className="erp-tags">{(sel.p.perks ?? []).map((k) => <span key={k} className="erp-tag erp-tag--primary">{k}</span>)}</span></dd></div>
                            <div><dt>공급사</dt><dd>{txt(sel.p.supplierName ?? sel.p.supplierId)}</dd></div>
                          </dl>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : <p className="erp-muted">왼쪽에서 상품을 고르세요.</p>}
            </PanelBody>
            <PanelFoot>
              {sel && selOffer
                ? <Link className="erp-btn erp-btn--primary" href={hrefWith(base, q, { w: 'new', product: sel.p.id, offer: selOffer.id, ic: null })}>접수하기</Link>
                : <span className="erp-btn erp-btn--primary" aria-disabled="true">접수하기</span>}
            </PanelFoot>
          </>
        )}
      </Panel>

      <Panel compact>
        <PanelHead kind="목록" title={iTitle} count={`전체 ${iShown.length}건`} />
        <SearchBar base={base} q={q} name="wiq" placeholder="고객 · 차번 · 모델 · 공급사 · 담당" keep={['wiv']}
          filter={<FilterSheet axes={접수판축} count={iShown.length} unit="건" label="필터" />} />
        <QuickFilter label="접수 칸" items={[
          { key: 'all', label: `전체 ${iSearched.length}`, href: hrefWith(base, q, { wiv: 'all', wpage: null }), on: iv === 'all' },
          ...BUCKETS.map((b) => ({ key: b, label: `${b} ${iCount(b)}`, href: hrefWith(base, q, { wiv: b === '당월접수' ? null : b, wpage: null }), on: iv === b })),
        ]} />
        <PanelBody>
          <RowCards label={`${iTitle} 목록`}>
            {islice.map((r) => {
              const b = bucketOf(r, now);
              return (
                <RowCard key={r.id} href={hrefWith(base, q, { ic: r.id, w: null })} current={cur?.id === r.id} tone={INTAKE_TONE[b]}
                  thumb={<><StatusIcon b={b} /><span>{INTAKE_SHORT[b]}</span></>} thumbStatus
                  title={txt(r.customer)} badge={<Badge tone={INTAKE_TONE[b]}>{b}</Badge>}
                  plate={txt(r.plate)} car={txt(r.model)}
                  facts={[['공급사', txt(r.supplier)], ['상품 · 기간', `${txt(r.product)} · ${r.term ?? '—'}개월`]]}
                  amount={won0(perfView ? marginOf(r, now) : r.rent)}
                  {...(perfView ? { amountLabel: '남는 것' } : { unit: '원/월' })} />
              );
            })}
          </RowCards>
        </PanelBody>
        <PanelFoot>
          <span>총 <b>{iShown.length}</b>건</span>
          <nav className="erp-pager" aria-label="페이지">
            {Array.from({ length: ipages }, (_, i) => i + 1).map((k) => (
              <Link key={k} href={hrefWith(base, q, { wpage: String(k) })} aria-current={k === ipage ? 'page' : undefined}>{k}</Link>
            ))}
          </nav>
        </PanelFoot>
      </Panel>
    </div>
    </Screen>
  );
}

/**
 * PC 실적 — 판 셋: 분납실적 | 실적상세 | 완납실적 (대표 2026-09-24 「실적은 분납실적과 완납실적이 있어
 *   … 맨 왼쪽에 분납실적이 있고 맨 오른쪽에 완납실적이 있는 거야 … 가운데에는 … 실적 상세가 있으면 돼」
 *   — 접수목록(§5-4 3패널)의 실적 칸 필터 하나로는 부족했다: 실적은 분납·완납 두 칸이 늘 같이 보여야
 *   하는 화면이라, 계약접수와는 다른 배열의 자기 판 셋을 쓴다). 실적상세는 접수상세와 같은 부품
 *   (SettlementDetail)을 그대로 쓴다 — 새 판이 아니라 같은 대상의 같은 상세다.
 */
async function PerformanceWorkspace({ q }: { q: Q }) {
  const base = '/intake';
  let intake: Awaited<ReturnType<typeof settlements.list>>;
  try { intake = await settlements.list(); }
  catch { intake = []; }
  const rows = intake.map((x) => x.row);
  const now = new Date(`${today()}T12:00:00+09:00`);
  const itext = sp(q.wiq).trim().toLowerCase();
  const searched = rows.filter((r) => !itext || [r.customer, r.plate, r.model, r.supplier, r.channel, r.agent].join(' ').toLowerCase().includes(itext));
  const icId = sp(q.ic);
  const cur = icId ? rows.find((r) => r.id === icId) : undefined;

  /*
   * 목록 판 규격 — 검색창(+필터 버튼) → 퀵 필터 → 목록, 예외 없이(대표 2026-09-24 「목록 카드는 …
   * 왜 규격화를 안 하고 자꾸 맘대로 만드냐」). 분납·완납은 늘 같이 보여야 해서 필터 축 이름(dsup/dch ·
   * fsup/fch)과 확인 필요 퀵 필터(dqs/fqs)를 각자 따로 둔다 — 한쪽에서 골라도 다른 쪽이 안 바뀐다.
   */
  const 실적문제 = (r: SettlementRow) => r.progress.billHold || r.claimStage === '정정' || r.payStage === '정정';
  const dAxis: [string, string, (r: SettlementRow) => string][] = [['dsup', '공급사', (r) => r.supplier ?? ''], ['dch', '영업채널', (r) => r.channel ?? '']];
  const fAxis: [string, string, (r: SettlementRow) => string][] = [['fsup', '공급사', (r) => r.supplier ?? ''], ['fch', '영업채널', (r) => r.channel ?? '']];
  const dSel = Object.fromEntries(dAxis.map(([a]) => [a, 고른값(sp(q[a]))])) as Record<string, string[]>;
  const fSel = Object.fromEntries(fAxis.map(([a]) => [a, 고른값(sp(q[a]))])) as Record<string, string[]>;
  const d통과 = (r: SettlementRow, skip?: string) => dAxis.every(([a, , of]) => a === skip || !dSel[a].length || dSel[a].includes(of(r)));
  const f통과 = (r: SettlementRow, skip?: string) => fAxis.every(([a, , of]) => a === skip || !fSel[a].length || fSel[a].includes(of(r)));
  const dqs = sp(q.dqs) === 'issue' ? 'issue' : 'all';
  const fqs = sp(q.fqs) === 'issue' ? 'issue' : 'all';

  const 분납전체 = sortIntakeRows(searched.filter((r) => bucketOf(r, now) === '분납실적'), '분납실적').filter((r) => d통과(r));
  const 완납전체 = sortIntakeRows(searched.filter((r) => bucketOf(r, now) === '완납실적'), '완납실적').filter((r) => f통과(r));
  const dIssueCount = 분납전체.filter(실적문제).length;
  const fIssueCount = 완납전체.filter(실적문제).length;
  const 분납 = dqs === 'issue' ? 분납전체.filter(실적문제) : 분납전체;
  const 완납 = fqs === 'issue' ? 완납전체.filter(실적문제) : 완납전체;

  const dFacets: FacetAxis[] = dAxis.map(([a, label, of]) => {
    const universe = sortIntakeRows(searched.filter((r) => bucketOf(r, now) === '분납실적'), '분납실적');
    const keys = 많은순(universe.map(of));
    const base = tallyMatch(universe, keys, (r, k) => of(r) === k);
    const live = tallyMatch(universe.filter((r) => d통과(r, a)), keys, (r, k) => of(r) === k);
    return { key: a, label, options: standingFixed(keys, base, live).map((o) => ({ key: o.key, label: o.key, count: o.count })) };
  });
  const fFacets: FacetAxis[] = fAxis.map(([a, label, of]) => {
    const universe = sortIntakeRows(searched.filter((r) => bucketOf(r, now) === '완납실적'), '완납실적');
    const keys = 많은순(universe.map(of));
    const base = tallyMatch(universe, keys, (r, k) => of(r) === k);
    const live = tallyMatch(universe.filter((r) => f통과(r, a)), keys, (r, k) => of(r) === k);
    return { key: a, label, options: standingFixed(keys, base, live).map((o) => ({ key: o.key, label: o.key, count: o.count })) };
  });

  const list = (title: string, items: SettlementRow[], b: Bucket) => (
    <RowCards label={`${title} 목록`}>
      {items.map((r) => (
        <RowCard key={r.id} href={hrefWith(base, q, { ic: r.id })} current={cur?.id === r.id} tone={INTAKE_TONE[b]}
          thumb={<><StatusIcon b={b} /><span>{INTAKE_SHORT[b]}</span></>} thumbStatus
          title={txt(r.customer)} badge={<Badge tone={INTAKE_TONE[b]}>{b}</Badge>}
          plate={txt(r.plate)} car={txt(r.model)}
          facts={[['공급사', txt(r.supplier)], ['상품 · 기간', `${txt(r.product)} · ${r.term ?? '—'}개월`]]}
          amount={won0(marginOf(r, now))} amountLabel="남는 것" />
      ))}
    </RowCards>
  );

  return (
    <Screen name="performance-workspace">
    <div className="erp-workspace">
      <Panel compact>
        <PanelHead kind="목록" title="분납실적" count={`전체 ${분납.length}건`} />
        <SearchBar base={base} q={q} name="wiq" placeholder="고객 · 차번 · 모델 · 공급사 · 담당" keep={['wiv', 'dqs']}
          filter={<FilterSheet axes={dFacets} count={분납.length} unit="건" label="필터" />} />
        <QuickFilter label="확인 필요" items={[
          { key: 'all', label: `전체 ${분납전체.length}`, href: hrefWith(base, q, { dqs: null }), on: dqs === 'all' },
          { key: 'issue', label: `확인필요 ${dIssueCount}`, href: hrefWith(base, q, { dqs: 'issue' }), on: dqs === 'issue' },
        ]} />
        <PanelBody>{list('분납실적', 분납, '분납실적')}</PanelBody>
      </Panel>

      <Panel>
        {cur ? (
          <SettlementDetail cur={cur} base={base} q={q} now={now} />
        ) : (
          <>
            <PanelHead kind="상세내용" title="실적상세" count="고른 실적" />
            <PanelBody><p className="erp-muted">왼쪽 · 오른쪽에서 실적을 고르세요.</p></PanelBody>
          </>
        )}
      </Panel>

      <Panel compact>
        <PanelHead kind="목록" title="완납실적" count={`전체 ${완납.length}건`} />
        <SearchBar base={base} q={q} name="wiq" placeholder="고객 · 차번 · 모델 · 공급사 · 담당" keep={['wiv', 'fqs']}
          filter={<FilterSheet axes={fFacets} count={완납.length} unit="건" label="필터" />} />
        <QuickFilter label="확인 필요" items={[
          { key: 'all', label: `전체 ${완납전체.length}`, href: hrefWith(base, q, { fqs: null }), on: fqs === 'all' },
          { key: 'issue', label: `확인필요 ${fIssueCount}`, href: hrefWith(base, q, { fqs: 'issue' }), on: fqs === 'issue' },
        ]} />
        <PanelBody>{list('완납실적', 완납, '완납실적')}</PanelBody>
      </Panel>
    </div>
    </Screen>
  );
}
