import assert from 'node:assert/strict';
import test from 'node:test';
import type { Application } from '../domain/application/types';
import type { CanonicalProduct } from '../domain/product/types';
import type { ApplicationRepository, ProductRepository } from '../ports/repositories';
import type { ReferenceMaster } from '../domain/reference-master/types';
import { submitApplication } from './applications';

const now='2026-09-20T00:00:00.000Z';
const product:CanonicalProduct={
  id:'p1',version:3,supplierId:'s1',supplierProductKey:'raw-1',
  vehicle:{nodeId:'n1',originId:'kr',manufacturerId:'kia',modelId:'k5',matchLevel:'MODEL'},
  specs:{modelYear:2026},
  offers:[{id:'o36',termMonths:36,monthlyRent:700000,deposit:0,policyValues:[]}],
  productPolicies:[],sourceSnapshotId:'source-3',updatedAt:now,
};

class Products implements ProductRepository{
  async get(id:string){return id===product.id?product:null;}
  async list(){return [product];}
  async save(value:CanonicalProduct){return value;}
}
class Applications implements ApplicationRepository{
  rows:Application[]=[];
  async createSequenced(_prefix:string,submissionId:string,build:(sequence:number)=>Application){
    const existing=this.rows.find(x=>x.submissionId===submissionId);
    if(existing)return{application:existing,created:false};
    const application=build(this.rows.length+1);
    this.rows.push(application);
    return{application,created:true};
  }
  async get(id:string){return this.rows.find(x=>x.id===id)??null;}
  async findBySubmissionId(id:string){return this.rows.find(x=>x.submissionId===id)??null;}
  async list(){return [...this.rows];}
  async mutate(id:string,change:(current:Application)=>Application){
    const i=this.rows.findIndex(x=>x.id===id);if(i<0)throw new Error('missing');
    this.rows[i]=change(this.rows[i]);return this.rows[i];
  }
}

const masters:ReferenceMaster={
  async listSalesChannels(){return[{id:'channel-1',label:'Channel 1',status:'ACTIVE'}];},
  async listAssignees(){return[{id:'admin-1',label:'Admin 1',status:'ACTIVE'}];},
  async getSalesChannel(id){return id==='channel-1'?{id,label:'Channel 1',status:'ACTIVE'}:null;},
  async getAssignee(id){return id==='admin-1'?{id,label:'Admin 1',status:'ACTIVE'}:null;},
};

function deps(applications=new Applications()){
  return{
    applications,
    products:new Products(),
    now:()=>new Date(now),
    newId:()=>`app-${applications.rows.length+1}`,
    actors:{requireActor:async()=>({id:'admin-1',type:'ADMIN' as const})},
    masters,
  };
}
const input={
  productId:'p1',offerId:'o36',salesChannelId:'channel-1',assigneeId:'admin-1',
  applicantName:'홍길동',expectedProductVersion:3,submissionId:'submit-1'};

test('same submissionId replays one stored application',async()=>{
  const applications=new Applications();const d=deps(applications);
  const first=await submitApplication(d,input);
  const second=await submitApplication(d,{...input});
  assert.equal(first.ok&&first.created,true);
  assert.equal(second.ok&&second.created,false);
  assert.equal(applications.rows.length,1);
  assert.equal(first.ok&&second.ok?first.application.id===second.application.id:false,true);
});

test('stale product version fails before creating intake',async()=>{
  const applications=new Applications();
  const result=await submitApplication(deps(applications),{...input,submissionId:'stale',expectedProductVersion:2});
  assert.deepEqual(result,{ok:false,reason:'PRODUCT_CHANGED',currentVersion:3,seenVersion:2});
  assert.equal(applications.rows.length,0);
});

test('offer from another product is rejected',async()=>{
  const applications=new Applications();
  const result=await submitApplication(deps(applications),{...input,submissionId:'bad-offer',offerId:'nope'});
  assert.deepEqual(result,{ok:false,reason:'OFFER_NOT_FOUND'});
  assert.equal(applications.rows.length,0);
});


test('inactive or unknown reference master ids are rejected before save',async()=>{
  const applications=new Applications();
  const badChannel=await submitApplication(deps(applications),{
    ...input,submissionId:'bad-channel',salesChannelId:'free-text',
  });
  assert.deepEqual(badChannel,{ok:false,reason:'SALES_CHANNEL_NOT_ACTIVE'});
  assert.equal(applications.rows.length,0);

  const badAssignee=await submitApplication(deps(applications),{
    ...input,submissionId:'bad-assignee',assigneeId:'unknown-admin',
  });
  assert.deepEqual(badAssignee,{ok:false,reason:'ASSIGNEE_NOT_ACTIVE'});
  assert.equal(applications.rows.length,0);
});
