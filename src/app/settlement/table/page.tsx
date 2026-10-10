import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readSettlementScreen } from '../../../server/freepass-data';
import { requireAdmin } from '../../../server/require-admin';
import { settlementSummary, settlementSummaryCells, SETTLEMENT_SUMMARY_HEADERS } from '../../../domain/settlement/summary';
import { sp, won } from '../../_fn/fmt';
import '../../products/board.css';
import './table.css';

export const dynamic = 'force-dynamic';

export default async function SettlementTablePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await requireAdmin()) redirect('/login');
  const q = await searchParams;
  let summary;
  try {
    const read = await readSettlementScreen();
    summary = settlementSummary(read.all.map(x => x.row), sp(q.month));
  } catch {
    return <div className="pb settlement-table"><div className="web-workspace"><section className="web-panel">
      <header className="web-panel-head"><h2>정산표</h2></header>
      <p className="pb-error" role="alert">접수 원장을 읽지 못했습니다. 잠시 후 다시 조회해 주세요.</p>
      <Link className="small-btn" href="/settlement/table">다시 조회</Link>
    </section></div></div>;
  }
  const query = new URLSearchParams({ month: summary.month }).toString();
  const months = summary.months.includes(summary.month) ? summary.months : [summary.month, ...summary.months];
  const tableRows = [...summary.suppliers, summary.total];
  return <div className="pb settlement-table"><div className="web-workspace"><section className="web-panel">
    <header className="web-panel-head"><h2>정산표</h2><small>부가세 별도 공급가 · 원</small></header>
    <div className="settlement-summary" role="status">
      <strong>{summary.month} · 접수 {summary.total.count}건</strong>
      <span>금액 확정 {summary.amountConfirmed}건</span>
      <span>확인 필요 {summary.needsAttention}건</span>
    </div>
    <p className="settlement-note">금액 확정은 청구·지급 모두 기록된 건수입니다. 인도 전·보류 등 확인 필요와 중복될 수 있으며, 이유도 중복 집계합니다.</p>
    {summary.reasons.length > 0 && <ul className="settlement-reasons" aria-label="확인 필요 이유">
      {summary.reasons.map(r => <li key={r.label}>{r.label} {r.count}건</li>)}
    </ul>}
    <form className="settlement-controls" action="/settlement/table">
      <label htmlFor="settlement-month">청구월</label>
      <select id="settlement-month" name="month" defaultValue={summary.month}>
        {months.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <button className="small-btn" type="submit">조회</button>
      <a className="small-btn" href={`/settlement/table/csv?${query}`}>CSV 내려받기</a>
      <Link className="small-btn" href={`/settlement?${query}`}>정산 업무</Link>
    </form>
    <p className="settlement-note">접수 원장 저장액 기준이며 인도 전·보류의 기록액도 포함합니다. 취소·정산 제외는 집계에서 제외합니다. 미확정은 합산하지 않으며, 확정분이 없으면 —로 표시합니다. 우리 몫은 양쪽 금액이 확정된 접수만 계산합니다.</p>
    <table className="settlement-grid">
      <caption className="sr-only">{summary.month} 공급사별 정산표 · 부가세 별도 공급가</caption>
      <thead><tr>{SETTLEMENT_SUMMARY_HEADERS.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
      <tbody>{tableRows.map((r, i) => {
        const total = i === summary.suppliers.length;
        return <tr key={total ? 'total' : `supplier-${i}`} className={total ? 'settlement-total' : undefined}>
          {settlementSummaryCells(r, total).map((value, c) => c === 0
            ? <th scope="row" key={c}>{value}</th>
            : <td key={c} data-label={SETTLEMENT_SUMMARY_HEADERS[c]}>{value === null ? '—' : typeof value === 'number' ? won(value) : value}</td>)}
        </tr>;
      })}</tbody>
    </table>
    {summary.total.count === 0 && <p className="empty">선택한 청구월의 접수가 없습니다.</p>}
    <p className="settlement-note">내부 조회·출력용입니다. 공급사용 청구서가 아니며 원천 최신성·공급사 확인·발행 가능 여부를 보증하지 않습니다.</p>
  </section></div></div>;
}
