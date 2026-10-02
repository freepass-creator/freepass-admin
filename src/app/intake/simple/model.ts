import { z } from 'zod';

export const fields = [
  ['receiptDate', '접수일', 'date'], ['plate', '차량번호', 'text'],
  ['supplier', '공급사', 'text'], ['product', '상품구분', 'text'],
  ['model', '차종', 'text'], ['customer', '고객명', 'text'],
  ['channel', '영업회사', 'text'], ['agent', '영업담당자', 'text'],
  ['term', '기간(개월)', 'number'], ['rent', '월 대여료', 'number'],
  ['billingMonth', '청구월', 'month'], ['claim', '청구액(공급가액)', 'number'],
  ['pay', '지급액(공급가액)', 'number'], ['memo', '메모', 'text'],
] as const;
export const checks = [['contract', '계약'], ['documents', '서류'], ['balance', '잔금'],
  ['delivered', '인도'], ['claimed', '청구'], ['collected', '수금'], ['paid', '지급'], ['cancelled', '취소']] as const;
export type Field = typeof fields[number][0];
export type Check = typeof checks[number][0];
const texts = Object.fromEntries(fields.map(([key]) => [key, z.string().max(5000)])) as Record<Field, z.ZodString>;
const flags = Object.fromEntries(checks.map(([key]) => [key, z.boolean()])) as Record<Check, z.ZodBoolean>;
export const rowSchema = z.object({ id: z.string().min(1), ...texts, ...flags });
export type Row = z.infer<typeof rowSchema>;
export const savedSchema = z.object({ version: z.literal(1), rows: z.array(rowSchema) });
export function blankRow(id: string, date: string): Row {
  return rowSchema.parse({ id, ...Object.fromEntries(fields.map(([key]) => [key, key === 'receiptDate' ? date : ''])),
    ...Object.fromEntries(checks.map(([key]) => [key, false])) });
}
export function validateRow(row: Row): string | null {
  if (!row.plate.trim()) return '차량번호를 입력해 주세요.';
  for (const [key, label, type] of fields) {
    if (type === 'number' && row[key] !== '' && (!Number.isFinite(Number(row[key])) || (key !== 'claim' && key !== 'pay' && Number(row[key]) < 0))) return `${label}에 올바른 숫자를 입력해 주세요.`;
  }
  return null;
}
