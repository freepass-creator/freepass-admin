import assert from 'node:assert/strict';
import test from 'node:test';
import type { Performance } from './types';
import { filterPerformances, performanceFacets } from './search';

function row(over:Partial<Performance>={}):Performance{
  return {
    id:'performance:a1',
    applicationId:'a1',
    deliveryEvidenceAt:'2026-09-20T01:00:00.000Z',
    status:'AWAITING_AMOUNTS',
    snapshot:{
      applicationNumber:'A-260920-001',
      applicantName:'홍길동',
      supplierId:'supplier-a',
      salesChannelId:'channel-a',
      assigneeId:'admin-a',
      productId:'p1',
      productVersion:1,
      vehicle:{nodeId:'n1',originId:'kr',manufacturerId:'kia',modelId:'k5',matchLevel:'MODEL'},
      specs:{},
      registration:{vehicleNumber:'12가3456'},
      offer:{id:'o1',termMonths:36,monthlyRent:700000,policyValues:[]},
      policies:[],
      deliveredAt:'2026-09-20T01:00:00.000Z',
    },
    amounts:{supplierReceivable:null,channelPayable:null,vatMode:'UNDECIDED'},
    salespersonReview:{status:'PENDING'},
    supplierReview:{status:'PENDING'},
    reconfirmation:{status:'NOT_REQUIRED'},
    createdAt:'2026-09-20T01:00:00.000Z',
    updatedAt:'2026-09-20T01:00:00.000Z',
    ...over,
  };
}

const rows=[
  row(),
  row({id:'performance:a2',applicationId:'a2',status:'AWAITING_SUPPLIER_REVIEW',snapshot:{...row().snapshot,applicationNumber:'A-260920-002',applicantName:'김철수',supplierId:'supplier-b',salesChannelId:'channel-b',assigneeId:'admin-b'}}),
  row({id:'performance:a3',applicationId:'a3',status:'FINALIZED',snapshot:{...row().snapshot,applicationNumber:'A-260920-003',applicantName:'이영희'}}),
];

test('performance search covers customer, application number, vehicle and vehicle number',()=>{
  assert.equal(filterPerformances(rows,{text:'홍길동'}).length,1);
  assert.equal(filterPerformances(rows,{text:'260920-002'})[0]?.snapshot.applicantName,'김철수');
  assert.equal(filterPerformances(rows,{text:'k5'}).length,3);
  assert.equal(filterPerformances(rows,{text:'12가3456'}).length,3);
});

test('OPEN excludes finalized rows',()=>{
  assert.deepEqual(filterPerformances(rows,{status:'OPEN'}).map((x)=>x.id),['performance:a1','performance:a2']);
});

test('supplier channel and assignee filters are exact',()=>{
  assert.deepEqual(filterPerformances(rows,{supplierId:'supplier-b'}).map((x)=>x.id),['performance:a2']);
  assert.deepEqual(filterPerformances(rows,{salesChannelId:'channel-b'}).map((x)=>x.id),['performance:a2']);
  assert.deepEqual(filterPerformances(rows,{assigneeId:'admin-a'}).map((x)=>x.id),['performance:a1','performance:a3']);
});

test('facets come from existing performance facts',()=>{
  const facets=performanceFacets(rows);
  assert.deepEqual(facets.suppliers,['supplier-a','supplier-b']);
  assert.deepEqual(facets.salesChannels,['channel-a','channel-b']);
  assert.equal(facets.statusCounts.OPEN,2);
  assert.equal(facets.statusCounts.FINALIZED,1);
});
