import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSettlementClawback,
  getClawbackSummary,
} from './settlement';
import type { SettlementItem } from './types';

const settlement:SettlementItem={
  id:'settlement:performance:1',
  performanceId:'performance:1',
  applicationId:'application:1',
  applicationNumber:'A-260921-001',
  applicantName:'홍길동',
  supplierId:'supplier-a',
  salesChannelId:'channel-a',
  assigneeId:'admin-1',
  supplierReceivable:1_000_000,
  channelPayable:800_000,
  margin:200_000,
  vatMode:'EXCLUDED',
  createdAt:'2026-09-21T00:00:00.000Z',
};

test('business clawback is a separate immutable fact and derives channel recovery by original ratio',()=>{
  const before=structuredClone(settlement);
  const clawback=createSettlementClawback(settlement,[],{
    id:'clawback-1',
    supplierAmount:500_000,
    reason:'3개월 유지조건 미충족',
    occurredAt:'2026-10-10T00:00:00.000Z',
    createdAt:'2026-10-10T01:00:00.000Z',
    createdBy:'admin-1',
  });

  assert.equal(clawback.supplierAmount,500_000);
  assert.equal(clawback.channelAmount,400_000);
  assert.deepEqual(clawback.supplierImpact,{net:500_000,vat:50_000,total:550_000});
  assert.deepEqual(clawback.channelImpact,{net:400_000,vat:40_000,total:440_000});
  assert.deepEqual(settlement,before,'original settlement must remain unchanged');
});

test('multiple clawbacks are bounded by remaining original settlement amounts',()=>{
  const first=createSettlementClawback(settlement,[],{
    id:'clawback-1',
    supplierAmount:500_000,
    reason:'1차 환수',
    occurredAt:'2026-10-10T00:00:00.000Z',
    createdAt:'2026-10-10T00:00:00.000Z',
    createdBy:'admin-1',
  });
  const second=createSettlementClawback(settlement,[first],{
    id:'clawback-2',
    supplierAmount:250_000,
    reason:'2차 환수',
    occurredAt:'2026-11-10T00:00:00.000Z',
    createdAt:'2026-11-10T00:00:00.000Z',
    createdBy:'admin-1',
  });

  assert.deepEqual(getClawbackSummary(settlement,[first,second]),{
    supplierClawback:750_000,
    channelClawback:600_000,
    supplierRemainingClawbackable:250_000,
    channelRemainingClawbackable:200_000,
  });

  assert.throws(()=>createSettlementClawback(settlement,[first,second],{
    id:'clawback-3',
    supplierAmount:300_000,
    reason:'초과 환수',
    occurredAt:'2026-12-10T00:00:00.000Z',
    createdAt:'2026-12-10T00:00:00.000Z',
    createdBy:'admin-1',
  }),/exceeds the remaining settlement amount/);
});

test('explicit channel clawback is allowed but cannot exceed remaining payable',()=>{
  const item=createSettlementClawback(settlement,[],{
    id:'clawback-explicit',
    supplierAmount:100_000,
    channelAmount:50_000,
    reason:'협의 환수',
    occurredAt:'2026-10-10T00:00:00.000Z',
    createdAt:'2026-10-10T00:00:00.000Z',
    createdBy:'admin-1',
  });
  assert.equal(item.channelAmount,50_000);

  assert.throws(()=>createSettlementClawback(settlement,[],{
    id:'clawback-too-much-channel',
    supplierAmount:100_000,
    channelAmount:900_000,
    reason:'잘못된 지급 환수',
    occurredAt:'2026-10-10T00:00:00.000Z',
    createdAt:'2026-10-10T00:00:00.000Z',
    createdBy:'admin-1',
  }),/Channel clawback exceeds/);
});

test('VAT included clawback splits the written gross amount without adding VAT twice',()=>{
  const included:SettlementItem={
    ...settlement,
    supplierReceivable:1_100_000,
    channelPayable:0,
    margin:1_100_000,
    vatMode:'INCLUDED',
  };
  const item=createSettlementClawback(included,[],{
    id:'clawback-vat-included',
    supplierAmount:1_100_000,
    channelAmount:0,
    reason:'전액 환수',
    occurredAt:'2026-10-10T00:00:00.000Z',
    createdAt:'2026-10-10T00:00:00.000Z',
    createdBy:'admin-1',
  });
  assert.deepEqual(item.supplierImpact,{net:1_000_000,vat:100_000,total:1_100_000});
});

test('same clawback id is idempotent only for the exact same business fact',()=>{
  const first=createSettlementClawback(settlement,[],{
    id:'clawback-idem',
    supplierAmount:100_000,
    reason:'환수',
    occurredAt:'2026-10-10T00:00:00.000Z',
    createdAt:'2026-10-10T00:00:00.000Z',
    createdBy:'admin-1',
  });
  const replay=createSettlementClawback(settlement,[first],{
    id:'clawback-idem',
    supplierAmount:100_000,
    reason:'환수',
    occurredAt:'2026-10-10T00:00:00.000Z',
    createdAt:'2026-10-10T00:00:00.000Z',
    createdBy:'admin-1',
  });
  assert.deepEqual(replay,first);

  assert.throws(()=>createSettlementClawback(settlement,[first],{
    id:'clawback-idem',
    supplierAmount:90_000,
    reason:'다른 환수',
    occurredAt:'2026-10-10T00:00:00.000Z',
    createdAt:'2026-10-10T00:00:00.000Z',
    createdBy:'admin-1',
  }),/IDEMPOTENCY_KEY_REUSE/);
});
