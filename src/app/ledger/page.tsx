import { mewcarGaTableOrNull, settlements, today, writeEnabled } from '../../server/freepass-data';
import { buildIntakeOptions } from '../intake/intake-options';
import { LedgerBoard } from './LedgerBoard';
import { toLedgerRow } from './model';
import '../products/board.css';
import './ledger.css';

export const dynamic = 'force-dynamic';

/**
 * 접수 관리 — 직원이 접수하고 목록을 한눈에 보는 화면 (사용자 결정 2026-10-03). 기존 판(.pb) 모양 그대로.
 * 평소엔 목록이 전체 폭, 접수하거나 줄을 고르면 목록 2 : 처리 판 1.
 * 저장은 기존 접수 저장소와 기존 액션을 그대로 쓴다 — 새 저장 규칙을 만들지 않는다.
 */
export default async function LedgerPage() {
  const day = today();
  let raw;
  try {
    raw = (await settlements.list()).map((x) => x.row);
  } catch (e) {
    return (
      <div className="pb ldesk"><div className="web-workspace"><section className="web-panel pb-list">
        <header className="web-panel-head"><h2>접수 관리</h2></header>
        <p className="pb-error" role="alert">접수 원장을 읽지 못했습니다 — {(e as Error).message}</p>
      </section></div></div>
    );
  }
  /* 뮤카 지급표 — 프리패스 데이터 수수료 규칙. 못 읽으면 null(«뮤카 금액 모름»), 목록은 그대로 */
  const mewcarTable = await mewcarGaTableOrNull();
  return (
    <LedgerBoard
      rows={raw.map((r) => toLedgerRow(r, day, undefined, mewcarTable))}
      options={buildIntakeOptions(raw)}
      canWrite={writeEnabled()}
      today={day}
    />
  );
}
