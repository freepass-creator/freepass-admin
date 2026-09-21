import { erp5 } from './firestore';
import type { FeeRule, FeeRuleSet, KindRule } from '../../domain/settlement/fee';

/**
 * **수수료 규칙을 ERP5 SSOT 에서 읽는다** — `settlement_fee_rules` · `settlement_rules/current`.
 * ★코드에 규칙 사본을 두지 않는다. 규칙이 바뀌면 ERP5 문서만 고친다(scripts/fee-rules-to-erp5.mts 가 넣었다).
 * ⚠ 규칙이 없으면 «지어내지 않고» 던진다 — 빈 규칙으로 세면 모든 접수가 「표에 없다」 가 된다.
 * ★캐시는 `globalThis` 에 둔다 — 상품 목록(server/erp5.ts) · 차종마스터(vehicle-master.ts)와 같은 자리·
 *   같은 이유. 세 캐시가 «각자 다른 자리»에 있으면 Next 가 모듈을 다시 평가할 때(HMR 등) 하나만 비고
 *   나머지는 남는 식으로 갈릴 수 있다 — 한 규칙으로 통일한다.
 */
const g = globalThis as unknown as { __fpaFeeRules?: { at: number; set: FeeRuleSet } };

export async function loadFeeRuleSet(maxAgeMs = 60_000): Promise<FeeRuleSet> {
  const hit = g.__fpaFeeRules;
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.set;
  const db = erp5();
  const [rulesSnap, cur] = await Promise.all([
    db.collection('settlement_fee_rules').get(),
    db.collection('settlement_rules').doc('current').get(),
  ]);
  if (!cur.exists || rulesSnap.empty) throw new Error('ERP5 에 수수료 규칙이 없다 — scripts/fee-rules-to-erp5.mts --apply 로 넣어야 한다');
  const c = cur.data()!;
  /* ★표의 차례(seq)로 다시 세운다 — 찾기가 «처음 맞는 것» 을 고르므로 차례가 뜻이다. id 순으로 두면 6줄이 다른 규칙으로 셈해진다(실측) */
  const docs = [...rulesSnap.docs].sort((a, b) => (Number(a.data().seq) || 0) - (Number(b.data().seq) || 0));
  if (docs.some((d) => typeof d.data().seq !== 'number')) throw new Error('수수료 규칙에 차례(seq)가 없는 문서가 있다 — 차례 없이 셈하면 다른 규칙이 골라진다');
  const rules: FeeRule[] = docs.map((d) => {
    const x = d.data();
    return {
      id: d.id, supplier: String(x.supplier), kind: x.kind, form: String(x.form ?? ''), term: Number(x.term) || 0,
      basis: x.basis, claim: x.claim, pay: x.pay, when: String(x.when ?? ''), auto: x.auto === true,
      ...(x.note ? { note: String(x.note) } : {}),
    };
  });
  const set: FeeRuleSet = {
    rules,
    aliases: (c.aliases ?? {}) as Record<string, string>,
    evModel: String(c.evModel ?? '$^'),
    kindRules: (c.kindRules ?? []) as KindRule[],
    version: String(c.version ?? ''),
  };
  g.__fpaFeeRules = { at: Date.now(), set };
  return set;
}
