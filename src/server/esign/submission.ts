import type { EsignSnapshot } from '../../domain/esign/types';
import { SIGNER_ROLES, applySignerRole } from '../../domain/esign/required-documents';
import { hasMeaningfulSignature } from './signature';

const S=(v:unknown)=>String(v??'').trim();
const rec=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};

export type PublicSubmissionPayload=Record<string,unknown>;

export function validateSubmission(payload:PublicSubmissionPayload,snapshot:EsignSnapshot){
  const name=S(payload.customer_name), phone=S(payload.customer_phone).replace(/\D/g,''), signature=S(payload.signature);
  if(!name||name.length>40) throw new Error('성명은 1~40자로 입력해 주세요.');
  if(phone.length<10||phone.length>11) throw new Error('연락처를 정확히 입력해 주세요.');
  if(signature.length>600000||!hasMeaningfulSignature(signature)) throw new Error('서명란에 성명을 또렷하게 적어 주세요.');
  const consents=Array.isArray(payload.consents)?payload.consents.map(S).filter(Boolean):[];
  const required=snapshot.consentProfile.requiredKeys;
  if(consents.length!==new Set(consents).size||consents.some(x=>!required.includes(x))||!required.every(x=>consents.includes(x))) throw new Error('필수 약관 동의가 누락되었습니다.');
  if(!Number(payload.summaryConfirmedAt||0)) throw new Error('계약 요약을 먼저 확인해 주세요.');
  if(!Number(payload.agreementReadAt||0)) throw new Error('계약과 약관을 확인해 주세요.');
  const address=S(payload.customer_address); if(!address||address.length>200) throw new Error('계약서에 기재할 주소를 입력해 주세요.');
  const corporate=snapshot.customerType==='법인';
  const birth=S(payload.customer_birth);
  if(!corporate&&!/^\d{4}-\d{2}-\d{2}$/.test(birth)) throw new Error('생년월일을 확인해 주세요.');
  const license=S(payload.driver_license_no); if(!corporate&&!license) throw new Error('운전면허번호를 입력해 주세요.');
  const signerName=S(payload.signer_name), signerRole=S(payload.signer_role);
  if(corporate&&(!signerName||!(SIGNER_ROLES as readonly string[]).includes(signerRole))) throw new Error('법인 서명자와 관계를 확인해 주세요.');
  const emergencyRelation=S(payload.emergency_relation),emergencyName=S(payload.emergency_name),emergencyPhone=S(payload.emergency_phone).replace(/\D/g,'');
  if(!emergencyRelation||!emergencyName||emergencyPhone.length<10||emergencyPhone.length>11) throw new Error('비상연락처를 확인해 주세요.');
  const cmsRequired=snapshot.consentProfile.cmsRequiredBeforeHandover;
  const cms={holderName:S(payload.cms_holder_name),holderRelation:S(payload.cms_holder_relation),holderPhone:S(payload.cms_holder_phone).replace(/\D/g,''),bank:S(payload.cms_bank),accountNo:S(payload.cms_account_no).replace(/\D/g,''),holderIdentifier:S(payload.cms_holder_identifier).replace(/\D/g,'')};
  if(cmsRequired&&(!cms.holderName||!cms.holderRelation||cms.holderPhone.length<10||cms.holderPhone.length>11||!cms.bank||cms.accountNo.length<6||cms.accountNo.length>24||!/^\d{6}(\d{4})?$/.test(cms.holderIdentifier))) throw new Error('자동이체 예금주·관계·연락처·은행·계좌번호·생년월일 또는 사업자번호를 확인해 주세요.');
  const uploaded=Array.isArray(payload.uploaded_documents)?payload.uploaded_documents.map(S):[];
  const docs=applySignerRole(snapshot.requiredDocuments,signerRole);
  const missing=docs.filter(d=>d.required&&!uploaded.includes(d.key));
  if(missing.length) throw new Error(`필수서류가 없습니다: ${missing.map(d=>d.label).join(' · ')}`);
  return {name,phone,signature,consents,address,birth,license,signerName,signerRole,cms:cmsRequired?cms:null,emergencyRelation,emergencyName,emergencyPhone,uploadedDocuments:uploaded};
}
