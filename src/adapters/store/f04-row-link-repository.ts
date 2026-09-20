import { join } from 'node:path';
import type { F04RowLink, F04RowLinkRepository } from '../../ports/legacy-f04';
import { JsonFileStore } from './json-file-store';

const DATA_DIR=process.env.FPA_DATA_DIR??join(process.cwd(),'.data');

export class FileF04RowLinkRepository implements F04RowLinkRepository{
  private readonly store:JsonFileStore<F04RowLink>;
  constructor(dir:string=DATA_DIR){
    this.store=new JsonFileStore<F04RowLink>(dir,'f04-row-links');
  }

  async getByApplicationId(applicationId:string){
    return (await this.store.all()).find((row)=>row.applicationId===applicationId)??null;
  }

  async getBySettlementCode(f04SettlementCode:string){
    return (await this.store.all()).find((row)=>row.f04SettlementCode===f04SettlementCode)??null;
  }

  async bind(link:F04RowLink){
    return this.store.mutate((rows)=>{
      const byApplication=rows.find((row)=>row.applicationId===link.applicationId);
      if(byApplication){
        if(JSON.stringify(byApplication)!==JSON.stringify(link))throw new Error('F04_APPLICATION_LINK_CONFLICT');
        return{rows,result:{link:structuredClone(byApplication),created:false}};
      }
      const byCode=rows.find((row)=>row.f04SettlementCode===link.f04SettlementCode);
      if(byCode)throw new Error('F04_SETTLEMENT_CODE_LINK_CONFLICT');
      const next=[...rows,structuredClone(link)];
      return{rows:next,result:{link:structuredClone(link),created:true}};
    });
  }

  async list(){
    return (await this.store.all()).slice().sort((a,b)=>a.linkedAt.localeCompare(b.linkedAt));
  }
}
