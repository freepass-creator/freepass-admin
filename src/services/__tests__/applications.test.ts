import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { FileApplicationRepository, FileProductRepository } from '../../adapters/store/repositories';
import { offer, product } from '../../domain/search/__tests__/fixtures';
import { cancel, markProgress, submitApplication, type Deps, type SubmitApplicationInput } from '../applications';

let dir: string;
let deps: Deps;
let seq = 0;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fpa-'));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** ★칸을 나눈다. 한 폴더를 같이 쓰면 앞 묶음의 접수가 뒤 묶음의 개수를 흔든다. */
function makeDeps(box: string): Deps {
  const at = join(dir, box);
  return {
    products: new FileProductRepository(at),
    applications: new FileApplicationRepository(at),
    now: () => new Date('2026-09-16T05:22:00.000Z'),
    newId: () => `app-${++seq}`,
    actors: {
      requireActor: async () => ({ id: 'staff-park', type: 'ADMIN' as const }),
    },
  };
}

const input = (over: Partial<SubmitApplicationInput> = {}): SubmitApplicationInput => ({
  productId: 'product-1',
  offerId: 'offer-36',
  salesChannelId: 'ch-unioto',
  assigneeId: 'staff-park',
  applicantName: '김서연',
  expectedProductVersion: 1,
  submissionId: 'sub-1',
  ...over,
});

describe('접수 저장', () => {
  before(async () => {
    deps = makeDeps('box-save');
    await deps.products.save(product({ id: 'product-1', offers: [offer({ id: 'offer-36' })] }));
  });

  it('저장한 뒤 «다시 읽어도» 남아 있다 — 새 저장소 객체로 읽는다', async () => {
    const result = await submitApplication(deps, input());
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.created, true);

    // ★같은 인스턴스의 메모리가 아니라 «파일»에서 읽혔는지 본다.
    const fresh = new FileApplicationRepository(join(dir, 'box-save'));
    const rows = await fresh.list();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].applicantName, '김서연');
  });

  it('접수번호는 그날 순번이다', async () => {
    const rows = await deps.applications.list();
    assert.equal(rows[0].applicationNumber, 'A-260916-001');
  });

  it('Snapshot 이 «접수 당시 판»과 그 Offer 를 통째로 들고 있다', async () => {
    const rows = await deps.applications.list();
    const snap = rows[0].snapshot;
    assert.equal(snap.productId, 'product-1');
    assert.equal(snap.productVersion, 1);
    assert.equal(snap.offer.id, 'offer-36');
    assert.equal(snap.offer.termMonths, 36);
    assert.equal(rows[0].history[0].type, 'APPLICATION_CREATED');
    assert.equal(rows[0].history[0].actor.id, 'staff-park');
  });

  it('전화번호는 필수가 아니다 — 없으면 아예 «안 적는다»', async () => {
    const rows = await deps.applications.list();
    assert.equal('applicantPhone' in rows[0], false);
  });
});

describe('중복 저장 방지 — 서버가 막는다', () => {
  before(async () => {
    deps = makeDeps('box-dup');
    await deps.products.save(product({ id: 'product-1', offers: [offer({ id: 'offer-36' })] }));
  });

  it('같은 submissionId 로 다시 오면 «있던 것»을 돌려주고 새로 만들지 않는다', async () => {
    const first = await submitApplication(deps, input({ submissionId: 'dup' }));
    const second = await submitApplication(deps, input({ submissionId: 'dup' }));

    assert.equal(first.ok && first.created, true);
    assert.equal(second.ok && second.created, false);
    assert.equal(first.ok && second.ok && first.application.id, second.ok ? second.application.id : '');
    assert.equal((await deps.applications.list()).length, 1);
  });

  it('★겹쳐 들어와도 한 건이다 — 버튼 disabled 로는 못 막는 자리', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => submitApplication(deps, input({ submissionId: 'race' }))),
    );
    const created = results.filter((r) => r.ok && r.created);
    assert.equal(created.length, 1, '동시에 여섯 번 들어와도 만들어진 것은 하나여야 한다');
    assert.equal((await deps.applications.list()).filter((a) => a.submissionId === 'race').length, 1);
  });

  it('submissionId 가 다르면 «다른 건»이다 — 진짜 두 번째 접수를 막지 않는다', async () => {
    await submitApplication(deps, input({ submissionId: 'other', applicantName: '이서진' }));
    const rows = await deps.applications.list();
    assert.equal(rows.filter((a) => a.applicantName === '이서진').length, 1);
  });
});

describe('서로 다른 동시 접수의 번호', () => {
  it('20건을 동시에 받아도 applicationNumber가 겹치지 않는다', async () => {
    const local = makeDeps('box-sequence-race');
    await local.products.save(product({ id: 'product-1', offers: [offer({ id: 'offer-36' })] }));

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        submitApplication(
          local,
          input({
            submissionId: `parallel-${index}`,
            applicantName: `고객-${index}`,
          }),
        ),
      ),
    );

    assert.equal(results.filter((result) => result.ok && result.created).length, 20);
    const rows = await local.applications.list();
    const numbers = rows.map((row) => row.applicationNumber);
    assert.equal(new Set(numbers).size, 20);
    assert.ok(numbers.includes('A-260916-001'));
    assert.ok(numbers.includes('A-260916-020'));
  });
});

describe('상품이 그 사이에 바뀌면', () => {
  before(async () => {
    deps = makeDeps('box-version');
    await deps.products.save(product({ id: 'product-1', offers: [offer({ id: 'offer-36' })] }));
  });

  it('화면이 본 판과 다르면 저장하지 않고 되돌린다', async () => {
    await deps.products.save(product({ id: 'product-1', offers: [offer({ id: 'offer-36', monthlyRent: 999_000 })] }));

    const result = await submitApplication(deps, input({ expectedProductVersion: 1, submissionId: 'stale' }));
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, 'PRODUCT_CHANGED');
    assert.equal(!result.ok && result.reason === 'PRODUCT_CHANGED' && result.currentVersion, 2);
    assert.equal((await deps.applications.list()).length, 0, '되돌렸으면 아무것도 안 남아야 한다');
  });

  it('★이미 저장된 건의 재시도는 «바뀐 상품»보다 먼저다', async () => {
    const fresh = await submitApplication(deps, input({ expectedProductVersion: 2, submissionId: 'retry' }));
    assert.equal(fresh.ok, true);

    // 상품을 또 올린 뒤 같은 submissionId 로 재시도 — 이미 만든 건이 나와야 한다.
    await deps.products.save(product({ id: 'product-1', offers: [offer({ id: 'offer-36' })] }));
    const again = await submitApplication(deps, input({ expectedProductVersion: 2, submissionId: 'retry' }));
    assert.equal(again.ok, true);
    assert.equal(again.ok && again.created, false);
  });

  it('지금 상품이 바뀌어도 «이미 받은 접수»의 조건은 안 바뀐다', async () => {
    const rows = await deps.applications.list();
    const saved = rows.find((a) => a.submissionId === 'retry');
    assert.ok(saved);
    assert.equal(saved.snapshot.productVersion, 2);
    assert.equal(saved.snapshot.offer.monthlyRent, 999_000, '접수 당시 값 그대로여야 한다');
  });
});

describe('진행과 취소', () => {
  let id: string;
  before(async () => {
    deps = makeDeps('box-progress');
    await deps.products.save(product({ id: 'product-1', offers: [offer({ id: 'offer-36' })] }));
    const r = await submitApplication(deps, input({ submissionId: 'prog' }));
    id = r.ok ? r.application.id : '';
  });

  it('계약서를 찍으면 상태가 따라 오른다', async () => {
    const r = await markProgress(deps, id, 'contractCompleted', true);
    assert.equal(r.ok && r.application.status, 'CONTRACTED');
  });

  it('서류는 «상태»를 바꾸지 않는다 — 네 진행 사실은 서로 독립이다', async () => {
    const r = await markProgress(deps, id, 'documentsCompleted', true);
    assert.equal(r.ok && r.application.status, 'CONTRACTED');
    assert.equal(r.ok && r.application.progress.documentsCompleted, true);
  });

  it('잔금도 별도 사실로 남고 계약 상태는 유지한다', async () => {
    const r = await markProgress(deps, id, 'balanceCompleted', true);
    assert.equal(r.ok && r.application.status, 'CONTRACTED');
    assert.equal(r.ok && r.application.progress.balanceCompleted, true);
  });

  it('같은 진행값을 다시 저장하면 history를 중복 추가하지 않는다', async () => {
    const before = await deps.applications.get(id);
    assert.ok(before);
    const r = await markProgress(deps, id, 'balanceCompleted', true);
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.application.history.length, before.history.length);
  });

  it('인도가 찍히면 DELIVERED — 여기서 실적 후보가 된다', async () => {
    const r = await markProgress(deps, id, 'deliveryCompleted', true);
    assert.equal(r.ok && r.application.status, 'DELIVERED');
  });

  it('서로 다른 진행 변경이 동시에 들어와도 한쪽이 사라지지 않는다', async () => {
    const local = makeDeps('box-progress-race');
    await local.products.save(product({ id: 'product-1', offers: [offer({ id: 'offer-36' })] }));
    const submitted = await submitApplication(local, input({ submissionId: 'progress-race' }));
    const localId = submitted.ok ? submitted.application.id : '';

    await Promise.all([
      markProgress(local, localId, 'documentsCompleted', true),
      markProgress(local, localId, 'balanceCompleted', true),
    ]);

    const saved = await local.applications.get(localId);
    assert.ok(saved);
    assert.equal(saved.progress.documentsCompleted, true);
    assert.equal(saved.progress.balanceCompleted, true);
  });

  it('취소는 이유가 있어야 한다', async () => {
    const r = await cancel(deps, id, '   ');
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.reason, 'REASON_REQUIRED');
  });

  it('취소하면 이유가 남고, 그 뒤로 진행을 못 바꾼다', async () => {
    const r = await cancel(deps, id, '고객 변심 — 타사 계약');
    assert.equal(r.ok && r.application.status, 'CANCELLED');
    assert.equal(r.ok && r.application.cancellationReason, '고객 변심 — 타사 계약');
    assert.equal(r.ok && r.application.history.at(-1)?.type, 'APPLICATION_CANCELLED');
    assert.equal(r.ok && r.application.history.at(-1)?.actor.id, 'staff-park');

    const after = await markProgress(deps, id, 'contractCompleted', false);
    assert.equal(after.ok, false);
    assert.equal(!after.ok && after.reason, 'CANCELLED');
  });

  it('★다시 취소해도 «첫 이유»를 덮지 않는다', async () => {
    const r = await cancel(deps, id, '다른 이유');
    assert.equal(r.ok && r.application.cancellationReason, '고객 변심 — 타사 계약');
  });
});
