import { createHash } from 'node:crypto';
import type { Application } from '../domain/application/types';
import type { Performance } from '../domain/performance/types';
import { getSettlementBalance } from '../domain/settlement/settlement';
import type { BillingRecord, LedgerEntry, SettlementItem } from '../domain/settlement/types';
import type { F04BridgeMode, F04CaseProjection } from '../ports/legacy-f04';

export type F04ProjectionLabels={
  supplierLabel?:string;
  salesChannelLabel?:string;
  assigneeLabel?:string;
};

export type F04ProjectionInput={
  application:Application;
  performance?:Performance|null;
  settlement?:SettlementItem|null;
  billing?:BillingRecord|null;
  ledger?:LedgerEntry[];
  labels?:F04ProjectionLabels;
};

export function f04SettlementCode(applicationId:string){
  const id=applicationId.trim();
  if(!id)throw new Error('F04_APPLICATION_ID_REQUIRED');
  return 'stl_'+createHash('sha256')
    .update('freepass-admin|'+id,'utf8')
    .digest('hex')
    .slice(0,32);
}

function modelLabel(application:Application){
  const v=application.snapshot.vehicle;
  return[
    v.manufacturerId,
    v.modelId,
    v.subModelId,
    v.trimId,
  ].filter(Boolean).join(' ');
}

function deliveryEvidence(application:Application){
  const event=[...application.history].reverse().find((item)=>
    item.type==='APPLICATION_PROGRESS_CHANGED'
    &&item.key==='deliveryCompleted'
    &&item.to===true,
  );
  return event?.occurredAt;
}

export function buildF04Projection(input:F04ProjectionInput):F04CaseProjection{
  const {application,performance,settlement,billing}=input;
  const ledger=input.ledger??[];
  const balance=settlement
    ?getSettlementBalance(settlement,billing??undefined,ledger)
    :null;

  return{
    applicationId:application.id,
    applicationNumber:application.applicationNumber,
    f04SettlementCode:f04SettlementCode(application.id),
    ...(application.snapshot.sourceSnapshotId
      ?{sourceSnapshotId:application.snapshot.sourceSnapshotId}
      :{}),
    productId:application.snapshot.productId,
    productVersion:application.snapshot.productVersion,
    ...(application.snapshot.offer.sourceOfferId
      ?{sourceOfferId:application.snapshot.offer.sourceOfferId}
      :{}),
    ...(application.snapshot.offer.sourceOfferRevision!==undefined
      ?{sourceOfferRevision:application.snapshot.offer.sourceOfferRevision}
      :{}),
    ...(application.snapshot.offer.sourcePriceTermKey
      ?{sourcePriceTermKey:application.snapshot.offer.sourcePriceTermKey}
      :{}),

    receivedAt:application.createdAt,
    ...(application.snapshot.registration?.vehicleNumber
      ?{vehicleNumber:application.snapshot.registration.vehicleNumber}
      :{}),
    supplierId:application.snapshot.supplierId,
    ...(input.labels?.supplierLabel?{supplierLabel:input.labels.supplierLabel}:{}),
    modelLabel:modelLabel(application),
    salesChannelId:application.salesChannelId,
    ...(input.labels?.salesChannelLabel?{salesChannelLabel:input.labels.salesChannelLabel}:{}),
    assigneeId:application.assigneeId,
    ...(input.labels?.assigneeLabel?{assigneeLabel:input.labels.assigneeLabel}:{}),
    customerName:application.applicantName,

    ...(application.snapshot.commercialType
      ?{commercialType:application.snapshot.commercialType}
      :{}),
    termMonths:application.snapshot.offer.termMonths,
    monthlyRent:application.snapshot.offer.monthlyRent,
    ...(application.snapshot.offer.deposit!==undefined
      ?{deposit:application.snapshot.offer.deposit}
      :{}),
    ...(application.snapshot.offer.depositState
      ?{depositState:application.snapshot.offer.depositState}
      :{}),

    contractCompleted:application.progress.contractCompleted,
    deliveryCompleted:application.progress.deliveryCompleted,
    ...(performance?.snapshot.deliveredAt
      ?{deliveredAt:performance.snapshot.deliveredAt}
      :deliveryEvidence(application)
        ?{deliveredAt:deliveryEvidence(application)}
        :{}),
    cancelled:application.status==='CANCELLED',

    ...(performance?{performanceId:performance.id}:{}),
    ...(settlement?{
      settlementId:settlement.id,
      supplierReceivable:settlement.supplierReceivable,
      channelPayable:settlement.channelPayable,
    }:{}),
    ...(billing?{
      billingCreated:true,
      invoiceEvidenceComplete:billing.status==='EVIDENCE_COMPLETE',
    }:{}),
    ...(balance?{
      collectedAmount:balance.collected,
      paidAmount:balance.paid,
    }:{}),
  };
}

export type F04SheetPatch=Record<string,string|number|boolean>;

/**
 * Fields Admin already owns during the parallel period.
 *
 * Deliberately NOT included yet:
 * 분납여부 / 청구월 / 다음회차일 / 환수* / 요율 / 인센티브 / 가감.
 * Until Admin owns those facts, a mirror must never blank or overwrite F04.
 */
export function f04AdminOwnedPatch(
  projection:F04CaseProjection,
  mode:F04BridgeMode,
):F04SheetPatch{
  if(mode==='OBSERVE')return{};

  const patch:F04SheetPatch={
    접수일:projection.receivedAt,
    모델명:projection.modelLabel,
    고객명:projection.customerName,
    계약기간:projection.termMonths,
    렌탈료:projection.monthlyRent,
    계약서:projection.contractCompleted,
    인도완료:projection.deliveryCompleted,
    취소:projection.cancelled,
    원본탭:'FreePass Admin',
  };

  if(projection.vehicleNumber)patch.차량번호=projection.vehicleNumber;
  if(projection.supplierLabel)patch.공급사=projection.supplierLabel;
  if(projection.salesChannelLabel)patch.영업채널=projection.salesChannelLabel;
  if(projection.assigneeLabel)patch.영업담당자=projection.assigneeLabel;
  if(projection.commercialType)patch.상품구분=projection.commercialType;
  if(projection.depositState==='ZERO')patch.보증금=0;
  else if(projection.depositState==='KNOWN'&&projection.deposit!==undefined)patch.보증금=projection.deposit;
  if(projection.deliveredAt)patch.인도일=projection.deliveredAt;
  if(projection.supplierReceivable!==undefined)patch.청구금액=projection.supplierReceivable;
  if(projection.channelPayable!==undefined)patch.지급액=projection.channelPayable;
  if(projection.billingCreated!==undefined)patch.청구=projection.billingCreated;
  if(
    projection.supplierReceivable!==undefined
    &&projection.collectedAmount!==undefined
  ){
    patch.수금=projection.collectedAmount>=projection.supplierReceivable;
  }

  // ADMIN_SINGLE_WRITER currently uses the same supported-field allowlist.
  // Fields move here only after their Domain ownership is implemented in Admin.
  return patch;
}

export function f04ProgressPatch(projection:F04CaseProjection):F04SheetPatch{
  const patch:F04SheetPatch={
    접수일:projection.receivedAt,
    고객명:projection.customerName,
    상품구분:projection.commercialType??'',
    계약서:projection.contractCompleted?'예':'아니오',
    인도완료:projection.deliveryCompleted?'예':'아니오',
    계약취소:projection.cancelled?'예':'아니오',
    정산코드:projection.f04SettlementCode,
  };
  if(projection.vehicleNumber)patch.차량번호=projection.vehicleNumber;
  if(projection.supplierLabel)patch.공급사=projection.supplierLabel;
  if(projection.salesChannelLabel)patch.영업채널=projection.salesChannelLabel;
  if(projection.assigneeLabel)patch.영업담당자=projection.assigneeLabel;
  if(projection.deliveredAt)patch.인도일=projection.deliveredAt;
  if(projection.invoiceEvidenceComplete)patch.청구상태='계산서 처리 완료';
  else if(projection.billingCreated)patch.청구상태='청구 생성';
  else if(projection.settlementId)patch.청구상태='정산 확정';
  else if(projection.performanceId)patch.청구상태='실적 진행';
  else patch.청구상태=projection.deliveryCompleted?'인도완료':'인도대기';
  return patch;
}


export type F04LegacyRowCandidate={
  sheetName:string;
  legacyRowRef:string;
  vehicleNumber?:string;
  customerName:string;
  receivedAt:string;
  supplierLabel?:string;
};

export type F04LegacyMatchResult=
  |{status:'MATCHED';candidate:F04LegacyRowCandidate}
  |{status:'NONE'}
  |{status:'AMBIGUOUS';candidates:F04LegacyRowCandidate[]};

const plateKey=(value:unknown)=>String(value??'').replace(/\s/g,'').trim();
const nameKey=(value:unknown)=>String(value??'').replace(/\s+/g,' ').trim();
const dayKey=(value:unknown)=>{
  const text=String(value??'').trim();
  const ms=Date.parse(text);
  return Number.isFinite(ms)?new Date(ms).toISOString().slice(0,10):text.slice(0,10);
};

export function matchExistingF04Row(
  projection:F04CaseProjection,
  rows:F04LegacyRowCandidate[],
):F04LegacyMatchResult{
  const plate=plateKey(projection.vehicleNumber);
  if(!plate)return{status:'NONE'};
  const customer=nameKey(projection.customerName);
  const received=dayKey(projection.receivedAt);
  const supplier=nameKey(projection.supplierLabel);

  const matches=rows.filter((row)=>{
    if(plateKey(row.vehicleNumber)!==plate)return false;
    if(nameKey(row.customerName)!==customer)return false;
    if(dayKey(row.receivedAt)!==received)return false;
    const rowSupplier=nameKey(row.supplierLabel);
    if(supplier&&rowSupplier&&supplier!==rowSupplier)return false;
    return true;
  });

  if(matches.length===0)return{status:'NONE'};
  if(matches.length>1)return{status:'AMBIGUOUS',candidates:matches};
  return{status:'MATCHED',candidate:matches[0]};
}

export function makeF04RowLink(
  projection:F04CaseProjection,
  candidate:F04LegacyRowCandidate,
  input:{linkedAt:string;linkedBy:string},
){
  if(!candidate.sheetName.trim()||!candidate.legacyRowRef.trim())throw new Error('F04_ROW_REFERENCE_REQUIRED');
  if(!input.linkedBy.trim())throw new Error('F04_LINK_ACTOR_REQUIRED');
  if(Number.isNaN(Date.parse(input.linkedAt)))throw new Error('F04_LINK_TIME_INVALID');
  return{
    applicationId:projection.applicationId,
    f04SettlementCode:projection.f04SettlementCode,
    sheetName:candidate.sheetName.trim(),
    legacyRowRef:candidate.legacyRowRef.trim(),
    method:'MIGRATION_EXACT_MATCH' as const,
    linkedAt:input.linkedAt,
    linkedBy:input.linkedBy.trim(),
  };
}
