import assert from 'node:assert/strict';
import test from 'node:test';
import type { SettlementPricingInput } from '../../ports/settlement-pricing';
import type { SettlementSupplierRuleKeyProvider } from '../../ports/settlement-supplier-rule-key';
import { FpSettlementPricingProvider } from './fp-settlement-provider';

const suppliers:SettlementSupplierRuleKeyProvider={
  async resolve(id){
    const map:Record<string,string>={
      'supplier-welrix':'웰릭스',
      'supplier-autoplus':'오토플러스',
      'supplier-star':'스타',
      'supplier-pacific':'퍼시픽',
    };
    return map[id]?{supplierId:id,ruleKey:map[id],displayName:map[id]}:null;
  },
};

const base:SettlementPricingInput={
  performanceId:'performance:1',
  applicationId:'application:1',
  catalog:{
    productId:'product-1',
    productVersion:7,
    sourceSnapshotId:'freepass-data:rel-1:product-1:7',
    commercialType:'USED_RENT',
    supplierId:'supplier-welrix',
    vehicleModel:{
      nodeId:'vm-1',
      originId:'KR',
      manufacturerId:'현대',
      modelId:'싼타페',
      subModelId:'MX5',
      trimId:'캘리그래피',
      fuel:'가솔린',
    },
    offer:{
      runtimeOfferId:'offer-1#36_2만',
      sourceOfferId:'offer-1',
      sourceOfferRevision:3,
      sourcePriceTermKey:'36_2만',
      termMonths:36,
      monthlyRent:700000,
      deposit:0,
      depositState:'ZERO',
      annualMileageKm:20000,
    },
    policies:[],
    deliveredAt:'2026-09-21T01:00:00.000Z',
  },
  operational:{},
};

test('standard 36-month re-rent ladder matches proven fp-settlement amounts',async()=>{
  const provider=new FpSettlementPricingProvider(suppliers);
  const result=await provider.quote(base);
  assert.equal(result.status,'READY');
  if(result.status!=='READY')return;

  // 700,000 * 36 * 3.75% / 3.00%
  assert.equal(result.supplierReceivable,945000);
  assert.equal(result.channelPayable,756000);
  assert.equal(result.vatMode,'EXCLUDED');
  assert.match(result.evidence.ruleId??'',/웰릭스\|재렌트/);
});

test('settlement ratio and incentives apply without mutating the fee rule',async()=>{
  const provider=new FpSettlementPricingProvider(suppliers);
  const result=await provider.quote({
    ...base,
    operational:{
      settleRatio:0.5,
      claimIncentive:300000,
      payIncentive:300000,
      billingMonth:'2026-10',
    },
  });
  assert.equal(result.status,'READY');
  if(result.status!=='READY')return;

  assert.equal(result.supplierReceivable,622500); // (945,000 + 300,000) * .5
  assert.equal(result.channelPayable,528000);     // (756,000 + 300,000) * .5
  assert.equal(result.billingMonth,'2026-10');
});

test('new-car vehicle-price rule requires form and uses snapshotted vehicle price',async()=>{
  const provider=new FpSettlementPricingProvider(suppliers);

  const missingForm=await provider.quote({
    ...base,
    catalog:{
      ...base.catalog,
      commercialType:'NEW_RENT',
      vehiclePrice:40000000,
    },
  });
  assert.equal(missingForm.status,'REVIEW_REQUIRED');
  if(missingForm.status==='REVIEW_REQUIRED'){
    assert.ok(missingForm.missingFacts.includes('commercialForm'));
  }

  const ready=await provider.quote({
    ...base,
    catalog:{
      ...base.catalog,
      commercialType:'NEW_RENT',
      vehiclePrice:40000000,
      policies:[{policyId:'product_form',type:'SINGLE_SELECT',value:'선출고'}],
    },
  });
  assert.equal(ready.status,'READY');
  if(ready.status!=='READY')return;

  // standard new car: 3.5% receive / 3.0% pay
  assert.equal(ready.supplierReceivable,1400000);
  assert.equal(ready.channelPayable,1200000);
});

test('AutoPlus electric subscription uses proven 150/130 fixed promotion rule',async()=>{
  const provider=new FpSettlementPricingProvider(suppliers);
  const result=await provider.quote({
    ...base,
    catalog:{
      ...base.catalog,
      supplierId:'supplier-autoplus',
      commercialType:'USED_SUBSCRIPTION',
      vehicleModel:{...base.catalog.vehicleModel,fuel:'전기',modelId:'EV6'},
    },
  });
  assert.equal(result.status,'READY');
  if(result.status!=='READY')return;

  assert.equal(result.supplierReceivable,1500000);
  assert.equal(result.channelPayable,1300000);
});

test('manual/conditional rules remain REVIEW_REQUIRED',async()=>{
  const provider=new FpSettlementPricingProvider(suppliers);
  const result=await provider.quote({
    ...base,
    catalog:{
      ...base.catalog,
      supplierId:'supplier-pacific',
      commercialType:'NEW_RENT',
      vehiclePrice:50000000,
      policies:[{policyId:'product_form',type:'SINGLE_SELECT',value:'선출고'}],
    },
  });
  assert.equal(result.status,'REVIEW_REQUIRED');
  if(result.status==='REVIEW_REQUIRED'){
    assert.ok(result.missingFacts.includes('manualFeeDecision'));
  }
});

test('unknown supplier identity fails closed instead of using supplier id as a name',async()=>{
  const provider=new FpSettlementPricingProvider(suppliers);
  const result=await provider.quote({
    ...base,
    catalog:{...base.catalog,supplierId:'RP-UNKNOWN'},
  });
  assert.equal(result.status,'REVIEW_REQUIRED');
  if(result.status==='REVIEW_REQUIRED'){
    assert.ok(result.missingFacts.includes('supplierRuleKey'));
  }
});

test('target, hold and exclusion preserve claim/pay axis separation',async()=>{
  const provider=new FpSettlementPricingProvider(suppliers);

  const channelOnly=await provider.quote({
    ...base,
    operational:{settleTarget:'CHANNEL'},
  });
  assert.equal(channelOnly.status,'READY');
  if(channelOnly.status==='READY'){
    assert.equal(channelOnly.supplierReceivable,0);
    assert.equal(channelOnly.channelPayable,756000);
  }

  const supplierOnly=await provider.quote({
    ...base,
    operational:{settleTarget:'SUPPLIER'},
  });
  assert.equal(supplierOnly.status,'READY');
  if(supplierOnly.status==='READY'){
    assert.equal(supplierOnly.supplierReceivable,945000);
    assert.equal(supplierOnly.channelPayable,0);
  }

  const held=await provider.quote({...base,operational:{billHold:true}});
  assert.equal(held.status,'READY');
  if(held.status==='READY'){
    assert.equal(held.supplierReceivable,0);
    assert.equal(held.channelPayable,756000);
  }

  const excluded=await provider.quote({...base,operational:{settleExclude:true}});
  assert.equal(excluded.status,'READY');
  if(excluded.status==='READY'){
    assert.equal(excluded.supplierReceivable,0);
    assert.equal(excluded.channelPayable,0);
  }
});
