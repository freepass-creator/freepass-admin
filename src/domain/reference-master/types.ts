export type ReferenceStatus='ACTIVE'|'INACTIVE';

export interface SalesChannelRef{
  id:string;
  label:string;
  status:ReferenceStatus;
}

export interface AssigneeRef{
  id:string;
  label:string;
  status:ReferenceStatus;
}

export interface ReferenceMaster{
  listSalesChannels():Promise<SalesChannelRef[]>;
  listAssignees():Promise<AssigneeRef[]>;
  getSalesChannel(id:string):Promise<SalesChannelRef|null>;
  getAssignee(id:string):Promise<AssigneeRef|null>;
}

export async function requireActiveSalesChannel(master:ReferenceMaster,id:string){
  const value=await master.getSalesChannel(id.trim());
  if(!value||value.status!=='ACTIVE')throw new Error('SALES_CHANNEL_NOT_ACTIVE');
  return value;
}

export async function requireActiveAssignee(master:ReferenceMaster,id:string){
  const value=await master.getAssignee(id.trim());
  if(!value||value.status!=='ACTIVE')throw new Error('ASSIGNEE_NOT_ACTIVE');
  return value;
}
