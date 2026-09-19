import Link from 'next/link';
import { settlements } from '../../server/erp5';
import { bucketOf, paidRoundsOf, roundsOf } from '../../domain/settlement/stage';
import { claimAmountOf, payAmountOf } from '../../domain/settlement/ledgers';
import { sp, txt, won } from '../_fn/fmt';
import { ListRow, type RowStatus } from '../_design/ListRow';
import { EmptyState, PanelHeader, SearchField } from '../_design/Primitives';
import { IntakeDetailPanel } from '../intake/panels';

export const dynamic = 'force-dynamic';

const VIEWS = ['', '완납실적', '분납실적'] as const;
type View = (typeof VIEWS)[number];

const 상태 = (bucket: string, paid: number, rounds: number): RowStatus =>
  bucket === '완납실적'
    ? { icon: 'circle-check', label: '완납', tone: 'green' }
    : { icon: 'repeat', label: rounds > 1 ? `${paid}/${rounds}회` : '분납', tone: 'navy' };

export default async function PerformancePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const kind = VIEWS.includes(sp(q.kind) as View) ? sp(q.kind) as View : '';
  const text = sp(q.q).trim().toLowerCase();
  const id = sp(q.id);

  let all: Awaited<ReturnType<typeof settlements.list>>;
  try { all = await settlements.list(); }
  catch (e) { return <><h1>실적</h1><p className="fn-err">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></>; }

  const rows = all.map((x) => x.row);
  const performance = rows.filter((r) => {
    const b = bucketOf(r);
    return b === '완납실적' || b === '분납실적';
  });
  const searched = performance.filter((r) => !text
    || [r.plate, r.customer, r.model, r.supplier, r.channel, r.agent].join(' ').toLowerCase().includes(text));
  const shown = searched.filter((r) => !kind || bucketOf(r) === kind)
    .sort((a, b) => String(b.progress.deliveredAt || b.receivedAt).localeCompare(String(a.progress.deliveredAt || a.receivedAt)));

  const selected = shown.find((r) => r.id === id) ?? shown[0] ?? null;
  const view = (id || sp(q.v) === 'work') && selected ? 'work' : 'list';

  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])));
    for (const [k, v] of Object.entries(extra)) { if (v) u.set(k, v); else u.delete(k); }
    const s = u.toString();
    return s ? `/performance?${s}` : '/performance';
  };

  const count = (v: string) => v
    ? performance.filter((r) => bucketOf(r) === v).length
    : performance.length;

  return (
    <section className="workspace" data-mode="performance" data-phone={view}>
      <section className="panel product-panel">
        <div className="dz-listtop">
          <PanelHeader title="실적 목록" count={`${shown.length.toLocaleString()}건`} />
          <form className="dz-find" action="/performance">
            {kind && <input type="hidden" name="kind" value={kind} />}
            <div className="searchbox dz-searchbox">
              <SearchField name="q" defaultValue={sp(q.q)} placeholder="고객 · 차량번호 · 공급사 · 영업채널" />
            </div>
          </form>
          <div className="quick-filters">
            {VIEWS.map((v) => (
              <Link key={v || '전체'} className={kind === v ? 'active' : ''} href={keep({ kind:v, id:'', v:'list' })}>
                {v || '전체'} <small>{count(v)}</small>
              </Link>
            ))}
          </div>
        </div>

        <div className="list">
          {shown.map((r) => {
            const bucket = bucketOf(r);
            const rounds = roundsOf(r.payKind);
            const paid = paidRoundsOf(r);
            const claim = claimAmountOf(r);
            const pay = payAmountOf(r);
            return (
              <ListRow key={r.id}
                href={keep({ id:r.id, v:'work' })}
                selected={r.id === selected?.id}
                status={상태(bucket, paid, rounds)}
                title={txt(r.customer)}
                badge={bucket}
                tone="act"
                meta={[r.plate, r.model, r.supplier, r.channel, r.progress.deliveredAt ? `인도 ${r.progress.deliveredAt}` : ''].filter(Boolean).join(' · ') || '—'}
                value={claim === null ? '청구금액 미확인' : `청구 ${won(claim)}원`}
                aside={pay === null ? '지급 미확인' : `지급 ${won(pay)}원`}
              />
            );
          })}
          {shown.length === 0 && <EmptyState>조건에 맞는 실적이 없습니다.</EmptyState>}
        </div>
      </section>

      <section className="panel work-panel">
        {selected
          ? <IntakeDetailPanel code={selected.id} back={keep({ id:'', v:'list' })} />
          : <>
              <PanelHeader title="실적 상세" />
              <EmptyState>왼쪽에서 실적을 고르면 상세가 여기 섭니다.</EmptyState>
            </>}
      </section>
    </section>
  );
}
