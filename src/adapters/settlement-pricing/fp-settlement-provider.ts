import type {
  SettlementPricingInput,
  SettlementPricingProvider,
  SettlementPricingResult,
} from '../../ports/settlement-pricing';
import type { SettlementSupplierRuleKeyProvider } from '../../ports/settlement-supplier-rule-key';
import {
  feeKindOf,
  feeRuleFor,
  type FeeRule,
} from './fp-settlement-fee-table';

const ENGINE_REVISION='fp-settlement:fee-table:ccc8b5456c79a00f00c3795ee87b94061f96791f';

const policyText=(input:SettlementPricingInput,ids:string[])=>{
  for(const policy of input.catalog.policies){
    if(!ids.includes(policy.policyId))continue;
    if(typeof policy.value==='string'&&policy.value.trim())return policy.value.trim();
  }
  return'';
};

function commercialText(input:SettlementPricingInput){
  return String(input.catalog.commercialType||'').trim();
}

function productForm(input:SettlementPricingInput){
  const values=[
    commercialText(input),
    policyText(input,['product_form','settlement_form','product_type']),
  ].filter(Boolean);
  const joined=values.join(' ');
  if(/매칭출고|견적출고/.test(joined))return'매칭출고';
  if(/선발주/.test(joined))return'선발주';
  if(/선출고/.test(joined))return'선출고';
  if(/신차발주|(?:^|\s)발주(?:\s|$)/.test(joined))return'발주';
  if(/인수,?반납형/.test(joined))return'인수,반납형';
  if(/인수형/.test(joined))return'인수형';
  return'';
}

function normalizedBase(input:SettlementPricingInput):{
  productText:string;
  requireNewForm:boolean;
}{
  const value=commercialText(input);
  switch(value){
    case'NEW_RENT':return{productText:productForm(input),requireNewForm:true};
    case'USED_RENT':return{productText:'재렌트',requireNewForm:false};
    case'NEW_SUBSCRIPTION':
    case'USED_SUBSCRIPTION':
    case'PICKUP_SUBSCRIPTION':
      return{productText:productForm(input)||'구독',requireNewForm:false};
  }

  if(/선출고|선발주|신차발주|매칭출고|견적출고/.test(value)){
    return{productText:value,requireNewForm:false};
  }
  if(/구독/.test(value))return{productText:value,requireNewForm:false};
  if(/재렌트|중고렌트|장기렌트/.test(value))return{productText:'재렌트',requireNewForm:false};
  if(/신차/.test(value))return{productText:productForm(input),requireNewForm:true};
  return{productText:'',requireNewForm:false};
}

function modelText(input:SettlementPricingInput){
  return[
    input.catalog.vehicleModel.manufacturerId,
    input.catalog.vehicleModel.modelId,
    input.catalog.vehicleModel.subModelId,
    input.catalog.vehicleModel.trimId,
  ].filter(Boolean).join(' ');
}

function explicitElectric(fuel:string|undefined):boolean|null{
  const value=String(fuel||'').trim().toLowerCase();
  if(!value)return null;
  if(['전기','전기차','electric','bev','ev'].includes(value))return true;
  if(/하이브리드|hev|phev|가솔린|디젤|lpg|수소/.test(value))return false;
  return null;
}

function classify(input:SettlementPricingInput):
  |{ok:true;kind:FeeRule['kind'];form?:string;fallback?:FeeRule['kind'];productText:string}
  |{ok:false;missing:string[];reason:string}{
  const base=normalizedBase(input);
  if(!base.productText){
    return{ok:false,missing:['commercialType'],reason:'상품 정산 갈래를 확정할 수 없습니다.'};
  }
  if(base.requireNewForm&&!productForm(input)){
    return{
      ok:false,
      missing:['commercialForm'],
      reason:'신차 정산은 선출고/선발주/발주/매칭출고 구분이 필요합니다.',
    };
  }

  const fromLegacy=feeKindOf(base.productText,modelText(input));
  const fuelElectric=explicitElectric(input.catalog.vehicleModel.fuel);
  if(fuelElectric===null){
    return{ok:true,...fromLegacy,productText:base.productText};
  }

  const form=fromLegacy.form;
  let baseKind:FeeRule['kind'];
  if(/구독/.test(base.productText))baseKind='구독';
  else if(/선출고|선발주|발주|매칭출고|견적출고/.test(base.productText))baseKind='신차';
  else baseKind='재렌트';

  return fuelElectric
    ?{ok:true,kind:'전기차',fallback:baseKind,...(form?{form}:{}),productText:base.productText}
    :{ok:true,kind:baseKind,...(form?{form}:{}),productText:base.productText};
}

function numeric(value:number|string):number|null{
  return typeof value==='number'&&Number.isFinite(value)?value:null;
}

function feeAmount(
  value:number,
  rule:FeeRule,
  input:SettlementPricingInput,
):{ok:true;amount:number}|{ok:false;missing:string;reason:string}{
  if(value<0)return{ok:false,missing:'feeRule',reason:'음수 수수료 규칙은 자동 계산하지 않습니다.'};

  if(rule.basis==='정액'){
    return{ok:true,amount:Math.round(value)};
  }

  if(rule.basis==='대여료×기간'){
    if(value>=1)return{ok:true,amount:Math.round(value)};
    return{
      ok:true,
      amount:Math.round(
        input.catalog.offer.monthlyRent
        * input.catalog.offer.termMonths
        * value,
      ),
    };
  }

  if(rule.basis==='차량가액'){
    if(input.catalog.vehiclePrice===undefined){
      return{ok:false,missing:'vehiclePrice',reason:'차량가액 기준 정산인데 차량가액 Snapshot이 없습니다.'};
    }
    if(value>=1)return{ok:true,amount:Math.round(value)};
    return{ok:true,amount:Math.round(input.catalog.vehiclePrice*value)};
  }

  return{
    ok:false,
    missing:'feeRule',
    reason:'이 수수료 셈법은 사람 확인이 필요합니다: '+rule.basis,
  };
}

function ratio(input:SettlementPricingInput):
  |{ok:true;value:number}
  |{ok:false;reason:string}{
  const value=input.operational.settleRatio;
  if(value===undefined)return{ok:true,value:1};
  if(!Number.isFinite(value)||value<=0||value>1){
    return{ok:false,reason:'정산 비율은 0보다 크고 1 이하여야 합니다.'};
  }
  return{ok:true,value};
}

function review(
  reason:string,
  missingFacts:string[],
  rule?:FeeRule,
  sourceRevision?:string,
):SettlementPricingResult{
  return{
    status:'REVIEW_REQUIRED',
    reason,
    missingFacts:[...new Set(missingFacts)],
    evidence:{
      engineId:'fp-settlement-fee-rules',
      engineRevision:ENGINE_REVISION,
      ...(rule?{ruleId:ruleId(rule)}:{}),
      ...(sourceRevision?{sourceRevision}:{}),
      explanation:rule
        ?[rule.supplier,rule.kind,rule.form||'공통',String(rule.term||'기간무관'),rule.basis,rule.note||'']
          .filter(Boolean).join(' · ')
        :reason,
    },
  };
}

function ruleId(rule:FeeRule){
  return[
    rule.supplier,
    rule.kind,
    rule.form||'ANY',
    rule.term||'ANY',
    rule.basis,
  ].join('|');
}

/**
 * P13 pricing bridge.
 *
 * Reverse-imports only the proven pure fee-rule table from fp-settlement.
 * It does not import fp-settlement UI/Auth/Firestore/RTDB code.
 *
 * V1 intentionally does not infer installment broken-ratio or billing month when
 * Admin operational facts are not authoritative yet. Those are separate layers.
 */
export class FpSettlementPricingProvider implements SettlementPricingProvider{
  constructor(
    private readonly suppliers:SettlementSupplierRuleKeyProvider,
  ){}

  async quote(input:SettlementPricingInput):Promise<SettlementPricingResult>{
    const supplier=await this.suppliers.resolve(input.catalog.supplierId);
    if(!supplier){
      return review(
        '공급사 ID를 정산 수수료 규칙 키로 해소하지 못했습니다.',
        ['supplierRuleKey'],
        undefined,
        input.catalog.sourceSnapshotId,
      );
    }

    const cls=classify(input);
    if(!cls.ok){
      return review(cls.reason,cls.missing,undefined,input.catalog.sourceSnapshotId);
    }

    const rule=feeRuleFor(
      supplier.ruleKey,
      cls.kind,
      input.catalog.offer.termMonths,
      cls.form,
      cls.fallback,
    );
    if(!rule){
      return review(
        '해당 공급사/상품갈래/기간의 검증된 수수료 규칙이 없습니다.',
        ['feeRule'],
        undefined,
        supplier.sourceRevision??input.catalog.sourceSnapshotId,
      );
    }

    if(!rule.auto){
      return review(
        rule.note||'기존 정산 엔진에서도 사람이 확정하는 규칙입니다.',
        ['manualFeeDecision'],
        rule,
        supplier.sourceRevision??input.catalog.sourceSnapshotId,
      );
    }

    const claimRate=numeric(rule.claim);
    const payRate=numeric(rule.pay);
    if(claimRate===null||payRate===null){
      return review(
        '수수료 규칙이 숫자 한 값으로 확정되지 않습니다.',
        ['manualFeeDecision'],
        rule,
        supplier.sourceRevision??input.catalog.sourceSnapshotId,
      );
    }

    const claimBase=feeAmount(claimRate,rule,input);
    if(!claimBase.ok){
      return review(
        claimBase.reason,
        [claimBase.missing],
        rule,
        supplier.sourceRevision??input.catalog.sourceSnapshotId,
      );
    }
    const payBase=feeAmount(payRate,rule,input);
    if(!payBase.ok){
      return review(
        payBase.reason,
        [payBase.missing],
        rule,
        supplier.sourceRevision??input.catalog.sourceSnapshotId,
      );
    }

    const share=ratio(input);
    if(!share.ok){
      return review(
        share.reason,
        ['settleRatio'],
        rule,
        supplier.sourceRevision??input.catalog.sourceSnapshotId,
      );
    }

    const claimIncentive=input.operational.claimIncentive??0;
    const payIncentive=input.operational.payIncentive??0;
    if(
      !Number.isSafeInteger(claimIncentive)
      ||claimIncentive<0
      ||!Number.isSafeInteger(payIncentive)
      ||payIncentive<0
    ){
      return review(
        '인센티브는 0 이상의 원 단위 정수여야 합니다.',
        ['claimIncentive','payIncentive'],
        rule,
        supplier.sourceRevision??input.catalog.sourceSnapshotId,
      );
    }

    const target=input.operational.settleTarget??'ALL';
    const excluded=input.operational.settleExclude===true;
    const held=input.operational.billHold===true;

    const claimFull=claimBase.amount+claimIncentive;
    const payFull=payBase.amount+payIncentive;
    const supplierReceivable=excluded||held||target==='CHANNEL'
      ?0
      :Math.round(claimFull*share.value);
    const channelPayable=excluded||target==='SUPPLIER'
      ?0
      :Math.round(payFull*share.value);

    return{
      status:'READY',
      supplierReceivable,
      channelPayable,
      vatMode:input.operational.vatIncluded===true?'INCLUDED':'EXCLUDED',
      ...(input.operational.billingMonth?{billingMonth:input.operational.billingMonth}:{}),
      evidence:{
        engineId:'fp-settlement-fee-rules',
        engineRevision:ENGINE_REVISION,
        ruleId:ruleId(rule),
        sourceRevision:supplier.sourceRevision??input.catalog.sourceSnapshotId,
        explanation:[
          supplier.displayName||supplier.ruleKey,
          cls.productText,
          input.catalog.offer.termMonths+'개월',
          rule.basis,
          rule.note||'',
        ].filter(Boolean).join(' · '),
      },
    };
  }
}
