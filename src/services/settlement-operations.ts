import {
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
  createSettlementFromPerformance,
  recordBillingInvoiceEvidence,
  registerCollection,
  registerPayout,
  reverseLedgerEntry,
} from '../domain/settlement/settlement';
import type { LedgerEntry, PayoutPolicy } from '../domain/settlement/types';
import type { ActorProvider } from '../ports/auth';
import type { OperationsRepository } from '../ports/operations';
import type { ApplicationRepository } from '../ports/repositories';

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
  const billing=await deps.operations.getBillingBySettlementId(settlementId);
  const entry:LedgerEntry={
    id:input.id,settlementId,account:'SUPPLIER_COLLECTION',kind:'CASH',
    amount:input.amount,occurredAt:iso(deps.now),actorId,
    ...(input.note?{note:input.note}:{}),
  };
  return deps.operations.mutateLedger(
    settlementId,
    entries=>registerCollection(settlement,billing??undefined,entries,entry),
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
  const billing=await deps.operations.getBillingBySettlementId(settlementId);
  const entry:LedgerEntry={
    id:input.id,settlementId,account:'CHANNEL_PAYOUT',kind:'CASH',
    amount:input.amount,occurredAt:iso(deps.now),actorId,
    ...(input.note?{note:input.note}:{}),
  };
  return deps.operations.mutateLedger(
    settlementId,
    entries=>registerPayout(settlement,billing??undefined,entries,entry,input.policy),
  );
}

export async function reverseEntry(
  deps:SettlementDeps,
  settlementId:string,
  input:{id:string;originalId:string;account:LedgerEntry['account'];amount:number;note?:string},
){
  const actorId=await adminId(deps.actors);
  const settlement=await deps.operations.getSettlement(settlementId);
  if(!settlement)throw new Error('SETTLEMENT_NOT_FOUND');
  const entry:LedgerEntry={
    id:input.id,settlementId,account:input.account,kind:'REVERSAL',
    amount:input.amount,occurredAt:iso(deps.now),actorId,reversalOfEntryId:input.originalId,
    ...(input.note?{note:input.note}:{}),
  };
  return deps.operations.mutateLedger(
    settlementId,
    entries=>reverseLedgerEntry(settlement,entries,entry),
  );
}
