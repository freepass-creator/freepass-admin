/**
 * 상품상세 — §5-4 상세내용 판. 계약접수(Workspace.tsx)·상품찾기(ProductsScreen.tsx) 가 같은 상품을
 *   가리킬 때 똑같은 판을 연다(대표 2026-09-24 「모든 페이지는 다 패널화 돼 있다」와 같은 결 — 화면마다
 *   새로 그리지 않는다). 원래 Workspace.tsx 안에 있던 것을 그대로 뽑았다 — 모양 · 계산 전부 그대로.
 */
import Link from 'next/link';
import type { CanonicalProduct, CommercialConditionEvidence, Offer } from '../../domain/product/types';
import { txt } from '../_fn/fmt';
import { Badge, hrefWith, PanelBody, PanelFoot, PanelHead, PanelState, won0, type Tone } from './parts';
import { 보증금 } from '../products/workspace-config';

type Q = Record<string, string | string[] | undefined>;

const CONDITION_LABEL: Record<string, string> = {
  term_months: '기간',
  annual_mileage_km: '약정 주행거리',
  driver_age: '기본 운전자 연령',
  additional_driver_count: '추가운전자 기본 포함',
  personal_driver_scope: '개인 운전자 범위',
  business_driver_scope: '법인 운전자 범위',
  license_period: '면허 경력',
  insurance_included: '보험',
  property_compensation_limit: '대물 한도',
  injury_compensation_limit: '대인 한도',
  self_body_accident_limit: '자기신체사고',
  uninsured_damage_limit: '무보험차상해',
  own_damage_compensation: '자차 보상',
  own_damage_repair_ratio: '자차 자기부담률',
  own_damage_min_deductible: '자차 최소면책',
  own_damage_max_deductible: '자차 최대면책',
  maintenance_service: '정비',
  roadside_assistance: '긴급출동',
  replacement_car: '대차',
  settlement_type: '만기 방식',
};

const ORIGIN_LABEL: Record<CommercialConditionEvidence['origin'], string> = {
  SOURCE_PRICE_KEY: '원천 가격키',
  CANONICAL_PRICE_TERM: '가격 원천',
  LINKED_POLICY_FACT: '연결 정책',
  MATCHED_POLICY_FACT: '역매칭 정책',
  UNRESOLVED: '미확인',
};

const conditionValue = (condition: CommercialConditionEvidence) => {
  const value = condition.value;
  if (value === undefined) return '—';
  if (condition.dimensionKey === 'annual_mileage_km' && typeof value === 'number') {
    return `연 ${value.toLocaleString('ko-KR')}km`;
  }
  if (condition.dimensionKey === 'term_months' && typeof value === 'number') return `${value}개월`;
  if (Array.isArray(value)) return value.join(' · ');
  return String(value);
};

const knownCondition = (offer: Offer, key: string) =>
  offer.conditionEvidence?.find((item) => item.dimensionKey === key && item.status === 'KNOWN');

const compactMoney = (value: number) => {
  if (value >= 100_000_000 && value % 100_000_000 === 0) return `${value / 100_000_000}억`;
  if (value >= 10_000 && value % 10_000 === 0) return `${value / 10_000}만원`;
  return `${value.toLocaleString('ko-KR')}원`;
};

const insuranceSummary = (offer: Offer) => {
  const evidence = knownCondition(offer, 'insurance_included');
  if (!evidence) return offer.unknownConditionKeys?.includes('insurance_included') ? '보험 미확인' : null;
  const value = evidence.value;
  if (value === true) return '보험 포함';
  if (value === false) return '보험 별도';
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/미포함|별도|불포함/.test(text)) return '보험 별도';
  if (/포함/.test(text)) return '보험 포함';
  return `보험 ${text}`;
};

export const salesPriceReason = (offer: Offer): string => {
  const parts: string[] = [];

  const mileage = knownCondition(offer, 'annual_mileage_km');
  if (typeof mileage?.value === 'number') {
    const km = mileage.value;
    parts.push(km % 10_000 === 0 ? `연 ${km / 10_000}만km` : `연 ${km.toLocaleString('ko-KR')}km`);
  } else if (offer.annualMileageKm) {
    const km = offer.annualMileageKm;
    parts.push(km % 10_000 === 0 ? `연 ${km / 10_000}만km` : `연 ${km.toLocaleString('ko-KR')}km`);
  }

  const age = knownCondition(offer, 'driver_age');
  if (typeof age?.value === 'number') parts.push(`만${age.value}세 이상`);
  else if (typeof age?.value === 'string' && age.value.trim()) parts.push(age.value.trim());

  const insurance = insuranceSummary(offer);
  if (insurance) parts.push(insurance);

  const property = knownCondition(offer, 'property_compensation_limit');
  if (typeof property?.value === 'number') parts.push(`대물 ${compactMoney(property.value)}`);
  else if (typeof property?.value === 'string' && property.value.trim()) parts.push(`대물 ${property.value.trim()}`);

  const maintenance = knownCondition(offer, 'maintenance_service');
  if (typeof maintenance?.value === 'string' && maintenance.value.trim()) {
    parts.push(`정비 ${maintenance.value.trim()}`);
  }

  if (!insurance && offer.unknownConditionKeys?.includes('insurance_included')) parts.push('보험 미확인');

  return parts.slice(0, 5).join(' · ');
};

export const STATUS_TONE: Record<string, Tone> = { 즉시출고: 'ok', 출고가능: 'info', 출고협의: 'warn', 출고불가: 'err' };
export const carName = (p: CanonicalProduct) => p.vehicle.subModelId || p.vehicle.modelId;

/** 차 아이콘 — ai-core 레퍼런스 side-by-side.html 의 svg path 그대로(새로 그리지 않는다). */
export function CarIcon() {
  return (
    <svg viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M8 42h104M14 42l6-14c2-5 6-8 12-9l22-3c8-1 16 1 22 6l12 10 14 3c4 1 6 4 6 7M30 42a8 8 0 1 0 16 0M78 42a8 8 0 1 0 16 0M40 20l4 14h24l-6-15" />
    </svg>
  );
}

export function ProductThumb({ p }: { p: CanonicalProduct }) {
  if (!p.photoUrl) return <CarIcon />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={p.photoUrl} alt="" loading="lazy" />;
}

export function ProductDetail({ sel, selOffers, selOffer, base, q }: {
  sel: { p: CanonicalProduct; offer: Offer } | undefined;
  selOffers: Offer[];
  selOffer: Offer | undefined;
  base: string;
  q: Q;
}) {
  return (
    <>
      <PanelHead kind="상세내용" title={sel ? `${txt(sel.p.registration?.vehicleNumber)} ${carName(sel.p)}` : '상품상세'} count="고른 상품" />
      <PanelBody>
        {sel ? (
          <div className="erp-detail-body">
            <div className="erp-hero-tile erp-tile">
              <div className="photo"><ProductThumb p={sel.p} /></div>
              <div className="erp-hero-info">
                <h2 className="name">{carName(sel.p)} {sel.p.status ? <Badge tone={STATUS_TONE[sel.p.status] ?? 'neutral'}>{sel.p.status}</Badge> : null}</h2>
                <p className="sub"><b>{txt(sel.p.registration?.vehicleNumber)}</b>{txt(sel.p.vehicle.manufacturerId)} · {txt(sel.p.supplierName ?? sel.p.supplierId)}</p>
                <div className="erp-tags" aria-label="차량 주요 정보">
                  {sel.p.specs.fuel ? <span className="erp-tag">{sel.p.specs.fuel}</span> : null}
                  {sel.p.specs.modelYear ? <span className="erp-tag">{sel.p.specs.modelYear}년식</span> : null}
                </div>
              </div>
            </div>

            <div>
              <p className="erp-subtitle erp-subtitle--lead">기간별 대여료</p>
              <div className="erp-offer-list" role="list" aria-label="기간별 대여료 선택">
                {selOffers.map((o) => {
                  const selected = selOffer?.id === o.id;
                  const support = [
                    `보증금 ${보증금(o.deposit)}`,
                    o.prepayment ? `선납금 ${won0(o.prepayment)}원` : null,
                    salesPriceReason(o) || null,
                    o.isDefaultPreview && o.previewMonthlyRent !== undefined && o.previewMonthlyRent !== o.monthlyRent
                      ? `기본조건 산출 월 ${won0(o.previewMonthlyRent)}원`
                      : null,
                    o.conditionStatus === 'PARTIAL'
                      ? `조건 ${o.unknownConditionKeys?.length ?? 0}개 미확인`
                      : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <Link key={o.id} className="erp-offer-card" role="listitem"
                      aria-current={selected ? 'true' : undefined}
                      href={hrefWith(base, q, { offer: o.id })}>
                      <strong className="erp-offer-term">
                        {o.termMonths}개월
                        {o.isListingPrice ? <> <Badge tone="ok">최저가</Badge></> : null}
                        {o.isDefaultPreview ? <> <Badge tone="info">기본조건</Badge></> : null}
                      </strong>
                      <b className="erp-offer-rent">{won0(o.monthlyRent)}원/월</b>
                      <span className="erp-offer-conditions">{support}</span>
                    </Link>
                  );
                })}
              </div>
            </div>


            {selOffer?.conditionEvidence?.length ? (
              <div>
                <p className="erp-subtitle">선택한 대여료 구성</p>
                <div className="erp-tile-group">
                  <div className="erp-info-card erp-tile">
                    <h3 className="erp-tile-title">
                      {selOffer.termMonths}개월 · 월 {won0(selOffer.monthlyRent)}원
                      {selOffer.isListingPrice ? ' · 최저가' : ''}
                      {selOffer.isDefaultPreview ? ' · 기본조건' : ''}
                    </h3>
                    <dl>
                      <div><dt>월 대여료</dt><dd>{won0(selOffer.monthlyRent)}원</dd></div>
                      <div><dt>보증금</dt><dd>{보증금(selOffer.deposit)}</dd></div>
                      {selOffer.conditionEvidence.filter((item) => item.status === 'KNOWN').map((item) => (
                        <div key={item.dimensionKey}>
                          <dt>{CONDITION_LABEL[item.dimensionKey] ?? item.dimensionKey}</dt>
                          <dd>
                            {conditionValue(item)}
                            <span className="erp-condition-origin"> · {ORIGIN_LABEL[item.origin]}</span>
                          </dd>
                        </div>
                      ))}
                      {(selOffer.unknownConditionKeys ?? []).length ? (
                        <div>
                          <dt>아직 모르는 조건</dt>
                          <dd>{(selOffer.unknownConditionKeys ?? []).map((key) => CONDITION_LABEL[key] ?? key).join(' · ')}</dd>
                        </div>
                      ) : (
                        <div><dt>조건 확인</dt><dd>이 대여료의 기준조건 확인 완료</dd></div>
                      )}
                    </dl>
                  </div>
                </div>
              </div>
            ) : null}

            {(sel.p.perks ?? []).length ? (
              <div>
                <p className="erp-subtitle">담당자 참고</p>
                <div className="erp-tile-group">
                  <div className="erp-info-card erp-tile">
                    <h3 className="erp-tile-title">우대조건 · 정책</h3>
                    <dl>
                      <div><dt>우대조건</dt><dd><span className="erp-tags">{(sel.p.perks ?? []).map((k) => <span key={k} className="erp-tag erp-tag--primary">{k}</span>)}</span></dd></div>
                      <div><dt>공급사</dt><dd>{txt(sel.p.supplierName ?? sel.p.supplierId)}</dd></div>
                    </dl>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : <PanelState title="상품을 선택해 주세요.">왼쪽 상품 목록에서 한 대를 고르면 차량·기간·대여료 상세가 표시됩니다.</PanelState>}
      </PanelBody>
      {sel ? (
        <PanelFoot>
          {selOffer
            ? <Link className="erp-btn erp-btn--primary"
                href={base === '/intake'
                  ? hrefWith(base, q, { w: 'new', product: sel.p.id, offer: selOffer.id, ic: null, v: 'work' })
                  : `/intake?w=new&product=${encodeURIComponent(sel.p.id)}&offer=${encodeURIComponent(selOffer.id)}&v=work`}>
                접수하기
              </Link>
            : <span className="erp-btn erp-btn--primary" aria-disabled="true">기간을 선택해 주세요</span>}
        </PanelFoot>
      ) : null}
    </>
  );
}
