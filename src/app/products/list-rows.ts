import type { CanonicalProduct, Offer } from '../../domain/product/types';
import { vehicleName } from '../_fn/product';
import { sp, txt, won } from '../_fn/fmt';
import { imgSrc } from '../../server/image-proxy';
import type { BoardRow } from './BoardList';

/**
 * 판 목록 줄 — 첫 화면(board.tsx)과 «더 불러오기»(list-actions.ts)가 같은 함수로 줄을 만든다(두 벌로 갈리지 않게).
 * ★한 번에 보내는 줄 수(PAGE) — 700대를 매 클릭마다 다시 보내면 느리다(대표 2026-09-22 「빠릿빠릿하지 않다」).
 */
export const PAGE = 40;

export type Q = Record<string, string | string[] | undefined>;
export const flat = (q: Q) => Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)]).filter(([, v]) => v)) as Record<string, string>;

/** 지금 주소 + 바꿀 칸 → 새 주소. 알림(created · exists)은 한 번만 */
export function keepUrl(q: Q, base: string, extra: Record<string, string>) {
  const u = new URLSearchParams(flat(q));
  for (const k of ['created', 'exists']) u.delete(k);
  for (const [k, v] of Object.entries(extra)) { if (v) u.set(k, v); else u.delete(k); }
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

export const 이름 = (p: CanonicalProduct) => p.vehicle.subModelId || p.vehicle.modelId || vehicleName(p) || p.id;
export const 공급사 = (p: CanonicalProduct) => p.supplierName ?? p.supplierId;
export const 요금줄 = (o?: Offer) => (o ? `${o.termMonths}개월 · 월 ${won(o.monthlyRent)}원` : '요금 없음');
export const 사진들 = (p: CanonicalProduct) =>
  (p.photos?.length ? p.photos : p.photoUrl ? [p.photoUrl] : []).filter((x) => x && x.trim()).map((x) => imgSrc(x)).filter((x): x is string => !!x);

/** 상품 목록 줄 */
export function productRows(sorted: { product: CanonicalProduct; lead?: Offer }[], q: Q, base: string): BoardRow[] {
  return sorted.map(({ product: p, lead: o }) => ({
    id: p.id,
    href: keepUrl(q, base, { id: p.id, offer: '', v: 'detail', w: '' }),
    kind: p.productKind ?? undefined,
    title: 이름(p),
    tag: p.perks?.[0],
    meta: [공급사(p), p.registration?.vehicleNumber, txt(p.status)].filter(Boolean).join(' · '),
    value: 요금줄(o),
    thumb: 사진들(p)[0],
  }));
}

/** 첫 화면에 보낼 창 — 앞 PAGE 줄, 고른 줄이 뒤에 있으면 그 뒤 20 까지 */
export function firstWindow<T extends { id: string }>(rows: T[], selectedId?: string) {
  const i = selectedId ? rows.findIndex((r) => r.id === selectedId) : -1;
  return rows.slice(0, Math.max(PAGE, i + 20));
}
