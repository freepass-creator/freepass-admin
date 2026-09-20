import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { F04RowLink } from '../../ports/legacy-f04';
import { FileF04RowLinkRepository } from './f04-row-link-repository';

const link:F04RowLink={
  applicationId:'application-1',
  f04SettlementCode:'stl_abc',
  sheetName:'접수',
  legacyRowRef:'접수!A12:BB12',
  method:'MIGRATION_EXACT_MATCH',
  linkedAt:'2026-09-21T02:00:00.000Z',
  linkedBy:'admin-1',
};

test('F04 row link is durable and exact replay is idempotent',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'f04-link-'));
  try{
    const first=new FileF04RowLinkRepository(dir);
    assert.equal((await first.bind(link)).created,true);
    assert.equal((await first.bind(link)).created,false);

    const second=new FileF04RowLinkRepository(dir);
    assert.deepEqual(await second.getByApplicationId('application-1'),link);
    assert.deepEqual(await second.getBySettlementCode('stl_abc'),link);
  }finally{
    await rm(dir,{recursive:true,force:true});
  }
});

test('F04 row link rejects application remap and settlement-code collision',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'f04-link-conflict-'));
  try{
    const repo=new FileF04RowLinkRepository(dir);
    await repo.bind(link);

    await assert.rejects(
      ()=>repo.bind({...link,legacyRowRef:'접수!A13:BB13'}),
      /F04_APPLICATION_LINK_CONFLICT/,
    );
    await assert.rejects(
      ()=>repo.bind({
        ...link,
        applicationId:'application-2',
        legacyRowRef:'접수!A14:BB14',
      }),
      /F04_SETTLEMENT_CODE_LINK_CONFLICT/,
    );
  }finally{
    await rm(dir,{recursive:true,force:true});
  }
});
