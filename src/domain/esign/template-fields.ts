type Row = Record<string, unknown>;
const S = (v: unknown) => String(v ?? '').trim();

const first = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const value = S(row[key]);
    if (value) return value;
  }
  return '';
};

const money = (v: unknown) => {
  const raw = S(v).replace(/[,\s원]/g, '');
  if (!raw) return '';
  const n = Number(raw);
  return Number.isFinite(n) ? String(Math.round(n)) : S(v);
};

/**
 * ERP4 FIELD_MAP의 핵심 data-field를 ERP5 contract snapshot 이름으로 투영한다.
 * 모르는 값을 추정하지 않고 빈칸으로 둔다. 발행 snapshot이 한번 만들어지면 live contract 변경은 영향을 주지 않는다.
 */
export function templateFieldsFromContract(contract: Row): Record<string, string> {
  const vehicle = [
    first(contract, 'maker_snapshot', 'maker'),
    first(contract, 'model_snapshot', 'model'),
    first(contract, 'sub_model_snapshot', 'sub_model'),
  ].filter(Boolean).join(' ') || first(contract, 'vehicle_name_snapshot', 'vehicle_name');

  const out: Record<string, string> = {
    contract_code: first(contract, 'contract_code'),
    contract_date: first(contract, 'contract_date'),
    contract_start: first(contract, 'contract_start', 'handover_date', 'delivery_date'),
    contract_end: first(contract, 'contract_end'),

    customer_name: first(contract, 'customer_name'),
    customer_phone: first(contract, 'customer_phone'),
    customer_address: first(contract, 'customer_address'),

    company_name: first(contract, 'provider_company_name_snapshot', 'provider_company_name', 'provider_name'),
    company_ceo: first(contract, 'provider_ceo_snapshot', 'provider_ceo'),
    company_biz_no: first(contract, 'provider_business_number_snapshot', 'provider_business_number', 'provider_biz_no'),
    company_phone: first(contract, 'provider_phone_snapshot', 'provider_phone'),
    company_address: first(contract, 'provider_address_snapshot', 'provider_address'),
    rental_business_no: first(contract, 'provider_rental_business_no_snapshot', 'rental_business_no'),

    vehicle_name: vehicle,
    car_number: first(contract, 'car_number_snapshot', 'car_number'),
    vin: first(contract, 'vin_snapshot', 'vin'),
    model_year: first(contract, 'year_snapshot', 'model_year_snapshot', 'year'),
    fuel: first(contract, 'fuel_type_snapshot', 'fuel_snapshot', 'fuel'),
    engine_cc: first(contract, 'engine_cc_snapshot', 'engine_cc'),
    drive_type: first(contract, 'drive_type_snapshot', 'drive_type'),
    seats: first(contract, 'seats_snapshot', 'seats'),
    options: first(contract, 'options_snapshot', 'option_snapshot', 'options'),
    color_exterior: first(contract, 'ext_color_snapshot', 'exterior_color_snapshot', 'ext_color'),
    color_interior: first(contract, 'int_color_snapshot', 'interior_color_snapshot', 'int_color'),
    odometer_delivery: first(contract, 'mileage_snapshot', 'odometer_delivery', 'mileage'),
    vehicle_remark: first(contract, 'vehicle_remark_snapshot', 'vehicle_remark'),

    rent_amount: money(contract.rent_amount_snapshot ?? contract.rent_amount),
    rent_month: first(contract, 'rent_month_snapshot', 'rent_month'),
    deposit_amount: money(contract.deposit_amount_snapshot ?? contract.deposit_amount),
    contract_vehicle_price: money(contract.vehicle_price_snapshot ?? contract.contract_vehicle_price),
    payment_method: first(contract, 'payment_method_snapshot', 'payment_method'),
    payment_timing: first(contract, 'payment_timing_snapshot', 'payment_timing'),
    auto_debit_date: first(contract, 'auto_debit_day_snapshot', 'auto_debit_date'),
    late_fee_rate: first(contract, 'late_fee_rate_snapshot', 'late_fee_rate'),
    succession_allowed: first(contract, 'succession_allowed_snapshot', 'succession_allowed'),
    succession_fee: money(contract.succession_fee_snapshot ?? contract.succession_fee),

    annual_mileage: first(contract, 'annual_mileage_snapshot', 'annual_mileage'),
    over_mileage_rate: first(contract, 'over_mileage_rate_snapshot', 'over_mileage_rate'),
    driver_age: first(contract, 'driver_age_snapshot', 'driver_age'),
    driver_scope: first(contract, 'driver_scope_snapshot', 'driver_scope'),

    insurance_condition: first(contract, 'insurance_condition_snapshot', 'insurance_condition'),
    insurer_name: first(contract, 'insurer_name_snapshot', 'insurer_name'),
    coverage_liability_person: first(contract, 'injury_compensation_limit_snapshot', 'injury_compensation_limit'),
    coverage_liability_property: first(contract, 'property_compensation_limit_snapshot', 'property_compensation_limit'),
    coverage_self_injury: first(contract, 'self_body_accident_snapshot', 'self_body_accident'),
    coverage_uninsured: first(contract, 'uninsured_damage_snapshot', 'uninsured_damage'),
    self_damage_coverage: first(contract, 'own_damage_compensation_snapshot', 'own_damage_compensation'),
    self_damage_deductible_rate: first(contract, 'own_damage_repair_ratio_snapshot', 'own_damage_repair_ratio'),
    emergency_dispatch_limit: first(contract, 'annual_roadside_assistance_snapshot', 'annual_roadside_assistance'),

    early_termination_rate_y1: first(contract, 'early_termination_rate_under1y_snapshot', 'early_termination_rate_under1y'),
    early_termination_rate_y2: first(contract, 'early_termination_rate_over1y_snapshot', 'early_termination_rate_over1y'),
    buyback_price: money(contract.buyout_price_snapshot ?? contract.buyout_price),
    buyback_option: first(contract, 'buyback_option_snapshot', 'buyback_option'),
    maintenance_product: first(contract, 'maintenance_service_snapshot', 'maintenance_service'),
    gps_installed: first(contract, 'gps_installed_snapshot', 'gps_installed'),
    special_terms: first(contract, 'special_terms_snapshot', 'special_terms'),
  };

  return Object.fromEntries(Object.entries(out).filter(([, v]) => !!v));
}
