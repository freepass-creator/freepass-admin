/**
 * **원자를 «성격별 구역» 으로 나눈다** — 화면은 구역을 받아 자리만 잡는다.
 *
 * ★대표 2026-09-18 「erp5에서 가져올 원자 다 갖고오는데 디자인쪽에다가 들어갈 공간좀 제대로 성격에 따라서 … 막 뭉쳐놓지 말고」
 *
 * ── 구역을 누가 정하나
 *   정책  erp4 policy-tier 사전 그대로 — 층(상품·영업·계약) · 노출(내부·영업·견적·계약서) · 약관 조항
 *   정산  erp4 settlement-atom 사전 그대로 — 묶음(정체·상대·조건·요율·돈·날·정산 축·상태·이월·출처)
 *   차량  화이트라벨이 손님에게 보이는 말 그대로 — 차량 · 제원 · 색상·옵션 · 출고 · 공급 · 차종 매칭 · 심사·혜택
 *   ⇒ 여기서 이름을 새로 짓지 않는다.
 *
 * ── 이 파일이 안 하는 것 (디자인과 기능 분리)
 *   글자 꼴(원·km·%)·색·칸폭을 안 정한다. `type` 만 준다 — 꼴은 화면이 정한다.
 *   ★값이 없어도 칸은 준다(`value: null`) — 자리가 흔들리지 않고, 「없음」 과 「모름」 을 화면이 가를 수 있다.
 *
 * ── 노출 (`exposure`)
 *   internal 은 «내부 전용» 이다 — 심사기준·신용등급·수수료 환수. ★손님 화면·견적서에 절대 안 나간다(erp4 사고).
 *   어드민은 다 보되, 화면은 이 딱지를 보여서 «밖에 말하면 안 되는 값» 임을 알려야 한다.
 */
import type { CanonicalProduct, PolicyValue } from '../product/types';
import { MATCH_LABEL } from '../product/master-match';
import { POLICY_FIELDS, POLICY_LAYER_LABEL } from './policy-fields.generated';
import { SETTLEMENT_FIELDS } from './settlement-fields.generated';

export type FieldType = 'text' | 'number' | 'money' | 'km' | 'cc' | 'kwh' | 'percent' | 'date' | 'boolean' | 'link' | 'list' | 'rate';
export type Exposure = 'internal' | 'sales' | 'quote' | 'contract';

export interface SectionItem {
  key: string;
  label: string;
  /** ★없으면 null — 칸은 남는다 */
  value: string | number | boolean | string[] | null;
  type: FieldType;
  exposure?: Exposure;
  /** 계약서 약관 조항 (계약 층) */
  article?: string;
  /** 사람이 알아야 할 한 줄 — 「미확인」 · 까닭 등 */
  note?: string;
}

export interface Section {
  key: string;
  title: string;
  /** 구역 설명 한 줄 (있으면) */
  hint?: string;
  items: SectionItem[];
}

const v = <T,>(x: T | undefined | null): T | null => (x === undefined || x === '' ? null : x) as T | null;

/* ══ 상품 ══════════════════════════════════════════════════════════ */

const policyValue = (p: PolicyValue): SectionItem['value'] =>
  Array.isArray(p.value) ? p.value : (p.value as string | number | boolean);
const policyType = (p: PolicyValue | undefined): FieldType =>
  !p ? 'text' : p.type === 'MONEY' ? 'money' : p.type === 'PERCENTAGE' ? 'percent' : p.type === 'BOOLEAN' ? 'boolean'
    : p.type === 'NUMBER' ? 'number' : p.type === 'MULTI_SELECT' ? 'list' : p.type === 'DATE' ? 'date' : 'text';

export function productSections(p: CanonicalProduct): Section[] {
  const s = p.specs, r = p.registration, vh = p.vehicle;
  const out: Section[] = [
    {
      key: 'vehicle', title: '차량', items: [
        { key: 'car_number', label: '차량번호', value: v(r?.vehicleNumber), type: 'text' },
        { key: 'vin', label: '차대번호', value: v(r?.vin), type: 'text' },
        { key: 'maker', label: '제조사', value: v(vh.manufacturerId), type: 'text' },
        { key: 'model', label: '모델', value: v(vh.modelId), type: 'text' },
        { key: 'sub_model', label: '세부모델', value: v(vh.subModelId), type: 'text' },
        { key: 'trim_name', label: '트림', value: v(vh.trimId), type: 'text' },
        { key: 'vehicle_class', label: '차급', value: v(p.vehicleClass), type: 'text' },
        { key: 'year', label: '연식', value: v(s.modelYear), type: 'number' },
        { key: 'first_registration_date', label: '최초등록일', value: v(r?.firstRegistrationDate), type: 'date' },
        { key: 'mileage', label: '주행거리', value: v(s.mileageKm), type: 'km' },
      ],
    },
    {
      key: 'spec', title: '제원', items: [
        { key: 'fuel_type', label: '연료', value: v(s.fuel), type: 'text' },
        { key: 'engine_cc', label: '배기량', value: v(s.displacementCc), type: 'cc' },
        { key: 'battery_capacity', label: '배터리', value: v(s.batteryKwh), type: 'kwh' },
        { key: 'drive_type', label: '구동', value: v(s.drivetrain), type: 'text' },
        { key: 'seats', label: '인승', value: v(s.seats), type: 'number' },
      ],
    },
    {
      key: 'look', title: '색상 · 옵션', items: [
        { key: 'ext_color', label: '외장색', value: v(p.extColor), type: 'text' },
        { key: 'int_color', label: '내장색', value: v(p.intColor), type: 'text' },
        { key: 'options', label: '옵션', value: v(p.options), type: 'text', ...(p.optionsUnverified ? { note: '공급사 원문으로 확인 안 됨' } : {}) },
      ],
    },
    {
      key: 'release', title: '출고', items: [
        { key: 'vehicle_status', label: '배차상태', value: v(p.status), type: 'text', ...(p.statusReason ? { note: p.statusReason } : {}) },
        { key: 'product_type', label: '상품구분', value: v(p.productKind), type: 'text' },
        { key: 'consumer_price', label: '차량가', value: v(p.consumerPrice), type: 'money' },
        { key: 'erp_first_seen_date', label: '입고일', value: v(p.firstSeenAt), type: 'date' },
      ],
    },
    {
      key: 'supply', title: '공급', items: [
        { key: 'provider_name', label: '공급사', value: v(p.supplierName), type: 'text', note: p.supplierId },
        { key: 'product_code', label: '상품코드', value: p.id, type: 'text' },
        { key: 'source_url', label: '공급사 원본', value: v(p.sourceUrl), type: 'link' },
        { key: 'tica_link', label: '롯데 T카', value: v(p.ticaLink), type: 'link' },
        { key: 'photo_link', label: '원본 사진', value: v(p.photoLink), type: 'link' },
      ],
    },
    {
      key: 'match', title: '차종 매칭', items: [
        { key: 'match_level', label: '확정 깊이', value: MATCH_LABEL[vh.matchLevel].label, type: 'text', ...(vh.matchNote ? { note: vh.matchNote } : {}) },
      ],
    },
    {
      key: 'screening', title: '심사 · 혜택',
      hint: p.policyState === 'INFERRED' ? '정책 추정 — 혜택도 추정이다' : p.policyState === 'MISSING' ? '정책 없음' : undefined,
      items: [
        { key: 'credit', label: '심사', value: v(p.credit), type: 'text', exposure: 'internal' },
        { key: 'perks', label: '혜택', value: p.perks?.length ? p.perks : null, type: 'list' },
        { key: 'policy_state', label: '정책 확정도', value: p.policyState ? { CONFIRMED: '확정', INFERRED: '추정', MISSING: '없음' }[p.policyState] : null, type: 'text' },
      ],
    },
  ];

  /* ── 정책 — 층마다 한 구역. 사전 차례 그대로 ── */
  const byId = new Map(p.productPolicies.map((x) => [x.policyId, x]));
  const known = new Set<string>();
  for (const layer of ['product', 'sales', 'contract'] as const) {
    const fields = POLICY_FIELDS.filter((f) => f.layer === layer);
    out.push({
      key: `policy_${layer}`, title: `정책 · ${POLICY_LAYER_LABEL[layer].split(' — ')[0]}`, hint: POLICY_LAYER_LABEL[layer].split(' — ')[1],
      items: fields.map((f) => {
        known.add(f.key);
        const pv = byId.get(f.key);
        return {
          key: f.key, label: f.label, value: pv ? policyValue(pv) : null, type: policyType(pv), exposure: f.exposure as Exposure,
          ...('article' in f && f.article ? { article: f.article } : {}),
        };
      }),
    });
  }
  /* 사전에 없는 정책 칸 — 버리지 않고 따로 둔다 (옛 이름 _legacy · 설명 글 등) */
  const rest = p.productPolicies.filter((x) => !known.has(x.policyId));
  if (rest.length) out.push({
    key: 'policy_other', title: '정책 · 사전에 없는 칸', hint: '옛 이름·설명 글 — 사전(erp4 policy-tier)에 없어 층을 모른다',
    items: rest.map((x) => ({ key: x.policyId, label: x.policyId, value: policyValue(x), type: policyType(x) })),
  });
  return out;
}

/* ══ 정산 줄 ════════════════════════════════════════════════════════ */

/**
 * ERP5 settlement_rows 원자 하나(raw)를 erp4 묶음대로 나눈다.
 * ★사전에 없는 원자(프로모션·가감 등 새로 생긴 칸)는 「요율·돈」 뒤에 붙인다 — 버리지 않는다.
 */
const EXTRA: { key: string; label: string; group: string; type: FieldType }[] = [
  { key: 'promoShare', label: '프로모션 영업자 몫', group: '요율·돈', type: 'rate' },
  { key: 'promoReason', label: '프로모션 사유', group: '요율·돈', type: 'text' },
  { key: 'claimAdjust', label: '가감(청구)', group: '요율·돈', type: 'money' },
  { key: 'payAdjust', label: '가감(지급)', group: '요율·돈', type: 'money' },
  { key: 'adjustReason', label: '가감 사유', group: '요율·돈', type: 'text' },
];
const MONEY_KEYS = /Written|Incentive|Amt|carry(Claim|Pay)|prepaid|^rent$|^deposit$|^price$/;
const RATE_KEYS = /Rate$|settleRatio/;
const DATE_KEYS = /At$|^receivedAt$|Month$/;

export function settlementSections(raw: Record<string, unknown>): Section[] {
  const fields = [...SETTLEMENT_FIELDS.map((f) => ({ ...f })), ...EXTRA];
  const groups: string[] = [];
  for (const f of fields) if (!groups.includes(f.group)) groups.push(f.group);
  const OWN: FieldType[] = ['money', 'rate', 'percent', 'km', 'cc', 'kwh', 'link', 'list'];
  const typeOf = (f: { key: string; type: string }): FieldType =>
    OWN.includes(f.type as FieldType) ? (f.type as FieldType) : f.type === 'boolean' ? 'boolean' : MONEY_KEYS.test(f.key) ? 'money' : RATE_KEYS.test(f.key) ? 'rate'
      : DATE_KEYS.test(f.key) ? 'date' : f.type === 'number' ? 'number' : (f.type as FieldType) === 'rate' ? 'rate' : 'text';
  return groups.map((g) => ({
    key: g, title: g,
    items: fields.filter((f) => f.group === g).map((f) => {
      const x = raw[f.key];
      const value = x === undefined || x === '' ? null : (typeof x === 'object' ? JSON.stringify(x) : x) as SectionItem['value'];
      return { key: f.key, label: f.label, value, type: typeOf(f), ...('note' in f && f.note ? { note: String(f.note) } : {}) };
    }),
  }));
}
