'use server';

import { requireAdmin } from '../../server/require-admin';
import { settlements, today } from '../../server/erp5';
import { productView } from './product-view';
import { PAGE, keepUrl, productRows } from './list-rows';
import { intakeListModel } from '../intake/intake-list-model';
import type { BoardRow } from './BoardList';

/**
 * 목록 «더 불러오기» — 첫 화면이 PAGE 줄만 보내고, 끝에 닿으면 여기서 다음 PAGE 줄을 받는다.
 * ★읽기만 한다. 거름 · 차례는 첫 화면과 같은 함수(productView · intakeListModel)라 줄이 어긋나지 않는다.
 */
export async function moreProductRows(q: Record<string, string>, base: string, offset: number): Promise<BoardRow[]> {
  if (await requireAdmin()) return [];
  const pv = await productView(q);
  if ('error' in pv) return [];
  return productRows(pv.sorted.slice(offset, offset + PAGE), q, base === '/intake' ? '/intake' : '/products');
}

export async function moreIntakeRows(q: Record<string, string>, offset: number): Promise<BoardRow[]> {
  if (await requireAdmin()) return [];
  const all = (await settlements.list()).map((x) => x.row);
  const m = intakeListModel(all, q, (extra) => keepUrl(q, '/intake', extra), today());
  return m.rows.slice(offset, offset + PAGE);
}
