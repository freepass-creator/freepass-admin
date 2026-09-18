import { createHash } from 'node:crypto';
import type { EsignPrivateSubmission, EsignSnapshot } from './types';

const S=(v:unknown)=>String(v??'').trim();
export const sha256=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');

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
      emergency_contact:[submission.emergencyRelation,submission.emergencyName,submission.emergencyPhone].filter(Boolean).join(' · '),
      esign_signed_at:new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'}).format(new Date(submission.submittedAt)),
      esign_consent_status:`${submission.consents.length}건 필수 동의 완료`,
      esign_consent_keys:submission.consents.join(','),
      esign_supporting_document_count:String(submission.supportingDocuments.length),
    },
  };
}
