import type {
  CanonicalProduct, Offer, PolicyValue, RegistrationInfo, VehicleMasterRef, VehicleSpecs,
} from '../../domain/product/types';
import { matchToMaster, type MasterIndex } from '../../domain/product/master-match';
import { numOrUndef as N, strOrUndef as S } from './atom';
import { parseAge, parseMileageKm, parseMoney, parsePriceKey, parseRate, parseYesNo } from './parse';

export type Erp5Doc=Record<string,unknown>;
export type SkipReason='NOT_LISTABLE'|'NO_CAR_NUMBER'|'NO_PRICE'|'NO_VALID_OFFER';
export type MapResult=
  |{ok:true;product:CanonicalProduct;warnings:string[]}
  |{ok:false;reason:SkipReason;key:string};

const POLICY_NUMBER:Record<string,'MONEY'|'NUMBER'|'PERCENTAGE'>={
  mileage_upcharge_per_10000km:'MONEY',
  additional_driver_cost:'MONEY',
  age_lowering_cost:'MONEY',
  succession_fee:'MONEY',
  own_damage_min_deductible:'MONEY',
  own_damage_max_deductible:'MONEY',
  self_body_deductible:'MONEY',
  property_deductible:'MONEY',
  injury_deductible:'MONEY',
  over_mileage_rate_domestic:'MONEY',
  over_mileage_rate_imported:'MONEY',
  over_mileage_rate_per_km:'MONEY',
  early_termination_rate_under1y:'PERCENTAGE',
  early_termination_rate_over1y:'PERCENTAGE',
  own_damage_repair_ratio:'PERCENTAGE',
  late_fee_rate:'PERCENTAGE',
  accident_termination_count:'NUMBER',
  deposit_return_days:'NUMBER',
  auto_terminate_overdue_days:'NUMBER',
};
const POLICY_BOOL=new Set([
  'deposit_card_payment','deposit_installment','succession_allowed','maintenance_service','insurance_included',
]);
const POLICY_DROP=/^(_|created_|updated_|policy_code|term_code|companyId|provider_company_code|status$)/;

export function policyValuesOf(policy:Erp5Doc|undefined):PolicyValue[]{
  if(!policy)return[];
  const out:PolicyValue[]=[];
  for(const [key,raw] of Object.entries(policy)){
    if(POLICY_DROP.test(key))continue;
    const text=S(raw);if(text===undefined)continue;

    if(key==='basic_driver_age'||key==='driver_age_lowering'||key==='driver_age_upper_limit'){
      const a=parseAge(raw);
      out.push(a.age!==undefined
        ?{policyId:key,type:'NUMBER',value:a.age}
        :{policyId:key,type:'TEXT',value:text});
      continue;
    }
    if(key==='annual_mileage'||key==='max_annual_mileage'){
      const km=parseMileageKm(raw);
      out.push(km!==undefined
        ?{policyId:key,type:'NUMBER',value:km}
        :{policyId:key,type:'TEXT',value:text});
      continue;
    }
    const kind=POLICY_NUMBER[key];
    if(kind){
      const value=kind==='PERCENTAGE'?parseRate(raw):kind==='MONEY'?parseMoney(raw):N(raw);
      if(value!==undefined){
        if(kind==='PERCENTAGE')out.push({policyId:key,type:'PERCENTAGE',value});
        else if(kind==='MONEY')out.push({policyId:key,type:'MONEY',value});
        else out.push({policyId:key,type:'NUMBER',value});
      }else out.push({policyId:key,type:'TEXT',value:text});
      continue;
    }
    if(POLICY_BOOL.has(key)){
      const value=parseYesNo(raw);
      out.push(value!==undefined
        ?{policyId:key,type:'BOOLEAN',value}
        :{policyId:key,type:'TEXT',value:text});
      continue;
    }
    out.push({policyId:key,type:'TEXT',value:text});
  }
  return out;
}

export function offersOf(price:unknown,productId:string):{offers:Offer[];warnings:string[]}{
  const warnings:string[]=[];
  if(!price||typeof price!=='object')return{offers:[],warnings};
  const offers:Offer[]=[];
  for(const [key,raw] of Object.entries(price as Record<string,unknown>)){
    if(!raw||typeof raw!=='object'){warnings.push('price '+key+' is not an object');continue;}
    const cell=raw as Record<string,unknown>;
    const parsed=parsePriceKey(key);
    const monthlyRent=N(cell.rent);
    if(parsed.termMonths===undefined){warnings.push('term unreadable: '+key);continue;}
    if(monthlyRent===undefined){warnings.push('rent missing: '+key);continue;}
    offers.push({
      id:productId+'#'+key,
      termMonths:parsed.termMonths,
      monthlyRent,
      deposit:N(cell.deposit),
      prepayment:N(cell.prepayment),
      annualMileageKm:parsed.annualMileageKm,
      policyValues:[],
    });
  }
  offers.sort((a,b)=>a.termMonths-b.termMonths||(a.annualMileageKm??0)-(b.annualMileageKm??0));
  return{offers,warnings};
}

function sourceVersion(d:Erp5Doc):number{
  for(const key of ['product_version','version','updatedAt','updated_at','stateAt']){
    const raw=d[key];
    if(typeof raw==='number'&&Number.isSafeInteger(raw)&&raw>0)return raw;
    const text=String(raw??'').trim();
    if(/^\d+$/.test(text)){
      const n=Number(text);if(Number.isSafeInteger(n)&&n>0)return n;
    }
    const ms=Date.parse(text);
    if(Number.isSafeInteger(ms)&&ms>0)return ms;
  }
  return 1;
}

function updatedAtOf(d:Erp5Doc):string{
  for(const key of ['updatedAt','updated_at','stateAt']){
    const raw=d[key];
    if(typeof raw==='number'&&Number.isFinite(raw))return new Date(raw).toISOString();
    const text=String(raw??'').trim();
    const ms=Date.parse(text);if(Number.isFinite(ms))return new Date(ms).toISOString();
  }
  return new Date(0).toISOString();
}

function vehicleRefOf(d:Erp5Doc,master:MasterIndex):VehicleMasterRef{
  const maker=S(d.maker),model=S(d.model),subModel=S(d.sub_model),trim=S(d.trim_name);
  const matched=matchToMaster({maker,model,subModel,trim,year:N(d.year)},master);
  return{
    nodeId:matched.nodeId,
    originId:S(d.origin)??'',
    manufacturerId:maker??'',
    modelId:model??'',
    ...(subModel?{subModelId:subModel}:{}),
    ...(trim?{trimId:trim}:{}),
    matchLevel:matched.level,
  };
}

function specsOf(d:Erp5Doc):VehicleSpecs{
  return{
    modelYear:N(d.year),
    mileageKm:N(d.mileage),
    fuel:S(d.fuel_type),
    displacementCc:N(d.engine_cc),
    seats:N(d.seats),
    drivetrain:S(d.drive_type),
    batteryKwh:N(d.battery_capacity),
  };
}

function registrationOf(d:Erp5Doc):RegistrationInfo|undefined{
  const r:RegistrationInfo={
    vehicleNumber:S(d.car_number),
    vin:S(d.vin),
    firstRegistrationDate:S(d.first_registration_date),
  };
  return r.vehicleNumber||r.vin||r.firstRegistrationDate?r:undefined;
}

export function toCanonicalProduct(
  d:Erp5Doc,
  docId:string,
  policy:Erp5Doc|undefined,
  master:MasterIndex,
):MapResult{
  const key=S(d.car_number)??docId;
  if(d.listable===false)return{ok:false,reason:'NOT_LISTABLE',key};
  if(!S(d.car_number))return{ok:false,reason:'NO_CAR_NUMBER',key};
  if(!d.price||typeof d.price!=='object')return{ok:false,reason:'NO_PRICE',key};

  const id=S(d.product_code)??docId;
  const {offers,warnings}=offersOf(d.price,id);
  if(!offers.length)return{ok:false,reason:'NO_VALID_OFFER',key};

  const policyCode=S(d.policy_code);
  if(policyCode&&!policy)warnings.push('policy not found: '+policyCode);
  if(!policyCode)warnings.push('policy_code missing');

  const productPolicies=policyValuesOf(policy);
  const depositNote=S(d.deposit_note);
  if(depositNote)productPolicies.push({policyId:'deposit_note',type:'TEXT',value:depositNote});
  const productType=S(d.product_type);
  if(productType)productPolicies.push({policyId:'product_type',type:'SINGLE_SELECT',value:productType});

  const version=sourceVersion(d);
  return{
    ok:true,
    warnings,
    product:{
      id,
      version,
      supplierId:S(d.provider_company_code)??S(d.partner_code)??'',
      supplierProductKey:key,
      vehicle:vehicleRefOf(d,master),
      specs:specsOf(d),
      registration:registrationOf(d),
      offers,
      productPolicies,
      sourceSnapshotId:'erp5:'+docId+':'+String(version),
      updatedAt:updatedAtOf(d),
    },
  };
}
