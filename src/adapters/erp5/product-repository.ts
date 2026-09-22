import { createHash } from 'node:crypto';
import type { ProductRepository } from '../../ports/repositories';
import type { CanonicalProduct } from '../../domain/product/types';
import { erp5 } from './firestore';
import { toCanonicalProduct, type Erp5Doc, type SkipReason } from './to-canonical';
import { loadMasterIndex } from './vehicle-master';

/**
 * **상품 문 뒤 — ERP5 Firestore.** 대표 2026-09-18 「erp5 ssot 를 «직접» 읽는거야」
 *
 * ★문(`ProductRepository`)은 «안 바뀐다». 파일 어댑터도 «안 지운다» — 시험이 그걸 쓴다.
 *   문 뒤가 하나 늘었을 뿐이다. 이게 「자격증명이 오면 문 뒤만 갈아 끼운다」 의 뜻이다.
 *
 * ★시트를 «안 거친다». 전에는 공급사시트 21곳 → 판매시트 3탭 → ERP 였고
 *   `aiops/docs/SHEET_MAP.md` 에 「ERP 가 이걸 그대로 읽는다」 고 적혀 있었다.
 *   ERP5 가 정본이 됐으므로 여기서 바로 읽는다. ⇒ 그 지도도 고쳐야 한다.
 */

/** 못 옮긴 줄 — 왜 빠졌는지 «세어» 둔다. 조용히 사라지면 대수가 갈린다. */
export type SkipTally = Record<SkipReason, number>;

export type Erp5ReadReport = {
  project: string;
  source: 'freepasserp5.products';
  readAt: string;
  /** 목록과 건수·필터가 같은 원본 집합을 보았는지 대조하는 안정 revision. */
  queryRevision: string;
  /** ERP5 `products` 문서 수 — 우리가 거른 뒤가 아니라 «있는 그대로». */
  docs: number;
  /** 우리 상품으로 옮겨진 수. */
  mapped: number;
  /** 못 옮긴 까닭별 수. */
  skipped: SkipTally;
  /** 옮겼지만 «미심쩍은» 것 — 정책 없음·차종 미등록 등. 버리지 않고 알린다. */
  warnings: number;
};

const 빈셈 = (): SkipTally => ({ NOT_LISTABLE: 0, NO_CAR_NUMBER: 0, NO_PRICE: 0, NO_VALID_OFFER: 0 });

function stableValue(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  const timestamp = value as { toDate?: () => Date };
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

/** 읽은 시각이 아니라 원문/Canonical 내용에 묶인다. 같은 상품은 다시 읽어도 같은 ID다. */
export function productSnapshotId(docId: string, data: Erp5Doc, material: unknown = data): string {
  const declared = [data.source_snapshot_id, data.sourceSnapshotId, data.snapshot_id]
    .find((value) => typeof value === 'string' && value.trim());
  const sourceRevision = typeof declared === 'string' ? declared.trim() : 'UNVERSIONED';
  return `freepasserp5.products:${docId}:${sourceRevision}:sha256:${digest(material)}`;
}

function bindSnapshotId(docId: string, data: Erp5Doc, product: CanonicalProduct): CanonicalProduct {
  const material = { ...product, sourceSnapshotId: '' };
  return { ...product, sourceSnapshotId: productSnapshotId(docId, data, material) };
}

function queryRevision(rows: CanonicalProduct[]): string {
  return `sha256:${digest(rows.map((row) => [row.id, row.sourceSnapshotId]).sort(([a], [b]) => a.localeCompare(b)))}`;
}

export class Erp5ProductRepository implements ProductRepository {
  /** 마지막으로 읽은 결과 — 화면이 「몇 대 중 몇 대인지」 를 말할 수 있게 들고 있는다. */
  private lastReport: Erp5ReadReport | null = null;

  report(): Erp5ReadReport | null { return this.lastReport; }

  async list(): Promise<CanonicalProduct[]> {
    const db = erp5();
    const readAt = new Date().toISOString();

    /**
     * 정책을 «한 번에» 읽어 둔다 — 상품마다 부르면 1,615번 왕복한다.
     * ★실측(2026-09-18) policy 81건뿐이라 통째로 들고 있어도 가볍다.
     */
    const [products, policies, master] = await Promise.all([
      db.collection('products').get(),
      db.collection('policy').get(),
      loadMasterIndex(),
    ]);
    const policyBy = new Map<string, Erp5Doc>();
    for (const d of policies.docs) policyBy.set(d.id, d.data() as Erp5Doc);

    const rows: CanonicalProduct[] = [];
    const skipped = 빈셈();
    let warnings = 0;

    for (const d of products.docs) {
      const data = d.data() as Erp5Doc;
      const code = typeof data.policy_code === 'string' ? data.policy_code.trim() : '';
      const result = toCanonicalProduct(data, d.id, code ? policyBy.get(code) : undefined, 'PENDING', master);
      if (!result.ok) { skipped[result.reason] += 1; continue; }
      if (result.warnings.length) warnings += 1;
      rows.push(bindSnapshotId(d.id, data, result.product));
    }

    this.lastReport = {
      project: 'freepasserp5', source: 'freepasserp5.products', readAt,
      queryRevision: queryRevision(rows),
      docs: products.size, mapped: rows.length, skipped, warnings,
    };
    return rows;
  }

  async get(id: string): Promise<CanonicalProduct | null> {
    /**
     * ⚠ 문서 id 가 «차번» 인 것도 있고 `product_code` 인 것도 있다(ERP5 이관 자국).
     *   그래서 doc(id) 한 번으로 못 끝낸다 — 없으면 product_code 로 한 번 더 찾는다.
     *   ★없으면 null 이다. 「못 찾았다」 를 빈 상품으로 지어내지 않는다.
     */
    const db = erp5();
    let docId = id;
    let data: Erp5Doc | null = null;
    const direct = await db.collection('products').doc(id).get();
    if (direct.exists) data = direct.data() as Erp5Doc;
    else {
      const hit = await db.collection('products').where('product_code', '==', id).limit(1).get();
      if (hit.empty) return null;
      docId = hit.docs[0].id;
      data = hit.docs[0].data() as Erp5Doc;
    }

    const code = typeof data.policy_code === 'string' ? data.policy_code.trim() : '';
    const policy = code ? (await db.collection('policy').doc(code).get()).data() as Erp5Doc | undefined : undefined;
    const result = toCanonicalProduct(data, docId, policy, 'PENDING', await loadMasterIndex());
    return result.ok ? bindSnapshotId(docId, data, result.product) : null;
  }

  /**
   * ★쓰지 «않는다». ERP5 는 공급사 시트에서 채워지는 정본이고, 상품을 우리가 고치는 일은
   *   아직 정해지지 않았다(대표 2026-09-18 — 상품찾기는 «갖고 오는» 일이다).
   * ⚠ 조용히 아무것도 안 하고 성공한 척하면, 부르는 쪽은 저장된 줄 안다. 그게 더 나쁘다.
   *   ⇒ 이름을 대고 던진다. 쓰기가 필요해지면 그때 양식을 열고 여기를 채운다.
   */
  async save(): Promise<CanonicalProduct> {
    throw new Error('ERP5 상품은 읽기 전용이다 — 쓰기는 아직 정해지지 않았다.');
  }
}
