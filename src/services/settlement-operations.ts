import {
  applySuggestedSettlementAmounts,
  confirmBySalesperson,
  confirmBySupplier,
  createPerformanceFromDelivery,
  disputeBySalesperson,
  reconfirmBySalesperson,
  registerSupplierIssue,
  resolveOpenIssue,
  setSettlementAmounts,
} from '../domain/performance/performance';
import type { SettlementAmounts } from '../domain/performance/types';
import {
  createBilling,
  createClawbackBillingAdjustment,
  createSettlementClawback,
  createSettlementFromPerformance,
  recordBillingInvoiceEvidence,
  recordClawbackBillingInvoiceEvidence,
  registerChannelRecovery,
  registerCollection,
  registerPayout,
  registerSupplierRefund,
  reverseLedgerEntry,
} from '../domain/settlement/settlement';
import type { LedgerEntry, PayoutPolicy } from '../domain/settlement/types';
import type { ActorProvider } from '../ports/auth';
import type { SettlementOperationalFacts, SettlementPricingProvider } from '../ports/settlement-pricing';
import type { OperationsRepository } from '../ports/operations';
import type { ApplicationRepository } from '../ports/repositories';
import { suggestSettlementPricing } from './settlement-pricing';

export type SettlementDeps = {
  applications: ApplicationRepository;
  operations: OperationsRepository;
  actors: ActorProvider;
  now: () => Date;
};

async function adminId(actors: ActorProvider): Promise<string> {
  const actor = await actors.requireActor();
  if (actor.type !== 'ADMIN') throw new Error('ADMIN_REQUIRED');
  return actor.id;
}

const iso=(now:()=>Date)=>now().toISOString();

export async function ensurePerformanceForApplication(deps:SettlementDeps,applicationId:string){
  await adminId(deps.actors);
  const application=await deps.applications.get(applicationId);
  if(!application)throw new Error('APPLICATION_NOT_FOUND');
  const candidate=createPerformanceFromDelivery(application);
  return deps.operations.ensurePerformance(candidate);
}


export async function suggestPerformancePricing(
  deps:SettlementDeps&{pricing:SettlementPricingProvider},
  performanceId:string,
  operational:SettlementOperationalFacts={},
){
  await adminId(deps.actors);
  const performance=await deps.operations.getPerformance(performanceId);
  if(!performance)throw new Error('PERFORMANCE_NOT_FOUND');

  const quote=await suggestSettlementPricing(deps.pricing,performance,operational);
  if(quote.status==='REVIEW_REQUIRED'){
    return{quote,performance,applied:false as const};
  }

  const now=iso(deps.now);
  const updated=await deps.operations.mutatePerformance(
    performanceId,
    current=>applySuggestedSettlementAmounts(
      current,
      {
        supplierReceivable:quote.supplierReceivable,
        channelPayable:quote.channelPayable,
        vatMode:quote.vatMode,
      },
      quote.evidence,
      now,
    ),
  );
  return{quote,performance:updated,applied:true as const};
}

export async function setPerformanceAmounts(
  deps:SettlementDeps,
  performanceId:string,
  amounts:SettlementAmounts,
){
  await adminId(deps.actors);
  return deps.operations.mutatePerformance(
    performanceId,
    current=>setSettlementAmounts(current,amounts,iso(deps.now)),
  );
}

export async function confirmSalesperson(
  deps:SettlementDeps,
  performanceId:string,
  partyId:string,
){
  const admin=await adminId(deps.actors);
  return deps.operations.mutatePerformance(
    performanceId,
    current=>confirmBySalesperson(current,partyId,admin,iso(deps.now)),
  );
}

export async function disputeSalesperson(
  deps:SettlementDeps,
  performanceId:string,
  partyId:string,
  reason:string,
){
  const admin=await adminId(deps.actors);
  return deps.operations.mutatePerformance(
    performanceId,
    current=>disputeBySalesperson(current,partyId,admin,reason,iso(deps.now)),
  );
}

export async function confirmSupplier(
  deps:SettlementDeps,
  performanceId:string,
  partyId:string,
){
  const admin=await adminId(deps.actors);
  return deps.operations.mutatePerformance(
    performanceId,
    current=>confirmBySupplier(current,partyId,admin,iso(deps.now)),
  );
}

export async function supplierIssue(
  deps:SettlementDeps,
  performanceId:string,
  partyId:string,
  reason:string,
  amounts:SettlementAmounts,
){
  const admin=await adminId(deps.actors);
  return deps.operations.mutatePerformance(
    performanceId,
    current=>registerSupplierIssue(current,partyId,admin,reason,amounts,iso(deps.now)),
  );
}

export async function reconfirmSalesperson(
  deps:SettlementDeps,
  performanceId:string,
  partyId:string,
){
  const admin=await adminId(deps.actors);
  return deps.operations.mutatePerformance(
    performanceId,
    current=>reconfirmBySalesperson(current,partyId,admin,iso(deps.now)),
  );
}

export async function resolvePerformanceIssue(
  deps:SettlementDeps,
  performanceId:string,
  reason:string,
){
  const admin=await adminId(deps.actors);
  return deps.operations.mutatePerformance(
    performanceId,
    current=>resolveOpenIssue(current,admin,reason,iso(deps.now)),
  );
}

export async function finalizeSettlement(deps:SettlementDeps,performanceId:string){
  await adminId(deps.actors);
  return deps.operations.finalizePerformance(
    performanceId,
    current=>createSettlementFromPerformance(current,iso(deps.now)),
  );
}

export async function createBusinessClawback(
  deps:SettlementDeps,
  settlementId:string,
  input:{
    id:string;
    supplierAmount:number;
    channelAmount?:number;
    reason:string;
    occurredAt?:string;
  },
){
  const actorId=await adminId(deps.actors);
  const settlement=await deps.operations.getSettlement(settlementId);
  if(!settlement)throw new Error('SETTLEMENT_NOT_FOUND');
  const existing=await deps.operations.listClawbacks(settlementId);
  const now=iso(deps.now);
  const candidate=createSettlementClawback(settlement,existing,{
    id:input.id,
    supplierAmount:input.supplierAmount,
    ...(input.channelAmount!==undefined?{channelAmount:input.channelAmount}:{}),
    reason:input.reason,
    occurredAt:input.occurredAt??now,
    createdAt:now,
    createdBy:actorId,
  });
  return deps.operations.ensureClawback(settlementId,candidate);
}

export async function ensureClawbackBillingAdjustment(
  deps:SettlementDeps,
  settlementId:string,
  clawbackId:string,
){
  await adminId(deps.actors);
  const settlement=await deps.operations.getSettlement(settlementId);
  if(!settlement)throw new Error('SETTLEMENT_NOT_FOUND');
  const clawbacks=await deps.operations.listClawbacks(settlementId);
  const clawback=clawbacks.find((item)=>item.id===clawbackId);
  if(!clawback)throw new Error('CLAWBACK_NOT_FOUND');
  return deps.operations.ensureClawbackBilling(
    clawbackId,
    ()=>createClawbackBillingAdjustment(settlement,clawback,iso(deps.now)),
  );
}

export async function recordClawbackBillingEvidence(
  deps:SettlementDeps,
  settlementId:string,
  clawbackId:string,
  input:{reference:string;issuedAt:string;note?:string},
){
  const actorId=await adminId(deps.actors);
  const settlement=await deps.operations.getSettlement(settlementId);
  if(!settlement)throw new Error('SETTLEMENT_NOT_FOUND');
  const adjustment=await deps.operations.getClawbackBillingByClawbackId(clawbackId);
  if(!adjustment||adjustment.settlementId!==settlementId)throw new Error('CLAWBACK_BILLING_NOT_FOUND');
  const recordedAt=iso(deps.now);
  return deps.operations.mutateClawbackBilling(
    clawbackId,
    current=>recordClawbackBillingInvoiceEvidence(current,{
      reference:input.reference,
      issuedAt:input.issuedAt,
      recordedAt,
      recordedBy:actorId,
      ...(input.note?{note:input.note}:{}),
    }),
  );
}

export async function ensureSettlementBilling(deps:SettlementDeps,settlementId:string){
  await adminId(deps.actors);
  const settlement=await deps.operations.getSettlement(settlementId);
  if(!settlement)throw new Error('SETTLEMENT_NOT_FOUND');
  return deps.operations.ensureBilling(settlementId,()=>createBilling(settlement,iso(deps.now)));
}

export async function recordBillingEvidence(
  deps:SettlementDeps,
  settlementId:string,
  input:{reference:string;issuedAt:string;note?:string},
){
  const actorId=await adminId(deps.actors);
  const recordedAt=iso(deps.now);
  return deps.operations.mutateBilling(
    settlementId,
    current=>recordBillingInvoiceEvidence(current,{
      reference:input.reference,
      issuedAt:input.issuedAt,
      recordedAt,
      recordedBy:actorId,
      ...(input.note?{note:input.note}:{}),
    }),
  );
}

export async function recordCollection(
  deps:SettlementDeps,
  settlementId:string,
  input:{id:string;amount:number;note?:string},
){
  const actorId=await adminId(deps.actors);
  const settlement=await deps.operations.getSettlement(settlementId);
  if(!settlement)throw new Error('SETTLEMENT_NOT_FOUND');
  const [billing,clawbacks]=await Promise.all([
    deps.operations.getBillingBySettlementId(settlementId),
    deps.operations.listClawbacks(settlementId),
  ]);
  const entry:LedgerEntry={
    id:input.id,settlementId,account:'SUPPLIER_COLLECTION',kind:'CASH',
    amount:input.amount,occurredAt:iso(deps.now),actorId,
    ...(input.note?{note:input.note}:{}),
  };
  return deps.operations.mutateLedger(
    settlementId,
    entries=>registerCollection(settlement,billing??undefined,entries,entry,clawbacks),
  );
}

export async function recordPayout(
  deps:SettlementDeps,
  settlementId:string,
  input:{id:string;amount:number;note?:string;policy:PayoutPolicy},
){
  const actorId=await adminId(deps.actors);
  const settlement=await deps.operations.getSettlement(settlementId);
  if(!settlement)throw new Error('SETTLEMENT_NOT_FOUND');
  const [billing,clawbacks]=await Promise.all([
    deps.operations.getBillingBySettlementId(settlementId),
    deps.operations.listClawbacks(settlementId),
  ]);
  const entry:LedgerEntry={
    id:input.id,settlementId,account:'CHANNEL_PAYOUT',kind:'CASH',
    amount:input.amount,occurredAt:iso(deps.now),actorId,
    ...(input.note?{note:input.note}:{}),
  };
  return deps.operations.mutateLedger(
    settlementId,
    entries=>registerPayout(settlement,billing??undefined,entries,entry,input.policy,clawbacks),
  );
}

export async function recordSupplierRefund(
  deps:SettlementDeps,
  settlementId:string,
  clawbackId:string,
  input:{id:string;amount:number;note?:string},
){
  const actorId=await adminId(deps.actors);
  const settlement=await deps.operations.getSettlement(settlementId);
  if(!settlement)throw new Error('SETTLEMENT_NOT_FOUND');
  const [billing,clawbacks]=await Promise.all([
    deps.operations.getBillingBySettlementId(settlementId),
    deps.operations.listClawbacks(settlementId),
  ]);
  const clawback=clawbacks.find((item)=>item.id===clawbackId);
  if(!clawback)throw new Error('CLAWBACK_NOT_FOUND');
  const entry:LedgerEntry={
    id:input.id,
    settlementId,
    clawbackId,
    account:'SUPPLIER_REFUND',
    kind:'CASH',
    amount:input.amount,
    occurredAt:iso(deps.now),
    actorId,
    ...(input.note?{note:input.note}:{}),
  };
  return deps.operations.mutateLedger(
    settlementId,
    entries=>registerSupplierRefund(
      settlement,billing??undefined,clawbacks,clawback,entries,entry,
    ),
  );
}

export async function recordChannelRecovery(
  deps:SettlementDeps,
  settlementId:string,
  clawbackId:string,
  input:{id:string;amount:number;note?:string},
){
  const actorId=await adminId(deps.actors);
  const settlement=await deps.operations.getSettlement(settlementId);
  if(!settlement)throw new Error('SETTLEMENT_NOT_FOUND');
  const [billing,clawbacks]=await Promise.all([
    deps.operations.getBillingBySettlementId(settlementId),
    deps.operations.listClawbacks(settlementId),
  ]);
  const clawback=clawbacks.find((item)=>item.id===clawbackId);
  if(!clawback)throw new Error('CLAWBACK_NOT_FOUND');
  const entry:LedgerEntry={
    id:input.id,
    settlementId,
    clawbackId,
    account:'CHANNEL_RECOVERY',
    kind:'CASH',
    amount:input.amount,
    occurredAt:iso(deps.now),
    actorId,
    ...(input.note?{note:input.note}:{}),
  };
  return deps.operations.mutateLedger(
    settlementId,
    entries=>registerChannelRecovery(
      settlement,billing??undefined,clawbacks,clawback,entries,entry,
    ),
  );
}

export async function reverseEntry(
  deps:SettlementDeps,
  settlementId:string,
  input:{id:string;originalId:string;account:LedgerEntry['account'];amount:number;clawbackId?:string;note?:string},
){
  const actorId=await adminId(deps.actors);
  const settlement=await deps.operations.getSettlement(settlementId);
  if(!settlement)throw new Error('SETTLEMENT_NOT_FOUND');
  const entry:LedgerEntry={
    id:input.id,settlementId,account:input.account,kind:'REVERSAL',
    amount:input.amount,occurredAt:iso(deps.now),actorId,reversalOfEntryId:input.originalId,
    ...(input.clawbackId?{clawbackId:input.clawbackId}:{}),
    ...(input.note?{note:input.note}:{}),
  };
  return deps.operations.mutateLedger(
    settlementId,
    entries=>reverseLedgerEntry(settlement,entries,entry),
  );
}
