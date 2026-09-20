import type { CanonicalProduct, Offer, PolicyValue } from '../domain/product/types';
import { resolveOfferPolicies } from '../domain/product/resolve-policies';

export type ProductSourceParityIssue =
  | { kind: 'MISSING_IN_DATA'; productId: string }
  | { kind: 'EXTRA_IN_DATA'; productId: string }
  | { kind: 'PRODUCT_MISMATCH'; productId: string; fields: string[] };

export type ProductSourceParityReport = {
  schema: 'freepass-admin.product-source-parity/v1';
  legacyCount: number;
  dataCount: number;
  matchedProducts: number;
  missingInData: number;
  extraInData: number;
  semanticMismatch: number;
  issues: ProductSourceParityIssue[];
};

function depositState(offer: Offer) {
  return offer.depositState
    ?? (offer.deposit === undefined ? 'UNKNOWN' : offer.deposit === 0 ? 'ZERO' : 'KNOWN');
}

function policyValue(value: PolicyValue) {
  return {
    policyId: value.policyId,
    type: value.type,
    value: Array.isArray(value.value) ? [...value.value].sort() : value.value,
  };
}

function policies(product: CanonicalProduct, offer: Offer) {
  return resolveOfferPolicies(product, offer)
    .map(policyValue)
    .sort((a,b)=>a.policyId.localeCompare(b.policyId)
      || a.type.localeCompare(b.type)
      || JSON.stringify(a.value).localeCompare(JSON.stringify(b.value)));
}

function offerSemantic(product: CanonicalProduct, offer: Offer) {
  return {
    supplierId: offer.supplierId ?? product.supplierId,
    termMonths: offer.termMonths,
    monthlyRent: offer.monthlyRent,
    deposit: offer.deposit ?? null,
    depositState: depositState(offer),
    annualMileageKm: offer.annualMileageKm ?? null,
    prepayment: offer.prepayment ?? null,
    policies: policies(product,offer),
  };
}

function offerSet(product: CanonicalProduct) {
  return product.offers
    .map((offer)=>offerSemantic(product,offer))
    .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function comparable(product: CanonicalProduct) {
  return {
    commercial:{
      commercialType:product.commercialType??null,
      vehiclePrice:product.vehiclePrice??null,
    },
    vehicle: {
      originId: product.vehicle.originId,
      manufacturerId: product.vehicle.manufacturerId,
      modelId: product.vehicle.modelId,
      subModelId: product.vehicle.subModelId ?? null,
      trimId: product.vehicle.trimId ?? null,
      matchLevel: product.vehicle.matchLevel,
    },
    specs: {
      modelYear: product.specs.modelYear ?? null,
      mileageKm: product.specs.mileageKm ?? null,
      fuel: product.specs.fuel ?? null,
      displacementCc: product.specs.displacementCc ?? null,
      seats: product.specs.seats ?? null,
      drivetrain: product.specs.drivetrain ?? null,
      batteryKwh: product.specs.batteryKwh ?? null,
    },
    registration: {
      vehicleNumber: product.registration?.vehicleNumber ?? null,
      vin: product.registration?.vin ?? null,
      firstRegistrationDate: product.registration?.firstRegistrationDate ?? null,
    },
    offers: offerSet(product),
  };
}

function mismatchFields(left: ReturnType<typeof comparable>, right: ReturnType<typeof comparable>) {
  const fields:string[]=[];
  if(JSON.stringify(left.commercial)!==JSON.stringify(right.commercial))fields.push('commercial');
  if(JSON.stringify(left.vehicle)!==JSON.stringify(right.vehicle))fields.push('vehicle');
  if(JSON.stringify(left.specs)!==JSON.stringify(right.specs))fields.push('specs');
  if(JSON.stringify(left.registration)!==JSON.stringify(right.registration))fields.push('registration');
  if(JSON.stringify(left.offers)!==JSON.stringify(right.offers))fields.push('offers');
  return fields;
}

/**
 * Compare consumer semantics, not source-specific ids/revisions.
 *
 * Source revisions are expected to differ between legacy ERP5 and FreePass Data.
 * Cutover parity is about the facts Admin actually searches/snapshots.
 */
export function compareProductSources(
  legacy: readonly CanonicalProduct[],
  data: readonly CanonicalProduct[],
): ProductSourceParityReport {
  const legacyById=new Map(legacy.map((product)=>[product.id,product]));
  const dataById=new Map(data.map((product)=>[product.id,product]));
  const issues:ProductSourceParityIssue[]=[];
  let matchedProducts=0;
  let semanticMismatch=0;

  for(const [productId,left] of legacyById){
    const right=dataById.get(productId);
    if(!right){
      issues.push({kind:'MISSING_IN_DATA',productId});
      continue;
    }
    matchedProducts+=1;
    const fields=mismatchFields(comparable(left),comparable(right));
    if(fields.length){
      semanticMismatch+=1;
      issues.push({kind:'PRODUCT_MISMATCH',productId,fields});
    }
  }

  for(const productId of dataById.keys()){
    if(!legacyById.has(productId))issues.push({kind:'EXTRA_IN_DATA',productId});
  }

  return {
    schema:'freepass-admin.product-source-parity/v1',
    legacyCount:legacy.length,
    dataCount:data.length,
    matchedProducts,
    missingInData:issues.filter((issue)=>issue.kind==='MISSING_IN_DATA').length,
    extraInData:issues.filter((issue)=>issue.kind==='EXTRA_IN_DATA').length,
    semanticMismatch,
    issues,
  };
}

export function parityClean(report:ProductSourceParityReport){
  return report.missingInData===0&&report.extraInData===0&&report.semanticMismatch===0;
}
