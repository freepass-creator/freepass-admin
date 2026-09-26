/**
 * **가상 데이터 모드 — `FPA_DEMO=on`.** 대표 요청: 자격증명이 없을 때 «가상 데이터로» 화면을 검토한다.
 *
 * ★켜는 법: `FPA_DEMO=on` (개발 · 미리보기 배포만). ★`VERCEL_ENV=production` 이면 무엇을 넣어도 «꺼진다».
 * ★읽기 전용이다 — 쓰는 메서드는 전부 이름을 대고 던진다. 쓰기 열쇠(`ERP5_WRITE`)도 이 모드에서는 안 돈다.
 * ★실 ERP5 에는 «붙지 않는다» — `erp5()` 가 이 가짜를 돌려주므로 자격증명이 있어도 실제 원장을 읽지 않는다.
 *   화면은 `demoMode()` 로 «가상 데이터» 표시를 세운다.
 *
 * 흉내 내는 것은 어댑터가 «실제로 쓰는» firebase-admin Firestore 모양뿐이다 —
 *   collection().get() · doc().get() · where(==, in, …).limit().get() · runTransaction(tx.get) ·
 *   스냅샷의 docs · size · empty · forEach · id · exists · data() · ref · updateTime.toMillis().
 */
import type { Firestore } from 'firebase-admin/firestore';
import { demoCollections, type DemoCollections, type DemoDoc } from './demo-fixtures';

export const DEMO_READ_ONLY = '데모 데이터 모드는 읽기 전용입니다';
export const DEMO_PROJECT = 'demo';

/** 가상 데이터 모드인가 — `FPA_DEMO=on` 이고 운영 배포(VERCEL_ENV=production)가 아닐 때만. */
export function demoMode(): boolean {
  return process.env.FPA_DEMO?.trim() === 'on' && process.env.VERCEL_ENV?.trim() !== 'production';
}

const readOnly = (): never => { throw new Error(DEMO_READ_ONLY); };

/** 한 프로세스에서 고정 — 상품 revision(updateTime)이 부를 때마다 바뀌지 않게. */
const LOADED_AT = Date.now();
const fakeTimestamp = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms), seconds: Math.floor(ms / 1000), nanoseconds: 0 });

/** 한국 날짜가 바뀌면 다시 짓는다 — 날짜가 「오늘」 기준이라서. */
let cache: { day: string; data: DemoCollections } | null = null;
function store(): DemoCollections {
  const day = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  if (!cache || cache.day !== day) cache = { day, data: demoCollections() };
  return cache.data;
}

type Op = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains' | 'array-contains-any';
type Filter = { field: string; op: Op; value: unknown };

const fieldOf = (d: DemoDoc, path: string): unknown =>
  path.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), d);

function matches(d: DemoDoc, f: Filter): boolean {
  const v = fieldOf(d, f.field);
  const cmp = (a: unknown, b: unknown) => (a as number | string) < (b as number | string) ? -1 : (a as number | string) > (b as number | string) ? 1 : 0;
  switch (f.op) {
    case '==': return v === f.value;
    case '!=': return v !== undefined && v !== f.value;
    case '<': return v !== undefined && cmp(v, f.value) < 0;
    case '<=': return v !== undefined && cmp(v, f.value) <= 0;
    case '>': return v !== undefined && cmp(v, f.value) > 0;
    case '>=': return v !== undefined && cmp(v, f.value) >= 0;
    case 'in': return Array.isArray(f.value) && f.value.includes(v);
    case 'not-in': return Array.isArray(f.value) && v !== undefined && !f.value.includes(v);
    case 'array-contains': return Array.isArray(v) && v.includes(f.value);
    case 'array-contains-any': return Array.isArray(v) && Array.isArray(f.value) && v.some((x) => (f.value as unknown[]).includes(x));
    default: throw new Error(`데모 Firestore 가 모르는 조건입니다: ${String(f.op)}`);
  }
}

class DemoDocSnapshot {
  readonly exists: boolean;
  readonly updateTime: ReturnType<typeof fakeTimestamp> | undefined;
  readonly createTime: ReturnType<typeof fakeTimestamp> | undefined;
  constructor(readonly ref: DemoDocRef, private readonly raw: DemoDoc | undefined) {
    this.exists = raw !== undefined;
    this.updateTime = raw ? fakeTimestamp(LOADED_AT) : undefined;
    this.createTime = this.updateTime;
  }
  get id() { return this.ref.id; }
  /** ★사본을 준다 — 부르는 쪽이 고쳐도 가짜 원장이 안 바뀐다. */
  data(): DemoDoc | undefined { return this.raw === undefined ? undefined : structuredClone(this.raw); }
  get(field: string): unknown { return this.raw === undefined ? undefined : structuredClone(fieldOf(this.raw, field)); }
}

class DemoQuerySnapshot {
  constructor(readonly docs: DemoDocSnapshot[]) {}
  get size() { return this.docs.length; }
  get empty() { return this.docs.length === 0; }
  forEach(fn: (d: DemoDocSnapshot) => void) { this.docs.forEach(fn); }
}

class DemoDocRef {
  constructor(readonly parent: DemoCollectionRef, readonly id: string) {}
  get path() { return `${this.parent.id}/${this.id}`; }
  async get() { return this.snapshot(); }
  snapshot() { return new DemoDocSnapshot(this, store()[this.parent.id]?.[this.id]); }
  collection(): never { return readOnly(); }
  set(): never { return readOnly(); }
  update(): never { return readOnly(); }
  create(): never { return readOnly(); }
  delete(): never { return readOnly(); }
}

class DemoQuery {
  constructor(readonly id: string, protected readonly filters: Filter[] = [], protected readonly max: number | null = null) {}
  where(field: string, op: Op, value: unknown): DemoQuery { return new DemoQuery(this.id, [...this.filters, { field, op, value }], this.max); }
  limit(n: number): DemoQuery { return new DemoQuery(this.id, this.filters, n); }
  run(): DemoQuerySnapshot {
    const col = new DemoCollectionRef(this.id);
    const docs = Object.entries(store()[this.id] ?? {})
      .filter(([, d]) => this.filters.every((f) => matches(d, f)))
      .map(([docId]) => col.doc(docId).snapshot());
    return new DemoQuerySnapshot(this.max === null ? docs : docs.slice(0, this.max));
  }
  async get() { return this.run(); }
}

class DemoCollectionRef extends DemoQuery {
  constructor(id: string) { super(id); }
  doc(id?: string): DemoDocRef {
    if (!id) return readOnly();   // 자동 id 는 새로 쓸 때만 쓴다
    return new DemoDocRef(this, id);
  }
  add(): never { return readOnly(); }
}

class DemoTransaction {
  async get(target: DemoDocRef | DemoQuery) {
    return target instanceof DemoDocRef ? target.snapshot() : target.run();
  }
  async getAll(...refs: DemoDocRef[]) { return refs.map((r) => r.snapshot()); }
  set(): never { return readOnly(); }
  update(): never { return readOnly(); }
  create(): never { return readOnly(); }
  delete(): never { return readOnly(); }
}

class DemoFirestore {
  collection(id: string) { return new DemoCollectionRef(id); }
  doc(path: string) {
    const [col, id, ...rest] = path.split('/');
    if (!col || !id || rest.length) throw new Error(`데모 Firestore 는 「컬렉션/문서」 경로만 압니다: ${path}`);
    return new DemoCollectionRef(col).doc(id);
  }
  async getAll(...refs: DemoDocRef[]) { return refs.map((r) => r.snapshot()); }
  async runTransaction<T>(fn: (tx: DemoTransaction) => Promise<T>): Promise<T> { return fn(new DemoTransaction()); }
  batch(): never { return readOnly(); }
  bulkWriter(): never { return readOnly(); }
  recursiveDelete(): never { return readOnly(); }
}

let fake: DemoFirestore | null = null;
/** 가상 ERP5 Firestore — firebase-admin 의 `Firestore` 자리에 꽂는다(읽기 모양만 같다). */
export function demoFirestore(): Firestore {
  fake ??= new DemoFirestore();
  return fake as unknown as Firestore;
}
