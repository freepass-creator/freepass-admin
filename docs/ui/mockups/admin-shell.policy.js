/* ══════════════════════════════════════════════════════════════════
   정책 원자 → 사람이 읽는 다섯 묶음.

   ★대표 2026-09-17 「구글 시트로 하던걸 erp화 하는거니까 항목이랑 이런것들을
     니가 알아서 넣고 구현해봐라 … 상세패널 어떻게 구현할건지」

   ERP5 `policy` 가 상품 하나에 매다는 원자는 «81 가지» 다.
   81 개를 그냥 쏟으면 아무도 안 읽는다. 그렇다고 골라서 «다섯 개» 만 보이면
   나머지 76 개는 «어디에도 없는 값» 이 되어, 결국 또 시트를 연다.

   그래서 —
     ① 다섯 묶음으로 «순서를 정해» 세운다 (아래 POLICY_BOOK)
     ② 묶음에 안 든 원자는 버리지 않고 「그 밖에」 로 접어 둔다
     ③ ★값이 없는 줄은 «안 그린다». 「미확인」을 81 줄 그리면 그게 소음이다

   ★여기는 «보여주는 꼴» 만 정한다. 값을 만들지 않는다.
   ══════════════════════════════════════════════════════════════════ */

/* 살림살이 칸 — 사람이 볼 값이 아니다. 「그 밖에」 에도 안 넣는다 */
const POLICY_HIDE = new Set([
  'sheet_synced_at', 'createdAt', 'updatedAt', 'content', 'product_type',
  'policy_name', 'term_name', 'is_freepass_common_policy',
  'policy_default_pack', 'policy_scope',
]);
/* `*_legacy` 는 새 칸이 이미 같은 값을 들고 있다 — 두 번 보이지 않게 접는다 */
const isLegacy = id => /_legacy$/.test(id);

/**
 * 다섯 묶음. ★순서가 곧 «읽는 차례» 다.
 *   대여료 → 보험 → 계약 → 기타.  상담원이 고객에게 말하는 순서 그대로다.
 *   (차량정보는 policy 가 아니라 specs 라서 위쪽 카드가 진다)
 */
const POLICY_BOOK = [
  ['대여료 · 납입', [
    ['annual_mileage', '약정주행'],
    ['over_mileage_rate_per_km', '초과주행 요금'],
    ['over_mileage_rate_domestic', '초과주행 · 국산'],
    ['over_mileage_rate_imported', '초과주행 · 수입'],
    ['mileage_upcharge_per_10000km', '약정 1만km 증액'],
    ['deposit_note', '보증금 기준'],
    ['deposit_installment', '보증금 분납'],
    ['deposit_card_payment', '보증금 카드'],
    ['deposit_return_days', '보증금 반환'],
    ['payment_method', '납입 방법'],
    ['payment_timing', '납입 시점'],
    ['payment_due_date', '납입일'],
    ['rental_card_payment', '대여료 카드'],
    ['late_fee_rate', '연체료율'],
    ['delivery_fee', '탁송료'],
  ]],
  ['보험 조건', [
    ['insurance_included', '보험'],
    ['insurer_name', '보험사'],
    ['injury_compensation_limit', '대인 한도'],
    ['injury_deductible', '대인 면책금'],
    ['self_body_accident', '자손 한도'],
    ['self_body_deductible', '자손 면책금'],
    ['property_compensation_limit', '대물 한도'],
    ['property_deductible', '대물 면책금'],
    ['own_damage_compensation', '자차 보상'],
    ['own_damage_min_deductible', '자차 면책금 · 최소'],
    ['own_damage_max_deductible', '자차 면책금 · 최대'],
    ['own_damage_repair_ratio', '자차 자기부담률'],
    ['uninsured_damage', '무보험차 상해'],
    ['uninsured_deductible', '무보험 면책금'],
    ['annual_roadside_assistance', '긴급출동'],
    ['replacement_car_policy', '대차'],
  ]],
  ['계약 조건', [
    ['basic_driver_age', '기본 운전연령'],
    ['driver_age_lowering', '연령 하향'],
    ['driver_age_upper_limit', '운전연령 상한'],
    ['age_lowering_cost', '연령 하향 비용'],
    ['age_21_cost', '21세 비용'],
    ['age_23_cost', '23세 비용'],
    ['additional_driver_allowance_count', '추가운전자'],
    ['additional_driver_cost', '추가운전자 비용'],
    ['personal_driver_scope', '개인 운전자 범위'],
    ['business_driver_scope', '사업자 운전자 범위'],
    ['license_period', '면허 기간'],
    ['screening_criteria', '심사 기준'],
    ['credit_grade', '신용등급'],
    ['disqualification_conditions', '결격 사유'],
    ['rental_region', '대여 지역'],
    ['penalty_condition', '위약금'],
    ['early_termination_rate_under1y', '중도해지 · 1년 미만'],
    ['early_termination_rate_over1y', '중도해지 · 1년 이상'],
    ['succession_allowed', '승계'],
    ['succession_fee', '승계 수수료'],
    ['buyout_notice_days', '인수 통보'],
    ['renewal_notice_days', '만기 통보'],
  ]],
  ['기타 · 운영', [
    ['gps_installed', 'GPS'],
    ['maintenance_service', '정비'],
    ['auto_terminate_overdue_days', '자동해지 연체일'],
    ['engine_control_overdue_days', '시동제어 연체일'],
    ['deposit_overdue_rounds', '보증금 연체 회차'],
    ['impound_keep_days', '차량 보관일'],
    ['accident_termination_count', '사고 해지 기준'],
    ['commission_clawback_condition', '수수료 환수'],
    ['esign_required_documents', '필수 서류'],
    ['sales_notes', '영업 참고'],
    ['term_description', '약관 설명'],
  ]],
];

/** 원자 하나를 «글자» 로. ★type 이 값의 뜻을 지므로 type 으로 가른다 */
function polFmt(v) {
  if (v == null || v.value === null || v.value === undefined || v.value === '') return null;
  const x = v.value;
  switch (v.type) {
    case 'MONEY':      return typeof x === 'number' ? won(x) : esc(String(x));
    case 'PERCENTAGE': return typeof x === 'number' ? (x * 100).toFixed(x * 100 % 1 ? 1 : 0) + '%' : esc(String(x));
    /* ★BOOLEAN 은 「예/아니오」 가 아니라 «가능/불가» 다 — 조건을 말하는 칸이라서 */
    case 'BOOLEAN':    return x ? '<span class="st ok">가능</span>' : '<span class="st mut">불가</span>';
    case 'NUMBER':     return typeof x === 'number' ? x.toLocaleString('ko-KR') : esc(String(x));
    default:           return esc(String(x));
  }
}

/** 상품 하나의 정책 원자를 다섯 묶음으로 세운다. 없는 줄은 «안 그린다» */
function polSections(pols) {
  if (!pols || !pols.length) return '';
  const by = {};
  for (const p of pols) by[p.policyId] = p;
  const used = new Set();
  let out = '';

  for (const [title, rows] of POLICY_BOOK) {
    const got = [];
    for (const [id, label] of rows) {
      const s = polFmt(by[id]);
      if (s === null) continue;
      used.add(id);
      got.push(`<dt>${label}</dt><dd>${s}</dd>`);
    }
    if (!got.length) continue;
    out += `<div class="sec"><h3>${title} <span class="cnt">${got.length}</span></h3>
      <dl class="kv two">${got.join('')}</dl></div>`;
  }

  /* ★남은 것을 «버리지» 않는다. 접어 둘 뿐이다.
     버리면 사람이 시트를 다시 연다 — 그 순간 ERP 가 정본이 아니게 된다. */
  const rest = Object.keys(by)
    .filter(id => !used.has(id) && !POLICY_HIDE.has(id) && !isLegacy(id))
    .filter(id => polFmt(by[id]) !== null)
    .sort();
  if (rest.length) {
    out += `<div class="sec"><details class="why"><summary>그 밖에 <b>${rest.length}</b>가지 — 묶음에 자리를 아직 안 준 원자</summary>
      <dl class="kv two">${rest.map(id => `<dt class="n">${esc(id)}</dt><dd>${polFmt(by[id])}</dd>`).join('')}</dl></details></div>`;
  }
  return out;
}
