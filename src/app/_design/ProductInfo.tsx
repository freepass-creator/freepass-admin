/**
 * ★★★**상품 상세정보 — erp4 «읽는 차례»로 다시 묶는다** (대표 2026-09-18 「상세 페이지 정리 좀 하자」 · 「어정쩡한 영문들 빼자」)
 *   ⚠ 앞서 사전 차례 그대로 열한 구역이었다 — 차종 매칭(1칸)·색상(3칸) 같은 작은 구역이 줄줄이 서고,
 *     정작 영업자가 찾는 보험·운전자 조건은 접힌 정책 구역 속에 흩어져 있었다. 원본 칸 이름(injury_deductible …)이 영문 그대로 섰다.
 *   ⇒ 정본 = freepasserp4 `ProductDetail` 의 차례: 차량 → 대여료 → (운전자) → 보험 → 계약 → 영업 전용 → 기타.
 *     원자는 기능 쪽 `productSections` 가 준 그대로다 — 여기서는 «어느 칸을 어느 자리에»만 정한다(값을 안 바꾼다).
 *   · 보험은 erp4 처럼 **한 표 세 칸**(항목 │ 보장한도 │ 면책금) — 면책금이 옛 이름 칸에 있어 짝을 맞춰 붙인다.
 *   · 대여료는 기간별 요금 한 표(erp4 ProductPriceTable) + 추가 요금.
 *   · 값에 단위를 붙인다(연 30,000km · 만 26세 · 30일) · 이름표의 「(일)」「(원)」「(0~1)」 같은 꼬리는 뗀다.
 *   · 빈 칸은 버리지 않는다 — 두세 개면 흐리게 그 자리에, 더 많으면 구역 끝 「빈 칸 N개」 안에 접어 둔다.
 *   · 이름을 모르는 옛 칸(영문 이름)은 안 세운다 — 기타 끝에 「이름 없는 원본 칸 N개」 수만 남긴다.
 */
import type { ReactNode } from 'react';
import type { Section, SectionItem } from '../../domain/catalog/sections';
import { Icon } from './Icon';
import { 꼴, 있음 } from './Sections';

type 요금 = { id: string; termMonths: number; monthlyRent: number; deposit?: number; prepayment?: number; annualMileageKm?: number };

const 수 = (n: number) => n.toLocaleString('ko-KR');
const 원 = (n?: number | null) => (n === undefined || n === null ? '—' : `${수(Math.round(n))}원`);

/** 옛 이름 칸(사전에 없는 칸) → 사람 말. 여기 없는 영문 칸은 안 세운다 */
const 옛이름: Record<string, string> = {
  injury_deductible: '대인 면책금', property_deductible: '대물 면책금', self_body_deductible: '자기신체 면책금',
  uninsured_deductible: '무보험 면책금', own_damage_min_deductible: '자차 최소 면책금', own_damage_max_deductible: '자차 최대 면책금',
  penalty_condition: '중도해지 조건', policy_name: '정책 이름', term_description: '정책 설명',
  age_21_cost: '만21세 하향 요금', age_23_cost: '만23세 하향 요금', over_mileage_rate_per_km: '초과 주행요금(1km당)',
  sheet_synced_at: '시트 반영',
};
/** 겹쳐서 안 세우는 칸 — 제목·요약이 이미 든다 */
const 뺌 = new Set(['perks']);
/** 옛 이름 칸 중 새 칸과 같은 것 — 조용히 뺀다 */
const 옛겹침 = new Set(['product_type']);

/** 값에 붙는 단위 — 숫자일 때만 */
const 단위: Record<string, (n: number) => string> = {
  annual_mileage: (n) => `연 ${수(n)}km`, max_annual_mileage: (n) => `연 ${수(n)}km`,
  basic_driver_age: (n) => `만 ${n}세`, driver_age_lowering: (n) => `만 ${n}세`, driver_age_upper_limit: (n) => `만 ${n}세`,
  deposit_return_days: (n) => `${n}일`, impound_keep_days: (n) => `${n}일`, engine_control_overdue_days: (n) => `${n}일`,
  auto_terminate_overdue_days: (n) => `${n}일`, renewal_notice_days: (n) => `${n}일`, buyout_notice_days: (n) => `${n}일`,
  deposit_overdue_rounds: (n) => `${n}회차`, accident_termination_count: (n) => `${n}회`,
  over_mileage_rate_domestic: (n) => `${수(n)}원/km`, over_mileage_rate_imported: (n) => `${수(n)}원/km`, over_mileage_rate_per_km: (n) => `${수(n)}원/km`,
  succession_fee: (n) => `${수(n)}원`, impound_fee: (n) => `${수(n)}원`,
  early_termination_rate_under1y: (n) => `${+(n <= 1 ? n * 100 : n).toFixed(2)}%`,
  early_termination_rate_over1y: (n) => `${+(n <= 1 ? n * 100 : n).toFixed(2)}%`,
  sheet_synced_at: (n) => new Date(n).toISOString().slice(0, 10),
};
/** 이름표 꼬리 떼기 — 「보증금 반환기한(일)」 → 「보증금 반환기한」(단위는 값이 든다) */
const 이름 = (l: string) => l.replace(/\((일|원|0~1|회차|1km당|계약 체결일 기준)\)/g, '').trim();

function 값(it: SectionItem): ReactNode {
  const u = 단위[it.key];
  const n = typeof it.value === 'number' ? it.value : Number(String(it.value ?? '').replace(/,/g, ''));
  if (u && 있음(it) && !Array.isArray(it.value) && typeof it.value !== 'boolean' && String(it.value).trim() !== '' && !Number.isNaN(n)) return u(n);
  return 꼴(it);
}

/** 한 줄 — 항목 │ 값 (내부 딱지 · 계약 조항 · 보조 글) */
function 줄(it: SectionItem, article = false) {
  return (
    <div key={it.key} className={있음(it) ? '' : 'none'}>
      <dt>
        {이름(it.label)}
        {it.exposure === 'internal' && <i className="dz-internal" title="내부 전용 — 손님·견적서에 안 나가는 값">내부</i>}
        {article && it.article && <small className="dz-article">{it.article}</small>}
      </dt>
      <dd>{값(it)}{it.note && <small className="dz-sec-note">{it.note}</small>}</dd>
    </div>
  );
}

/** 구역 하나 — 머리(아이콘 · 이름 · 옆 한 낱말) + 표. 빈 칸이 셋 이상이면 끝에 접는다 */
function 구역({ icon, title, weight = 'sub', tag, open = true, items, article, children }: {
  icon: string; title: string; weight?: 'main' | 'sub' | 'trace' | 'inner'; tag?: string; open?: boolean;
  items: SectionItem[]; article?: boolean; children?: ReactNode;
}) {
  const 찬 = items.filter(있음);
  const 빈 = items.filter((x) => !있음(x));
  const 접을 = 빈.length >= 3;
  if (!찬.length && !빈.length && !children) return null;
  return (
    <details className={`dz-sec ${weight}`} open={open}>
      <summary>
        <span className="dz-sec-ico"><Icon name={icon} size={15} /></span>
        <b>{title}</b>
        {tag && <i className="dz-sec-tag">{tag}</i>}
        <span className="dz-sec-fold" aria-hidden><Icon name="chevron-down" size={16} /></span>
      </summary>
      {children}
      {(찬.length > 0 || (빈.length > 0 && !접을)) && (
        <dl className="dz-sec-table">
          {찬.map((x) => 줄(x, article))}
          {!접을 && 빈.map((x) => 줄(x, article))}
        </dl>
      )}
      {접을 && (
        <details className="dz-sec-empty">
          <summary>빈 칸 {빈.length}개</summary>
          <dl className="dz-sec-table">{빈.map((x) => 줄(x, article))}</dl>
        </details>
      )}
    </details>
  );
}

export function ProductInfo({ sections, offers }: { sections: Section[]; offers: 요금[] }) {
  const 칸 = new Map<string, SectionItem>();
  const 옛칸: SectionItem[] = [];
  for (const s of sections) {
    for (const it of s.items) {
      if (s.key === 'policy_other') {
        if (옛겹침.has(it.key)) continue;
        if (옛이름[it.key]) 칸.set(it.key, { ...it, label: 옛이름[it.key] });
        else 옛칸.push(it);
      } else if (!뺌.has(it.key)) 칸.set(it.key, it);
    }
  }
  const 쓴 = new Set<string>();
  const 집 = (...keys: string[]) => keys.map((k) => { 쓴.add(k); return 칸.get(k); }).filter((x): x is SectionItem => !!x);

  /* 연료가 전기면 배기량 대신 배터리 — 없는 축을 비어 세우지 않는다 */
  const 전기 = 칸.get('battery_capacity') && 있음(칸.get('battery_capacity')!);
  const 차량 = 집('vehicle_class', 'year', 'first_registration_date', 'mileage', 'fuel_type', 전기 ? 'battery_capacity' : 'engine_cc', 'drive_type', 'seats', 'ext_color', 'int_color', 'options');
  쓴.add('battery_capacity'); 쓴.add('engine_cc');
  const 대여료 = 집('mileage_upcharge_per_10000km', 'delivery_fee', 'payment_method', 'payment_timing', 'payment_due_date', 'deposit_installment', 'rental_card_payment', 'deposit_card_payment');
  const 운전자 = 집('basic_driver_age', 'driver_age_lowering', 'age_lowering_cost', 'age_21_cost', 'age_23_cost', 'driver_age_upper_limit', 'license_period',
    'personal_driver_scope', 'business_driver_scope', 'additional_driver_allowance_count', 'additional_driver_cost', 'rental_region', 'contracts_per_customer_limit');
  /* 보험 — 항목 │ 보장한도 │ 면책금 */
  const 보험줄: [string, string, string | string[]][] = [
    ['대인배상', 'injury_compensation_limit', 'injury_deductible'],
    ['대물배상', 'property_compensation_limit', 'property_deductible'],
    ['자기신체사고', 'self_body_accident', 'self_body_deductible'],
    ['무보험차상해', 'uninsured_damage', 'uninsured_deductible'],
    ['자기차량손해', 'own_damage_compensation', ['own_damage_repair_ratio', 'own_damage_min_deductible', 'own_damage_max_deductible']],
  ];
  for (const [, a, b] of 보험줄) { 쓴.add(a); for (const k of Array.isArray(b) ? b : [b]) 쓴.add(k); }
  const 보험포함 = 칸.get('insurance_included'); 쓴.add('insurance_included');
  const 보험기타 = 집('annual_roadside_assistance', 'maintenance_service', 'insurer_name', 'designated_garage', 'self_damage_exclusions', 'replacement_car_policy');
  const 셀 = (k: string) => { 쓴.add(k); const it = 칸.get(k); return it && 있음(it) ? 값(it) : null; };
  const 계약 = 집('annual_mileage', 'max_annual_mileage', 'over_mileage_rate_domestic', 'over_mileage_rate_imported', 'over_mileage_rate_per_km',
    'early_termination_rate_under1y', 'early_termination_rate_over1y', 'penalty_condition', 'succession_allowed', 'succession_fee', 'late_fee_rate',
    'deposit_return_days', 'engine_control_overdue_days', 'auto_terminate_overdue_days', 'deposit_overdue_rounds', 'accident_termination_count',
    'claim_basis', 'renewal_notice_days', 'buyout_notice_days', 'impound_fee', 'impound_keep_days', 'gps_installed', 'policy_extra_terms');
  const 영업 = 집('credit', 'screening_criteria', 'disqualification_conditions', 'credit_grade', 'sales_notes', 'commission_clawback_condition', 'policy_state');
  const 기타 = 집('car_number', 'vin', 'provider_name', 'product_code', 'product_type', 'vehicle_status', 'consumer_price', 'erp_first_seen_date', 'match_level',
    'policy_name', 'term_description', 'sheet_synced_at', 'source_url', 'tica_link', 'photo_link');
  /* 제목(차명)이 이미 든 칸 */
  for (const k of ['maker', 'model', 'sub_model', 'trim_name']) 쓴.add(k);
  /* 정책 이름과 설명이 같으면 하나만 */
  const 기타칸 = 기타.filter((x) => !(x.key === 'term_description' && String(x.value) === String(칸.get('policy_name')?.value)));
  /* 어느 자리에도 안 든 칸(사전에 새로 생긴 칸) — 버리지 않고 기타 끝에 */
  const 남은 = [...칸.values()].filter((x) => !쓴.has(x.key));

  const 줄세움 = [...offers].sort((a, b) => a.termMonths - b.termMonths || (a.annualMileageKm ?? 0) - (b.annualMileageKm ?? 0) || a.monthlyRent - b.monthlyRent);
  return (
    <div className="dz-secs">
      <구역 icon="car" title="차량" weight="main" items={차량} />
      <구역 icon="wallet" title="대여료" weight="main" items={대여료}>
        {줄세움.length > 0 && (
          <table className="dz-sec-grid">
            <thead><tr><th>기간</th><th>월 대여료</th><th>보증금</th><th>주행</th></tr></thead>
            <tbody>
              {줄세움.map((o) => (
                <tr key={o.id}>
                  <th>{o.termMonths}개월</th>
                  <td><b>{원(o.monthlyRent)}</b></td>
                  <td>{원(o.deposit)}</td>
                  <td>{o.annualMileageKm ? `연 ${수(o.annualMileageKm)}km` : <span className="dz-none">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </구역>
      <구역 icon="users" title="운전자" items={운전자} />
      <구역 icon="shield-check" title="보험" tag={보험포함 && 있음(보험포함) ? String(보험포함.value) : undefined} items={보험기타}>
        <table className="dz-sec-grid">
          <thead><tr><th>항목</th><th>보장한도</th><th>면책금</th></tr></thead>
          <tbody>
            {보험줄.map(([label, lim, ded]) => {
              const 한도 = 셀(lim);
              const 면책 = Array.isArray(ded)
                ? (() => {
                  const r = 셀(ded[0]); const lo = 셀(ded[1]); const hi = 셀(ded[2]);
                  const 범위 = lo || hi ? <>{lo ?? '—'} ~ {hi ?? '—'}</> : null;
                  return r || 범위 ? <>{r}{r && 범위 ? ' · ' : ''}{범위}</> : null;
                })()
                : 셀(ded);
              return (
                <tr key={label}>
                  <th>{label}</th>
                  <td>{한도 ?? <span className="dz-none">—</span>}</td>
                  <td>{면책 ?? <span className="dz-none">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </구역>
      <구역 icon="file-text" title="계약 조건" items={계약} article />
      <구역 icon="info" title="영업 전용" weight="inner" tag="밖에 안 나감" items={영업} />
      <구역 icon="database" title="기타" weight="trace" open={false} items={[...기타칸, ...남은]}>
        {옛칸.length > 0 && <p className="dz-sec-hint">이름 없는 원본 칸 {옛칸.length}개는 세우지 않았습니다.</p>}
      </구역>
    </div>
  );
}
