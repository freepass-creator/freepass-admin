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
import { lead, STATUS_ORDER } from '../products/workspace-config';
import { bucketOf, type Bucket } from '../../domain/settlement/stage';
import { sortIntakeRows } from '../../domain/settlement/intake-list';
import { sp, txt } from '../_fn/fmt';
import {
  Badge, hrefWith, Panel, PanelBody, PanelFoot, PanelHead, QuickFilter, RowCard, RowCards, Screen, SearchBar, Tile, TileGroup, won0, type Tone,
} from './parts';

type Q = Record<string, string | string[] | undefined>;
const carName = (p: CanonicalProduct) => p.vehicle.subModelId || p.vehicle.modelId;
const STATUS_TONE: Record<string, Tone> = { 즉시출고: 'ok', 출고가능: 'info', 출고협의: 'warn', 출고불가: 'err' };
const INTAKE_TONE: Record<Bucket, Tone> = { 당월접수: 'info', 미완료: 'warn', 분납실적: 'neutral', 완납실적: 'ok', 취소: 'err' };
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
  const base = '/intake';

  let products: CanonicalProduct[];
  try { products = (await productList()).rows; }
  catch { products = []; }
  const text = sp(q.pq).trim().toLowerCase();
  const pst = sp(q.pst);
  const all = products
    .filter((p) => !text || [carName(p), p.registration?.vehicleNumber, p.supplierName ?? p.supplierId].filter(Boolean).join(' ').toLowerCase().includes(text))
    .filter((p) => lead(p.offers))
    .map((p) => ({ p, offer: lead(p.offers)! }))
    .sort((a, b) => (STATUS_ORDER[a.p.status ?? ''] ?? 9) - (STATUS_ORDER[b.p.status ?? ''] ?? 9) || a.offer.monthlyRent - b.offer.monthlyRent);
  const readyCount = all.filter((h) => h.p.status === '즉시출고').length;
  const hits = pst ? all.filter((h) => h.p.status === pst) : all;
  const selId = sp(q.id);
  const sel = hits.find((h) => h.p.id === selId) ?? hits[0];
  const selOffers = sel ? sel.p.offers.slice().sort((a, b) => a.termMonths - b.termMonths) : [];
  const selOffer = sel ? (selOffers.find((o) => o.id === sp(q.offer)) ?? sel.offer) : undefined;

  let intake: Awaited<ReturnType<typeof settlements.list>>;
  try { intake = await settlements.list(); }
  catch { intake = []; }
  const rows = intake.map((x) => x.row);
  const now = new Date(`${today()}T12:00:00+09:00`);
  const itext = sp(q.wiq).trim().toLowerCase();
  const iBucket = sp(q.wiv);
  const iSearched = rows.filter((r) => !itext || [r.customer, r.plate, r.model, r.supplier].join(' ').toLowerCase().includes(itext));
  const thisMonthCount = iSearched.filter((r) => bucketOf(r, now) === '당월접수').length;
  const iShown = sortIntakeRows(iBucket ? iSearched.filter((r) => bucketOf(r, now) === iBucket) : iSearched, iBucket ? (iBucket as Bucket) : '당월접수');

  return (
    <Screen name="intake-workspace">
    <div className="sbs-main">
      <Panel compact>
        <PanelHead kind="목록" title="상품찾기" count={`전체 ${hits.length}건`} />
        <SearchBar base={base} q={q} name="pq" placeholder="차량번호 · 차명 · 공급사" keep={['id', 'offer', 'pst']} />
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
                amount={won0(offer.monthlyRent)} amountLabel="원/월" />
            ))}
          </RowCards>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead kind="상세내용" title={sel ? `${txt(sel.p.registration?.vehicleNumber)} ${carName(sel.p)}` : '상품상세'} count="고른 상품" />
        <PanelBody>
          {sel ? (
            <div className="sv-detail-body">
              <div className="sv-car-card erp-tile">
                <div className="photo"><CarIcon /></div>
                <div className="sv-detail-info">
                  <h2 className="name">{carName(sel.p)} {sel.p.status ? <Badge tone={STATUS_TONE[sel.p.status] ?? 'neutral'}>{sel.p.status}</Badge> : null}</h2>
                  <p className="sub"><b>{txt(sel.p.registration?.vehicleNumber)}</b>{txt(sel.p.vehicle.manufacturerId)} · {txt(sel.p.supplierName ?? sel.p.supplierId)}</p>
                  <p className="sv-car-line">{sel.p.specs.modelYear ?? '—'}식 · {typeof sel.p.specs.mileageKm === 'number' ? `${sel.p.specs.mileageKm.toLocaleString('ko-KR')}km` : '—'} · {txt(sel.p.extColor)} · {txt(sel.p.productKind)}</p>
                </div>
              </div>

              <div className="sv-terms-main">
                <p className="sv-section-title sv-section-title--main">대여료</p>
                <TileGroup>
                  {selOffers.map((o) => (
                    <Tile key={o.id} href={hrefWith(base, q, { offer: o.id })} pressed={selOffer?.id === o.id}
                      lede={`${o.termMonths}개월`} figure={`${won0(o.monthlyRent)}원`}
                      note={o.deposit ? `보증금 ${won0(o.deposit)}원` : '보증금 없음'} />
                  ))}
                </TileGroup>
              </div>

              {(sel.p.perks ?? []).length ? (
                <div className="sv-staff-ref">
                  <p className="sv-section-title">담당자 참고</p>
                  <div className="sv-ref-list erp-tile-group">
                    <div className="sv-ref-card erp-tile">
                      <h3 className="sv-ref-card-title erp-tile-title">우대조건 · 정책</h3>
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
            ? <Link className="erp-btn erp-btn--primary" href={`/intake?w=new&product=${encodeURIComponent(sel.p.id)}&offer=${encodeURIComponent(selOffer.id)}`}>접수하기</Link>
            : <span className="erp-btn erp-btn--primary" aria-disabled="true">접수하기</span>}
        </PanelFoot>
      </Panel>

      <Panel compact>
        <PanelHead kind="목록" title="접수목록" count={`전체 ${iSearched.length}건`} />
        <SearchBar base={base} q={q} name="wiq" placeholder="고객 · 차번 · 공급사" keep={['wiv']} />
        <QuickFilter label="퀵 필터" items={[
          { key: 'all', label: `전체 ${iSearched.length}`, href: hrefWith(base, q, { wiv: null }), on: !iBucket },
          { key: '당월접수', label: `당월접수 ${thisMonthCount}`, href: hrefWith(base, q, { wiv: '당월접수' }), on: iBucket === '당월접수' },
        ]} />
        <PanelBody>
          <RowCards label="접수 목록">
            {iShown.slice(0, 40).map((r) => {
              const b = bucketOf(r, now);
              return (
                <RowCard key={r.id} href={`/intake?ic=${encodeURIComponent(r.id)}`} tone={INTAKE_TONE[b]}
                  thumb={<><StatusIcon b={b} /><span>{INTAKE_SHORT[b]}</span></>} thumbStatus
                  title={txt(r.customer)} badge={<Badge tone={INTAKE_TONE[b]}>{b}</Badge>}
                  plate={txt(r.plate)} car={txt(r.model)}
                  facts={[['공급사', txt(r.supplier)], ['상품 · 기간', `${txt(r.product)} · ${r.term ?? '—'}개월`]]}
                  amount={won0(r.rent)} amountLabel="원/월" />
              );
            })}
          </RowCards>
        </PanelBody>
      </Panel>
    </div>
    </Screen>
  );
}
