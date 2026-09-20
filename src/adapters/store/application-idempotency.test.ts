import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { FileApplicationRepository, FileProductRepository } from './repositories';
import type { ReferenceMaster } from '../../domain/reference-master/types';
import type { CanonicalProduct } from '../../domain/product/types';
import { submitApplication } from '../../services/applications';

const masters:ReferenceMaster={
  async listSalesChannels(){return[{id:'channel-1',label:'Channel 1',status:'ACTIVE'}];},
  async listAssignees(){return[{id:'admin-1',label:'Admin 1',status:'ACTIVE'}];},
  async getSalesChannel(id){return id==='channel-1'?{id,label:'Channel 1',status:'ACTIVE'}:null;},
  async getAssignee(id){return id==='admin-1'?{id,label:'Admin 1',status:'ACTIVE'}:null;},
};

const product:CanonicalProduct={
  id:'p1',
  version:0,
  supplierId:'supplier-1',
  supplierProductKey:'raw-1',
  vehicle:{nodeId:'n1',originId:'kr',manufacturerId:'kia',modelId:'k5',matchLevel:'MODEL'},
  specs:{},
  offers:[{id:'o1',termMonths:36,monthlyRent:700000,policyValues:[]}],
  productPolicies:[],
  sourceSnapshotId:'source-1',
  updatedAt:'2026-09-20T00:00:00.000Z',
};

test('concurrent same key with different payload creates one row and rejects the other',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'fpa-idem-'));
  try{
    const products=new FileProductRepository(dir);
    const applications=new FileApplicationRepository(dir);
    const saved=await products.save(product);

    let idSeq=0;
    const deps={
      products,
      applications,
      actors:{requireActor:async()=>({id:'admin-1',type:'ADMIN' as const})},
      masters,
      now:()=>new Date('2026-09-20T00:00:00.000Z'),
      newId:()=>`app-${++idSeq}`,
    };

    const base={
      productId:saved.id,
      offerId:'o1',
      salesChannelId:'channel-1',
      assigneeId:'admin-1',
      expectedProductVersion:saved.version,
      submissionId:'same-key',
      source:'ADMIN' as const,
    };

    const results=await Promise.all([
      submitApplication(deps,{...base,applicantName:'고객 A'}),
      submitApplication(deps,{...base,applicantName:'고객 B'}),
    ]);

    const created=results.filter((x)=>x.ok&&x.created);
    const conflicts=results.filter((x)=>!x.ok&&x.reason==='IDEMPOTENCY_KEY_REUSE');
    assert.equal(created.length,1);
    assert.equal(conflicts.length,1);
    assert.equal((await applications.list()).length,1);
  }finally{
    await rm(dir,{recursive:true,force:true});
  }
});
