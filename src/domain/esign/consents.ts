import type { ConsentAtom, ConsentProfile, EsignRequiredDocument } from './types';

export const CONSENT_VERSION = 'freepass-admin-consent-v1';

function privacy(customerType: string): ConsentAtom {
  const corporate = customerType === '법인';
  return {
    key:'privacy', label:'개인정보 수집·이용 및 계약 이행 동의', required:true,
    items: corporate
      ? ['법인명','법인/사업자등록번호','담당자 연락처','서명자 성명·관계','제출 법인서류']
      : ['성명','연락처','주소','운전면허번호','비상연락처','가림 처리한 신분증 사본','본인 얼굴 사진'],
    purpose:'자동차 임대차계약 체결·이행 및 본인/운전자격 확인',
    retention:'계약 종료 후 5년 및 관계 법령상 보존기간',
    refusalNote:'필수 개인정보 처리 동의를 거부하면 계약을 진행할 수 없습니다.',
  };
}
function gps(): ConsentAtom {
  return { key:'gps', label:'차량 위치정보(GPS) 수집·이용 동의', required:true,
    items:['대여 차량 GPS·통신 단말 위치정보'], purpose:'차량 보호·사고 대응·계약 이행 확인',
    retention:'계약 기간 및 분쟁 절차 종료 시까지' };
}
function cms(): ConsentAtom {
  return {
    key:'cms_debit', label:'자동이체 출금 동의 및 계좌정보 수집·이용 동의', required:true,
    items:['예금주 성명·관계·연락처','은행명·계좌번호','예금주 생년월일 또는 사업자등록번호'],
    purpose:'계약서상 대여료 자동이체 등록 및 출금 관련 본인·예금주 확인',
    retention:'계약 종료 후 관계 법령 및 금융거래 보존기간',
    refusalNote:'자동이체 출금 동의를 거부하면 CMS 자동이체 방식으로 계약을 진행할 수 없습니다.',
  };
}
function docs(required: EsignRequiredDocument[]): ConsentAtom | null {
  if (!required.length) return null;
  return { key:'supporting_documents_consent', label:'추가 제출서류 수집·이용 동의', required:true,
    items:required.map((d)=>d.label), purpose:'계약 심사·체결·이행 확인', retention:'관계 법령상 보존기간' };
}

export function buildConsentProfile(input: {
  customerType:string; gpsInstalled?:string; paymentMethod?:string; screeningCriteria?:string;
  requiredDocuments:EsignRequiredDocument[];
}): ConsentProfile {
  const screening = input.screeningCriteria === '소득확인' ? '소득확인' : '무심사';
  if (input.screeningCriteria === '신용조회') {
    throw new Error('신용조회 계약은 조회기관·제공처가 특정된 별도 신용정보 동의가 연결되기 전에는 발행할 수 없습니다.');
  }
  const payment = input.paymentMethod === 'CMS 자동이체' ? 'CMS 자동이체' : '계좌이체';
  const gpsInstalled = input.gpsInstalled === '장착' ? '장착' : '미장착';
  const atoms:ConsentAtom[]=[privacy(input.customerType)];
  if (payment === 'CMS 자동이체') atoms.push(cms());
  if (gpsInstalled === '장착') atoms.push(gps());
  const d=docs(input.requiredDocuments); if(d) atoms.push(d);
  return {
    version:CONSENT_VERSION,
    requiredKeys:['rental_terms',...atoms.map((a)=>a.key)],
    atoms,
    gpsInstalled,
    paymentMethod:payment,
    screeningCriteria:screening,
    cmsRequiredBeforeHandover:payment === 'CMS 자동이체',
  };
}

export function isFrozenConsentProfile(v: unknown): v is ConsentProfile {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const r=v as Record<string,unknown>, keys=Array.isArray(r.requiredKeys)?r.requiredKeys.map(String):[];
  return r.version===CONSENT_VERSION && keys.includes('rental_terms') && keys.includes('privacy') && keys.length===new Set(keys).size;
}
