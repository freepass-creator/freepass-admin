export function parseMoney(raw:unknown):number|undefined{
  if(typeof raw==='number')return Number.isFinite(raw)?raw:undefined;
  const s=String(raw??'').trim();if(!s)return undefined;
  const eok=/^(\d+(?:\.\d+)?)\s*억/.exec(s);
  if(eok)return Number(eok[1])*100_000_000;
  const man=/^(\d[\d,]*(?:\.\d+)?)\s*만/.exec(s);
  if(man)return Number(man[1].replace(/,/g,''))*10_000;
  const plain=/^(\d[\d,]*)\s*원?$/.exec(s);
  return plain?Number(plain[1].replace(/,/g,'')):undefined;
}

export function parseMileageKm(raw:unknown):number|undefined{
  if(typeof raw==='number')return Number.isFinite(raw)?raw:undefined;
  const s=String(raw??'').trim();if(!s)return undefined;
  const man=/(\d[\d,]*(?:\.\d+)?)\s*만\s*(?:km|킬로)?/i.exec(s);
  if(man)return Number(man[1].replace(/,/g,''))*10_000;
  const km=/(\d[\d,]*)\s*(?:km|킬로)/i.exec(s);
  if(km)return Number(km[1].replace(/,/g,''));
  const bare=/^(?:연\s*)?(\d[\d,]*)$/.exec(s);
  return bare?Number(bare[1].replace(/,/g,'')):undefined;
}

export function parseAge(raw:unknown):{age?:number;unlimited?:boolean;denied?:boolean}{
  const s=String(raw??'').trim();if(!s)return{};
  if(/^(불가|없음|미제공|해당없음)$/i.test(s))return{denied:true};
  if(/제한\s*없|무제한/.test(s))return{unlimited:true};
  const m=/(\d{2})\s*세/.exec(s);
  return m?{age:Number(m[1])}:{};
}

export function parseRate(raw:unknown):number|undefined{
  if(typeof raw==='number')return Number.isFinite(raw)?(raw>1?raw/100:raw):undefined;
  const s=String(raw??'').trim();if(!s)return undefined;
  const pct=/^(\d+(?:\.\d+)?)\s*%$/.exec(s);
  if(pct)return Number(pct[1])/100;
  const n=Number(s);return Number.isFinite(n)?(n>1?n/100:n):undefined;
}

export function parseYesNo(raw:unknown):boolean|undefined{
  const s=String(raw??'').trim();if(!s)return undefined;
  if(/^(가능|포함|있음|제공|true|y|예)$/i.test(s))return true;
  if(/^(불가|불포함|없음|미제공|false|n|아니오)$/i.test(s))return false;
  return undefined;
}

export function parsePriceKey(key:string):{termMonths?:number;annualMileageKm?:number}{
  const s=String(key??'').trim();if(!s)return{};
  const [head,...rest]=s.split('_');
  const termMonths=/^\d+$/.test(head)?Number(head):undefined;
  const tail=rest.join('_');
  return{termMonths,annualMileageKm:tail?parseMileageKm(tail):undefined};
}
