/**
 * **원자 사전을 erp4 에서 «그대로» 뽑아 온다** — 손으로 옮겨 적지 않는다.
 *
 *   npx tsx scripts/sync-field-catalog.mts
 *
 * ★대표 2026-09-18 「erp5에서 가져올 원자 다 갖고오는데 디자인쪽에다가 들어갈 공간좀 제대로 성격에 따라서 … 막 뭉쳐놓지 말고」
 *   ⇒ 칸마다 «이름 · 묶음 · 층 · 어디까지 나가나» 가 이미 erp4 에 정해져 있다. 그걸 쓴다.
 *
 *   정책  erp4 lib/domain/policy-tier.ts      ALL_POLICY_FIELDS (층: 상품·영업·계약 · 노출: 내부·영업·견적·계약서 · 약관 조항)
 *   정산  erp4 lib/domain/settlement-atom.ts  SETTLEMENT_FIELDS (묶음 · 이름 · 꼴)
 *
 * 나오는 곳: src/domain/catalog/*.generated.ts — ★손으로 고치지 않는다. 고치려면 erp4 사전을 고치고 이걸 다시 돌린다.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { ALL_POLICY_FIELDS, POLICY_LAYER_LABEL } from 'file:///C:/dev/freepasserp4/lib/domain/policy-tier.ts';
import { SETTLEMENT_FIELDS } from 'file:///C:/dev/freepasserp4/lib/domain/settlement-atom.ts';

const rev = (f: string) => { try { return execSync(`git -C C:/dev/freepasserp4 log -1 --format=%h -- ${f}`).toString().trim(); } catch { return '?'; } };
const head = (src: string) => `/* ★자동 생성 — 손으로 고치지 않는다. scripts/sync-field-catalog.mts 가 erp4 ${src} 에서 뽑았다. */\n`;

mkdirSync('src/domain/catalog', { recursive: true });

const policy = (ALL_POLICY_FIELDS as Record<string, unknown>[]).map((f) => ({
  key: f.key, label: f.label, layer: f.layer, exposure: f.exposure,
  ...(f.article ? { article: f.article } : {}), ...(f.decides ? { decides: f.decides } : {}), why: f.why,
}));
writeFileSync('src/domain/catalog/policy-fields.generated.ts', head(`lib/domain/policy-tier.ts (${rev('lib/domain/policy-tier.ts')})`)
  + `export const POLICY_LAYER_LABEL = ${JSON.stringify(POLICY_LAYER_LABEL, null, 2)} as const;\n\n`
  + `export const POLICY_FIELDS = ${JSON.stringify(policy, null, 2)} as const;\n`, 'utf8');

const settle = (SETTLEMENT_FIELDS as Record<string, unknown>[]).map((f) => ({
  key: f.key, label: f.label, group: f.group, type: f.type, ...(f.note ? { note: f.note } : {}),
}));
writeFileSync('src/domain/catalog/settlement-fields.generated.ts', head(`lib/domain/settlement-atom.ts (${rev('lib/domain/settlement-atom.ts')})`)
  + `export const SETTLEMENT_FIELDS = ${JSON.stringify(settle, null, 2)} as const;\n`, 'utf8');

console.log(`정책 ${policy.length}칸 · 정산 ${settle.length}칸 (묶음 ${[...new Set(settle.map((f) => f.group))].join(' · ')})`);
