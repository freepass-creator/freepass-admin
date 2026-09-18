/**
 * **환수 — 열어 둔다.**  대표 2026-09-18 「접수해서 완료실적되서 청구해서 지급하면 끝. 환수가 생기는경우가 있을수도 있으니까 그건 열어두고」
 *
 * ★환수는 접수 줄의 체크가 아니라 «반대 부호의 한 줄» 이다 — ERP5 `settlement_clawbacks` 에 따로 선다
 *   (erp4 settlement-atom 「두 곳에 두면 갈린다」 · 사장님 2026-09-01 「환수는 따로」).
 *   청구목록·지급목록은 «환수일이 든 달» 에 그 상대에서 뺀다(ledgers.ts · lifecycle planInvoice).
 *
 * ★금액은 «사람이 넣는다» — 환수 조건이 공급사·정책마다 다르다(오토플러스 「3개월 유지」 · 무보증 심사 「6개월」 …).
 *   기계가 짐작해 넣으면 그 값이 그대로 청구서에서 빠진다. 사유가 없으면 안 받는다.
 * ★꼴은 기존 23건과 같다 — 문서 id `{차번}_{환수월}` (erp4 atomize 와 같은 열쇠), 칸 plate·model·at·supplierAmt·agentAmt·reason·supplier·channel·month·by.
 *   ⚠ 한 차가 «같은 달» 에 두 번 환수되면 id 가 겹친다 — 그때는 새로 세우지 않고 «이미 있다» 고 말한다(고치기로).
 */
import type { SettlementRow } from './types';

export interface ClawbackInput { at: string; supplierAmt: number | null; agentAmt: number | null; reason: string }

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const clawbackId = (plate: unknown, month: string) =>
  `${String(plate ?? '').trim().replace(/[.$#[\]/\s]/g, '_')}_${month}`;

export function clawbackRecord(r: SettlementRow, x: ClawbackInput, by: string, nowMs: number):
  { ok: true; id: string; doc: Record<string, unknown> } | { ok: false; error: string } {
  if (!r.plate) return { ok: false, error: '차량번호가 없는 줄은 환수를 세울 수 없습니다' };
  if (!r.progress.delivered) return { ok: false, error: '인도 전 줄입니다 — 실적이 안 선 줄은 환수할 것이 없습니다(취소로)' };
  if (!DAY.test(x.at)) return { ok: false, error: '환수일은 YYYY-MM-DD' };
  if (!x.reason.trim()) return { ok: false, error: '환수 사유를 적어야 합니다 — 사유 없는 돈은 다음 달에 아무도 못 읽는다' };
  const s = x.supplierAmt ?? 0, a = x.agentAmt ?? 0;
  if (![s, a].every((v) => Number.isFinite(v) && v >= 0)) return { ok: false, error: '환수 금액을 읽지 못했습니다' };
  if (!s && !a) return { ok: false, error: '공급사 환수·영업채널 환수 중 하나는 있어야 합니다' };
  const month = x.at.slice(0, 7);
  return {
    ok: true,
    id: clawbackId(r.plate, month),
    doc: {
      plate: r.plate, model: r.model ?? '', at: x.at, month,
      supplierAmt: Math.round(s), agentAmt: Math.round(a), reason: x.reason.trim(),
      supplier: r.supplier ?? '', channel: r.channel ?? '',
      /* ★어느 줄의 환수인지 — 기존 23건에는 없던 칸이다(차번만 있었다). 재계약이면 차번만으로는 못 가른다 */
      code: r.id, receivedAt: r.receivedAt ?? '',
      by, updatedAt: nowMs,
    },
  };
}
