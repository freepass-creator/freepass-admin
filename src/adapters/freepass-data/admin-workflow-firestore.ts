import { randomBytes, randomUUID } from 'node:crypto';

type WorkflowResource =
  | 'products' | 'policies' | 'vehicleMaster'
  | 'settlementRows' | 'settlementEvents' | 'settlementInvoices'
  | 'settlementCashEvents' | 'settlementClawbacks' | 'settlementFeeRules'
  | 'settlementRules' | 'partners' | 'contracts' | 'contractEvents'
  | 'esignSessions' | 'esignPrivate' | 'esignEvents' | 'esignIssueLocks';

type Filter = { field: string; op: '=='; value: unknown };
type ReadSpec =
  | { kind: 'doc'; resource: WorkflowResource; id: string }
  | { kind: 'query'; resource: WorkflowResource; filters?: Filter[]; limit?: number };
type ReadResult = {
  schema: 'freepass-data.admin-workflow-read/v1';
  docs: { id: string; data: Record<string, unknown> }[];
  digest: string;
};
type Expectation = { spec: ReadSpec; digest: string };
type Mutation =
  | { op: 'set'; resource: WorkflowResource; id: string; data: Record<string, unknown>; merge?: boolean }
  | { op: 'update'; resource: WorkflowResource; id: string; data: Record<string, unknown> }
  | { op: 'create'; resource: WorkflowResource; id: string; data: Record<string, unknown> };

const COLLECTION_RESOURCE: Record<string, WorkflowResource> = {
  products: 'products',
  policy: 'policies',
  vehicle_master: 'vehicleMaster',
  settlement_rows: 'settlementRows',
  settlement_events: 'settlementEvents',
  settlement_invoices: 'settlementInvoices',
  settlement_cash_events: 'settlementCashEvents',
  settlement_clawbacks: 'settlementClawbacks',
  settlement_fee_rules: 'settlementFeeRules',
  settlement_rules: 'settlementRules',
  partner: 'partners',
  contract: 'contracts',
  contract_event: 'contractEvents',
  esign_session: 'esignSessions',
  esign_private: 'esignPrivate',
  esign_event: 'esignEvents',
  esign_issue_lock: 'esignIssueLocks',
};

function config(env: Record<string, string | undefined> = process.env) {
  const raw = env.FREEPASS_DATA_BASE_URL?.trim().replace(/\/$/, '') ?? '';
  const token = env.FREEPASS_DATA_ADMIN_CATALOG_TOKEN?.trim() ?? '';
  if (!raw || !token) throw new Error('FREEPASS_DATA_ADMIN_WORKFLOW_CONFIG_MISSING');
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('FREEPASS_DATA_BASE_URL_MUST_BE_ORIGIN');
  }
  if (env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('FREEPASS_DATA_BASE_URL_MUST_BE_HTTPS');
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('FREEPASS_DATA_BASE_URL_INVALID');
  if (token.length < 32) throw new Error('FREEPASS_DATA_ADMIN_CATALOG_TOKEN_INVALID');
  return { base: url.origin, token };
}

class WorkflowHttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

class Transport {
  private async call<T>(path: string, body: unknown): Promise<T> {
    const { base, token } = config();
    const response = await fetch(`${base}/v1/consumers/freepass-admin-catalog/admin-workflow/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const parsed = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      throw new WorkflowHttpError(response.status, String(parsed.code ?? `FREEPASS_DATA_HTTP_${response.status}`));
    }
    return parsed as T;
  }

  read(spec: ReadSpec) {
    return this.call<ReadResult>('read', spec);
  }

  async commit(
    operationId: string,
    expectations: Expectation[],
    mutations: Mutation[],
    purpose = 'FreePass Admin repository transaction',
  ) {
    const body = {
      operationId,
      actor: 'freepass-admin-runtime',
      purpose,
      expectations,
      mutations,
    };
    let last: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.call<Record<string, unknown>>('commit', body);
      } catch (error) {
        last = error;
        if (error instanceof WorkflowHttpError && error.status < 500) throw error;
      }
    }
    throw last;
  }
}

const generatedId = () => randomBytes(15).toString('base64url').slice(0, 20);

export class RemoteDocumentReference {
  constructor(
    readonly transport: Transport,
    readonly resource: WorkflowResource,
    readonly id: string,
  ) {}

  _spec(): ReadSpec { return { kind: 'doc', resource: this.resource, id: this.id }; }

  async _read() {
    const result = await this.transport.read(this._spec());
    return { result, snapshot: this._snapshot(result) };
  }

  _snapshot(result: ReadResult) {
    const hit = result.docs[0];
    return new RemoteDocumentSnapshot(this, !!hit, hit?.data);
  }

  async get() { return (await this._read()).snapshot; }

  async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
    await this.transport.commit(randomUUID(), [], [{
      op: 'set', resource: this.resource, id: this.id, data,
      ...(options?.merge ? { merge: true } : {}),
    }], 'FreePass Admin direct set through Data');
  }

  async update(data: Record<string, unknown>) {
    await this.transport.commit(randomUUID(), [], [{
      op: 'update', resource: this.resource, id: this.id, data,
    }], 'FreePass Admin direct update through Data');
  }

  async create(data: Record<string, unknown>) {
    await this.transport.commit(randomUUID(), [], [{
      op: 'create', resource: this.resource, id: this.id, data,
    }], 'FreePass Admin direct create through Data');
  }
}

export class RemoteDocumentSnapshot {
  readonly id: string;
  constructor(
    readonly ref: RemoteDocumentReference,
    readonly exists: boolean,
    private readonly value?: Record<string, unknown>,
  ) {
    this.id = ref.id;
  }
  data() { return this.exists ? structuredClone(this.value ?? {}) : undefined; }
}

export class RemoteQuery {
  constructor(
    readonly transport: Transport,
    readonly resource: WorkflowResource,
    readonly filters: Filter[] = [],
    readonly take?: number,
  ) {}

  _spec(): ReadSpec {
    return {
      kind: 'query',
      resource: this.resource,
      ...(this.filters.length ? { filters: this.filters } : {}),
      ...(this.take ? { limit: this.take } : {}),
    };
  }

  where(field: string, op: '==', value: unknown) {
    if (op !== '==') throw new Error('FREEPASS_DATA_QUERY_ONLY_SUPPORTS_EQUALITY');
    return new RemoteQuery(this.transport, this.resource, [...this.filters, { field, op, value }], this.take);
  }

  limit(value: number) {
    return new RemoteQuery(this.transport, this.resource, this.filters, value);
  }

  async _read() {
    const result = await this.transport.read(this._spec());
    return { result, snapshot: this._snapshot(result) };
  }

  _snapshot(result: ReadResult) {
    return new RemoteQuerySnapshot(
      result.docs.map((doc) => new RemoteDocumentSnapshot(
        new RemoteDocumentReference(this.transport, this.resource, doc.id),
        true,
        doc.data,
      )),
    );
  }

  async get() { return (await this._read()).snapshot; }
}

export class RemoteCollectionReference extends RemoteQuery {
  constructor(
    transport: Transport,
    resource: WorkflowResource,
  ) { super(transport, resource); }

  doc(id = generatedId()) {
    return new RemoteDocumentReference(this.transport, this.resource, id);
  }

  async add(data: Record<string, unknown>) {
    const ref = this.doc();
    await ref.create(data);
    return ref;
  }
}

export class RemoteQuerySnapshot {
  readonly size: number;
  readonly empty: boolean;
  constructor(readonly docs: RemoteDocumentSnapshot[]) {
    this.size = docs.length;
    this.empty = docs.length === 0;
  }
}

class RemoteTransaction {
  readonly expectations: Expectation[] = [];
  readonly mutations: Mutation[] = [];

  constructor(readonly transport: Transport) {}

  async get(target: RemoteDocumentReference | RemoteQuery) {
    const { result, snapshot } = await target._read();
    this.expectations.push({ spec: target._spec(), digest: result.digest });
    return snapshot;
  }

  set(ref: RemoteDocumentReference, data: Record<string, unknown>, options?: { merge?: boolean }) {
    this.mutations.push({
      op: 'set', resource: ref.resource, id: ref.id, data,
      ...(options?.merge ? { merge: true } : {}),
    });
    return this;
  }

  update(ref: RemoteDocumentReference, data: Record<string, unknown>) {
    this.mutations.push({ op: 'update', resource: ref.resource, id: ref.id, data });
    return this;
  }

  create(ref: RemoteDocumentReference, data: Record<string, unknown>) {
    this.mutations.push({ op: 'create', resource: ref.resource, id: ref.id, data });
    return this;
  }
}

export class FreePassDataWorkflowFirestore {
  private readonly transport = new Transport();

  collection(name: string) {
    const resource = COLLECTION_RESOURCE[name];
    if (!resource) throw new Error(`FREEPASS_DATA_RESOURCE_UNMAPPED:${name}`);
    return new RemoteCollectionReference(this.transport, resource);
  }

  async runTransaction<T>(run: (tx: RemoteTransaction) => Promise<T>): Promise<T> {
    let conflict: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const tx = new RemoteTransaction(this.transport);
      const result = await run(tx);
      if (!tx.mutations.length) return result;
      try {
        await this.transport.commit(
          randomUUID(),
          tx.expectations,
          tx.mutations,
          'FreePass Admin atomic repository transaction',
        );
        return result;
      } catch (error) {
        if (error instanceof WorkflowHttpError && error.status === 409 && error.code === 'ADMIN_WORKFLOW_CONFLICT') {
          conflict = error;
          continue;
        }
        throw error;
      }
    }
    throw conflict ?? new Error('ADMIN_WORKFLOW_CONFLICT');
  }
}

let singleton: FreePassDataWorkflowFirestore | null = null;

export function freepassDataWorkflowFirestore() {
  singleton ??= new FreePassDataWorkflowFirestore();
  return singleton;
}

export function adminWorkflowTransportReady(env: Record<string, string | undefined> = process.env) {
  try { config(env); return true; } catch { return false; }
}

export const __test = { config, COLLECTION_RESOURCE };
