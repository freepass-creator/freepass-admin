import type { CanonicalProduct, Offer } from '../product/types';
import { CUSTOMER_VEHICLE_CLASSES, customerVehicleClass, type CustomerVehicleClass } from '../product/customer-vehicle-class';
import { matchProduct } from './match-product';
import type { ProductSearchMatch, ProductSearchQuery } from './types';

export type FinderBand = { k: string; label: string; lo: number; hi: number };

export const RENT_BANDS: readonly FinderBand[] = [
  { k: 'r50', label: '50만↓', lo: 0, hi: 500000 },
  { k: 'r60', label: '50~60만', lo: 500000, hi: 600000 },
  { k: 'r70', label: '60~70만', lo: 600000, hi: 700000 },
  { k: 'r80', label: '70~80만', lo: 700000, hi: 800000 },
  { k: 'r90', label: '80~90만', lo: 800000, hi: 900000 },
  { k: 'r100', label: '90~100만', lo: 900000, hi: 1000000 },
  { k: 'r150', label: '100~150만', lo: 1000000, hi: 1500000 },
  { k: 'r200', label: '150만↑', lo: 1500000, hi: Infinity },
];

export const DEPOSIT_BANDS: readonly FinderBand[] = [
  { k: 'd0', label: '없음', lo: -1, hi: 0 },
  { k: 'd1', label: '100만↓', lo: 0, hi: 1000000 },
  { k: 'd2', label: '100~200만', lo: 1000000, hi: 2000000 },
  { k: 'd3', label: '200~300만', lo: 2000000, hi: 3000000 },
  { k: 'd4', label: '300만↑', lo: 3000000, hi: Infinity },
];

export const VEHICLE_MILEAGE_BANDS: readonly FinderBand[] = [
  { k: 'm1', label: '1만km↓', lo: -1, hi: 10000 },
  { k: 'm3', label: '1~3만km', lo: 10000, hi: 30000 },
  { k: 'm5', label: '3~5만km', lo: 30000, hi: 50000 },
  { k: 'm10', label: '5~10만km', lo: 50000, hi: 100000 },
  { k: 'm99', label: '10만km↑', lo: 100000, hi: Infinity },
];

export const OFFER_FINDER_AXES = ['term', 'rent', 'dep', 'mile'] as const;
export const PRODUCT_FINDER_AXES = [
  'status', 'vc', 'kind', 'perk', 'supplier', 'maker', 'cls', 'year', 'vmile', 'fuel', 'credit',
] as const;

export type OfferFinderAxis = typeof OFFER_FINDER_AXES[number];
export type ProductFinderAxis = typeof PRODUCT_FINDER_AXES[number];
export type FinderAxis = OfferFinderAxis | ProductFinderAxis;
export type FinderSelection = Record<FinderAxis, string[]>;

export type FinderLimits = {
  rentMax?: number;
  depositMax?: number;
  vehicleMileageMax?: number;
};

export type FinderRequirements = {
  perks: string[];
  driverAge?: number;
};

export type FinderInput = {
  selection: FinderSelection;
  limits: FinderLimits;
  requirements: FinderRequirements;
  text?: string;
};

export function emptyFinderSelection(): FinderSelection {
  return Object.fromEntries(
    [...OFFER_FINDER_AXES,...PRODUCT_FINDER_AXES].map((axis)=>[axis,[] as string[]]),
  ) as FinderSelection;
}

const inBand=(bands:readonly FinderBand[],key:string,value:number|undefined|null)=>{
  const band=bands.find((x)=>x.k===key);
  return !!band && typeof value==='number' && Number.isFinite(value) && value>band.lo && value<=band.hi;
};

export function minimumDriverAge(perks: readonly string[] | undefined): number | undefined {
  const ages=(perks??[])
    .map((perk)=>/^만(\d{2})세$/.exec(perk)?.[1])
    .filter((v):v is string=>!!v)
    .map(Number);
  return ages.length?Math.min(...ages):undefined;
}

export function productMeetsFinderRequirements(
  product: Pick<CanonicalProduct,'perks'>,
  requirements: FinderRequirements,
): boolean {
  const perks=product.perks??[];
  if(!requirements.perks.every((perk)=>perks.includes(perk)))return false;
  if(requirements.driverAge!==undefined){
    const minAge=minimumDriverAge(perks);
    if(minAge===undefined||minAge>requirements.driverAge)return false;
  }
  return true;
}

export function productWithinFinderLimits(
  product: Pick<CanonicalProduct,'specs'>,
  limits: FinderLimits,
): boolean {
  if(limits.vehicleMileageMax===undefined)return true;
  const km=product.specs.mileageKm;
  return typeof km==='number'&&Number.isFinite(km)&&km>0&&km<=limits.vehicleMileageMax;
}

export function offerWithinFinderLimits(
  offer: Pick<Offer,'monthlyRent'|'deposit'>,
  limits: FinderLimits,
): boolean {
  if(limits.rentMax!==undefined&&offer.monthlyRent>limits.rentMax)return false;
  if(limits.depositMax!==undefined){
    if(offer.deposit===undefined||offer.deposit===null)return false;
    if(offer.deposit>limits.depositMax)return false;
  }
  return true;
}

function productText(product:CanonicalProduct):string {
  return [
    product.vehicle.manufacturerId,product.vehicle.modelId,product.vehicle.subModelId,product.vehicle.trimId,
    product.registration?.vehicleNumber,product.supplierName,product.supplierId,
  ].filter(Boolean).join(' ').toLowerCase();
}

function baseQuery(selection:FinderSelection,limits:FinderLimits,skip?:FinderAxis):ProductSearchQuery {
  const nums=(vals:string[])=>vals.map(Number).filter((n)=>Number.isFinite(n));
  return {
    ...(skip==='kind'||!selection.kind.length?{}:{productKinds:selection.kind}),
    ...(skip==='credit'||!selection.credit.length?{}:{credits:selection.credit}),
    ...(skip==='vc'||!selection.vc.length?{}:{customerVehicleClasses:selection.vc.filter((x):x is CustomerVehicleClass=>
      (CUSTOMER_VEHICLE_CLASSES as readonly string[]).includes(x))}),
    ...(skip==='maker'||!selection.maker.length?{}:{manufacturerIds:selection.maker}),
    ...(skip==='year'||!selection.year.length?{}:{modelYears:nums(selection.year)}),
    ...(skip==='fuel'||!selection.fuel.length?{}:{fuels:selection.fuel}),
    ...(skip==='term'||!selection.term.length?{}:{termMonths:nums(selection.term)}),
    ...(skip==='mile'||!selection.mile.length?{}:{annualMileageKmValues:nums(selection.mile)}),
    ...(limits.vehicleMileageMax===undefined?{}:{vehicleMileageKm:{max:limits.vehicleMileageMax}}),
    ...(limits.rentMax===undefined?{}:{monthlyRent:{max:limits.rentMax}}),
    ...(limits.depositMax===undefined?{}:{deposit:{max:limits.depositMax}}),
  };
}

function productAxisMatches(product:CanonicalProduct,axis:ProductFinderAxis,key:string):boolean {
  switch(axis){
    case 'status': return product.status===key;
    case 'vc': return customerVehicleClass(product)===key;
    case 'kind': return product.productKind===key;
    case 'perk': return (product.perks??[]).includes(key);
    case 'supplier': return (product.supplierName??product.supplierId)===key;
    case 'maker': return product.vehicle.manufacturerId===key;
    case 'cls': return product.vehicleClass===key;
    case 'year': return product.specs.modelYear!==undefined&&String(product.specs.modelYear)===key;
    case 'vmile': return inBand(VEHICLE_MILEAGE_BANDS,key,product.specs.mileageKm)&&Number(product.specs.mileageKm)>0;
    case 'fuel': return product.specs.fuel===key;
    case 'credit': return product.credit===key;
  }
}

function offerAxisMatches(offer:Offer,axis:OfferFinderAxis,key:string):boolean {
  switch(axis){
    case 'term': return String(offer.termMonths)===key;
    case 'rent': return inBand(RENT_BANDS,key,offer.monthlyRent);
    case 'dep': return inBand(DEPOSIT_BANDS,key,offer.deposit);
    case 'mile': return offer.annualMileageKm!==undefined&&String(offer.annualMileageKm)===key;
  }
}

export function finderAxisMatches(
  match: Pick<ProductSearchMatch,'product'|'matchedOffers'>,
  axis: FinderAxis,
  key: string,
): boolean {
  return (OFFER_FINDER_AXES as readonly string[]).includes(axis)
    ? match.matchedOffers.some((offer)=>offerAxisMatches(offer,axis as OfferFinderAxis,key))
    : productAxisMatches(match.product,axis as ProductFinderAxis,key);
}

export function matchFinderProduct(
  product: CanonicalProduct,
  input: FinderInput,
  skip?: FinderAxis,
): ProductSearchMatch|null {
  if(!productMeetsFinderRequirements(product,input.requirements))return null;
  if(!productWithinFinderLimits(product,input.limits))return null;
  if(input.text?.trim()&&!productText(product).includes(input.text.trim().toLowerCase()))return null;

  // Shared semantic engine first: vehicle hierarchy, product facts, exact numeric limits,
  // same-Offer rule, unknown-value handling, and matched Offer continuity.
  const base=matchProduct(product,baseQuery(input.selection,input.limits,skip));
  if(!base)return null;

  for(const axis of PRODUCT_FINDER_AXES){
    if(axis===skip)continue;
    const selected=input.selection[axis];
    if(selected.length&&!selected.some((key)=>productAxisMatches(product,axis,key)))return null;
  }

  const matchedOffers=base.matchedOffers.filter((offer)=>
    offerWithinFinderLimits(offer,input.limits)
    && OFFER_FINDER_AXES.every((axis)=>
      axis===skip||!input.selection[axis].length||input.selection[axis].some((key)=>offerAxisMatches(offer,axis,key))),
  );
  if(!matchedOffers.length)return null;

  return {...base,matchedOffers,matchedOfferIds:matchedOffers.map((offer)=>offer.id)};
}

export function findProducts(
  products: readonly CanonicalProduct[],
  input: FinderInput,
  skip?: FinderAxis,
): ProductSearchMatch[] {
  const exact:ProductSearchMatch[]=[];
  const partial:ProductSearchMatch[]=[];
  for(const product of products){
    const match=matchFinderProduct(product,input,skip);
    if(!match)continue;
    (match.vehicleMatch.level==='EXACT'?exact:partial).push(match);
  }
  return [...exact,...partial];
}
