/* ══════════════════════════════════════════════════════════════════
   ERP5 스냅샷 → 목업이 쓰는 꼴.

   ★대표 2026-09-17 「erp5는 이제 파이어베이스만 언급하는거야」
     ERP5 = Firebase 프로젝트 `freepasserp5` 하나다.

   여기는 «보여주는 꼴» 로만 바꾼다 — 값은 안 만든다.
   원자는 `erp5.data.js` 가 들고 있고, 그건 `scripts/erp5-snapshot.mts` 가
   ERP5 Firestore 에서 «읽어» 만든 것이다. 손으로 고치지 않는다.

   ★표본으로 되돌리려면 주소 뒤에 ?data=sample 을 붙인다.
   ══════════════════════════════════════════════════════════════════ */

/** 정책 한 벌에서 «조건 딱지» 를 뽑는다. ★없는 것을 지어내지 않는다. */
function ecPolTags(pvs) {
  const by = {};
  for (const p of pvs || []) by[p.policyId] = p;
  const tags = [];
  const age = by.basic_driver_age;
  if (age && age.type === 'NUMBER') tags.push(`만 ${age.value}세 이상`);
  const low = by.driver_age_lowering;
  if (low && low.type === 'NUMBER') tags.push(`만 ${low.value}세 하향 가능`);
  const pay = by.payment_method;
  if (pay && /카드/.test(String(pay.value))) tags.push('카드결제');
  const timing = by.payment_timing || by.payment_method;
  if (timing && /후불/.test(String(timing.value))) tags.push('후불');
  if (timing && /선불/.test(String(timing.value))) tags.push('선불');
  const inst = by.deposit_installment;
  if (inst && inst.type === 'BOOLEAN' && inst.value) tags.push('보증금 분납');
  const card = by.deposit_card_payment;
  if (card && card.type === 'BOOLEAN' && card.value) tags.push('보증금 카드');
  const ins = by.insurance_included;
  if (ins && (ins.value === true || /포함/.test(String(ins.value)))) tags.push('보험포함');
  const maint = by.maintenance_service;
  if (maint && (maint.value === true || /포함/.test(String(maint.value)))) tags.push('정비포함');
  const scr = by.screening_criteria;
  if (scr && /무심사/.test(String(scr.value))) tags.push('무심사');
  const region = by.rental_region;
  if (region && /전국/.test(String(region.value))) tags.push('전국');
  return tags;
}

const MATCH_LABEL = {
  TRIM: '세부트림 확정',
  SUB_MODEL: '세부모델까지만 확인됨',
  MODEL: '모델까지만 확인됨',
  UNMATCHED: '차종마스터 미등록',
};

/** 차 색 글자 → 윤곽 색. ★모르면 회색으로 둔다 — 지어내지 않는다 */
function bodyOf(color) {
  const s = String(color || '');
  if (/블랙|검/.test(s)) return '#20262c';
  if (/화이트|흰/.test(s)) return '#e9e7e1';
  if (/그레이|회|실버/.test(s)) return '#9aa3ab';
  if (/블루|파랑/.test(s)) return '#2f4d6b';
  if (/레드|빨/.test(s)) return '#7a3430';
  return null;
}

function erp5ToMock(p) {
  const tags = ecPolTags(p.productPolicies);
  const v = p.vehicle || {};
  const sub = [v.subModelId, v.trimId].filter(Boolean).join(' ')
    || (v.matchLevel === 'UNMATCHED' ? '차종마스터 미등록' : '세부트림 미확인');
  return {
    id: p.id,
    v: p.version,
    supplier: p.supplierName || p.supplierId,
    maker: v.manufacturerId || '',
    name: v.modelId || p.supplierProductKey,
    sub,
    match: v.matchLevel,
    matchLabel: MATCH_LABEL[v.matchLevel] || v.matchLevel,
    year: p.specs?.modelYear ?? null,
    mileage: p.specs?.mileageKm ?? null,
    fuel: p.specs?.fuel ?? null,
    seats: p.specs?.seats ?? null,
    color: p.color ?? null,
    body: bodyOf(p.color),
    plate: p.registration?.vehicleNumber ?? null,
    status: p.status || null,
    photo: p.photo || null,
    warn: (p.warnings || []).length ? p.warnings : null,
    offers: (p.offers || []).map((o) => ({
      id: o.id,
      term: o.termMonths,
      rent: o.monthlyRent,
      /* ★없으면 null 이다. 0 으로 만들면 「무보증」 이 되어 버린다 */
      dep: o.deposit === undefined ? null : o.deposit,
      depRate: null,
      mile: o.annualMileageKm === undefined ? null : o.annualMileageKm,
      pol: tags,
    })),
  };
}

/** ★목록은 «지금 나갈 수 있는 것» 이 앞에 선다 */
const STATUS_RANK = { 즉시출고: 0, 출고가능: 1, 협의: 2, 출고불가: 3 };

(function mountErp5() {
  const wantSample = new URLSearchParams(location.search).get('data') === 'sample';
  if (wantSample || typeof ERP5 === 'undefined' || !ERP5.products?.length) {
    window.ERP5_ON = false;
    return;
  }
  const mapped = ERP5.products.map(erp5ToMock).sort((a, b) => {
    const r = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (r) return r;
    return (a.maker + a.name).localeCompare(b.maker + b.name, 'ko');
  });
  PRODUCTS.length = 0;
  PRODUCTS.push(...mapped);
  window.ERP5_ON = true;
  window.ERP5_REPORT = ERP5.report;
})();
