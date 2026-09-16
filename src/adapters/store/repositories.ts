import { join } from 'node:path';
import type { Application } from '../../domain/application/types';
import type { CanonicalProduct } from '../../domain/product/types';
import type { ApplicationRepository, ProductRepository } from '../../ports/repositories';
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

  /**
   * ★중복 저장을 여기서 막는다. «읽고-보고-쓰기»가 한 덩어리로 돌아야 한다 —
   *   따로 하면 두 요청이 사이를 파고들어 같은 submissionId 로 두 건이 들어간다.
   */
  async create(application: Application): Promise<{ application: Application; created: boolean }> {
    type R = { application: Application; created: boolean };
    return this.store.mutate<R>((rows) => {
      const existing = rows.find((row) => row.submissionId === application.submissionId);
      const result: R = existing
        ? { application: existing, created: false }
        : { application, created: true };
      return { rows: existing ? rows : [application, ...rows], result };
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

  async update(application: Application): Promise<Application> {
    return this.store.mutate((rows) => {
      const index = rows.findIndex((row) => row.id === application.id);
      // 없는 것을 조용히 만들어 내지 않는다 — 그러면 잘못된 id 로 온 수정이 새 건으로 남는다.
      if (index < 0) throw new Error(`Application not found: ${application.id}`);
      const next = [...rows];
      next[index] = application;
      return { rows: next, result: application };
    });
  }

  async countByDatePrefix(prefix: string): Promise<number> {
    const rows = await this.store.all();
    return rows.filter((row) => row.applicationNumber.startsWith(prefix)).length;
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
