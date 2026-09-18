import Link from 'next/link';
import { ListRow } from '../_design/ListRow';
import { settlements, today } from '../../server/erp5';
import { claimLedger, ledgerMonths, ledgerTotals, NO_MONTH, payLedger } from '../../domain/settlement/ledgers';
import { sp, txt, won, yes } from '../_fn/fmt';

export const dynamic = 'force-dynamic';

/**
 * 정산관리 — 청구목록 · 지급목록. ★지금은 «읽기» 다.
 *   청구서 발행 · 수금 · 지급을 여기서 누르는 길은 업무 규칙이 굳은 뒤 연다 (AGENTS §10 — 추측 구현 금지).
 */
export default async function SettlementPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const tab = sp(q.tab) === 'pay' ? 'pay' : 'claim';

  let rows: Awaited<ReturnType<typeof settlements.list>>;
  try { rows = await settlements.list(); }
  catch (e) { return <><h1>정산관리</h1><p className="fn-err">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></>; }
  const all = rows.map((x) => x.row);

  const months = ledgerMonths(all);
  /* ★처음 여는 달 = 이번 달까지 중 가장 최근. 원장에 앞날 청구월(2026-10)이 적힌 줄이 있어 «맨 위» 로 고르면 엉뚱한 달이 열린다 */
  const now = today().slice(0, 7);
  const month = sp(q.month) || months.find((m) => m !== NO_MONTH && m <= now) || months[0] || NO_MONTH;
  const groups = tab === 'claim' ? claimLedger(all, month) : payLedger(all, month);
  const t = ledgerTotals(groups);
  const href = (x: Record<string, string>) => `/settlement?${new URLSearchParams({ tab, month, ...x })}`;
  const who = tab === 'claim' ? '공급사' : '영업채널';

  return (
    <>
      <h1>정산관리</h1>
      <div className="fn-tabs">
        <a href={href({ tab: 'claim' })} className={tab === 'claim' ? 'on' : ''}>청구목록 (공급사에게 받을 것)</a>
        <a href={href({ tab: 'pay' })} className={tab === 'pay' ? 'on' : ''}>지급목록 (영업채널에 줄 것)</a>
      </div>
      <div className="fn-tabs">{months.map((m) => <a key={m} href={href({ month: m })} className={m === month ? 'on' : ''}>{m}</a>)}</div>
      <p className="fn-muted">
        실적(인도 완료 · 취소 아님 · 정산 제외 아님)만 섭니다. 달은 ERP5 청구월(billMonth).
        {' '}★금액을 «모르는» 줄은 합에 안 넣고 따로 셉니다 — 0 으로 세면 합이 거짓말을 합니다.
      </p>
      <p><b>{month}</b> · {who} {groups.length}곳 · {t.rows}줄 · 합 <b>{won(t.total)}</b>
        {t.unknown > 0 && <span className="fn-err"> · 금액 모름 {t.unknown}줄</span>}
        {' '}· {tab === 'claim' ? '청구서 보냄' : '지급 통보'} {t.done}/{t.rows}</p>
      {tab === 'pay' && <p className="fn-muted">「지급함(paid)」 칸은 원장에서 아직 아무도 안 씁니다 — 0건은 「안 줬다」 가 아니라 「안 적었다」 입니다.</p>}

      {/* ★목록 한 줄 규격(_design/ListRow) — 묶음 한 곳 = 한 줄 */}
      <div className="dz-list">
        {groups.map((g) => (
          <ListRow key={g.party} href={`#g-${encodeURIComponent(g.party)}`}
            title={g.party} badge={`${tab === 'claim' ? '청구서' : '지급 통보'} ${g.done}/${g.rows.length}`}
            tone={g.done < g.rows.length ? 'act' : 'plain'}
            meta={`${g.rows.length}줄${g.unknown ? ` · 금액 모름 ${g.unknown}` : ''}${g.hold ? ` · 보류 ${g.hold}` : ''}`}
            value={`${won(g.total)}원`} aside={who} />
        ))}
      </div>

      {groups.map((g) => (
        <details key={g.party} id={`g-${encodeURIComponent(g.party)}`}>
          <summary><b>{g.party}</b> — {g.rows.length}줄 · {won(g.total)}{g.unknown ? ` · 모름 ${g.unknown}` : ''}</summary>
          <div className="dz-list">
            {g.rows.map((r) => {
              const 돈 = tab === 'claim' ? r.money.claim : r.money.pay;
              const 끝 = tab === 'claim' ? r.progress.billed : r.progress.paid;
              return (
                <ListRow key={r.id} href={`/intake/${r.id}`}
                  title={txt(r.customer)} badge={r.progress.billHold ? '보류' : (tab === 'claim' ? r.claimStage : r.payStage)}
                  tone={r.progress.billHold || !끝 ? 'act' : 'plain'}
                  meta={[r.plate, r.model, tab === 'claim' ? r.channel : r.supplier, r.progress.deliveredAt ? `인도 ${r.progress.deliveredAt}` : ''].filter(Boolean).join(' · ') || '—'}
                  value={`${tab === 'claim' ? '청구' : '지급'} ${won(돈)}${돈 === null || 돈 === undefined ? '' : '원'}`}
                  aside={txt(r.receivedAt)} />
              );
            })}
          </div>
        </details>
      ))}
    </>
  );
}
