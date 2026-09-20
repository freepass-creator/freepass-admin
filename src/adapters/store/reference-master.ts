import type { AssigneeRef, ReferenceMaster, SalesChannelRef } from '../../domain/reference-master/types';

function ids(value:unknown):string[]{
  return [...new Set(
    String(value??'')
      .split(',')
      .map((x)=>x.trim())
      .filter(Boolean),
  )];
}

export class EnvReferenceMaster implements ReferenceMaster{
  constructor(private readonly env:NodeJS.ProcessEnv=process.env){}

  async listSalesChannels():Promise<SalesChannelRef[]>{
    return ids(this.env.FPA_DEV_SALES_CHANNEL_IDS)
      .map((id)=>({id,label:id,status:'ACTIVE' as const}));
  }

  async listAssignees():Promise<AssigneeRef[]>{
    const primary=String(this.env.FPA_DEV_ACTOR_ID||'dev-admin').trim();
    return ids([primary,...ids(this.env.FPA_DEV_ASSIGNEE_IDS)].join(','))
      .map((id)=>({id,label:id,status:'ACTIVE' as const}));
  }

  async getSalesChannel(id:string):Promise<SalesChannelRef|null>{
    const rows=await this.listSalesChannels();
    return rows.find((row)=>row.id===id)??null;
  }

  async getAssignee(id:string):Promise<AssigneeRef|null>{
    const rows=await this.listAssignees();
    return rows.find((row)=>row.id===id)??null;
  }
}
