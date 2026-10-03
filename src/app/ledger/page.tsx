import { settlements, today, writeEnabled } from '../../server/freepass-data';
import { buildIntakeOptions } from '../intake/intake-options';
import { LedgerBoard } from './LedgerBoard';
import { toLedgerRow } from './model';
import './ledger.css';

export const dynamic = 'force-dynamic';

/**
 * 접수 데스크 — 직원이 접수하고 목록을 한눈에 보는 ERP 화면 (사용자 결정 2026-10-03).
 * 왼쪽 목록은 «보기», 오른쪽 판은 «처리»(새 접수 · 고른 접수의 진행/금액).
 * 저장은 기존 접수 저장소와 기존 액션을 그대로 쓴다 — 새 저장 규칙을 만들지 않는다.
 */
export default async function LedgerPage() {
  const day = today();
  let raw;
  try {
    raw = (await settlements.list()).map((x) => x.row);
  } catch (e) {
    return (
      <section className="erp-screen ledger">
        <h1 className="ledger-title">접수</h1>
        <p className="ledger-alert" role="alert">접수 원장을 읽지 못했습니다 — {(e as Error).message}</p>
      </section>
    );
  }
  return (
    <LedgerBoard
      rows={raw.map((r) => toLedgerRow(r, day))}
      options={buildIntakeOptions(raw)}
      canWrite={writeEnabled()}
      today={day}
    />
  );
}
