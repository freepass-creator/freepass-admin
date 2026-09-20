'use server';

import { redirect } from 'next/navigation';
import { adminOperations } from '../../server/admin-operations';
import { adminActorProvider, adminRepositories } from '../../server/admin-runtime';
import {
  confirmSalesperson,
  confirmSupplier,
  disputeSalesperson,
  ensurePerformanceForApplication,
  ensureSettlementBilling,
  finalizeSettlement,
  reconfirmSalesperson,
  recordCollection,
  recordPayout,
  resolvePerformanceIssue,
  setPerformanceAmounts,
  supplierIssue,
} from '../../services/settlement-operations';

const s=(v:FormDataEntryValue|null)=>String(v??'').trim();
const i=(v:FormDataEntryValue|null)=>{
  const n=Number(s(v));
  if(!Number.isSafeInteger(n)||n<0)throw new Error('금액은 0 이상의 정수여야 합니다.');
  return n;
};

function deps(){
  const {applications}=adminRepositories();
  return {
    applications,
    operations:adminOperations(),
    actors:adminActorProvider(),
    now:()=>new Date(),
  };
}
function href(id:string,error?:unknown){
  const p=new URLSearchParams({id});
  if(error)p.set('error',error instanceof Error?error.message:String(error));
  return '/settlement?'+p.toString();
}

export async function syncDeliveredPerformances(){
  const d=deps();
  const applications=await d.applications.list();
  for(const app of applications){
    if(app.status==='DELIVERED'&&app.progress.deliveryCompleted){
      await ensurePerformanceForApplication(d,app.id);
    }
  }
  redirect('/settlement?synced=1');
}

export async function saveAmounts(formData:FormData){
  const id=s(formData.get('id'));
  try{
    await setPerformanceAmounts(deps(),id,{
      supplierReceivable:i(formData.get('supplierReceivable')),
      channelPayable:i(formData.get('channelPayable')),
      vatMode:s(formData.get('vatMode'))==='EXCLUDED'?'EXCLUDED':'INCLUDED',
    });
  }catch(e){redirect(href(id,e));}
  redirect(href(id));
}

export async function confirmSales(formData:FormData){
  const id=s(formData.get('id'));
  try{await confirmSalesperson(deps(),id,s(formData.get('partyId')));}
  catch(e){redirect(href(id,e));}
  redirect(href(id));
}

export async function disputeSales(formData:FormData){
  const id=s(formData.get('id'));
  try{await disputeSalesperson(deps(),id,s(formData.get('partyId')),s(formData.get('reason')));}
  catch(e){redirect(href(id,e));}
  redirect(href(id));
}

export async function confirmSupplierAction(formData:FormData){
  const id=s(formData.get('id'));
  try{await confirmSupplier(deps(),id,s(formData.get('partyId')));}
  catch(e){redirect(href(id,e));}
  redirect(href(id));
}

export async function supplierIssueAction(formData:FormData){
  const id=s(formData.get('id'));
  try{
    await supplierIssue(
      deps(),id,s(formData.get('partyId')),s(formData.get('reason')),
      {
        supplierReceivable:i(formData.get('supplierReceivable')),
        channelPayable:i(formData.get('channelPayable')),
        vatMode:s(formData.get('vatMode'))==='EXCLUDED'?'EXCLUDED':'INCLUDED',
      },
    );
  }catch(e){redirect(href(id,e));}
  redirect(href(id));
}

export async function reconfirmSales(formData:FormData){
  const id=s(formData.get('id'));
  try{await reconfirmSalesperson(deps(),id,s(formData.get('partyId')));}
  catch(e){redirect(href(id,e));}
  redirect(href(id));
}

export async function resolveIssue(formData:FormData){
  const id=s(formData.get('id'));
  try{await resolvePerformanceIssue(deps(),id,s(formData.get('reason')));}
  catch(e){redirect(href(id,e));}
  redirect(href(id));
}

export async function finalizeAction(formData:FormData){
  const id=s(formData.get('id'));
  try{await finalizeSettlement(deps(),id);}
  catch(e){redirect(href(id,e));}
  redirect(href(id));
}

export async function createBillingAction(formData:FormData){
  const id=s(formData.get('id'));
  const settlementId=s(formData.get('settlementId'));
  try{await ensureSettlementBilling(deps(),settlementId);}
  catch(e){redirect(href(id,e));}
  redirect(href(id));
}

export async function collectAction(formData:FormData){
  const id=s(formData.get('id'));
  const settlementId=s(formData.get('settlementId'));
  try{
    await recordCollection(deps(),settlementId,{
      id:'collection:'+crypto.randomUUID(),
      amount:i(formData.get('amount')),
      note:s(formData.get('note'))||undefined,
    });
  }catch(e){redirect(href(id,e));}
  redirect(href(id));
}

export async function payoutAction(formData:FormData){
  const id=s(formData.get('id'));
  const settlementId=s(formData.get('settlementId'));
  try{
    await recordPayout(deps(),settlementId,{
      id:'payout:'+crypto.randomUUID(),
      amount:i(formData.get('amount')),
      note:s(formData.get('note'))||undefined,
      policy:'AFTER_FULL_COLLECTION',
    });
  }catch(e){redirect(href(id,e));}
  redirect(href(id));
}
