import type { SettlementRow } from '../../domain/settlement/types';
import { vocab } from '../_fn/fmt';
import type { IntakeOptions } from './new/IntakeForm';

/** 이름 → 가장 많이 사용된 기존 코드. 새 코드를 추측하지 않는다. */
function codeMap(pairs: [string | null, string | null][]): Record<string, string> {
  const m = new Map<string, Map<string, number>>();
  for (const [name, code] of pairs) {
    if (!name || !code) continue;
    const c = m.get(name) ?? new Map<string, number>();
    c.set(code, (c.get(code) ?? 0) + 1);
    m.set(name, c);
  }
  return Object.fromEntries([...m].map(([name, codes]) => [
    name,
    [...codes].sort((a, b) => b[1] - a[1])[0][0],
  ]));
}

/** 신규 접수 폼의 기존 원장 선택지를 한 곳에서 만든다. */
export function buildIntakeOptions(rows: SettlementRow[]): IntakeOptions {
  return {
    channels: vocab(rows.map((r) => r.channel)),
    channelCode: codeMap(rows.map((r) => [r.channel, r.channelCode])),
    agents: vocab(rows.map((r) => r.agent)),
    agentCode: codeMap(rows.map((r) => [r.agent, r.agentCode])),
    agentChannel: codeMap(rows.map((r) => [r.agent, r.channel])),
    suppliers: vocab(rows.map((r) => r.supplier)),
    supplierCode: codeMap(rows.map((r) => [r.supplier, r.supplierCode])),
    products: vocab(rows.map((r) => r.product)),
    rentKinds: vocab(rows.map((r) => r.rentKind)),
    contractTypes: vocab(rows.map((r) => r.contractType)),
    payKinds: vocab(rows.map((r) => r.payKind)),
  };
}
