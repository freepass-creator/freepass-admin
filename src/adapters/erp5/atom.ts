export const strOf=(v:unknown):string=>String(v??'').trim();
export const strOrUndef=(v:unknown):string|undefined=>strOf(v)||undefined;

const bareNumber=(v:unknown):number|undefined=>{
  if(typeof v==='number')return Number.isFinite(v)?v:undefined;
  const s=strOf(v).replace(/[,\s원]/g,'');
  if(!s)return undefined;
  const n=Number(s);
  return Number.isFinite(n)?n:undefined;
};
export const numOrUndef=(v:unknown)=>bareNumber(v);
