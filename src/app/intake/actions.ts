'use server';

import { redirect } from 'next/navigation';
import { cancel, markProgress, submitApplication } from '../../services/applications';
import type { ProgressKey } from '../../domain/application/update-progress';
import { adminActorProvider, adminRepositories } from '../../server/admin-runtime';

const s=(value:FormDataEntryValue|null)=>String(value??'').trim();

function deps(){
  const {products,applications}=adminRepositories();
  return {
    products,
    applications,
    actors:adminActorProvider(),
    now:()=>new Date(),
    newId:()=>crypto.randomUUID(),
  };
}

export async function submitIntake(formData:FormData){
  const productId=s(formData.get('productId'));
  const offerId=s(formData.get('offerId'));
  const salesChannelId=s(formData.get('salesChannelId'));
  const assigneeId=s(formData.get('assigneeId'));
  const applicantName=s(formData.get('applicantName'));
  const applicantPhone=s(formData.get('applicantPhone')) || undefined;
  const submissionId=s(formData.get('submissionId'));
  const expectedProductVersion=Number(s(formData.get('expectedProductVersion')));

  const result=await submitApplication(deps(),{
    productId,
    offerId,
    salesChannelId,
    assigneeId,
    applicantName,
    applicantPhone,
    submissionId,
    expectedProductVersion,
    source:'ADMIN',
  });

  if(!result.ok){
    const reason=result.reason==='PRODUCT_CHANGED'
      ? `상품이 변경되었습니다. 현재판 ${result.currentVersion}, 화면판 ${result.seenVersion}`
      : result.reason==='PRODUCT_NOT_FOUND'
        ? '상품을 찾을 수 없습니다.'
        : '선택한 계약조건을 찾을 수 없습니다.';
    redirect('/intake/new?error='+encodeURIComponent(reason)+'&productId='+encodeURIComponent(productId)+'&offerId='+encodeURIComponent(offerId));
  }
  redirect('/intake?id='+encodeURIComponent(result.application.id)+'&saved='+(result.created?'1':'replay'));
}

export async function setIntakeProgress(formData:FormData){
  const id=s(formData.get('id'));
  const key=s(formData.get('key')) as ProgressKey;
  const completed=s(formData.get('completed'))==='true';
  if(!['contractCompleted','documentsCompleted','balanceCompleted','deliveryCompleted'].includes(key)){
    throw new Error('Unknown application progress key.');
  }
  await markProgress(deps(),id,key,completed);
  redirect('/intake?id='+encodeURIComponent(id));
}

export async function cancelIntake(formData:FormData){
  const id=s(formData.get('id'));
  const reason=s(formData.get('reason'));
  const result=await cancel(deps(),id,reason);
  if(!result.ok){
    redirect('/intake?id='+encodeURIComponent(id)+'&error='+encodeURIComponent(result.reason));
  }
  redirect('/intake?id='+encodeURIComponent(id));
}
