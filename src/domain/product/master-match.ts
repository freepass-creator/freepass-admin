import type { VehicleMatchLevel } from './types';

export interface VehicleMasterNode{
  id:string;maker:string;model:string;subModel:string;aliases:string[];trims:string[];
  yearStart:number|null;yearEnd:number|null;
}
export interface MasterMatch{level:VehicleMatchLevel;nodeId:string;why:string|null;}
export type MasterIndex=Map<string,VehicleMasterNode[]>;

export const norm=(s:unknown)=>String(s??'').replace(/\s+/g,'').toLowerCase();

export function indexMaster(nodes:readonly VehicleMasterNode[]):MasterIndex{
  const m:MasterIndex=new Map();
  for(const n of nodes){
    const k=norm(n.maker)+'|'+norm(n.model);
    m.set(k,[...(m.get(k)??[]),n]);
  }
  return m;
}

export function matchToMaster(
  a:{maker?:string;model?:string;subModel?:string;trim?:string;year?:number},
  index:MasterIndex,
):MasterMatch{
  if(!a.maker||!a.model)return{level:'UNMATCHED',nodeId:'',why:'제조사·모델이 비어 있다'};
  const family=index.get(norm(a.maker)+'|'+norm(a.model));
  if(!family?.length)return{level:'UNMATCHED',nodeId:'',why:'차종마스터에 제조사·모델이 없다'};
  const modelNode=a.maker+'|'+a.model;
  if(!a.subModel)return{level:'MODEL',nodeId:modelNode,why:'세부모델 미확인'};

  const want=norm(a.subModel);
  let hits=family.filter((n)=>norm(n.subModel)===want||n.aliases.some((x)=>norm(x)===want));
  if(hits.length>1&&a.year){
    const inYear=hits.filter((n)=>(n.yearStart===null||n.yearStart<=a.year!)&&(n.yearEnd===null||a.year!<=n.yearEnd));
    if(inYear.length)hits=inYear;
  }
  if(hits.length!==1)return{level:'MODEL',nodeId:modelNode,why:hits.length?'세부모델 후보가 여러 개다':'세부모델이 마스터에 없다'};
  const node=hits[0];
  if(!a.trim)return{level:'SUB_MODEL',nodeId:node.id,why:'트림 미확인'};
  if(node.trims.some((x)=>norm(x)===norm(a.trim)))return{level:'TRIM',nodeId:node.id,why:null};
  return{level:'SUB_MODEL',nodeId:node.id,why:'트림이 마스터에 없다'};
}
