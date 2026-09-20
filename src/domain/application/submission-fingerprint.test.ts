import assert from 'node:assert/strict';
import test from 'node:test';
import type { Application } from './types';
import { storedSubmissionFingerprint, submissionFingerprint } from './submission-fingerprint';

const input={
  productId:'p1',
  offerId:'o1',
  salesChannelId:'channel-1',
  assigneeId:'admin-1',
  applicantName:'홍길동',
  applicantPhone:'010-1234-5678',
  expectedProductVersion:3,
  submissionId:'key-1',
  source:'ADMIN' as const,
};

const application:Application={
  id:'a1',
  applicationNumber:'A-260920-001',
  applicantName:'홍길동',
  applicantPhone:'010-1234-5678',
  salesChannelId:'channel-1',
  assigneeId:'admin-1',
  source:'ADMIN',
  status:'RECEIVED',
  progress:{contractCompleted:false,documentsCompleted:false,balanceCompleted:false,deliveryCompleted:false},
  snapshot:{
    productId:'p1',
    productVersion:3,
    supplierId:'supplier-1',
    vehicle:{nodeId:'n1',originId:'kr',manufacturerId:'kia',modelId:'k5',matchLevel:'MODEL'},
    specs:{},
    offer:{id:'o1',termMonths:36,monthlyRent:700000,policyValues:[]},
    productPolicies:[],
    capturedAt:'2026-09-20T00:00:00.000Z',
  },
  submissionId:'key-1',
  history:[],
  createdAt:'2026-09-20T00:00:00.000Z',
  updatedAt:'2026-09-20T00:00:00.000Z',
};

test('stored application reconstructs the same semantic fingerprint',()=>{
  assert.equal(submissionFingerprint(input),storedSubmissionFingerprint(application));
});

test('whitespace that is trimmed by the domain does not change semantic identity',()=>{
  assert.equal(
    submissionFingerprint({...input,applicantName:'  홍길동  ',salesChannelId:' channel-1 '}),
    submissionFingerprint(input),
  );
});

test('changing any business semantic field changes the fingerprint',()=>{
  for(const changed of [
    {...input,productId:'p2'},
    {...input,offerId:'o2'},
    {...input,expectedProductVersion:4},
    {...input,salesChannelId:'channel-2'},
    {...input,assigneeId:'admin-2'},
    {...input,applicantName:'김철수'},
    {...input,applicantPhone:'010-9999-9999'},
  ]){
    assert.notEqual(submissionFingerprint(changed),submissionFingerprint(input));
  }
});
