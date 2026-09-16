import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * 파일 한 장에 컬렉션 하나를 담는 저장소.
 *
 * ★이것은 «개발·검증용 문 뒤» 다. 운영은 Firestore 로 간다.
 *   그래도 «진짜로» 저장한다 — 프로세스를 껐다 켜도 남아 있어야 저장을 확인했다고 말할 수 있다.
 *   메모리 Map 으로 두면 화면은 똑같이 돌지만 아무것도 증명하지 못한다.
 *
 * ★쓰기는 «임시파일 → rename» 이다. 바로 덮어쓰면 쓰는 도중에 죽었을 때
 *   반쯤 쓰인 JSON 이 남고, 다음 실행이 원장을 통째로 못 읽는다.
 *   rename 은 같은 볼륨 안에서 원자적이라 「옛 것」 아니면 「새 것」 둘 중 하나만 남는다.
 *
 * ★쓰기는 «줄 세운다»(`queue`). Node 는 한 프로세스 안에서도 요청을 겹쳐 처리하므로,
 *   읽고-고치고-쓰는 사이에 다른 요청이 끼어들면 **먼저 것이 통째로 사라진다.**
 */
export class JsonFileStore<T> {
  private readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir: string, name: string) {
    this.file = join(dir, `${name}.json`);
  }

  private async readAll(): Promise<T[]> {
    try {
      const raw = await readFile(this.file, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (error) {
      // 아직 한 번도 안 썼으면 빈 원장이다. 그 밖의 오류는 삼키지 않는다 —
      // 깨진 파일을 «빈 것» 으로 읽어 주면 그 위에 덮어써서 원장을 지운다.
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
      throw error;
    }
  }

  private async writeAll(rows: T[]): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(rows, null, 2), 'utf8');
    await rename(tmp, this.file);
  }

  /** 읽기만. 줄에 안 세운다 — 읽기끼리는 서로 안 밟는다. */
  async all(): Promise<T[]> {
    return this.readAll();
  }

  /**
   * 읽고 → 고치고 → 쓰기를 «한 덩어리로» 돌린다. 이 안에서만 원장을 바꾼다.
   * 겹쳐 들어온 요청은 앞엣것이 끝난 뒤에 자기 차례를 받는다.
   */
  async mutate<R>(fn: (rows: T[]) => { rows: T[]; result: R } | Promise<{ rows: T[]; result: R }>): Promise<R> {
    const run = this.queue.then(async () => {
      const rows = await this.readAll();
      const { rows: next, result } = await fn(rows);
      await this.writeAll(next);
      return result;
    });
    // 앞엣것이 실패해도 줄은 계속 돌아야 한다 — 안 그러면 한 번 터진 뒤로 전부 막힌다.
    this.queue = run.catch(() => undefined);
    return run;
  }
}
