import { CUSTOMER_INSURANCE_NOTE } from './contract-kind';
import type { EsignRequiredDocument } from './types';

const S = (v: unknown) => String(v ?? '').trim();
export const MAX_ESIGN_REQUIRED_DOCUMENTS = 10;
export const SIGNER_ROLES = ['대표이사', '위임받은 임직원'] as const;
export const DELEGATED_SIGNER_ROLE = '위임받은 임직원';

export const CUSTOMER_INSURANCE_CERTIFICATE: EsignRequiredDocument = {
  key:'customer_insurance_certificate', label:'자동차보험 가입증명서(회사 질권 설정)',
  note:CUSTOMER_INSURANCE_NOTE, required:true,
};

export const DOCUMENT_PRESETS = {
  personal: [
    { key:'resident_register', label:'주민등록등본', note:'최근 3개월 이내 발급본', required:true },
  ],
  income: [
    { key:'income_certificate', label:'소득금액증명원', note:'최근 귀속연도 발급본', required:true },
  ],
  business: [
    { key:'business_registration', label:'사업자등록증', note:'현재 사업자 정보가 보이는 사본', required:true },
  ],
  corporate: [
    { key:'business_registration', label:'사업자등록증', note:'현재 법인 정보가 보이는 사본', required:true },
    { key:'corporate_registry', label:'법인등기부등본', note:'최근 3개월 이내 발급본', required:true },
    { key:'corporate_seal', label:'법인인감증명서', note:'최근 3개월 이내 발급본', required:true },
    { key:'delegation_letter', label:'위임장', note:'위임받은 임직원인 경우', required:false },
    { key:'employment_certificate', label:'재직증명서', note:'위임받은 임직원인 경우', required:false },
  ],
} satisfies Record<string, EsignRequiredDocument[]>;

export function normalizeRequiredDocuments(value: unknown): EsignRequiredDocument[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  return value.slice(0, MAX_ESIGN_REQUIRED_DOCUMENTS).flatMap((x, i) => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return [];
    const r = x as Record<string, unknown>, label = S(r.label).slice(0, 60);
    if (!label) return [];
    let key = S(r.key).toLowerCase().replace(/[^a-z0-9_-]/g,'_') || `document_${i+1}`;
    while (used.has(key)) key = `${key}_2`; used.add(key);
    return [{ key, label, note:S(r.note).slice(0,180), required:r.required !== false }];
  });
}

export function mergeRequiredDocuments(...groups: EsignRequiredDocument[][]): EsignRequiredDocument[] {
  const map = new Map<string, EsignRequiredDocument>();
  for (const group of groups) for (const d of normalizeRequiredDocuments(group)) {
    const hit = map.get(d.key); map.set(d.key, hit ? { ...hit, required:hit.required || d.required } : d);
  }
  return [...map.values()].slice(0, MAX_ESIGN_REQUIRED_DOCUMENTS);
}

export function applySignerRole(documents: EsignRequiredDocument[], role: unknown) {
  if (S(role) !== DELEGATED_SIGNER_ROLE) return documents.map((d) => ({...d}));
  return mergeRequiredDocuments(documents, [
    { key:'delegation_letter', label:'위임장', note:'법인 명의의 서명권 위임장', required:true },
    { key:'employment_certificate', label:'재직증명서', note:'서명자의 재직 확인 서류', required:true },
  ]);
}
