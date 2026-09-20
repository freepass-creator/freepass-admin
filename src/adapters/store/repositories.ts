import { join } from 'node:path';
import { assertApplicationMutation } from '../../domain/application/invariants';
import type { Application } from '../../domain/application/types';
import { AppError } from '../../domain/errors';
import type { Performance } from '../../domain/performance/types';
import type { CanonicalProduct } from '../../domain/product/types';
import type { Settlement } from '../../domain/settlement/types';
import type { ApplicationRepository, PerformanceRepository, ProductRepository, SettlementRepository } from '../../ports/repositories';
import { JsonFileStore } from './json-file-store';

/**
 * 파일 뒤의 저장소 — `src/ports/repositories.ts` 의 문을 실제로 연다.
 *
 * ★이것은 «개발·검증용»이다. 운영은 Firestore 로 간다(RTDB 는 폐기 정책상 금지).
 *   그래도 진짜로 저장한다 — 프로세스를 껐다 켜도 남아야 「저장된다」고 말할 수 있다.
 */

const DATA_DIR = process.env.FPA_DATA_DIR ?? join(process.cwd(), '.data');

export class FileApplicationRepository implements ApplicationRepository {
  private readonly store: JsonFileStore<Application>;

  constructor(dir: string = DATA_DIR) {
    this.store = new JsonFileStore<Application>(dir, 'applications');
  }

  async createSequenced(
    datePrefix: string,
    submissionId: string,
    build: (sequence: number) => Application,
  ): Promise<{ application: Application; created: boolean }> {
    type R = { application: Application; created: boolean };
    return this.store.mutate<R>((rows) => {
      const existing = rows.find((row) => row.submissionId === submissionId);
      if (existing) return { rows, result: { application: existing, created: false } };

      const sequence = rows.filter((row) => row.applicationNumber.startsWith(datePrefix)).length + 1;
      const application = build(sequence);

      if (application.submissionId !== submissionId) {
        throw new AppError('CONFLICT', 'Application submissionId does not match the repository transaction key.');
      }

      if (rows.some((row) => row.applicationNumber === application.applicationNumber)) {
        throw new AppError('CONFLICT', `Duplicate application number: ${application.applicationNumber}`);
      }

      return {
        rows: [application, ...rows],
        result: { application, created: true },
      };
    });
  }

  async get(id: string): Promise<Application | null> {
    return (await this.store.all()).find((row) => row.id === id) ?? null;
  }

  async findBySubmissionId(submissionId: string): Promise<Application | null> {
    return (await this.store.all()).find((row) => row.submissionId === submissionId) ?? null;
  }

  /** 최신이 앞. 화면이 이 순서를 그대로 쓴다. */
  async list(): Promise<Application[]> {
    const rows = await this.store.all();
    return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async mutate(id: string, change: (current: Application) => Application): Promise<Application> {
    return this.store.mutate((rows) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) throw new AppError('NOT_FOUND', `Application not found: ${id}`);
      const updated = change(rows[index]);
      assertApplicationMutation(rows[index], updated);
      const next = [...rows];
      next[index] = updated;
      return { rows: next, result: updated };
    });
  }
}

export class FilePerformanceRepository implements PerformanceRepository {
  private readonly store: JsonFileStore<Performance>;

  constructor(dir: string = DATA_DIR) {
    this.store = new JsonFileStore<Performance>(dir, 'performances');
  }

  async createNormalSequenced(
    datePrefix: string,
    applicationId: string,
    build: (sequence: number) => Performance,
  ): Promise<{ performance: Performance; created: boolean }> {
    type R = { performance: Performance; created: boolean };
    return this.store.mutate<R>((rows) => {
      const existing = rows.find((row) => row.kind === 'NORMAL' && row.applicationId === applicationId);
      if (existing) return { rows, result: { performance: existing, created: false } };

      const sequence = rows.filter((row) => row.performanceNumber.startsWith(datePrefix)).length + 1;
      const performance = build(sequence);

      if (performance.kind !== 'NORMAL' || performance.applicationId !== applicationId) {
        throw new AppError('CONFLICT', 'Performance does not match the repository idempotency key.');
      }
      if (rows.some((row) => row.performanceNumber === performance.performanceNumber)) {
        throw new AppError('CONFLICT', `Duplicate performance number: ${performance.performanceNumber}`);
      }
      if (rows.some((row) => row.settlementCode === performance.settlementCode)) {
        throw new AppError('CONFLICT', `Duplicate settlement code: ${performance.settlementCode}`);
      }

      return {
        rows: [performance, ...rows],
        result: { performance, created: true },
      };
    });
  }

  async get(id: string): Promise<Performance | null> {
    return (await this.store.all()).find((row) => row.id === id) ?? null;
  }

  async findNormalByApplicationId(applicationId: string): Promise<Performance | null> {
    return (await this.store.all()).find(
      (row) => row.kind === 'NORMAL' && row.applicationId === applicationId,
    ) ?? null;
  }

  async list(): Promise<Performance[]> {
    const rows = await this.store.all();
    return [...rows].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }
}


export class FileSettlementRepository implements SettlementRepository {
  private readonly store: JsonFileStore<Settlement>;

  constructor(dir: string = DATA_DIR) {
    this.store = new JsonFileStore<Settlement>(dir, 'settlements');
  }

  async createForPerformance(
    performanceId: string,
    build: () => Settlement,
  ): Promise<{ settlement: Settlement; created: boolean }> {
    type R = { settlement: Settlement; created: boolean };
    return this.store.mutate<R>((rows) => {
      const existing = rows.find((row) => row.performanceId === performanceId);
      if (existing) return { rows, result: { settlement: existing, created: false } };

      const settlement = build();
      if (settlement.performanceId !== performanceId) {
        throw new AppError('CONFLICT', 'Settlement does not match the repository idempotency key.');
      }
      if (rows.some((row) => row.settlementCode === settlement.settlementCode)) {
        throw new AppError('CONFLICT', `Duplicate settlement code: ${settlement.settlementCode}`);
      }

      return {
        rows: [settlement, ...rows],
        result: { settlement, created: true },
      };
    });
  }

  async get(id: string): Promise<Settlement | null> {
    return (await this.store.all()).find((row) => row.id === id) ?? null;
  }

  async findByPerformanceId(performanceId: string): Promise<Settlement | null> {
    return (await this.store.all()).find((row) => row.performanceId === performanceId) ?? null;
  }

  async list(): Promise<Settlement[]> {
    const rows = await this.store.all();
    return [...rows].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async mutate(id: string, change: (current: Settlement) => Settlement): Promise<Settlement> {
    return this.store.mutate((rows) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) throw new AppError('NOT_FOUND', `Settlement not found: ${id}`);
      const updated = change(rows[index]);
      if (updated.id !== rows[index].id || updated.performanceId !== rows[index].performanceId) {
        throw new AppError('CONFLICT', 'Settlement identity fields are immutable.');
      }
      const next = [...rows];
      next[index] = updated;
      return { rows: next, result: updated };
    });
  }
}

export class FileProductRepository implements ProductRepository {
  private readonly store: JsonFileStore<CanonicalProduct>;

  constructor(dir: string = DATA_DIR) {
    this.store = new JsonFileStore<CanonicalProduct>(dir, 'products');
  }

  async get(id: string): Promise<CanonicalProduct | null> {
    return (await this.store.all()).find((row) => row.id === id) ?? null;
  }

  async list(): Promise<CanonicalProduct[]> {
    return this.store.all();
  }

  /**
   * ★판(version)은 «저장소가» 올린다. 부르는 쪽이 올리면 올리는 것을 깜빡한 경로가 하나라도
   *   생기는 순간, 접수 Snapshot 이 가리키는 판과 실제 내용이 어긋난다.
   */
  async save(product: CanonicalProduct): Promise<CanonicalProduct> {
    return this.store.mutate((rows) => {
      const index = rows.findIndex((row) => row.id === product.id);
      if (index < 0) {
        const created = { ...product, version: 1 };
        return { rows: [...rows, created], result: created };
      }
      const updated = { ...product, version: rows[index].version + 1 };
      const next = [...rows];
      next[index] = updated;
      return { rows: next, result: updated };
    });
  }
}
