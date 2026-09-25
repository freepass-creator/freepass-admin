import type { EsignSnapshot } from './types';

const S = (v: unknown) => String(v ?? '').trim();
const N = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const B = (v: unknown) => v === true || v === 'true' || v === 'TRUE';
/** 접수 원장은 레거시 꼴(Y · 1 · 참)이 섞여 있다 — 취소 판정은 넓게 본다 */
const legacyTrue = (v: unknown) => v === true || v === 1 || /^(true|y|1|참|o)$/i.test(S(v));

/**
 * 승인(봉인) 직전에 계약이 «아직 서명 확정해도 되는 상태»인지 본다.
 * 발행 때의 검사(service.snapshot)와 같은 기준을 한 번 더 적용하고, 발행 뒤 계약 조건이 바뀌었으면 막는다.
 * ★고객이 제출한 뒤 ERP 에서 계약이 취소되거나 금액이 바뀐 상태로 「계약완료」를 덮어쓰면 안 된다.
 * @returns 막아야 하면 사람이 읽을 까닭, 괜찮으면 null
 */
export function signabilityProblem(
  contract: Record<string, unknown> | null | undefined,
  snapshot: Pick<EsignSnapshot, 'rent' | 'termMonths' | 'deposit' | 'plate' | 'supplierCode'>,
  intake?: Record<string, unknown> | null,
): string | null {
  if (!contract) return '계약을 찾을 수 없습니다.';
  if (B(contract._deleted) || B(contract.is_test) || B(contract.test_only)) return '삭제/시험 계약은 서명 완료할 수 없습니다.';
  if (/취소|철회/.test(S(contract.contract_status))) return '취소·철회된 계약은 서명 완료할 수 없습니다.';
  if (intake && legacyTrue(intake.cancelled)) return '원본 접수가 취소되어 서명 완료할 수 없습니다.';

  const changed: string[] = [];
  if (N(contract.rent_amount_snapshot) !== snapshot.rent) changed.push('월 대여료');
  if (N(contract.rent_month_snapshot) !== snapshot.termMonths) changed.push('대여기간');
  if (N(contract.deposit_amount_snapshot) !== snapshot.deposit) changed.push('보증금');
  if (S(contract.car_number_snapshot || contract.car_number) !== S(snapshot.plate)) changed.push('차량번호');
  if (S(contract.provider_company_code) !== S(snapshot.supplierCode)) changed.push('공급사');
  if (changed.length) {
    return '발행 뒤 계약 조건이 바뀌었습니다(' + changed.join(' · ') + ') — 전자계약을 다시 발행해 주세요.';
  }
  return null;
}
