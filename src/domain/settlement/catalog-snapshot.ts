import { createHash } from 'node:crypto';
import type { CanonicalProduct, Offer, PolicyValue } from '../product/types';
import { resolveOfferPolicies } from '../product/resolve-policies';
import type { IntakeCatalogSnapshot } from './types';

function clonePolicy(p:PolicyValue):PolicyValue {
  return p.type==='MULTI_SELECT' ? {...p,value:[...p.value]} : {...p};
}
function canonical(value:unknown):unknown {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object'){
    return Object.fromEntries(
      Object.entries(value as Record<string,unknown>)
        .filter(([key])=>key!=='capturedAt'&&key!=='digest')
        .sort(([a],[b])=>a.localeCompare(b))
        .map(([key,child])=>[key,canonical(child)]),
    );
  }
  return value;
}
export function intakeCatalogSnapshotDigest(snapshot:Omit<IntakeCatalogSnapshot,'digest'>|IntakeCatalogSnapshot):string {
  return createHash('sha256').update(JSON.stringify(canonical(snapshot))).digest('hex');
}

export function buildIntakeCatalogSnapshot(
  product:CanonicalProduct,
  offer:Offer,
  capturedAt:string,
):IntakeCatalogSnapshot {
  const base:Omit<IntakeCatalogSnapshot,'digest'>={
    capturedAt,
    product:{
      id:product.id,
      version:product.version,
      sourceSnapshotId:product.sourceSnapshotId,
      supplierId:product.supplierId,
      supplierName:product.supplierName??null,
      productKind:product.productKind??null,
      status:product.status??null,
      consumerPrice:product.consumerPrice??null,
      vehicle:{
        nodeId:product.vehicle.nodeId,
        originId:product.vehicle.originId,
        manufacturerId:product.vehicle.manufacturerId,
        modelId:product.vehicle.modelId,
        subModelId:product.vehicle.subModelId??null,
        trimId:product.vehicle.trimId??null,
        matchLevel:product.vehicle.matchLevel,
      },
      specs:{
        modelYear:product.specs.modelYear??null,
        mileageKm:product.specs.mileageKm??null,
        fuel:product.specs.fuel??null,
        displacementCc:product.specs.displacementCc??null,
        seats:product.specs.seats??null,
        drivetrain:product.specs.drivetrain??null,
        batteryKwh:product.specs.batteryKwh??null,
      },
      registration:{
        vehicleNumber:product.registration?.vehicleNumber??null,
        vin:product.registration?.vin??null,
        firstRegistrationDate:product.registration?.firstRegistrationDate??null,
      },
      policyValues:product.productPolicies.map(clonePolicy),
    },
    offer:{
      id:offer.id,
      supplierId:offer.supplierId??product.supplierId??null,
      supplierName:offer.supplierName??product.supplierName??null,
      termMonths:offer.termMonths,
      monthlyRent:offer.monthlyRent,
      deposit:offer.deposit??null,
      prepayment:offer.prepayment??null,
      annualMileageKm:offer.annualMileageKm??null,
      policyValues:offer.policyValues.map(clonePolicy),
      resolvedPolicyValues:resolveOfferPolicies(product,offer).map(clonePolicy),
    },
  };
  return {...base,digest:intakeCatalogSnapshotDigest(base)};
}

const S=(v:unknown)=>String(v??'').trim();
const N=(v:unknown)=>{
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v); return Number.isFinite(n)?n:null;
};
function storedDigest(raw:Record<string,unknown>):string|null {
  const explicit=S(raw.catalogSnapshotDigest);
  if(explicit)return explicit;
  const snapshot=raw.catalogSnapshot;
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return null;
  try{return intakeCatalogSnapshotDigest(snapshot as IntakeCatalogSnapshot);}catch{return null;}
}

/**
 * 상품 접수의 중복 재시도는 «같은 선택»일 때만 idempotent다.
 * 같은 Product/날짜라도 Offer/version/snapshot/digest가 다르면 기존 접수를 재사용하지 않는다.
 */
export function catalogRetryConflict(
  existing:Record<string,unknown>,
  incoming:{
    sourceProductId?:string;
    sourceProductVersion?:number|null;
    sourceOfferId?:string;
    sourceSnapshotId?:string;
    catalogSnapshotDigest?:string;
  },
):string|null {
  if(!incoming.sourceProductId)return null;
  const checks:[string,unknown,unknown][]=[
    ['Product',S(existing.sourceProductId),incoming.sourceProductId.trim()],
    ['Product version',N(existing.sourceProductVersion),incoming.sourceProductVersion??null],
    ['Offer',S(existing.sourceOfferId),S(incoming.sourceOfferId)],
    ['Source snapshot',S(existing.sourceSnapshotId),S(incoming.sourceSnapshotId)],
    ['Catalog snapshot digest',storedDigest(existing),S(incoming.catalogSnapshotDigest)||null],
  ];
  const mismatch=checks.find(([,a,b])=>a!==b);
  return mismatch
    ? `같은 상품의 기존 접수가 있지만 선택 조건이 다릅니다 — ${mismatch[0]} 불일치. 기존 접수를 확인하거나 새 접수일로 진행해 주세요.`
    : null;
}
