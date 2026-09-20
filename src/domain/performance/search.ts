import type { Performance, PerformanceStatus } from './types';

export type PerformanceListQuery={
  text?:string;
  status?:PerformanceStatus|'OPEN';
  supplierId?:string;
  salesChannelId?:string;
  assigneeId?:string;
};

const norm=(value:string|undefined)=>String(value??'').trim().toLowerCase();

export function matchPerformance(row:Performance,query:PerformanceListQuery):boolean{
  if(query.status){
    if(query.status==='OPEN'){
      if(row.status==='FINALIZED')return false;
    }else if(row.status!==query.status){
      return false;
    }
  }

  if(query.supplierId&&row.snapshot.supplierId!==query.supplierId)return false;
  if(query.salesChannelId&&row.snapshot.salesChannelId!==query.salesChannelId)return false;
  if(query.assigneeId&&row.snapshot.assigneeId!==query.assigneeId)return false;

  const text=norm(query.text);
  if(text){
    const haystack=[
      row.id,
      row.snapshot.applicationNumber,
      row.snapshot.applicantName,
      row.snapshot.supplierId,
      row.snapshot.salesChannelId,
      row.snapshot.assigneeId,
      row.snapshot.vehicle.manufacturerId,
      row.snapshot.vehicle.modelId,
      row.snapshot.vehicle.subModelId,
      row.snapshot.vehicle.trimId,
      row.snapshot.registration?.vehicleNumber,
    ].filter(Boolean).join(' ').toLowerCase();
    if(!haystack.includes(text))return false;
  }

  return true;
}

export function filterPerformances(rows:readonly Performance[],query:PerformanceListQuery):Performance[]{
  return rows.filter((row)=>matchPerformance(row,query));
}

export function performanceFacets(rows:readonly Performance[]){
  const unique=(values:string[])=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko-KR'));
  const statuses:PerformanceStatus[]=[
    'AWAITING_AMOUNTS',
    'AWAITING_SALESPERSON_CONFIRMATION',
    'AWAITING_SUPPLIER_REVIEW',
    'AWAITING_SALESPERSON_RECONFIRMATION',
    'SUPPLIER_ISSUE',
    'READY_TO_FINALIZE',
    'FINALIZED',
  ];
  return{
    suppliers:unique(rows.map((row)=>row.snapshot.supplierId)),
    salesChannels:unique(rows.map((row)=>row.snapshot.salesChannelId)),
    assignees:unique(rows.map((row)=>row.snapshot.assigneeId)),
    statusCounts:Object.fromEntries([
      ['ALL',rows.length],
      ['OPEN',rows.filter((row)=>row.status!=='FINALIZED').length],
      ...statuses.map((status)=>[status,rows.filter((row)=>row.status===status).length]),
    ]) as Record<'ALL'|'OPEN'|PerformanceStatus,number>,
  };
}
