/**
 * ERP5 문서 한 개 → `CanonicalProduct` 한 개.
 *
 * 원천 : Firebase 프로젝트 **`freepasserp5`** Firestore
 *        `products` 1,615 · `policy` 81 (2026-09-17 실측)
 *   ★대표 2026-09-17 「erp5는 이제 파이어베이스만 언급하는거야」 —
 *     `C:\dev\jpkerp5` 는 ERP5 가 «아니다». 그쪽은 렌터카 운영 ERP 고 전부 RTDB 다.
 *
 * ★여기서 «버리는 것» 을 세어 둔다. 조용히 사라지면 다음 사람이 또 센다.
 */
import type {
  CanonicalProduct, Offer, PolicyValue, VehicleMasterRef, VehicleSpecs, RegistrationInfo,
} from '../../domain/product/types';
import { photosOf } from './photos';
import { creditOf, perksOf, productKindOf } from './perks';
import { extrasOf } from './extras';
import { matchToMaster, type MasterIndex } from '../../domain/product/master-match';
import { parseAge, parseMileageKm, parseMoney, parsePriceKey, parseRate, parseYesNo } from './parse';
import { strOrUndef as S, numOrUndef as N } from './atom';

export type Erp5Doc = Record<string, unknown>;


/** 왜 한 줄을 못 실었나. ★버린 까닭을 반드시 남긴다 */
export type SkipReason =
  | 'NOT_LISTABLE'        // listable=false — 공급사가 안 내겠다고 한 것
  | 'NO_CAR_NUMBER'       // 차량번호가 없다 — 열쇠가 없으면 줄이 성립하지 않는다
  | 'NO_PRICE'            // price 맵이 없다 — 값 없는 상품은 고를 수 없다
  | 'NO_VALID_OFFER';     // price 맵은 있는데 기간·대여료를 읽을 수 있는 게 하나도 없다

export type MapResult =
  | { ok: true; product: CanonicalProduct; warnings: string[] }
  | { ok: false; reason: SkipReason; key: string };

/**
 * ★정책 글자 → `PolicyValue`.
 *   못 읽은 칸은 «버리지 않고» TEXT 로 남긴다 — 화면이 「미확인」이 아니라 원문을 보여줄 수 있어야 한다.
 */
const POLICY_NUMBER: Record<string, 'MONEY' | 'NUMBER' | 'PERCENTAGE'> = {
  mileage_upcharge_per_10000km: 'MONEY',
  additional_driver_cost: 'MONEY',
  age_lowering_cost: 'MONEY',
  succession_fee: 'MONEY',
  own_damage_min_deductible: 'MONEY',
  own_damage_max_deductible: 'MONEY',
  self_body_deductible: 'MONEY',
  property_deductible: 'MONEY',
  injury_deductible: 'MONEY',
  over_mileage_rate_domestic: 'MONEY',
  over_mileage_rate_imported: 'MONEY',
  over_mileage_rate_per_km: 'MONEY',
  early_termination_rate_under1y: 'PERCENTAGE',
  early_termination_rate_over1y: 'PERCENTAGE',
  own_damage_repair_ratio: 'PERCENTAGE',
  late_fee_rate: 'PERCENTAGE',
  accident_termination_count: 'NUMBER',
  deposit_return_days: 'NUMBER',
  auto_terminate_overdue_days: 'NUMBER',
  engine_control_overdue_days: 'NUMBER',
  impound_keep_days: 'NUMBER',
  renewal_notice_days: 'NUMBER',
  buyout_notice_days: 'NUMBER',
  deposit_overdue_rounds: 'NUMBER',
};
const POLICY_BOOL = new Set([
  'deposit_card_payment', 'deposit_installment', 'succession_allowed',
  'maintenance_service', 'insurance_included',
]);
/** 값이 아니라 «기록» 인 칸. 상품 조건이 아니므로 안 싣는다 */
const POLICY_DROP = /^(_|created_|updated_|policy_code|term_code|companyId|provider_company_code|status$)/;

export function policyValuesOf(policy: Erp5Doc | undefined): PolicyValue[] {
  if (!policy) return [];
  const out: PolicyValue[] = [];
  for (const [k, raw] of Object.entries(policy)) {
    if (POLICY_DROP.test(k)) continue;
    const s = S(raw);
    if (s === undefined) continue;

    if (k === 'basic_driver_age' || k === 'driver_age_lowering' || k === 'driver_age_upper_limit') {
      const a = parseAge(raw);
      if (a.age !== undefined) out.push({ policyId: k, type: 'NUMBER', value: a.age });
      /* ★「불가」·「제한없음」 은 숫자가 아니다. 뜻이 다르니 글자로 남긴다 */
      else out.push({ policyId: k, type: 'TEXT', value: s });
      continue;
    }
    if (k === 'annual_mileage' || k === 'max_annual_mileage') {
      const km = parseMileageKm(raw);
      if (km !== undefined) out.push({ policyId: k, type: 'NUMBER', value: km });
      else out.push({ policyId: k, type: 'TEXT', value: s });
      continue;
    }
    const numKind = POLICY_NUMBER[k];
    if (numKind) {
      const v = numKind === 'PERCENTAGE' ? parseRate(raw) : numKind === 'MONEY' ? parseMoney(raw) : N(raw);
      if (v !== undefined) { out.push({ policyId: k, type: numKind, value: v }); continue; }
      out.push({ policyId: k, type: 'TEXT', value: s });
      continue;
    }
    if (POLICY_BOOL.has(k)) {
      const b = parseYesNo(raw);
      if (b !== undefined) { out.push({ policyId: k, type: 'BOOLEAN', value: b }); continue; }
      out.push({ policyId: k, type: 'TEXT', value: s });   /* 「협의」 — 참도 거짓도 아니다 */
      continue;
    }
    out.push({ policyId: k, type: 'TEXT', value: s });
  }
  return out;
}

/** ERP5 `price` 중첩맵 → `Offer[]`. 실측 두 꼴: `{"12":{…}}` · `{"12_2만":{…}}` */
export function offersOf(price: unknown, productId: string): { offers: Offer[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!price || typeof price !== 'object') return { offers: [], warnings };
  const offers: Offer[] = [];
  for (const [key, raw] of Object.entries(price as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') { warnings.push(`price["${key}"] 가 맵이 아니다`); continue; }
    const cell = raw as Record<string, unknown>;
    const { termMonths, annualMileageKm } = parsePriceKey(key);
    const monthlyRent = N(cell.rent);
    if (termMonths === undefined) { warnings.push(`price["${key}"] 에서 기간을 못 읽었다`); continue; }
    if (monthlyRent === undefined) { warnings.push(`price["${key}"] 에 대여료가 없다`); continue; }
    offers.push({
      id: `${productId}#${key}`,
      termMonths,
      monthlyRent,
      /* ★보증금은 «없으면 undefined» 다. 0 을 넣으면 「무보증」 이 되어 버린다 */
      deposit: N(cell.deposit),
      prepayment: N(cell.prepayment),
      annualMileageKm,
      policyValues: [],
    });
  }
  offers.sort((a, b) => a.termMonths - b.termMonths || (a.annualMileageKm ?? 0) - (b.annualMileageKm ?? 0));
  return { offers, warnings };
}

/** ★차종마스터에 붙었나. ERP5 는 `ssot_hold_reasons` 로 「없다」를 말한다 */
function vehicleRefOf(d: Erp5Doc, master?: MasterIndex): VehicleMasterRef {
  const trim = S(d.trim_name), sub = S(d.sub_model), model = S(d.model), maker = S(d.maker);
  const base = { originId: S(d.origin) ?? '', manufacturerId: maker ?? '', modelId: model ?? '', subModelId: sub, trimId: trim };
  /**
   * ★마스터를 받으면 «지금의 마스터» 에 대어 판정한다 (domain/product/master-match.ts).
   *   원자의 `ssot_hold_reasons` 는 freepasserp3 에서 옮겨 온 옛 표시라 믿지 않는다 — 실측 210대 중 대부분이 틀렸다.
   */
  if (master) {
    const m = matchToMaster({ maker, model, subModel: sub, trim, year: N(d.year) }, master);
    return { ...base, nodeId: m.nodeId, matchLevel: m.level, ...(m.why ? { matchNote: m.why } : {}) };
  }
  /* 마스터 없이 부를 때(시험·옛 길) — 옛 규칙 그대로 */
  const holds = Array.isArray(d.ssot_hold_reasons) ? (d.ssot_hold_reasons as unknown[]).map(String) : [];
  const identMiss = holds.some((h) => h.startsWith('IDENT:'));
  const matchLevel = identMiss ? 'UNMATCHED' : trim ? 'TRIM' : sub ? 'SUB_MODEL' : model ? 'MODEL' : 'UNMATCHED';
  return { ...base, nodeId: S(d.catalog_id) ?? '', matchLevel };
}

function specsOf(d: Erp5Doc): VehicleSpecs {
  return {
    modelYear: N(d.year),
    mileageKm: N(d.mileage),
    fuel: S(d.fuel_type),
    displacementCc: N(d.engine_cc),
    seats: N(d.seats),
    drivetrain: S(d.drive_type),
    batteryKwh: N(d.battery_capacity),
  };
}

function registrationOf(d: Erp5Doc): RegistrationInfo | undefined {
  const r: RegistrationInfo = {
    vehicleNumber: S(d.car_number),
    vin: S(d.vin),
    firstRegistrationDate: S(d.first_registration_date),
  };
  return r.vehicleNumber || r.vin || r.firstRegistrationDate ? r : undefined;
}

/**
 * ERP5 상품 한 문서를 우리 상품으로 옮긴다.
 *
 * @param d       Firestore `products/{id}` 의 data()
 * @param docId   문서 id (차량번호인 경우가 많다)
 * @param policy  `policy_code` 로 찾은 정책 문서. 없으면 undefined
 * @param snapshotId  이 스냅샷이 언제 것인지 — 접수가 이 값을 물고 간다
 */
export function toCanonicalProduct(
  d: Erp5Doc, docId: string, policy: Erp5Doc | undefined, snapshotId: string, master?: MasterIndex, version = 1,
): MapResult {
  const key = S(d.car_number) ?? docId;

  /* ★공급사가 «안 내겠다» 고 한 것은 목록에 없다. 조용히 빼지 말고 세어 둔다 */
  if (d.listable === false) return { ok: false, reason: 'NOT_LISTABLE', key };
  if (!S(d.car_number)) return { ok: false, reason: 'NO_CAR_NUMBER', key };
  if (!d.price || typeof d.price !== 'object') return { ok: false, reason: 'NO_PRICE', key };

  const id = S(d.product_code) ?? docId;
  const { offers, warnings } = offersOf(d.price, id);
  if (!offers.length) return { ok: false, reason: 'NO_VALID_OFFER', key };

  if (!policy && S(d.policy_code)) warnings.push(`정책 ${S(d.policy_code)} 을 못 찾았다`);
  if (!S(d.policy_code)) warnings.push('정책이 안 붙어 있다 (policy_code 없음)');
  if (!master && S(d.ssot_status) === 'HOLD') warnings.push(`차종마스터 미등록 — ${(d.ssot_hold_reasons as unknown[] ?? []).join(' / ')}`);

  const productPolicies = policyValuesOf(policy);
  /* 상품에만 붙는 조건 — 정책과 갈래가 다르므로 여기 둔다 */
  const depositNote = S(d.deposit_note);
  if (depositNote) productPolicies.push({ policyId: 'deposit_note', type: 'TEXT', value: depositNote });
  const productType = S(d.product_type);
  if (productType) productPolicies.push({ policyId: 'product_type', type: 'SINGLE_SELECT', value: productType });

  return {
    ok: true,
    warnings,
    product: {
      id,
      version,
      supplierId: S(d.provider_company_code) ?? S(d.partner_code) ?? '',
      /* ★이름과 코드를 «둘 다» 든다 — 사람은 이름을, 대조는 코드를 본다 */
      supplierName: S(d.provider_name),
      status: S(d.vehicle_status),
      ...(() => {
        const { photos, photoLink } = photosOf(d);
        return { ...(photos.length ? { photoUrl: photos[0], photos } : {}), ...(photoLink ? { photoLink } : {}) };
      })(),
      ...(() => {
        const kind = productKindOf(d.product_type);
        const deposits = offers.filter((o) => o.monthlyRent > 0).map((o) => o.deposit);
        return {
          ...(kind ? { productKind: kind } : {}),
          credit: creditOf(d, policy ?? {}),
          perks: perksOf(d, policy, deposits),
          ...extrasOf(d, !!policy),
        };
      })(),
      supplierProductKey: key,
      vehicle: vehicleRefOf(d, master),
      specs: specsOf(d),
      registration: registrationOf(d),
      offers,
      productPolicies,
      sourceSnapshotId: snapshotId,
      updatedAt: new Date().toISOString(),
    },
  };
}
