import type { Application, ApplicationStatus } from './types';

export type ApplicationListQuery={
  text?:string;
  status?:ApplicationStatus|'ACTIVE';
  salesChannelId?:string;
  assigneeId?:string;
};

const norm=(value:string|undefined)=>String(value??'').trim().toLowerCase();

export function matchApplication(app:Application,query:ApplicationListQuery):boolean{
  if(query.status){
    if(query.status==='ACTIVE'){
      if(app.status==='DELIVERED'||app.status==='CANCELLED')return false;
    }else if(app.status!==query.status){
      return false;
    }
  }

  if(query.salesChannelId&&app.salesChannelId!==query.salesChannelId)return false;
  if(query.assigneeId&&app.assigneeId!==query.assigneeId)return false;

  const text=norm(query.text);
  if(text){
    const haystack=[
      app.applicationNumber,
      app.applicantName,
      app.applicantPhone,
      app.salesChannelId,
      app.assigneeId,
      app.snapshot.supplierId,
      app.snapshot.vehicle.manufacturerId,
      app.snapshot.vehicle.modelId,
      app.snapshot.vehicle.subModelId,
      app.snapshot.vehicle.trimId,
      app.snapshot.registration?.vehicleNumber,
    ].filter(Boolean).join(' ').toLowerCase();
    if(!haystack.includes(text))return false;
  }

  return true;
}

export function filterApplications(apps:readonly Application[],query:ApplicationListQuery):Application[]{
  return apps.filter((app)=>matchApplication(app,query));
}

export function applicationFacets(apps:readonly Application[]){
  const unique=(values:string[])=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko-KR'));
  return{
    salesChannels:unique(apps.map((app)=>app.salesChannelId)),
    assignees:unique(apps.map((app)=>app.assigneeId)),
    statusCounts:{
      ALL:apps.length,
      ACTIVE:apps.filter((app)=>app.status!=='DELIVERED'&&app.status!=='CANCELLED').length,
      RECEIVED:apps.filter((app)=>app.status==='RECEIVED').length,
      CONTRACTED:apps.filter((app)=>app.status==='CONTRACTED').length,
      DELIVERED:apps.filter((app)=>app.status==='DELIVERED').length,
      CANCELLED:apps.filter((app)=>app.status==='CANCELLED').length,
    },
  };
}
