import Link from 'next/link';
import { ListRow } from '../../_design/ListRow';
import { settlements } from '../../../server/erp5';
import { blockOf, isOpenIntake } from '../../../domain/settlement/types';
import { num, sp, txt, won, yes } from '../../_fn/fmt';

export const dynamic = 'force-dynamic';

const VIEWS = [
  ['open', '진행 중 (인도 전)'],
  ['delivered', '인도 완료'],
  ['cancelled', '취소'],
  ['all', '전체'],
] as const;

export default async function IntakeList({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const view = sp(q.view) || 'open';
  const text = sp(q.q).trim().toLowerCase();
  const month = sp(q.month);

  let all: Awaited<ReturnType<typeof settlements.list>>;
  try { all = await settlements.list(); }
  catch (e) { return <><h1>계약접수</h1><p className="fn-err">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></>; }

  const rows = all.map((x) => x.row);
  const inView = (r: (typeof rows)[number]) =>
    view === 'open' ? isOpenIntake(r)
      : view === 'delivered' ? r.progress.delivered && !r.progress.cancelled
        : view === 'cancelled' ? r.progress.cancelled : true;
  const count = Object.fromEntries(VIEWS.map(([v]) => [v, rows.filter((r) =>
    v === 'open' ? isOpenIntake(r) : v === 'delivered' ? r.progress.delivered && !r.progress.cancelled
      : v === 'cancelled' ? r.progress.cancelled : true).length]));
  const months = [...new Set(rows.map((r) => (r.receivedAt ?? '').slice(0, 7)).filter(Boolean))].sort().reverse();

  const shown = rows
    .filter(inView)
    .filter((r) => !month || (r.receivedAt ?? '').startsWith(month))
    .filter((r) => !text || [r.plate, r.customer, r.model, r.supplier, r.channel, r.agent].join(' ').toLowerCase().includes(text))
    .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));

  const href = (v: string) => `/intake/list?${new URLSearchParams({ view: v, q: sp(q.q), month })}`;

  return (
    <>
      <h1>계약접수 <Link href="/intake/new" style={{ fontSize: 13, marginLeft: 12 }}>+ 새 접수</Link></h1>
      <p className="fn-muted">ERP5 settlement_rows {rows.length}줄 · 열쇠 = 차량번호 + 접수일</p>
      <div className="fn-tabs">{VIEWS.map(([v, label]) => <a key={v} href={href(v)} className={v === view ? 'on' : ''}>{label} {count[v]}</a>)}</div>
      <form className="fn-filter">
        <input type="hidden" name="view" value={view} />
        <label>찾기<input name="q" defaultValue={sp(q.q)} placeholder="차번 · 고객 · 모델 · 공급사 · 채널" /></label>
        <label>접수월<select name="month" defaultValue={month}><option value="">전체</option>{months.map((m) => <option key={m}>{m}</option>)}</select></label>
        <button type="submit">찾기</button>
      </form>
      <p>{shown.length}줄</p>
      {/* ★목록 한 줄 규격(_design/ListRow) — 접수 한 건 = 한 줄 */}
      <div className="dz-list">
        {shown.map((r) => (
          <ListRow key={r.id} href={`/intake/${r.id}`}
            title={txt(r.customer)} badge={r.progress.cancelled ? '취소' : (blockOf(r) ?? '끝')}
            tone={!r.progress.cancelled && blockOf(r) ? 'act' : 'plain'}
            meta={[r.plate, r.model, r.supplier, r.channel, r.agent].filter(Boolean).join(' · ') || '—'}
            value={r.rent ? `월 ${won(r.rent)}원` : '—'} aside={txt(r.receivedAt)} />
        ))}
      </div>
    </>
  );
}
