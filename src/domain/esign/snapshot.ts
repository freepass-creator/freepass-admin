import { createHash } from 'node:crypto';
import type { EsignPrivateSubmission, EsignSnapshot } from './types';
import { formatKstSignedAt } from './signed-at';

const S=(v:unknown)=>String(v??'').trim();
export const sha256=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');

export function stableJson(value: unknown): string {
  const canonical=(v:unknown):unknown=>{
    if(Array.isArray(v))return v.map(canonical);
    if(v&&typeof v==='object')return Object.fromEntries(
      Object.entries(v as Record<string,unknown>)
        .sort(([a],[b])=>a.localeCompare(b))
        .map(([k,x])=>[k,canonical(x)]),
    );
    return v;
  };
  return JSON.stringify(canonical(value));
}

export function signedSnapshot(snapshot:EsignSnapshot, submission:EsignPrivateSubmission) {
  return {
    ...snapshot,
    templateFields:{
      ...snapshot.templateFields,
      customer_name:submission.customerName,
      customer_phone:submission.customerPhone,
      customer_birth:S(submission.customerBirth),
      customer_address:submission.customerAddress,
      driver_license_no:S(submission.driverLicenseNo),
      signer_name:S(submission.signerName),
      signer_role:S(submission.signerRole),
      cms_holder_name:S(submission.cms?.holderName),
      cms_holder_relation:S(submission.cms?.holderRelation),
      cms_holder_phone:S(submission.cms?.holderPhone),
      cms_bank:S(submission.cms?.bank),
      cms_account_no:S(submission.cms?.accountNo),
      cms_holder_identifier:S(submission.cms?.holderIdentifier),
      emergency_contact:[submission.emergencyRelation,submission.emergencyName,submission.emergencyPhone].filter(Boolean).join(' · '),
      // 봉인 해시에 들어가는 값 — Node/ICU 버전에 따라 바뀌면 같은 계약의 sealHash 가 달라진다. PDF 표기와도 같게 둔다.
      esign_signed_at:formatKstSignedAt(submission.submittedAt),
      esign_consent_status:`${submission.consents.length}건 필수 동의 완료`,
      esign_consent_keys:submission.consents.join(','),
      esign_supporting_document_count:String(submission.supportingDocuments.length),
    },
  };
}
