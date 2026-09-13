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
  termMonths: number;
  monthlyRent: number;
  deposit?: number;
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
  supplierId: string;
  supplierProductKey: string;
  vehicle: VehicleMasterRef;
  specs: VehicleSpecs;
  registration?: RegistrationInfo;
  offers: Offer[];
  productPolicies: PolicyValue[];
  sourceSnapshotId: string;
  updatedAt: string;
}
