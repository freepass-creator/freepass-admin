import { ledgerGroupAttention, type LedgerGroup } from '../../domain/settlement/ledgers';

export type SettlementSignalTone = 'neutral' | 'info' | 'warning' | 'error' | 'success';
export type SettlementSignalKey =
  | 'month-unassigned'
  | 'amount-unknown'
  | 'broken'
  | 'correction'
  | 'hold'
  | 'clawback'
  | 'done'
  | 'progress'
  | 'waiting';

export type SettlementSignal = {
  key: SettlementSignalKey;
  label: string;
  tone: SettlementSignalTone;
};

/**
 * 정산 목록의 표시 우선순위만 정한다.
 * 업무 상태/필터 판정은 ledgerGroupAttention 및 row lifecycle이 정본이고,
 * 이 함수는 그 사실을 카드 한 칸에 어떤 신호로 먼저 보여줄지만 결정한다.
 */
export function settlementGroupSignal(
  g: LedgerGroup,
  side: 'claim' | 'pay',
  monthUnassigned = false,
): SettlementSignal {
  if (monthUnassigned) return { key: 'month-unassigned', label: '미정', tone: 'error' };
  if (g.unknown > 0) return { key: 'amount-unknown', label: '금액 모름', tone: 'error' };
  if (g.broken > 0) return { key: 'broken', label: '끊김', tone: 'error' };

  const correction = settlementGroupCorrectionCount(g, side);
  if (correction > 0) return { key: 'correction', label: '정정', tone: 'error' };
  if (g.hold > 0) return { key: 'hold', label: '보류', tone: 'warning' };
  if (g.clawbacks.length > 0) return { key: 'clawback', label: '환수', tone: 'error' };

  const attention = ledgerGroupAttention(g);
  if (attention === 'done') return { key: 'done', label: '완료', tone: 'success' };
  if (g.done > 0 || g.completed > 0) return { key: 'progress', label: '진행', tone: 'info' };
  return { key: 'waiting', label: '대기', tone: 'neutral' };
}

export function settlementGroupCorrectionCount(g: LedgerGroup, side: 'claim' | 'pay'): number {
  return g.lines.filter(({ row }) => (side === 'claim' ? row.claimStage : row.payStage) === '정정').length;
}

export function settlementGroupSupport(g: LedgerGroup, side: 'claim' | 'pay'): string {
  const correction = settlementGroupCorrectionCount(g, side);
  const signals = [
    g.unknown ? `금액 모름 ${g.unknown}` : '',
    g.broken ? `끊김 ${g.broken}` : '',
    correction ? `정정 ${correction}` : '',
    g.hold ? `보류 ${g.hold}` : '',
    g.clawbacks.length ? `환수 ${g.clawbacks.length}` : '',
  ].filter(Boolean);

  if (signals.length) {
    return signals.length > 2 ? `${signals.slice(0, 2).join(' · ')} · 외 ${signals.length - 2}` : signals.join(' · ');
  }
  return `완료 ${g.completed}/${g.lines.length}`;
}

export function settlementLineSignal(
  stage: string,
  options: { hold?: boolean; broken?: boolean } = {},
): SettlementSignal {
  if (options.hold) return { key: 'hold', label: '보류', tone: 'warning' };
  if (stage === '정정') return { key: 'correction', label: '정정', tone: 'error' };
  if (options.broken) return { key: 'broken', label: '끊김', tone: 'error' };
  if (stage === '수금' || stage === '지급') return { key: 'done', label: stage, tone: 'success' };
  if (stage === '청구' || stage === '통보' || stage === '확인') return { key: 'progress', label: stage, tone: 'info' };
  return { key: 'waiting', label: stage || '접수', tone: 'neutral' };
}
