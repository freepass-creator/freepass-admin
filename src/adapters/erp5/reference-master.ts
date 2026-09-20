import type { AssigneeRef, ReferenceMaster, SalesChannelRef } from '../../domain/reference-master/types';
import { partnerTypeLabel } from '../../domain/reference-master/partner-type';
import { adminUidAllowlist } from '../../server/auth/config';
import { erp5 } from './firestore';

const text=(value:unknown)=>String(value??'').trim();
const yes=(value:unknown)=>value===true||value==='true'||value==='TRUE'||value===1;

function partnerStatus(data:Record<string,unknown>):'ACTIVE'|'INACTIVE'{
  if(yes(data._deleted)||text(data.merged_into))return'INACTIVE';
  const status=text(data.status||data.partner_status).toLowerCase();
  if(['inactive','disabled','deleted','비활성','중지','폐기'].includes(status))return'INACTIVE';
  return'ACTIVE';
}

export class Erp5ReferenceMaster implements ReferenceMaster{
  constructor(private readonly env:NodeJS.ProcessEnv=process.env){}

  async listSalesChannels():Promise<SalesChannelRef[]>{
    const snap=await erp5(this.env).collection('partner').get();
    const out:SalesChannelRef[]=[];

    for(const doc of snap.docs){
      const data=doc.data() as Record<string,unknown>;
      const id=text(data.partner_code)||doc.id;
      if(partnerTypeLabel(data.partner_type??data.type,id)!=='영업채널')continue;
      const status=partnerStatus(data);
      if(status!=='ACTIVE')continue;
      out.push({
        id,
        label:text(data.partner_name)||text(data.name)||id,
        status,
      });
    }

    const byId=new Map<string,SalesChannelRef>();
    for(const row of out)if(!byId.has(row.id))byId.set(row.id,row);
    return [...byId.values()].sort((a,b)=>a.label.localeCompare(b.label,'ko-KR'));
  }

  async listAssignees():Promise<AssigneeRef[]>{
    return [...adminUidAllowlist(this.env)]
      .map((id)=>({id,label:id,status:'ACTIVE' as const}))
      .sort((a,b)=>a.id.localeCompare(b.id));
  }

  async getSalesChannel(id:string):Promise<SalesChannelRef|null>{
    const rows=await this.listSalesChannels();
    return rows.find((row)=>row.id===id)??null;
  }

  async getAssignee(id:string):Promise<AssigneeRef|null>{
    if(!adminUidAllowlist(this.env).has(id))return null;
    return{id,label:id,status:'ACTIVE'};
  }
}
