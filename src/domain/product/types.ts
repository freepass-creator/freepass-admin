export type VehicleMatchLevel = 'MODEL' | 'SUB_MODEL' | 'TRIM' | 'UNMATCHED';

export interface VehicleMasterRef {
  nodeId: string;
  originId: string;
  manufacturerId: string;
  modelId: string;
  subModelId?: string;
  trimId?: string;
  matchLevel: VehicleMatchLevel;
}

export interface VehicleSpecs {
  modelYear?: number;
  mileageKm?: number;
  fuel?: string;
  displacementCc?: number;
  seats?: number;
  drivetrain?: string;
  batteryKwh?: number;
}

export interface RegistrationInfo {
  vehicleNumber?: string;
  vin?: string;
  firstRegistrationDate?: string;
}

export interface Offer {
  id: string;
  /** 선택한 Offer의 공급사. 없으면 legacy product.supplierId를 사용한다. */
  supplierId?: string;
  /** FreePass Data 등 upstream Offer/PriceTerm을 다시 가리키기 위한 provenance. */
  sourceOfferId?: string;
  sourceOfferRevision?: number;
  sourcePriceTermKey?: string;
  termMonths: number;
  monthlyRent: number;
  deposit?: number;
  /** Data contract semantics. Legacy sources may omit it. */
  depositState?: 'KNOWN' | 'ZERO' | 'UNKNOWN' | 'NOT_APPLICABLE';
  prepayment?: number;
  annualMileageKm?: number;
  policyValues: PolicyValue[];
}

export type PolicyValue =
  | { policyId: string; type: 'BOOLEAN'; value: boolean }
  | { policyId: string; type: 'NUMBER'; value: number }
  | { policyId: string; type: 'MONEY'; value: number }
  | { policyId: string; type: 'PERCENTAGE'; value: number }
  | { policyId: string; type: 'SINGLE_SELECT'; value: string }
  | { policyId: string; type: 'MULTI_SELECT'; value: string[] }
  | { policyId: string; type: 'TEXT'; value: string }
  | { policyId: string; type: 'DATE'; value: string };

export interface CanonicalProduct {
  id: string;
  /**
   * 상품이 바뀔 때마다 오르는 번호. 접수 Snapshot 이 «어느 판을 보고 받았는지» 를 적어 둔다.
   * 이것이 없으면 「지금 상품과 다르다」는 것만 알고 «언제부터 달라졌는지» 를 모른다.
   */
  version: number;
  supplierId: string;
  supplierProductKey: string;
  /** Consumer-facing commercial classification; source-specific detail may also live in policies. */
  commercialType?: string;
  /** Supplier/catalog vehicle price used by settlement pricing when applicable. */
  vehiclePrice?: number;
  vehicle: VehicleMasterRef;
  specs: VehicleSpecs;
  registration?: RegistrationInfo;
  offers: Offer[];
  productPolicies: PolicyValue[];
  sourceSnapshotId: string;
  updatedAt: string;
}
