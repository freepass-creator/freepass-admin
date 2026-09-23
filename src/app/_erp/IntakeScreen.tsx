/**
 * PC 계약접수 · 실적 — 규격 `platform/contracts.html`(목록) · `platform/contract-detail.html`(상세) 구성 그대로
 *   목록: ④ 헤더 → ⑤ KPI → [⑥ 조회조건 · ⑦ 상태 탭 · 그리드 · 바닥] 한 카드.
 *   상세(?ic=): ④ 헤더(고객 + 상태 뱃지) → 진행 단계 카드 → 2단(왼쪽 고객 · 차량 · 조건 · 금액 / 오른쪽 처리).
 *   실적은 따로 판이 없다 — 실적 칸(분납실적 · 완납실적)을 고르면 같은 판이 «실적» 이 되고 금액 열이 선다(대표 2026-09-23).
 *   처리(저장 · 인도 · 취소 …)는 기능 쪽 IntakeDetailPanel 을 그대로 쓴다 — 업무 규칙을 새로 짜지 않는다.
 */
import Link from 'next/link';
import { settlements, today } from '../../server/erp5';
import type { SettlementRow } from '../../domain/settlement/types';
import { BUCKETS, bucketOf, type Bucket } from '../../domain/settlement/stage';
import { claimAmountOf, marginOf, payAmountOf } from '../../domain/settlement/money';
import { sortIntakeRows } from '../../domain/settlement/intake-list';
import { sp, txt } from '../_fn/fmt';
import { IntakeDetailPanel, NewIntakePanel } from '../intake/panels';
import { Badge, CardHead, Field, hrefWith, Kpis, PageHeader, Props, Screen, Seg, Select, Steps, won0, type Tone } from './parts';

type Q = Record<string, string | string[] | undefined>;
const 실적칸: Bucket[] = ['분납실적', '완납실적'];
const TONE: Record<Bucket, Tone> = { 당월접수: 'info', 미완료: 'warn', 분납실적: 'neutral', 완납실적: 'ok', 취소: 'err' };
const PAGE = 15;
const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (typeof b === 'number' ? b : 0), 0);

export async function IntakeScreen({ q, base = '/intake' }: { q: Q; base?: string }) {
  let rows: SettlementRow[];
  try { rows = (await settlements.list()).map((x) => x.row); }
  catch (e) { return <Screen name="intake"><PageHeader crumb={['홈', '계약접수']} title="계약접수" desc={<span className="erp-field-error">ERP5 를 못 읽었습니다 — {(e as Error).message}</span>} /></Screen>; }
  const now = new Date(`${today()}T12:00:00+09:00`);
  const bucket = new Map(rows.map((r) => [r, bucketOf(r, now)]));

  /* ── 신규 접수(?w=new) — 기능 쪽 접수 양식을 규격 폼 화면에 앉힌다 ── */
  if (sp(q.w) === 'new') {
    return (
      <Screen name="intake-new">
        <PageHeader crumb={['홈', '업무', '계약접수', '신규 접수']} title="신규 접수" badge={<Badge tone="neutral">작성중</Badge>}
          desc="상품찾기에서 고른 차와 요금이 그대로 들어옵니다. 저장하면 접수 당시 상품 · 요금이 스냅샷으로 남습니다."
          actions={<Link className="erp-btn" href="/products">상품 다시 고르기</Link>} />
        <section className="erp-section erp-embed">
          <h2 className="erp-section-title">접수 내용</h2>
          <NewIntakePanel rows={rows} productId={sp(q.product)} offerId={sp(q.offer)} back={base} />
        </section>
      </Screen>
    );
  }

  /* ── 접수 상세(?ic=) ── */
  const ic = sp(q.ic);
  const cur = ic ? rows.find((r) => r.id === ic) : undefined;
  if (cur) {
    const b = bucket.get(cur)!;
    const p = cur.progress;
    const step = p.cancelled ? -1 : !p.paper ? 1 : !p.delivered ? 2 : !p.billed ? 3 : !p.collected ? 4 : 5;
    const claim = claimAmountOf(cur, now), pay = payAmountOf(cur, now), margin = marginOf(cur, now);
    return (
      <Screen name="intake-detail">
        <PageHeader crumb={['홈', '업무', 실적칸.includes(b) ? '실적' : '계약접수', txt(cur.customer)]}
          title={`${txt(cur.customer)} · ${txt(cur.plate)}`} badge={<Badge tone={TONE[b]}>{b}</Badge>}
          desc={`${txt(cur.model)} · ${txt(cur.supplier)} · ${txt(cur.channel)}${cur.agent ? ` · 담당 ${cur.agent}` : ''} · 접수 ${txt(cur.receivedAt)}`}
          actions={<>
            <Link className="erp-btn erp-btn--ghost" href={hrefWith(base, q, { ic: null })}>목록으로</Link>
            <Link className="erp-btn" href={`/settlement?focus=${encodeURIComponent(cur.id)}`}>정산관리에서 보기</Link>
          </>} />
        <section className="erp-card">
          <div className="erp-card-body">
            <Steps current={step} items={[
              { label: '접수', count: cur.receivedAt?.slice(5) ?? '—' },
              { label: '계약서', count: p.paper ? '받음' : '—' },
              { label: '인도', count: p.deliveredAt?.slice(5) ?? '—' },
              { label: '청구', count: p.billMonth ?? '—' },
              { label: '수금 · 지급', count: p.collected && p.paid ? '끝' : p.collected ? '수금' : '—' },
            ]} />
          </div>
        </section>
        <div className="erp-cols erp-cols--detail">
          <div className="erp-stack">
            <section className="erp-section">
              <h2 className="erp-section-title">고객 · 차량</h2>
              <Props pairs={[['고객', txt(cur.customer)], ['차량번호', txt(cur.plate)], ['차량', txt(cur.model)], ['공급사', txt(cur.supplier)],
                ['영업채널', txt(cur.channel)], ['영업 담당', txt(cur.agent)]]} />
            </section>
            <section className="erp-section">
              <h2 className="erp-section-title">계약 조건</h2>
              <Props pairs={[['상품구분', txt(cur.product)], ['계약기간', cur.term ? `${cur.term}개월` : '—'], ['보증금', won0(cur.deposit)],
                ['월 대여료', won0(cur.rent)], ['결제', txt(cur.payKind)], ['계약 방식', txt(cur.contractType)]]} />
            </section>
            <section className="erp-section">
              <h2 className="erp-section-title">금액 <span className="erp-docstate">청구(공급사) − 지급(영업채널) = 남는 것</span></h2>
              <table className="erp-grid erp-grid--dense">
                <thead><tr><th>구분</th><th>상대</th><th>단계</th><th className="erp-num">금액</th></tr></thead>
                <tbody>
                  <tr><td>청구</td><td>{txt(cur.supplier)}</td><td>{cur.claimStage}</td><td className="erp-num erp-strong">{won0(claim)}</td></tr>
                  <tr><td>지급</td><td>{txt(cur.channel)}</td><td>{cur.payStage}</td><td className="erp-num erp-strong">{won0(pay)}</td></tr>
                </tbody>
                <tfoot><tr><td>남는 것</td><td /><td /><td className="erp-num">{won0(margin)}</td></tr></tfoot>
              </table>
            </section>
          </div>
          <div className="erp-stack">
            <section className="erp-card erp-embed">
              <CardHead title="처리" sub="저장 · 계약서 · 인도 · 취소" />
              <div className="erp-card-body">
                <IntakeDetailPanel code={cur.id} back={hrefWith(base, q, { ic: null })} newHref="/products" />
              </div>
            </section>
          </div>
        </div>
      </Screen>
    );
  }

  /* ── 목록 ── */
  const iv = (BUCKETS as string[]).includes(sp(q.iv)) || sp(q.iv) === 'all' ? sp(q.iv) : '당월접수';
  const perfView = 실적칸.includes(iv as Bucket);
  const text = sp(q.iq).trim().toLowerCase();
  const sup = sp(q.isup), ch = sp(q.ich);
  const searched = rows
    .filter((r) => !text || [r.customer, r.plate, r.model, r.supplier, r.channel, r.agent].join(' ').toLowerCase().includes(text))
    .filter((r) => !sup || r.supplier === sup).filter((r) => !ch || r.channel === ch);
  const inView = (r: SettlementRow) => iv === 'all' || bucket.get(r) === iv;
  const shown = sortIntakeRows(searched.filter(inView), iv as Bucket | 'all');
  const page = Math.max(1, Number(sp(q.page)) || 1);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const slice = shown.slice((page - 1) * PAGE, page * PAGE);
  const n = (b: Bucket) => searched.filter((r) => bucket.get(r) === b).length;
  const suppliers = [...new Set(rows.map((r) => r.supplier).filter(Boolean) as string[])].sort();
  const channels = [...new Set(rows.map((r) => r.channel).filter(Boolean) as string[])].sort();
  const perfRows = rows.filter((r) => 실적칸.includes(bucket.get(r)!));
  const title = perfView ? '실적' : '계약접수';

  return (
    <Screen name={perfView ? 'performance' : 'intake'}>
      <PageHeader crumb={['홈', '업무', title]} title={title}
        desc={perfView ? '인도된 계약 — 분납실적 · 완납실적. 청구 · 지급 · 남는 것을 한 줄로 봅니다.' : '접수부터 계약서 · 인도 · 취소까지 모든 접수의 진행을 봅니다. 새 접수는 상품찾기에서 차를 고르고 시작합니다.'}
        actions={<>
          <Link className="erp-btn erp-btn--ghost" href="/settlement">정산관리</Link>
          <Link className="erp-btn erp-btn--primary" href="/products">신규 접수</Link>
        </>} />
      {perfView ? (
        <Kpis items={[
          { label: '완납실적', side: '건', value: String(n('완납실적')), unit: '건' },
          { label: '분납실적', side: '건', value: String(n('분납실적')), unit: '건' },
          { label: '청구 합계', side: '공급사', value: won0(sum(perfRows.map((r) => claimAmountOf(r, now)))), unit: '원' },
          { label: '남는 것', side: '청구 − 지급', value: won0(sum(perfRows.map((r) => marginOf(r, now)))), unit: '원' },
        ]} />
      ) : (
        <Kpis items={[
          { label: '당월접수', side: today().slice(0, 7), value: String(n('당월접수')), unit: '건' },
          { label: '미완료', side: '계약서 · 인도 대기', value: String(n('미완료')), unit: '건', alert: n('미완료') > 0 },
          { label: '실적', side: '분납 + 완납', value: String(n('분납실적') + n('완납실적')), unit: '건' },
          { label: '취소', side: '누적', value: String(n('취소')), unit: '건' },
        ]} />
      )}
      <section className="erp-card erp-card--fill">
        <form className="erp-filter" data-region="filter" role="search" action={base}>
          <Field label="고객 / 차번 / 모델"><input className="erp-input" name="iq" defaultValue={sp(q.iq)} placeholder="고객 · 차번 · 모델" /></Field>
          <Field label="공급사"><Select name="isup" value={sup} options={suppliers} /></Field>
          <Field label="영업채널"><Select name="ich" value={ch} options={channels} /></Field>
          <input type="hidden" name="iv" value={iv === '당월접수' ? '' : iv} />
          <div className="erp-filter-actions">
            <Link className="erp-btn erp-btn--ghost" href={hrefWith(base, {}, { iv: iv === '당월접수' ? null : iv })}>초기화</Link>
            <button className="erp-btn erp-btn--primary" type="submit">조회</button>
          </div>
        </form>
        <div className="erp-toolbar" data-region="grid-toolbar">
          {sup ? <Link className="erp-chip" href={hrefWith(base, q, { isup: null, page: null })}>공급사: {sup} ×</Link> : null}
          {ch ? <Link className="erp-chip" href={hrefWith(base, q, { ich: null, page: null })}>영업채널: {ch} ×</Link> : null}
          <span className="erp-toolbar-spacer" />
          <Seg label="접수 칸" items={[
            { key: 'all', label: `전체 ${searched.length}`, href: hrefWith(base, q, { iv: 'all', page: null }), on: iv === 'all' },
            ...BUCKETS.map((b) => ({ key: b, label: `${b} ${n(b)}`, href: hrefWith(base, q, { iv: b === '당월접수' ? null : b, page: null }), on: iv === b })),
          ]} />
        </div>
        <div className="erp-grid-scroll" data-region="grid">
          <table className="erp-grid">
            <thead>{perfView ? (
              <tr><th>인도일</th><th>고객</th><th>차량 / 차량번호</th><th>공급사</th><th>영업채널</th><th>상품 · 기간</th>
                <th className="erp-num">청구액</th><th className="erp-num">지급액</th><th className="erp-num">남는 것</th><th>청구 · 지급</th><th>상태</th></tr>
            ) : (
              <tr><th>접수일</th><th>고객</th><th>차량 / 차량번호</th><th>공급사</th><th>상품 · 기간</th><th className="erp-num">보증금</th><th className="erp-num">월 대여료</th>
                <th>영업채널 · 담당</th><th>진행</th><th>청구 · 지급</th><th>상태</th></tr>
            )}</thead>
            <tbody>
              {slice.map((r) => {
                const href = hrefWith(base, q, { ic: r.id });
                const b = bucket.get(r)!;
                return perfView ? (
                  <tr key={r.id} data-href={href}>
                    <td><Link className="erp-row-link" href={href}>{txt(r.progress.deliveredAt)}</Link></td>
                    <td>{txt(r.customer)}</td><td>{txt(r.model)}<span className="erp-cell-sub">{txt(r.plate)}</span></td>
                    <td>{txt(r.supplier)}</td><td>{txt(r.channel)}</td><td>{txt(r.product)} · {r.term ?? '—'}개월</td>
                    <td className="erp-num">{won0(claimAmountOf(r, now))}</td><td className="erp-num">{won0(payAmountOf(r, now))}</td>
                    <td className="erp-num erp-strong">{won0(marginOf(r, now))}</td>
                    <td className="erp-muted">{r.claimStage} · {r.payStage}</td><td><Badge tone={TONE[b]}>{b}</Badge></td>
                  </tr>
                ) : (
                  <tr key={r.id} data-href={href}>
                    <td><Link className="erp-row-link" href={href}>{txt(r.receivedAt)}</Link></td>
                    <td>{txt(r.customer)}</td><td>{txt(r.model)}<span className="erp-cell-sub">{txt(r.plate)}</span></td>
                    <td>{txt(r.supplier)}</td><td>{txt(r.product)} · {r.term ?? '—'}개월</td>
                    <td className="erp-num">{r.deposit ? won0(r.deposit) : <span className="erp-tag erp-tag--primary">무보증</span>}</td>
                    <td className="erp-num erp-strong">{won0(r.rent)}</td>
                    <td>{txt(r.channel)}<span className="erp-cell-sub">{txt(r.agent)}</span></td>
                    <td><span className="erp-tags">
                      <span className={`erp-tag${r.progress.paper ? ' erp-tag--primary' : ''}`}>계약서 {r.progress.paper ? '받음' : '대기'}</span>
                      <span className={`erp-tag${r.progress.delivered ? ' erp-tag--primary' : ''}`}>인도 {r.progress.delivered ? '완료' : '대기'}</span>
                    </span></td>
                    <td className="erp-muted">{r.claimStage} · {r.payStage}</td><td><Badge tone={TONE[b]}>{b}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
            {perfView ? (
              <tfoot><tr><td colSpan={6}>합계 ({shown.length}건)</td>
                <td className="erp-num">{won0(sum(shown.map((r) => claimAmountOf(r, now))))}</td>
                <td className="erp-num">{won0(sum(shown.map((r) => payAmountOf(r, now))))}</td>
                <td className="erp-num">{won0(sum(shown.map((r) => marginOf(r, now))))}</td><td /><td /></tr></tfoot>
            ) : null}
          </table>
        </div>
        <div className="erp-grid-foot">
          <span>총 <b>{shown.length}</b>건</span>
          {!perfView ? <><span>·</span><span>월 대여료 합계 <b>{won0(sum(shown.map((r) => r.rent)))}</b>원</span></> : null}
          <nav className="erp-pager" aria-label="페이지">
            {Array.from({ length: pages }, (_, i) => i + 1).map((k) => (
              <Link key={k} href={hrefWith(base, q, { page: String(k) })} aria-current={k === page ? 'page' : undefined}>{k}</Link>
            ))}
          </nav>
        </div>
      </section>
    </Screen>
  );
}
