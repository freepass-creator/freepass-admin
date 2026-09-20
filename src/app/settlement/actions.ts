'use server';

import { redirect } from 'next/navigation';
import { adminOperations } from '../../server/admin-operations';
import { adminSettlementPricingProvider } from '../../server/admin-settlement-pricing';
import { adminActorProvider, adminRepositories } from '../../server/admin-runtime';
import {
  confirmSalesperson,
  confirmSupplier,
  createBusinessClawback,
  disputeSalesperson,
  ensurePerformanceForApplication,
  ensureSettlementBilling,
  finalizeSettlement,
  reconfirmSalesperson,
  recordBillingEvidence,
  recordCollection,
  recordPayout,
  resolvePerformanceIssue,
  reverseEntry,
  setPerformanceAmounts,
  supplierIssue,
  suggestPerformancePricing,
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

export async function suggestAmounts(formData:FormData){
  const id=s(formData.get('id'));
  try{
    const result=await suggestPerformancePricing(
      {...deps(),pricing:adminSettlementPricingProvider()},
      id,
    );
    if(!result.applied){
      redirect(href(id,result.quote.reason));
    }
  }catch(e){redirect(href(id,e));}
  redirect(href(id));
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

export async function createClawbackAction(formData:FormData){
  const id=s(formData.get('id'));
  const settlementId=s(formData.get('settlementId'));
  const channelRaw=s(formData.get('channelAmount'));
  try{
    await createBusinessClawback(deps(),settlementId,{
      id:'clawback:'+crypto.randomUUID(),
      supplierAmount:i(formData.get('supplierAmount')),
      ...(channelRaw?{channelAmount:i(formData.get('channelAmount'))}:{}),
      reason:s(formData.get('reason')),
      occurredAt:s(formData.get('occurredAt'))||undefined,
    });
  }catch(e){redirect(href(id,e));}
  redirect(href(id));
}

export async function createBillingAction(formData:FormData){
  const id=s(formData.get('id'));
  const settlementId=s(formData.get('settlementId'));
  try{await ensureSettlementBilling(deps(),settlementId);}
  catch(e){redirect(href(id,e));}
  redirect(href(id));
}

export async function recordBillingEvidenceAction(formData:FormData){
  const id=s(formData.get('id'));
  const settlementId=s(formData.get('settlementId'));
  try{
    await recordBillingEvidence(deps(),settlementId,{
      reference:s(formData.get('reference')),
      issuedAt:s(formData.get('issuedAt')),
      note:s(formData.get('note'))||undefined,
    });
  }catch(e){redirect(href(id,e));}
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


export async function reverseLedgerAction(formData:FormData){
  const id=s(formData.get('id'));
  const settlementId=s(formData.get('settlementId'));
  const account=s(formData.get('account'));
  if(account!=='SUPPLIER_COLLECTION'&&account!=='CHANNEL_PAYOUT'){
    redirect(href(id,'INVALID_LEDGER_ACCOUNT'));
  }
  try{
    await reverseEntry(deps(),settlementId,{
      id:'reversal:'+crypto.randomUUID(),
      originalId:s(formData.get('originalId')),
      account,
      amount:i(formData.get('amount')),
      note:s(formData.get('reason'))||undefined,
    });
  }catch(e){redirect(href(id,e));}
  redirect(href(id));
}
