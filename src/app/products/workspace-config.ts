import type { Offer } from '../../domain/product/types';
import {
  DEPOSIT_BANDS, OFFER_FINDER_AXES, PRODUCT_FINDER_AXES, RENT_BANDS, VEHICLE_MILEAGE_BANDS,
  type FinderAxis, type FinderLimits, type FinderRequirements,
} from '../../domain/search/finder';
export {
  offerWithinFinderLimits as offerWithinSearchLimits,
  productMeetsFinderRequirements as productMeetsSearchRequirements,
  productWithinFinderLimits as productWithinSearchLimits,
} from '../../domain/search/finder';
import { won } from '../_fn/fmt';

/** 목록 한 줄의 대표 요금 — 인수형은 가능하면 제외하고, 조건에 남은 Offer 중 최저 월 대여료. */
export function lead(offers: Offer[]): Offer | undefined {
  const plain = offers.filter((o) => !o.id.includes('인수형'));
  const pool = plain.length ? plain : offers;
  return pool.reduce<Offer | undefined>((a, b) => (!a || b.monthlyRent < a.monthlyRent ? b : a), undefined);
}

/** 지금 나갈 수 있는 것이 앞. */
export const STATUS_ORDER: Record<string, number> = { 즉시출고: 0, 출고가능: 1, 출고협의: 2 };

export const 대여료구간 = RENT_BANDS;
export const 보증금구간 = DEPOSIT_BANDS;
export const 현재주행구간 = VEHICLE_MILEAGE_BANDS;

export const 요금축 = OFFER_FINDER_AXES;
export const 차축 = PRODUCT_FINDER_AXES;
export type 요금축 = typeof 요금축[number];
export type 차축 = typeof 차축[number];
export type 상품축 = FinderAxis;

export const 상품축이름: [상품축, string][] = [
  ['status', '출고상태'], ['vc', '차종'], ['kind', '상품구분'], ['perk', '혜택'], ['term', '계약기간'],
  ['rent', '월 대여료'], ['dep', '보증금'], ['mile', '연 약정주행'],
  ['maker', '제조사'], ['cls', '차급'], ['year', '연식'], ['vmile', '현재 주행거리'],
  ['fuel', '연료'], ['credit', '심사'], ['supplier', '공급사'],
];

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
  limits: FinderLimits;
  /** 검색창에서 따로 적은 혜택조건은 각각 AND다. facet의 같은 축 OR 규칙과 섞지 않는다. */
  requirements: FinderRequirements;
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
  const limits: ParsedProductSearch['limits'] = {};
  const requirements: ParsedProductSearch['requirements'] = { perks: [] };
  const infer = (axis: 상품축, key: string) => {
    const a = inferred[axis] ?? [];
    if (!a.includes(key)) a.push(key);
    inferred[axis] = a;
  };
  const add = (axis: 상품축, key: string, label: string) => {
    infer(axis, key);
    if (!tokens.some((x) => x.axis === axis && x.key === key)) tokens.push({ axis, key, label });
  };
  const token = (axis: 상품축, key: string, label: string) => {
    if (!tokens.some((x) => x.axis === axis && x.key === key)) tokens.push({ axis, key, label });
  };
  const requirePerk = (key: string, label = key) => {
    if (!requirements.perks.includes(key)) requirements.perks.push(key);
    token('perk', `required:${key}`, label);
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

  // «연 N만km»만 약정주행이다. «N만km / 주행 N만km»는 차량 현재 주행거리로 읽는다.
  rest = rest.replace(/연\s*(\d+(?:\.\d+)?)\s*만\s*km/gi, (_, n: string) => {
    const km = Math.round(Number(n) * 10000);
    if (Number.isFinite(km) && km > 0) add('mile', String(km), `연 ${Number(n).toLocaleString('ko-KR')}만km`);
    return ' ';
  });
  rest = rest.replace(/(?:현재\s*)?(?:주행(?:거리)?\s*)?(\d+(?:\.\d+)?)\s*만\s*km\s*(?:이하|이내|밑)?/gi, (_, n: string) => {
    const max = Math.round(Number(n) * 10000);
    if (Number.isFinite(max) && max > 0) {
      limits.vehicleMileageMax = max;
      for (const b of 현재주행구간) if (max > b.lo) infer('vmile', b.k);
      token('vmile', `max:${max}`, `현재 주행 ${Number(n).toLocaleString('ko-KR')}만km 이하`);
    }
    return ' ';
  });
  // 금액 상한 — 기존 구간 facet을 여러 값 OR로 켠다. 별도 가격 엔진을 만들지 않는다.
  rest = rest.replace(/보증금\s*(\d+(?:\.\d+)?)\s*만(?:원)?\s*(?:이하|이내|밑)/g, (_, n: string) => {
    const max = Number(n) * 10000;
    limits.depositMax = max;
    // 상한이 구간 중간에 걸리면 그 구간도 후보로 넣고, 마지막에 실제 숫자로 다시 자른다.
    for (const b of 보증금구간) if (max > b.lo) infer('dep', b.k);
    token('dep', `max:${max}`, `보증금 ${Number(n).toLocaleString('ko-KR')}만원 이하`);
    return ' ';
  });
  rest = rest.replace(/(?:월\s*)?(\d+(?:\.\d+)?)\s*만(?:원)?\s*(?:이하|이내|밑)/g, (_, n: string) => {
    const max = Number(n) * 10000;
    limits.rentMax = max;
    for (const b of 대여료구간) if (max > b.lo) infer('rent', b.k);
    token('rent', `max:${max}`, `월 ${Number(n).toLocaleString('ko-KR')}만원 이하`);
    return ' ';
  });

  eat(/무\s*보증|보증금\s*(?:0|없음?)/, 'dep', 'd0', '무보증');
  if (/무\s*심사/.test(rest)) {
    rest = rest.replace(/무\s*심사/, ' ');
    requirePerk('무심사');
  }
  rest = rest.replace(/(?:만\s*)?(\d{2})\s*세|([2-9]\d)살/g, (matched, a: string, b: string) => {
    const age = Number(a || b);
    // 혜택의 만N세는 «최소 운전자 연령». 21세 고객은 최소연령 18~21 상품을 모두 탈 수 있다.
    if (age >= 18 && age <= 21) {
      requirements.driverAge = age;
      token('perk', `driver-age:${age}`, `만${age}세`);
      return ' ';
    }
    return matched;
  });
  for (const perk of ['경력무관', '소득확인', '신용조회', '분납가능', '무사고']) {
    const re = new RegExp(perk.replace(/(.{2})/, '$1\\s*'));
    if (re.test(rest)) { rest = rest.replace(re, ' '); requirePerk(perk); }
  }
  eat(/즉시\s*출고/, 'status', '즉시출고', '즉시출고');
  eat(/하이브리드|하브|\bHEV\b/i, 'fuel', '하이브리드', '하이브리드');
  eat(/디젤/, 'fuel', '디젤', '디젤');
  eat(/가솔린|휘발유/, 'fuel', '가솔린', '가솔린');

  return { text: rest.replace(/\s+/g, ' ').trim(), inferred, tokens, limits, requirements };
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
