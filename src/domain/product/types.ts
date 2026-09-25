export type VehicleMatchLevel = 'MODEL' | 'SUB_MODEL' | 'TRIM' | 'UNMATCHED';

export interface VehicleMasterRef {
  nodeId: string;
  originId: string;
  manufacturerId: string;
  modelId: string;
  subModelId?: string;
  trimId?: string;
  matchLevel: VehicleMatchLevel;
  /**
   * ★왜 그 깊이에서 멈췄나 — 「세부모델 「K8」 이 마스터의 K8 아래에 없다」 처럼 사람이 읽는 말.
   *   TRIM 까지 확정이면 없다. 화면은 이걸 그대로 보이면 된다 (차종마스터를 고칠 사람이 이걸 본다).
   */
  matchNote?: string;
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
  /** Supplier belongs to the Offer. Product-level supplier fields are legacy compatibility only. */
  supplierId?: string;
  supplierName?: string;
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
  /* ── 상품찾기가 보일 것 (adapters/erp5/extras.ts) — 없으면 칸이 없다. 지어내지 않는다 ── */
  extColor?: string;
  intColor?: string;
  /** 옵션 원문 */
  options?: string;
  /** 옵션이 공급사 원문으로 «확인 안 된» 것 — 화면은 옵션 옆에 「미확인」 을 보여야 한다 */
  optionsUnverified?: boolean;
  /** 차급 — 경형~대형 (+세단·SUV·MPV …). ★원자에 딴 말(「신차렌트」·「레이」)이 든 것은 걸러 비운다 */
  vehicleClass?: string;
  /** 차량가(신차가) · 원 */
  consumerPrice?: number;
  /** 배차상태의 까닭 — 공급사협의 · 공급사불가 · 계약선점 … */
  statusReason?: string;
  /** 공급사 원본 상세 링크 · 롯데 T카 링크(픽업구독) */
  sourceUrl?: string;
  ticaLink?: string;
  /** ERP 에 처음 들어온 날 (YYYY-MM-DD) */
  firstSeenAt?: string;
  /**
   * 정책 확정도 — CONFIRMED(운영자 연결·정규화) · INFERRED(추정) · MISSING(없음) · 칸 없음 = 모른다.
   * ★심사·혜택(perks)은 이 정책에서 나온다. INFERRED 면 혜택도 추정이다.
   */
  policyState?: 'CONFIRMED' | 'INFERRED' | 'MISSING';
  /**
   * 상품구분 — 신차렌트 · 중고렌트 · 신차구독 · 중고구독 · 오플구독 · 픽업구독 · 오공구독 (erp4 캐논 7).
   * 재렌트→중고렌트처럼 옛 말은 캐논으로 접는다. 캐논 밖 글자는 원문 그대로. 없으면 칸이 없다.
   */
  productKind?: string;
  /** 심사 — 무심사 · 소득확인 · 신용조회 · 그 밖은 원문 · 모르면 「미입력」. ★모르는 것을 「무심사」 로 꾸미지 않는다 */
  credit?: string;
  /**
   * 한 줄에 보일 조건 — 보일 글자 그대로. 차례가 뜻이다: 심사(셋 중 하나일 때만) → 분납가능 → 무보증 → 만N세 → 경력무관 → 무사고.
   * 판정은 adapters/erp5/perks.ts 한 곳 (erp4 화이트라벨과 같은 규칙). 화면은 받은 대로만 그린다.
   */
  perks?: string[];
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
