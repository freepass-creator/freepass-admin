/**
 * **F04 「수수료표」 탭에만 있는 규칙 — erp4 표에 없는 줄.**
 *
 * ★2026-10-03 대표 「정산 시트에 수수료 탭은 기본적으로 있다」 → 청구·지급 규칙의 정본은 F04 「수수료표」 탭이다.
 *   erp4 `settlement-fee-table.ts` 150규칙은 탭 A2:J159 와 같다(10-03 대조). 그 뒤 탭에 «추가된» 줄 중
 *   ERP5 수수료 규칙(settlement_fee_rules)에 넣는 것만 여기 둔다. `scripts/fee-rules-to-erp5.mts` 가 erp4 규칙 뒤에 붙여 쓴다.
 *
 * ★금액 기준이 정해지지 않은 줄은 `auto: false` — 기계가 금액을 내지 않고 접수 때 사람이 넣는다(0 으로 세지 않는다).
 */
import type { FeeRule } from './fee';

export const F04_EXTRA_RULES: Omit<FeeRule, 'id'>[] = [
  {
    /* F04 수수료표 169행 · 대표 10-03 (ai-ops docs/대표-결정-장부.md 27줄) — 범위만 확정, 80~120만 중 어느 값인지 기준 미정 */
    supplier: '뮤카', kind: '구독', form: '', term: 0, basis: '범위',
    claim: '차량 기준가×1% (프리패스 몫 · 별도 지급)',
    pay: '정액 80~120만원 + 추가보증금×10%(최대 40만) — 금액 기준 미정',
    when: '미정', auto: false,
    note: '대표 10-03 범위만 확정 — F04 수수료표 169행. 프리패스 1%와 에이전트 정액을 서로 빼지 않는다',
  },
];

/** 원장·메일에 「무카」로도 적힌다(2026-10-01 「무카 김건식」 메일) */
export const F04_EXTRA_ALIASES: Record<string, string> = { 무카: '뮤카' };
