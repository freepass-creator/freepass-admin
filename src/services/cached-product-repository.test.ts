import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanonicalProduct } from '../domain/product/types';
import type { ProductRepository } from '../ports/repositories';
import { CachedProductRepository } from './cached-product-repository';

const product:CanonicalProduct={
  id:'p1',version:1,supplierId:'s1',supplierProductKey:'raw',
  vehicle:{nodeId:'n',originId:'kr',manufacturerId:'kia',modelId:'k5',matchLevel:'MODEL'},
  specs:{},offers:[{id:'o1',termMonths:36,monthlyRent:700000,policyValues:[]}],
  productPolicies:[],sourceSnapshotId:'src',updatedAt:'2026-09-20T00:00:00.000Z',
};

test('catalog list is reused inside ttl and refreshed after expiry',async()=>{
  let calls=0,now=1000;
  const inner:ProductRepository={
    async list(){calls+=1;return [{...product,version:calls}];},
    async get(id){return id==='p1'?product:null;},
    async save(p){return p;},
  };
  const cached=new CachedProductRepository(inner,60_000,()=>now);
  assert.equal((await cached.list())[0].version,1);
  assert.equal((await cached.list())[0].version,1);
  assert.equal(calls,1);
  now+=60_001;
  assert.equal((await cached.list())[0].version,2);
  assert.equal(calls,2);
});

test('get uses warm list cache before delegate get',async()=>{
  let gets=0;
  const inner:ProductRepository={
    async list(){return [product];},
    async get(){gets+=1;return null;},
    async save(p){return p;},
  };
  const cached=new CachedProductRepository(inner);
  await cached.list();
  assert.equal((await cached.get('p1'))?.id,'p1');
  assert.equal(gets,0);
});
