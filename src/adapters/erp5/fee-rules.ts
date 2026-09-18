import { erp5 } from './firestore';
import type { FeeRule, FeeRuleSet, KindRule } from '../../domain/settlement/fee';

/**
 * **수수료 규칙을 ERP5 SSOT 에서 읽는다** — `settlement_fee_rules` · `settlement_rules/current`.
 * ★코드에 규칙 사본을 두지 않는다. 규칙이 바뀌면 ERP5 문서만 고친다(scripts/fee-rules-to-erp5.mts 가 넣었다).
 * ⚠ 규칙이 없으면 «지어내지 않고» 던진다 — 빈 규칙으로 세면 모든 접수가 「표에 없다」 가 된다.
 */
let cache: { at: number; set: FeeRuleSet } | null = null;

export async function loadFeeRuleSet(maxAgeMs = 60_000): Promise<FeeRuleSet> {
  if (cache && Date.now() - cache.at < maxAgeMs) return cache.set;
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
  cache = { at: Date.now(), set };
  return set;
}
