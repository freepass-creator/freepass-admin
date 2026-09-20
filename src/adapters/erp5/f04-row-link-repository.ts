import type { F04RowLink, F04RowLinkRepository } from '../../ports/legacy-f04';
import { erp5, erp5AdminCollection, requireErp5Write } from './firestore';

const clone=<T>(value:T):T=>structuredClone(value);

export class Erp5F04RowLinkRepository implements F04RowLinkRepository{
  private links(){return erp5().collection(erp5AdminCollection('f04_links'));}

  async getByApplicationId(applicationId:string){
    const doc=await this.links().doc(applicationId).get();
    return doc.exists?(doc.data() as F04RowLink):null;
  }

  async getBySettlementCode(f04SettlementCode:string){
    const snap=await this.links().where('f04SettlementCode','==',f04SettlementCode).limit(1).get();
    return snap.empty?null:(snap.docs[0].data() as F04RowLink);
  }

  async bind(link:F04RowLink){
    requireErp5Write();
    const db=erp5();
    const ref=this.links().doc(link.applicationId);
    const byCode=this.links().where('f04SettlementCode','==',link.f04SettlementCode).limit(1);
    return db.runTransaction(async(tx)=>{
      const [existing,codeHit]=await Promise.all([tx.get(ref),tx.get(byCode)]);
      if(existing.exists){
        const current=existing.data() as F04RowLink;
        if(JSON.stringify(current)!==JSON.stringify(link))throw new Error('F04_APPLICATION_LINK_CONFLICT');
        return{link:current,created:false};
      }
      if(!codeHit.empty)throw new Error('F04_SETTLEMENT_CODE_LINK_CONFLICT');
      tx.create(ref,link);
      return{link:clone(link),created:true};
    });
  }

  async list(){
    const snap=await this.links().get();
    return snap.docs
      .map((doc)=>doc.data() as F04RowLink)
      .sort((a,b)=>a.linkedAt.localeCompare(b.linkedAt));
  }
}
