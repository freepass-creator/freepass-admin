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

export const 요금축 = ['term', 'rent', 'dep', 'mile'] as const;
export const 차축 = ['status', 'kind', 'perk', 'supplier', 'cls', 'fuel'] as const;
export type 요금축 = (typeof 요금축)[number];
export type 차축 = (typeof 차축)[number];
export type 상품축 = 요금축 | 차축;

export const 상품축이름: [상품축, string][] = [
  ['status', '출고상태'], ['kind', '상품구분'], ['perk', '혜택'], ['term', '계약기간'],
  ['rent', '월 대여료'], ['dep', '보증금'], ['mile', '약정주행'], ['supplier', '공급사'], ['cls', '차급'], ['fuel', '연료'],
];

export const 요금맞음: Record<요금축, (o: Offer, k: string) => boolean> = {
  term: (o, k) => String(o.termMonths) === k,
  rent: (o, k) => 구간에(대여료구간, k, o.monthlyRent),
  dep: (o, k) => 구간에(보증금구간, k, o.deposit),
  mile: (o, k) => o.annualMileageKm !== undefined && String(o.annualMileageKm) === k,
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


export type ParsedProductSearch = {
  text: string;
  inferred: Partial<Record<상품축, string[]>>;
  tokens: { axis: 상품축; key: string; label: string }[];
};

/**
 * 검색창의 업무 말을 기존 facet 축으로 읽는다.
 * ★별도 검색 상태를 만들지 않는다 — 읽힌 조건도 URL facet과 같은 상품축/요금축 판정으로 흘린다.
 * 모르는 말은 text 에 남겨 차량명·차번·공급사 자유검색으로 보낸다.
 */
export function parseProductSearch(raw: string): ParsedProductSearch {
  let rest = ` ${raw.normalize('NFKC')} `;
  const inferred: Partial<Record<상품축, string[]>> = {};
  const tokens: ParsedProductSearch['tokens'] = [];
  const add = (axis: 상품축, key: string, label: string) => {
    const a = inferred[axis] ?? [];
    if (!a.includes(key)) a.push(key);
    inferred[axis] = a;
    if (!tokens.some((x) => x.axis === axis && x.key === key)) tokens.push({ axis, key, label });
  };
  const eat = (re: RegExp, axis: 상품축, key: string, label: string) => {
    if (!re.test(rest)) return;
    rest = rest.replace(re, ' ');
    add(axis, key, label);
  };

  // 계약기간은 실제 source-derived 기간이라 어떤 양의 개월 수도 읽는다.
  rest = rest.replace(/(\d{1,3})\s*개월/g, (_, n: string) => {
    const month = Number(n);
    if (Number.isInteger(month) && month > 0) add('term', String(month), `${month}개월`);
    return ' ';
  });

  rest = rest.replace(/(?:연\s*)?(\d+(?:\.\d+)?)\s*만\s*km/gi, (_, n: string) => {
    const km = Math.round(Number(n) * 10000);
    if (Number.isFinite(km) && km > 0) add('mile', String(km), `연 ${Number(n).toLocaleString('ko-KR')}만km`);
    return ' ';
  });
  eat(/무\s*보증|보증금\s*(?:0|없음?)/, 'dep', 'd0', '무보증');
  eat(/무\s*심사/, 'perk', '무심사', '무심사');
  eat(/(?:만\s*)?21\s*세|21살/, 'perk', '만21세', '만21세');
  eat(/경력\s*무관/, 'perk', '경력무관', '경력무관');
  eat(/즉시\s*출고/, 'status', '즉시출고', '즉시출고');
  eat(/하이브리드|하브|\bHEV\b/i, 'fuel', '하이브리드', '하이브리드');
  eat(/디젤/, 'fuel', '디젤', '디젤');
  eat(/가솔린|휘발유/, 'fuel', '가솔린', '가솔린');

  return { text: rest.replace(/\s+/g, ' ').trim(), inferred, tokens };
}

export function mergeProductSelections(
  explicit: Record<상품축, string[]>,
  inferred: Partial<Record<상품축, string[]>>,
): Record<상품축, string[]> {
  return Object.fromEntries(상품축이름.map(([axis]) => [
    axis,
    [...new Set([...(explicit[axis] ?? []), ...(inferred[axis] ?? [])])],
  ])) as Record<상품축, string[]>;
}
