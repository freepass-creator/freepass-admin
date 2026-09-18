import type { Offer } from '../../domain/product/types';
import { won } from '../_fn/fmt';

/** 목록 한 줄의 대표 요금 — 인수형은 가능하면 제외하고, 조건에 남은 Offer 중 최저 월 대여료. */
export function lead(offers: Offer[]): Offer | undefined {
  const plain = offers.filter((o) => !o.id.includes('인수형'));
  const pool = plain.length ? plain : offers;
  return pool.reduce<Offer | undefined>((a, b) => (!a || b.monthlyRent < a.monthlyRent ? b : a), undefined);
}

/** 지금 나갈 수 있는 것이 앞. */
export const STATUS_ORDER: Record<string, number> = { 즉시출고: 0, 출고가능: 1, 출고협의: 2 };

export type RangeBand = { k: string; label: string; lo: number; hi: number };

export const 대여료구간: RangeBand[] = [
  { k: 'r50', label: '50만↓', lo: 0, hi: 500000 }, { k: 'r60', label: '50~60만', lo: 500000, hi: 600000 },
  { k: 'r70', label: '60~70만', lo: 600000, hi: 700000 }, { k: 'r80', label: '70~80만', lo: 700000, hi: 800000 },
  { k: 'r90', label: '80~90만', lo: 800000, hi: 900000 }, { k: 'r100', label: '90~100만', lo: 900000, hi: 1000000 },
  { k: 'r150', label: '100~150만', lo: 1000000, hi: 1500000 }, { k: 'r200', label: '150만↑', lo: 1500000, hi: Infinity },
];

export const 보증금구간: RangeBand[] = [
  { k: 'd0', label: '없음', lo: -1, hi: 1 }, { k: 'd1', label: '100만↓', lo: 1, hi: 1000000 },
  { k: 'd2', label: '100~200만', lo: 1000000, hi: 2000000 }, { k: 'd3', label: '200~300만', lo: 2000000, hi: 3000000 },
  { k: 'd4', label: '300만↑', lo: 3000000, hi: Infinity },
];

const 구간에 = (bands: RangeBand[], k: string, n?: number | null) => {
  const b = bands.find((x) => x.k === k);
  return !!b && n !== undefined && n !== null && n > b.lo && n <= b.hi;
};

export const 요금축 = ['term', 'rent', 'dep'] as const;
export const 차축 = ['status', 'kind', 'perk', 'supplier', 'cls', 'fuel'] as const;
export type 요금축 = (typeof 요금축)[number];
export type 차축 = (typeof 차축)[number];
export type 상품축 = 요금축 | 차축;

export const 상품축이름: [상품축, string][] = [
  ['status', '출고상태'], ['kind', '상품구분'], ['perk', '혜택'], ['term', '계약기간'],
  ['rent', '월 대여료'], ['dep', '보증금'], ['supplier', '공급사'], ['cls', '차급'], ['fuel', '연료'],
];

export const 요금맞음: Record<요금축, (o: Offer, k: string) => boolean> = {
  term: (o, k) => String(o.termMonths) === k,
  rent: (o, k) => 구간에(대여료구간, k, o.monthlyRent),
  dep: (o, k) => 구간에(보증금구간, k, o.deposit),
};

/** 받은 값의 차례 — 많이 있는 것부터, 동률은 가나다순. */
export const 많은순 = (vals: string[]) => {
  const m = new Map<string, number>();
  for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).map(([k]) => k);
};

/** 0은 없음, null/undefined는 모름. */
export const 보증금 = (n?: number | null) => (n === undefined || n === null ? '—' : n === 0 ? '없음' : `${won(n)}원`);

export const 정책말 = (s?: 'CONFIRMED' | 'INFERRED' | 'MISSING'): string | undefined =>
  s === 'INFERRED' ? '정책 추정' : s === 'MISSING' ? '정책 없음' : undefined;
