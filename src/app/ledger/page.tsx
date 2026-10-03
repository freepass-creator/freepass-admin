import { settlements, today, writeEnabled } from '../../server/freepass-data';
import { LedgerSheet } from './LedgerSheet';
import { sortLedger, toLedgerRow } from './model';
import './ledger.css';

export const dynamic = 'force-dynamic';

/**
 * 접수표 — 엑셀 F04 「접수」 탭을 그대로 옮긴 한 장 (사용자 결정 2026-10-03).
 * 맨 위 한 줄로 접수하고, 아래로 접수가 누적된다. 칸을 눌러 바로 고친다.
 * 저장은 기존 접수 저장소와 기존 액션을 그대로 쓴다 — 새 저장 규칙을 만들지 않는다.
 */
export default async function LedgerPage() {
  let rows;
  try {
    rows = sortLedger((await settlements.list()).map((x) => toLedgerRow(x.row)));
  } catch (e) {
    return (
      <section className="erp-screen ledger">
        <h1 className="ledger-title">접수표</h1>
        <p className="ledger-alert" role="alert">접수 원장을 읽지 못했습니다 — {(e as Error).message}</p>
      </section>
    );
  }
  return <LedgerSheet rows={rows} canWrite={writeEnabled()} today={today()} />;
}
