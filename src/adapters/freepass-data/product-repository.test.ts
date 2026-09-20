import assert from 'node:assert/strict';
import test from 'node:test';
import { matchProduct } from '../../domain/search/match-product';
import {
  FreePassDataProductRepository,
  freePassDataProductRepositoryFromEnv,
  type FreePassDataAdminCatalogResponse,
} from './product-repository';

const payload:FreePassDataAdminCatalogResponse={
  schema:'freepass-data.admin-catalog/v1',
  meta:{
    schemaVersion:'1.0.0',
    releaseId:'rel-admin-1',
    revision:17,
    generatedAt:'2026-09-21T00:00:00.000Z',
    activatedAt:'2026-09-21T00:01:00.000Z',
    policyParity:'COMPLETE',
    missingPolicyOfferIds:[],
    invalidPolicyFactRefs:[],
  },
  data:[{
    productId:'product-1',
    productRevision:7,
    sourceProductKey:'legacy-product-77',
    updatedAt:'2026-09-20T23:59:00.000Z',
    displayName:'싼타페 MX5 캘리그래피',
    commercialType:'USED_RENT',
    media:{
      primaryImageUrl:'https://img.example/data-santafe.jpg',
      imageUrls:['https://img.example/data-santafe.jpg'],
    },
    vehicleModel:{
      id:'vm-santafe-mx5-calligraphy',
      origin:'KR',
      maker:'현대',
      model:'싼타페',
      generation:'5세대',
      subModel:'MX5',
      trim:'캘리그래피',
      fuel:'하이브리드',
      drive:'AWD',
      seats:6,
      modelYear:2026,
    },
    vehicleAsset:{
      id:'asset-123',
      status:'AVAILABLE',
      plateNumber:'123하4567',
      vin:'KMH-DATA-VIN',
      odometerKm:21000,
      firstRegistrationDate:'2026-01-03',
    },
    offers:[
      {
        offerId:'offer-a',
        offerRevision:3,
        supplierId:'supplier-a',
        policyId:'policy-a',
        policyValues:[
          {policyId:'basic_driver_age',type:'NUMBER',value:21},
          {policyId:'deposit_card_payment',type:'BOOLEAN',value:true},
        ],
        priceTerms:[
          {
            termKey:'36_2만',
            termMonths:36,
            monthlyRent:{amount:920000,currency:'KRW'},
            deposit:{amount:0,currency:'KRW'},
            depositState:'ZERO',
            mileageLimitKmPerYear:20000,
          },
          {
            termKey:'48_2만',
            termMonths:48,
            monthlyRent:{amount:850000,currency:'KRW'},
            depositState:'UNKNOWN',
            mileageLimitKmPerYear:20000,
          },
        ],
      },
      {
        offerId:'offer-b',
        offerRevision:5,
        supplierId:'supplier-b',
        policyValues:[{policyId:'basic_driver_age',type:'NUMBER',value:26}],
        priceTerms:[{
          termKey:'36_3만',
          termMonths:36,
          monthlyRent:{amount:900000,currency:'KRW'},
          deposit:{amount:1000000,currency:'KRW'},
          depositState:'KNOWN',
          mileageLimitKmPerYear:30000,
        }],
      },
    ],
  }],
};

const fetcher=async()=>new Response(JSON.stringify(payload),{
  status:200,
  headers:{'content-type':'application/json'},
});

test('FreePass Data projection maps one Product with supplier-specific flattened PriceTerms',async()=>{
  const repo=new FreePassDataProductRepository('https://data.example',undefined,fetcher);
  const products=await repo.list();
  assert.equal(products.length,1);
  const product=products[0];

  assert.equal(product.id,'product-1');
  assert.equal(product.version,7);
  assert.equal(product.supplierId,'','multi-supplier products must not invent one product supplier');
  assert.equal(product.registration?.vehicleNumber,'123하4567');
  assert.equal(product.media?.primaryImageUrl,'https://img.example/data-santafe.jpg');
  assert.equal(product.registration?.vin,'KMH-DATA-VIN');
  assert.equal(product.vehicle.nodeId,'vm-santafe-mx5-calligraphy');
  assert.equal(product.vehicle.generationId,'5세대');
  assert.equal(product.vehicle.subModelId,'MX5');
  assert.equal(product.vehicle.trimId,'캘리그래피');
  assert.equal(product.offers.length,3);

  const a36=product.offers.find((offer)=>offer.id==='offer-a#36_2만');
  assert.equal(a36?.supplierId,'supplier-a');
  assert.equal(a36?.sourceOfferId,'offer-a');
  assert.equal(a36?.sourceOfferRevision,3);
  assert.equal(a36?.sourcePriceTermKey,'36_2만');
  assert.equal(a36?.deposit,0);
  assert.equal(a36?.depositState,'ZERO');

  const a48=product.offers.find((offer)=>offer.id==='offer-a#48_2만');
  assert.equal(a48?.deposit,undefined,'UNKNOWN deposit must not become zero');
  assert.equal(a48?.depositState,'UNKNOWN');

  const b36=product.offers.find((offer)=>offer.id==='offer-b#36_3만');
  assert.equal(b36?.supplierId,'supplier-b');
  assert.equal(b36?.deposit,1000000);
  assert.equal(b36?.depositState,'KNOWN');
});

test('same-Offer search keeps supplier, term, deposit, mileage and policy on one Data Offer term',async()=>{
  const repo=new FreePassDataProductRepository('https://data.example',undefined,fetcher);
  const [product]=await repo.list();

  const supplierA=matchProduct(product,{
    supplierIds:['supplier-a'],
    termMonths:[36],
    deposit:{max:0},
    annualMileageKm:{min:20000,max:20000},
    policies:[{policyId:'basic_driver_age',anyOf:[21]}],
  });
  assert.deepEqual(supplierA?.matchedOfferIds,['offer-a#36_2만']);

  assert.equal(matchProduct(product,{
    supplierIds:['supplier-a'],
    termMonths:[48],
    deposit:{max:0},
  }),null,'UNKNOWN deposit must fail zero-deposit filtering');

  assert.deepEqual(matchProduct(product,{
    supplierIds:['supplier-b'],
    termMonths:[36],
    annualMileageKm:{min:30000,max:30000},
    policies:[{policyId:'basic_driver_age',anyOf:[26]}],
  })?.matchedOfferIds,['offer-b#36_3만']);
});

test('Data adapter rejects incomplete consumer envelopes instead of guessing',async()=>{
  const bad=async()=>new Response(JSON.stringify({schema:'wrong',data:[],meta:{}}),{status:200});
  const repo=new FreePassDataProductRepository('https://data.example',undefined,bad);
  await assert.rejects(()=>repo.list(),/FREEPASS_DATA_CONTRACT_INVALID/);
});

test('production Data source requires an explicit service credential',()=>{
  assert.throws(
    ()=>freePassDataProductRepositoryFromEnv({
      NODE_ENV:'production',
      FREEPASS_DATA_BASE_URL:'https://data.example',
    }),
    /FREEPASS_DATA_SERVICE_TOKEN_REQUIRED/,
  );
});


test('Data adapter blocks incomplete policy parity by default but allows explicit shadow mode',async()=>{
  const incomplete={
    ...payload,
    meta:{
      ...payload.meta,
      policyParity:'INCOMPLETE' as const,
      missingPolicyOfferIds:['offer-a'],
    },
  };
  const incompleteFetcher=async()=>new Response(JSON.stringify(incomplete),{status:200});

  const runtimeRepo=new FreePassDataProductRepository(
    'https://data.example',
    undefined,
    incompleteFetcher,
  );
  await assert.rejects(()=>runtimeRepo.list(),/FREEPASS_DATA_POLICY_PARITY_INCOMPLETE/);

  const shadowRepo=new FreePassDataProductRepository(
    'https://data.example',
    undefined,
    incompleteFetcher,
    '/v1/views/admin-catalog/products',
    true,
  );
  assert.equal((await shadowRepo.list()).length,1);
});
