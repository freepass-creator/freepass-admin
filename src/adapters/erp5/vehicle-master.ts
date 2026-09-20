import { indexMaster, type MasterIndex, type VehicleMasterNode } from '../../domain/product/master-match';
import { erp5 } from './firestore';
import { strOf as S } from './atom';

function arr(v:unknown):unknown[]{
  if(Array.isArray(v))return v;
  if(typeof v==='string'&&v.trim().startsWith('[')){
    try{const x=JSON.parse(v);return Array.isArray(x)?x:[];}catch{return[];}
  }
  return[];
}
function year(v:unknown){
  const n=Number(String(v??'').slice(0,4));
  return Number.isFinite(n)&&n>1900?n:null;
}

export function nodeFromErp5(id:string,d:Record<string,unknown>):VehicleMasterNode{
  const trims=new Set<string>();
  for(const t of arr(d.trims)){const s=S(t);if(s)trims.add(s);}
  for(const v of arr(d.variants)){
    for(const t of arr((v as Record<string,unknown>)?.trims)){const s=S(t);if(s)trims.add(s);}
  }
  return{
    id,maker:S(d.maker),model:S(d.model),subModel:S(d.sub_model),
    aliases:arr(d.aliases).map(S).filter(Boolean),
    trims:[...trims],yearStart:year(d.year_start),yearEnd:year(d.year_end),
  };
}

const CACHE_MS=5*60_000;
const g=globalThis as unknown as{__fpaMasterIndex?:{at:number;index:MasterIndex}};

export async function loadMasterIndex():Promise<MasterIndex>{
  const hit=g.__fpaMasterIndex;
  if(hit&&Date.now()-hit.at<CACHE_MS)return hit.index;
  const snap=await erp5().collection('vehicle_master').get();
  const index=indexMaster(snap.docs.map((d)=>nodeFromErp5(d.id,d.data())));
  g.__fpaMasterIndex={at:Date.now(),index};
  return index;
}
