export type ContractKind = '구독' | '렌탈';
export type MaturityKind = '인수형' | '반납형';
export type InsuranceSide = '회사포함' | '고객직접';

export type ContractKindSpec = {
  key: string;
  label: string;
  kind: ContractKind;
  maturity: MaturityKind;
  title: string;
  party: { provider: string; customer: string };
  maturityNote: string;
  buyoutPriceRequired: boolean;
  insuranceSides: InsuranceSide[];
};

export const CONTRACT_KINDS: ContractKindSpec[] = [
  { key:'sub_buyout', label:'구독 인수형', kind:'구독', maturity:'인수형', title:'자동차 구독 계약서',
    party:{provider:'회사',customer:'계약자'}, maturityNote:'계약 만기에 약정한 인수가격으로 차량을 인수합니다.',
    buyoutPriceRequired:true, insuranceSides:['회사포함','고객직접'] },
  { key:'sub_return', label:'구독 반납형(인수선택)', kind:'구독', maturity:'반납형', title:'자동차 구독 계약서',
    party:{provider:'회사',customer:'계약자'}, maturityNote:'계약 만기에 차량을 반납합니다. 원하면 인수도 선택할 수 있습니다.',
    buyoutPriceRequired:false, insuranceSides:['회사포함','고객직접'] },
  { key:'rent_buyout', label:'렌탈 인수형', kind:'렌탈', maturity:'인수형', title:'자동차 장기대여 계약서',
    party:{provider:'임대인',customer:'임차인(계약자)'}, maturityNote:'만기 인수', buyoutPriceRequired:true, insuranceSides:['회사포함'] },
  { key:'rent_return', label:'렌탈 반납형(인수선택)', kind:'렌탈', maturity:'반납형', title:'자동차 장기대여 계약서',
    party:{provider:'임대인',customer:'임차인(계약자)'}, maturityNote:'만기 반납', buyoutPriceRequired:false, insuranceSides:['회사포함'] },
];

export const findContractKind = (key: unknown) => CONTRACT_KINDS.find((x) => x.key === String(key ?? '').trim()) ?? null;
export const allowsInsuranceSide = (spec: ContractKindSpec, side: InsuranceSide) => spec.insuranceSides.includes(side);
export const CUSTOMER_INSURANCE_NOTE =
  '회사가 자동차보험에 가입하지 않는 상품입니다. 고객이 직접 보험에 가입하고 회사 질권 설정 증빙을 제출해야 합니다.';
