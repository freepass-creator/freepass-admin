import { z } from 'zod';
import type { CanonicalProduct } from '../../../domain/product/types';

export const fields = [
  ['receiptDate', '접수일', 'date'], ['plate', '차량번호', 'text'],
  ['supplier', '공급사', 'text'], ['product', '상품구분', 'text'],
  ['model', '차종', 'text'], ['customer', '고객명', 'text'],
  ['channel', '영업채널', 'text'], ['agent', '영업담당자', 'text'],
  ['term', '기간(개월)', 'number'], ['rent', '월 대여료', 'number'],
  ['billingMonth', '청구월', 'month'], ['claim', '청구액(공급가액)', 'number'],
  ['pay', '지급액(공급가액)', 'number'], ['memo', '메모', 'text'],
] as const;
export const extraFields = [
  ['deposit', '보증금', 'text'], ['vehiclePrice', '차량가액', 'number'],
  ['installment', '분납여부', 'text'], ['deliveryDate', '인도일', 'date'],
  ['nextRoundDate', '다음회차일', 'date'], ['refundReason', '환수사유', 'text'],
  ['refundDate', '환수일', 'date'], ['refundAmount', '환수금액', 'number'],
  ['rentKind', '렌트구분', 'text'], ['supplierRate', '공급사수수료율', 'text'],
  ['salesFee', '판매수수료', 'number'], ['supplierIncentive', '공급사인센티브', 'number'],
  ['supplierVat', '공급사부가세', 'number'], ['claimGross', '청구금액(부가세 포함)', 'number'],
  ['agencyRate', '에이전시수수료율', 'text'], ['deliveryFee', '출고수수료', 'number'],
  ['agencyIncentive', '에이전시인센티브', 'number'], ['documentFee', '계약서대행료', 'number'],
  ['agencyVat', '에이전시부가세', 'number'], ['payGross', '지급합계(부가세 포함)', 'number'],
  ['contractNumber', '계약번호', 'text'], ['contractKind', '계약형태', 'text'],
  ['age', '연령', 'text'], ['contractRent', '계약대여료', 'number'],
  ['upsell', '업셀링금액', 'number'], ['region', '출고지역', 'text'],
  ['writer', '계약서작성담당', 'text'], ['remarks', '비고', 'text'],
  ['sourceTab', '원본탭', 'text'], ['agentCode', '영업자코드', 'text'],
  ['paidRounds', '납입회차', 'number'], ['claimAdjustment', '청구가감', 'number'],
  ['payAdjustment', '지급가감', 'number'], ['adjustmentReason', '가감사유', 'text'],
  ['claimLink', '청구서 링크', 'text'], ['claimSentDate', '청구 최종발송일', 'date'],
  ['claimProof', '청구 발송증빙', 'text'], ['collectedAmount', '수금 누계액', 'number'],
  ['collectionDate', '최종 수금일', 'date'], ['collectionProof', '수금 증빙', 'text'],
  ['payLink', '지급명세서 링크', 'text'], ['paySentDate', '지급 최종발송일', 'date'],
  ['payProof', '지급 발송증빙', 'text'], ['paidAmount', '지급 누계액', 'number'],
  ['paymentDate', '최종 지급일', 'date'], ['paymentProof', '지급 증빙', 'text'],
  ['history', '처리 이력(수기)', 'text'],
] as const;
const allFields = [...fields, ...extraFields];
// F04 접수 A:O 중 직원 입력. 진행/청구/수수료는 접수 후 관리한다.
export const intakeKeys = ['receiptDate', 'plate', 'supplier', 'model', 'channel', 'agent', 'customer', 'memo', 'product', 'term', 'rent', 'deposit', 'vehiclePrice', 'installment'] as const;
export const intakeFields = intakeKeys.map(key => allFields.find(field => field[0] === key)!);
export const followupFields = ['deliveryDate', 'billingMonth'].map(key => allFields.find(field => field[0] === key)!);
export const feeFields = fields.filter(([key]) => key === 'claim' || key === 'pay');
export const checks = [['contract', '계약서'], ['documents', '서류'], ['balance', '잔금'],
  ['delivered', '인도'], ['claimed', '청구'], ['collected', '수금'], ['paid', '지급'], ['cancelled', '취소']] as const;
export type Field = typeof allFields[number][0];
export type Check = typeof checks[number][0];
const texts = Object.fromEntries(allFields.map(([key]) => [key, z.string().max(5000).default('')])) as Record<Field, z.ZodDefault<z.ZodString>>;
const flags = Object.fromEntries(checks.map(([key]) => [key, z.boolean()])) as Record<Check, z.ZodBoolean>;
export const rowSchema = z.object({ id: z.string().min(1), ...texts, plate: z.string().max(5000), receiptDate: z.string().max(5000), ...flags, refunded: z.boolean().default(false) });
export type Row = z.infer<typeof rowSchema>;
export type CatalogChoice = {
  key: string; productId: string; offerId: string; version: number; snapshot: string;
  supplier: string; model: string; product: string; term: string; rent: string; deposit: string; vehiclePrice: string;
};
export const normalizedPlate = (value: string) => value.replace(/\s|-/g, '').toUpperCase();
export function plateChoices(products: CanonicalProduct[], plate: string): CatalogChoice[] {
  const target = normalizedPlate(plate);
  if (!target) return [];
  return products.filter(p => normalizedPlate(p.registration?.vehicleNumber ?? '') === target).flatMap(p => p.offers.map(o => ({
    key: JSON.stringify([p.id, o.id]), productId:p.id, offerId:o.id, version:p.version, snapshot:p.sourceSnapshotId,
    supplier:o.supplierName ?? p.supplierName ?? '', model:p.vehicle.subModelId || p.vehicle.modelId || '',
    product:p.productKind ?? '', term:Number.isFinite(o.termMonths) ? String(o.termMonths) : '',
    rent:Number.isFinite(o.monthlyRent) ? String(o.monthlyRent) : '', deposit:o.deposit == null ? '' : String(o.deposit),
    vehiclePrice:p.consumerPrice == null ? '' : String(p.consumerPrice),
  })));
}
export const savedSchema = z.object({ version: z.union([z.literal(1), z.literal(2)]), rows: z.array(rowSchema) });
export function normalizeRow(row: Row): Row {
  return { ...row, ...Object.fromEntries(allFields.filter(([, , type]) => type === 'number').map(([key]) => [key, row[key].replaceAll(',', '').trim()])) };
}
export function blankRow(id: string, date: string): Row {
  return rowSchema.parse({ id, ...Object.fromEntries(allFields.map(([key]) => [key, key === 'receiptDate' ? date : ''])),
    ...Object.fromEntries(checks.map(([key]) => [key, false])) });
}
export function validateRow(row: Row): string | null {
  if (!row.plate.trim()) return '차량번호를 입력해 주세요.';
  for (const [key, label, type] of allFields) {
    if (type === 'number' && row[key] !== '' && (!row[key].trim() || !Number.isFinite(Number(row[key])) || (['term', 'rent', 'vehiclePrice', 'paidRounds'].includes(key) && Number(row[key]) < 0))) return `${label}에 올바른 숫자를 입력해 주세요.`;
  }
  return null;
}
