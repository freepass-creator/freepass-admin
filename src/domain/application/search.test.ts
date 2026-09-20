import assert from 'node:assert/strict';
import test from 'node:test';
import type { Application } from './types';
import { applicationFacets, filterApplications, matchApplication } from './search';

function app(over:Partial<Application>={}):Application{
  return {
    id:'a1',
    applicationNumber:'A-260920-001',
    applicantName:'홍길동',
    applicantPhone:'010-1111-2222',
    salesChannelId:'channel-a',
    assigneeId:'admin-a',
    source:'ADMIN',
    status:'RECEIVED',
    progress:{contractCompleted:false,documentsCompleted:false,balanceCompleted:false,deliveryCompleted:false},
    snapshot:{
      productId:'p1',productVersion:1,supplierId:'supplier-a',
      vehicle:{nodeId:'n1',originId:'kr',manufacturerId:'kia',modelId:'k5',matchLevel:'MODEL'},
      specs:{},
      offer:{id:'o1',termMonths:36,monthlyRent:700000,policyValues:[]},
      productPolicies:[],capturedAt:'2026-09-20T00:00:00.000Z',
    },
    submissionId:'sub-1',
    history:[],
    createdAt:'2026-09-20T00:00:00.000Z',
    updatedAt:'2026-09-20T00:00:00.000Z',
    ...over,
  };
}

const rows=[
  app(),
  app({id:'a2',applicationNumber:'A-260920-002',applicantName:'김철수',salesChannelId:'channel-b',assigneeId:'admin-b',status:'CONTRACTED'}),
  app({id:'a3',applicationNumber:'A-260920-003',applicantName:'이영희',status:'DELIVERED',progress:{contractCompleted:true,documentsCompleted:true,balanceCompleted:true,deliveryCompleted:true}}),
  app({id:'a4',applicationNumber:'A-260920-004',applicantName:'최취소',status:'CANCELLED'}),
];

test('text search covers customer, application number, phone and vehicle facts',()=>{
  assert.equal(filterApplications(rows,{text:'홍길동'}).length,1);
  assert.equal(filterApplications(rows,{text:'260920-002'})[0]?.applicantName,'김철수');
  assert.equal(filterApplications(rows,{text:'010-1111'})[0]?.id,'a1');
  assert.equal(filterApplications(rows,{text:'k5'}).length,4);
});

test('ACTIVE means received or contracted only',()=>{
  assert.deepEqual(filterApplications(rows,{status:'ACTIVE'}).map((x)=>x.id),['a1','a2']);
});

test('channel and assignee filters are exact identifiers',()=>{
  assert.deepEqual(filterApplications(rows,{salesChannelId:'channel-b'}).map((x)=>x.id),['a2']);
  assert.deepEqual(filterApplications(rows,{assigneeId:'admin-a'}).map((x)=>x.id),['a1','a3','a4']);
});

test('facets come only from existing ledger values and count statuses',()=>{
  const facets=applicationFacets(rows);
  assert.deepEqual(facets.salesChannels,['channel-a','channel-b']);
  assert.deepEqual(facets.assignees,['admin-a','admin-b']);
  assert.equal(facets.statusCounts.ACTIVE,2);
  assert.equal(facets.statusCounts.DELIVERED,1);
  assert.equal(facets.statusCounts.CANCELLED,1);
});
