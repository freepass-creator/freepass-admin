import type { Performance } from '../../domain/performance/types';
import type { BillingRecord, ClawbackItem, LedgerEntry, SettlementItem } from '../../domain/settlement/types';
import type { OperationsRepository } from '../../ports/operations';
import { erp5, erp5AdminCollection, requireErp5Write } from './firestore';

const clone=<T>(value:T):T=>structuredClone(value);

export class Erp5OperationsRepository implements OperationsRepository{
  private performances(){return erp5().collection(erp5AdminCollection('performances'));}
  private settlements(){return erp5().collection(erp5AdminCollection('settlements'));}
  private clawbacks(){return erp5().collection(erp5AdminCollection('clawbacks'));}
  private billings(){return erp5().collection(erp5AdminCollection('billings'));}
  private ledger(){return erp5().collection(erp5AdminCollection('ledger'));}

  async ensurePerformance(candidate:Performance){
    requireErp5Write();
    const db=erp5();
    const ref=this.performances().doc(candidate.id);
    return db.runTransaction(async(tx)=>{
      const doc=await tx.get(ref);
      if(doc.exists)return{performance:doc.data() as Performance,created:false};
      tx.create(ref,candidate);
      return{performance:clone(candidate),created:true};
    });
  }

  async getPerformance(id:string){
    const doc=await this.performances().doc(id).get();
    return doc.exists?(doc.data() as Performance):null;
  }

  async listPerformances(){
    const snap=await this.performances().get();
    return snap.docs.map((d)=>d.data() as Performance).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }

  async mutatePerformance(id:string,change:(current:Performance)=>Performance){
    requireErp5Write();
    const db=erp5();const ref=this.performances().doc(id);
    return db.runTransaction(async(tx)=>{
      const doc=await tx.get(ref);if(!doc.exists)throw new Error('PERFORMANCE_NOT_FOUND');
      const current=doc.data() as Performance;
      const next=change(clone(current));
      if(next.id!==current.id||next.applicationId!==current.applicationId)throw new Error('PERFORMANCE_IDENTITY_IMMUTABLE');
      tx.set(ref,next);return next;
    });
  }

  async finalizePerformance(
    id:string,
    finalize:(current:Performance)=>{performance:Performance;settlement:SettlementItem},
  ){
    requireErp5Write();
    const db=erp5();const perfRef=this.performances().doc(id);
    return db.runTransaction(async(tx)=>{
      const perfDoc=await tx.get(perfRef);if(!perfDoc.exists)throw new Error('PERFORMANCE_NOT_FOUND');
      const current=perfDoc.data() as Performance;
      const existing=await tx.get(this.settlements().where('performanceId','==',id).limit(1));
      if(!existing.empty){
        const settlement=existing.docs[0].data() as SettlementItem;
        return{performance:current,settlement,created:false};
      }

      const built=finalize(clone(current));
      if(built.performance.id!==id||built.settlement.performanceId!==id)throw new Error('SETTLEMENT_PERFORMANCE_IDENTITY_MISMATCH');
      const settlementRef=this.settlements().doc(built.settlement.id);
      const collision=await tx.get(settlementRef);
      if(collision.exists)throw new Error('SETTLEMENT_ID_COLLISION');
      tx.set(perfRef,built.performance);
      tx.create(settlementRef,built.settlement);
      return{...built,created:true};
    });
  }

  async getSettlement(id:string){
    const doc=await this.settlements().doc(id).get();
    return doc.exists?(doc.data() as SettlementItem):null;
  }

  async findSettlementByPerformanceId(performanceId:string){
    const snap=await this.settlements().where('performanceId','==',performanceId).limit(1).get();
    return snap.empty?null:(snap.docs[0].data() as SettlementItem);
  }

  async listSettlements(){
    const snap=await this.settlements().get();
    return snap.docs.map((d)=>d.data() as SettlementItem).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }

  async ensureClawback(settlementId:string,candidate:ClawbackItem){
    requireErp5Write();
    const db=erp5();
    const settlementRef=this.settlements().doc(settlementId);
    const clawbackRef=this.clawbacks().doc(candidate.id);
    return db.runTransaction(async(tx)=>{
      const [settlement,existing]=await Promise.all([
        tx.get(settlementRef),
        tx.get(clawbackRef),
      ]);
      if(!settlement.exists)throw new Error('SETTLEMENT_NOT_FOUND');
      if(candidate.settlementId!==settlementId)throw new Error('CLAWBACK_SETTLEMENT_IDENTITY_MISMATCH');
      if(existing.exists){
        const current=existing.data() as ClawbackItem;
        if(JSON.stringify(current)!==JSON.stringify(candidate))throw new Error('IDEMPOTENCY_KEY_REUSE');
        return{clawback:current,created:false};
      }
      tx.create(clawbackRef,candidate);
      return{clawback:clone(candidate),created:true};
    });
  }

  async listClawbacks(settlementId:string){
    const snap=await this.clawbacks().where('settlementId','==',settlementId).get();
    return snap.docs
      .map((d)=>d.data() as ClawbackItem)
      .sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));
  }

  async ensureBilling(settlementId:string,create:()=>BillingRecord){
    requireErp5Write();
    const db=erp5();
    const settlementRef=this.settlements().doc(settlementId);
    const query=this.billings().where('settlementId','==',settlementId).limit(1);
    return db.runTransaction(async(tx)=>{
      const [settlement,existing]=await Promise.all([tx.get(settlementRef),tx.get(query)]);
      if(!settlement.exists)throw new Error('SETTLEMENT_NOT_FOUND');
      if(!existing.empty)return{billing:existing.docs[0].data() as BillingRecord,created:false};
      const billing=create();
      if(billing.settlementId!==settlementId)throw new Error('BILLING_SETTLEMENT_IDENTITY_MISMATCH');
      tx.create(this.billings().doc(billing.id),billing);
      return{billing,created:true};
    });
  }

  async getBillingBySettlementId(settlementId:string){
    const snap=await this.billings().where('settlementId','==',settlementId).limit(1).get();
    return snap.empty?null:(snap.docs[0].data() as BillingRecord);
  }

  async mutateBilling(settlementId:string,change:(current:BillingRecord)=>BillingRecord){
    requireErp5Write();
    const db=erp5();
    const query=this.billings().where('settlementId','==',settlementId).limit(1);
    return db.runTransaction(async(tx)=>{
      const snap=await tx.get(query);
      if(snap.empty)throw new Error('BILLING_NOT_FOUND');
      const doc=snap.docs[0];
      const current=doc.data() as BillingRecord;
      const next=change(clone(current));
      if(next.id!==current.id||next.settlementId!==current.settlementId)throw new Error('BILLING_IDENTITY_IMMUTABLE');
      tx.set(doc.ref,next);
      return next;
    });
  }

  async listLedger(settlementId:string){
    const snap=await this.ledger().where('settlementId','==',settlementId).get();
    return snap.docs.map((d)=>d.data() as LedgerEntry).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));
  }

  async mutateLedger(settlementId:string,change:(entries:LedgerEntry[])=>LedgerEntry[]){
    requireErp5Write();
    const db=erp5();
    const settlementRef=this.settlements().doc(settlementId);
    const query=this.ledger().where('settlementId','==',settlementId);
    return db.runTransaction(async(tx)=>{
      const [settlement,snap]=await Promise.all([tx.get(settlementRef),tx.get(query)]);
      if(!settlement.exists)throw new Error('SETTLEMENT_NOT_FOUND');
      const current=snap.docs.map((d)=>d.data() as LedgerEntry);
      const next=change(clone(current));
      if(next.some((x)=>x.settlementId!==settlementId))throw new Error('LEDGER_SETTLEMENT_IDENTITY_MISMATCH');

      const byId=new Map(next.map((x)=>[x.id,x]));
      for(const existing of current){
        const after=byId.get(existing.id);
        if(!after)throw new Error('LEDGER_DELETE_FORBIDDEN');
        if(JSON.stringify(after)!==JSON.stringify(existing))throw new Error('LEDGER_HISTORY_IMMUTABLE');
      }
      const currentIds=new Set(current.map((x)=>x.id));
      for(const entry of next){
        if(!currentIds.has(entry.id))tx.create(this.ledger().doc(entry.id),entry);
      }
      return next;
    });
  }
}
