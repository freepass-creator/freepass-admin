import { createHash } from 'node:crypto';
import type { Application } from './types';
import type { SubmitApplicationInput } from '../../services/applications';

type SemanticSubmission={
  productId:string;
  offerId:string;
  expectedProductVersion:number;
  salesChannelId:string;
  assigneeId:string;
  applicantName:string;
  applicantPhone:string|null;
  source:Application['source'];
};

const clean=(value:string|undefined)=>String(value??'').trim();

export function submissionSemanticPayload(input:SubmitApplicationInput):SemanticSubmission{
  return{
    productId:clean(input.productId),
    offerId:clean(input.offerId),
    expectedProductVersion:input.expectedProductVersion,
    salesChannelId:clean(input.salesChannelId),
    assigneeId:clean(input.assigneeId),
    applicantName:clean(input.applicantName),
    applicantPhone:clean(input.applicantPhone)||null,
    source:input.source??'ADMIN',
  };
}

export function storedApplicationSemanticPayload(application:Application):SemanticSubmission{
  return{
    productId:application.snapshot.productId,
    offerId:application.snapshot.offer.id,
    expectedProductVersion:application.snapshot.productVersion,
    salesChannelId:application.salesChannelId,
    assigneeId:application.assigneeId,
    applicantName:application.applicantName,
    applicantPhone:application.applicantPhone?.trim()||null,
    source:application.source,
  };
}

function canonical(value:SemanticSubmission){
  return JSON.stringify({
    applicantName:value.applicantName,
    applicantPhone:value.applicantPhone,
    assigneeId:value.assigneeId,
    expectedProductVersion:value.expectedProductVersion,
    offerId:value.offerId,
    productId:value.productId,
    salesChannelId:value.salesChannelId,
    source:value.source,
  });
}

export function submissionFingerprint(input:SubmitApplicationInput):string{
  return 'sha256:'+createHash('sha256').update(canonical(submissionSemanticPayload(input))).digest('hex');
}

export function storedSubmissionFingerprint(application:Application):string{
  return 'sha256:'+createHash('sha256').update(canonical(storedApplicationSemanticPayload(application))).digest('hex');
}
