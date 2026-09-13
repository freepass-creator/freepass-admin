import type { Offer } from './types';

export const TERM_OPTIONS = [1, 6, 12, 24, 36, 60] as const;

export function money(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function offerSummary(offer: Offer) {
  return `${offer.termMonths}개월 · 월 ${money(offer.monthlyRent)} · 보증금 ${offer.deposit === undefined ? '미확인' : money(offer.deposit)} · 연 ${offer.annualMileageKm?.toLocaleString('ko-KR') ?? '미확인'}km`;
}
