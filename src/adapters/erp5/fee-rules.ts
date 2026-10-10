import { erp5 } from './firestore';
import { parseMewcarGaTable, type MewcarGaTable } from '../../domain/settlement/fee-rules-f04-extra';

/**
 * 예시공급사D 영업 GA 지급표 — 프리패스 데이터 수수료 규칙(settlement_fee_rules 의 예시공급사D 문서) `gaTable` 칸을 읽는다.
 * ★금액은 공개 코드에 두지 않는다(AI 상황실 10-05). 칸이 없거나 모양이 틀리면 null(«모른다») — 지어내지 않는다.
 */
export async function loadMewcarGaTable(): Promise<MewcarGaTable | null> {
  const snap = await erp5().collection('settlement_fee_rules').where('supplier', '==', '예시공급사D').get();
  const tables = snap.docs.map((d) => d.data().gaTable).filter((x) => x !== undefined);
  if (tables.length > 1) throw new Error('예시공급사D 지급표(gaTable)가 두 문서 이상에 있다 — 어느 것이 정본인지 정해야 한다');
  return tables.length ? parseMewcarGaTable(tables[0]) : null;
}
