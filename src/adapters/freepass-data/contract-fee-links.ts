import type { SettlementRow } from '../../domain/settlement/types';
import type { ContractFeeLinkItem, ContractFeeLinkReason, ContractFeeLinkResult,
  ContractFeeLinksClient, ContractFeeLinksRead } from '../../ports/admin-catalog-reader';
import { ContractFeeLinkItemSchema, FreePassDataAdminCatalogClient } from './admin-catalog-client';

const noPlate = /^(?:신차.*|미정|미등록|미배정|미출고|차량번호없음|차번없음|없음|대기|미확인|확인중|등록예정|배정예정|[-—?]+|n\/?a|null|undefined)$/i;

/** 표시 월의 접수만 받는다. 저장·재시도·금액 보정 없이 최대 500개씩 읽는다. */
export async function readContractFeeLinks(
  rows: readonly SettlementRow[], client: ContractFeeLinksClient = new FreePassDataAdminCatalogClient(),
): Promise<ContractFeeLinksRead> {
  const items: ContractFeeLinkItem[] = [];
  const excluded = new Map<string, ContractFeeLinkReason[]>();
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
  for (const row of rows) {
    const reasons: ContractFeeLinkReason[] = [];
    const plate = row.plate?.replace(/\s/g, '') ?? '';
    if (!plate || noPlate.test(plate)) reasons.push('NO_PLATE');
    if (!row.supplierCode?.trim()) reasons.push('NO_SUPPLIER_CODE');
    else if (!/^[A-Za-z0-9._:-]+$/.test(row.supplierCode)) reasons.push('INVALID_SUPPLIER_CODE');
    if (!row.id.trim() || row.id.length > 120 || counts.get(row.id)! > 1) reasons.push('INVALID_KEY');
    if (row.term === null || !Number.isInteger(row.term) || row.term < 1 || row.term > 120) reasons.push('INVALID_TERM');
    if (row.rent === null || !Number.isFinite(row.rent) || row.rent < 0
      || (row.deposit !== null && (!Number.isFinite(row.deposit) || row.deposit < 0))) reasons.push('INVALID_CONDITION');
    if (reasons.length) { excluded.set(row.id, reasons); continue; }
    items.push(ContractFeeLinkItemSchema.parse({
      key: row.id, plate, supplierId: row.supplierCode, termMonths: row.term, monthlyRent: row.rent,
      ...(row.deposit === null ? {} : { deposit: row.deposit }),
    }));
  }
  const results = new Map<string, ContractFeeLinkResult>();
  try {
    for (let offset = 0; offset < items.length; offset += 500) {
      const batch = items.slice(offset, offset + 500);
      const response = await client.contractFeeLinks(batch);
      const keys = new Set(batch.map(item => item.key));
      if (response.length !== keys.size || new Set(response.map(r => r.key)).size !== keys.size
        || response.some(r => !keys.has(r.key))) throw new Error('CONTRACT_FEE_LINKS_INVALID_RESPONSE');
      for (const result of response) results.set(result.key, result);
    }
    return { status: 'READY', results, excluded };
  } catch (error) {
    // upstream 원문에는 민감정보가 있을 수 있다. 안전한 코드만 화면/CSV에 전달한다.
    const http = error instanceof Error ? /^FREEPASS_DATA_HTTP_(\d{3})$/.exec(error.message)?.[1] : undefined;
    const code = http ?? (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
      ? 'TIMEOUT' : error instanceof Error && (error.name === 'ZodError'
        || error.message === 'CONTRACT_FEE_LINKS_INVALID_RESPONSE') ? 'INVALID_RESPONSE' : 'UNAVAILABLE');
    return { status: 'UNAVAILABLE', code };
  }
}
