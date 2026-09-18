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
  /**
   * 상품이 바뀔 때마다 오르는 번호. 접수 Snapshot 이 «어느 판을 보고 받았는지» 를 적어 둔다.
   * 이것이 없으면 「지금 상품과 다르다」는 것만 알고 «언제부터 달라졌는지» 를 모른다.
   */
  version: number;
  supplierId: string;
  /**
   * 사람이 읽는 공급사 이름. `supplierId` 는 «코드» 다 — 화면에 코드를 띄우면 아무도 못 읽는다.
   * ⚠ 없을 수 있다. 그때 화면은 코드를 보이되 «이름이 없다» 는 것을 숨기지 않는다.
   */
  supplierName?: string;
  /**
   * **지금 나갈 수 있나.** ERP5 `vehicle_status` 실측(2026-09-18 · 694대) —
   *   출고가능 407 · 출고협의 250 · 즉시출고 30 · 계약중 5 · 상품화중 2
   * ★목록의 «첫 칸» 이다. 이것이 없으면 출고불가 차를 상담하게 된다.
   * ⚠ 값을 우리가 정하지 않는다 — 공급사가 준 말을 그대로 들고 있는다.
   *   갈래로 접는 것은 «보이는 쪽» 이 할 일이다(대표 2026-09-18 「디자인과 기능은 분리」).
   */
  status?: string;
  /**
   * 대표 사진 한 장 — 목록 카드 썸네일. ★없으면 비운다(28% 가 사진 없음). 지어내지 않는다.
   * 고르는 차례는 화이트라벨과 같다 (adapters/erp5/photos.ts).
   */
  photoUrl?: string;
  /** 사진 전부 — 상세. 첫 장이 `photoUrl` 이다. */
  photos?: string[];
  /**
   * 사진이 있는 «곳» — 드라이브 폴더·공급사 상세페이지. ★이미지가 아니다. `<img>` 에 넣지 않는다.
   * 사진을 아직 못 푼 차는 이것만 있다 — 화면은 「원본 사진 보기」 링크로 쓸 수 있다.
   */
  photoLink?: string;
  supplierProductKey: string;
  vehicle: VehicleMasterRef;
  specs: VehicleSpecs;
  registration?: RegistrationInfo;
  offers: Offer[];
  productPolicies: PolicyValue[];
  sourceSnapshotId: string;
  updatedAt: string;
}
