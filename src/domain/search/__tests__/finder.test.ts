import test from 'node:test';
import assert from 'node:assert/strict';
import { matchProduct } from '../match-product';
import {
  emptyFinderSelection,
  findProducts,
  finderAxisMatches,
  matchFinderProduct,
  sortFinderMatches,
  type FinderInput,
} from '../finder';
import { offer, product } from './fixtures';

const input=(patch:Partial<FinderInput>={}):FinderInput=>({
  selection:emptyFinderSelection(),
  limits:{},
  requirements:{perks:[]},
  text:'',
  ...patch,
});

test('Domain Finder keeps rent/deposit conditions on one Offer',()=>{
  const p=product({
    offers:[
      offer({id:'cheap',termMonths:36,monthlyRent:600_000,deposit:3_000_000}),
      offer({id:'no-deposit',termMonths:36,monthlyRent:900_000,deposit:0}),
    ],
  });
  const selection=emptyFinderSelection();
  selection.rent=['r70'];
  selection.dep=['d0'];
  assert.equal(matchFinderProduct(p,input({selection})),null);

  selection.rent=['r90'];
  const match=matchFinderProduct(p,input({selection}));
  assert.deepEqual(match?.matchedOfferIds,['no-deposit']);
});

test('Finder skip-axis supports cross facet counts without dropping other filters',()=>{
  const a=product({id:'a',productKind:'중고렌트',specs:{fuel:'가솔린'}});
  const b=product({id:'b',productKind:'중고렌트',specs:{fuel:'디젤'}});
  const c=product({id:'c',productKind:'신차렌트',specs:{fuel:'디젤'}});
  const selection=emptyFinderSelection();
  selection.kind=['중고렌트'];
  selection.fuel=['가솔린'];
  const current=input({selection});

  assert.deepEqual(findProducts([a,b,c],current).map((x)=>x.product.id),['a']);
  const withoutFuel=findProducts([a,b,c],current,'fuel');
  assert.deepEqual(withoutFuel.map((x)=>x.product.id),['a','b']);
  assert.equal(finderAxisMatches(withoutFuel[1],'fuel','디젤'),true);
});

test('Finder free text and internal supplier facet share one result pipeline',()=>{
  const a=product({id:'a',supplierId:'SUP-A',supplierName:'오토플러스'});
  const b=product({id:'b',supplierId:'SUP-B',supplierName:'손오공'});
  const selection=emptyFinderSelection();
  selection.supplier=['오토플러스'];

  assert.deepEqual(
    findProducts([a,b],input({selection,text:'오토'})).map((x)=>x.product.id),
    ['a'],
  );
});

test('Finder preserves exact numeric natural-language limits after coarse bands',()=>{
  const p=product({
    specs:{mileageKm:49_000},
    offers:[
      offer({id:'ok',monthlyRent:540_000,deposit:1_400_000}),
      offer({id:'over-rent',monthlyRent:560_000,deposit:1_400_000}),
    ],
  });
  const selection=emptyFinderSelection();
  selection.rent=['r50','r60'];
  selection.dep=['d0','d1','d2'];
  selection.vmile=['m1','m3','m5'];

  const match=matchFinderProduct(p,input({
    selection,
    limits:{rentMax:550_000,depositMax:1_500_000,vehicleMileageMax:50_000},
  }));
  assert.deepEqual(match?.matchedOfferIds,['ok']);
});

test('Finder requirements stay AND while visible perk facet stays OR',()=>{
  const p=product({perks:['무심사','경력무관','만21세']});
  const selection=emptyFinderSelection();
  selection.perk=['무심사','소득확인'];

  assert.ok(matchFinderProduct(p,input({
    selection,
    requirements:{perks:['경력무관'],driverAge:21},
  })));

  assert.equal(matchFinderProduct(product({perks:['무심사','만21세']}),input({
    selection,
    requirements:{perks:['경력무관'],driverAge:21},
  })),null);
});


test('finder sort uses matched offers, not hidden unmatched offers',()=>{
  const a=product({
    id:'a',
    offers:[
      offer({id:'a-selected',termMonths:36,monthlyRent:700_000}),
      offer({id:'a-hidden',termMonths:60,monthlyRent:100_000}),
    ],
  });
  const b=product({
    id:'b',
    offers:[offer({id:'b-selected',termMonths:36,monthlyRent:650_000})],
  });
  const selection=emptyFinderSelection();
  selection.term=['36'];
  const matches=findProducts([a,b],input({selection}));
  assert.deepEqual(sortFinderMatches(matches,'asc').map((x)=>x.product.id),['b','a']);
});

test('white-label compatible sorts keep exact before partial and then apply requested value',()=>{
  const exactOld=product({
    id:'exact-old',
    photoUrl:'https://example.com/a.jpg',
    vehicle:{...product().vehicle,matchLevel:'SUB_MODEL',subModelId:'sub-dn8'},
    specs:{modelYear:2022,mileageKm:50_000},
    offers:[offer({monthlyRent:700_000,deposit:2_000_000})],
  });
  const exactNew=product({
    id:'exact-new',
    photoUrl:'https://example.com/b.jpg',
    vehicle:{...product().vehicle,matchLevel:'SUB_MODEL',subModelId:'sub-dn8'},
    specs:{modelYear:2025,mileageKm:20_000},
    offers:[offer({monthlyRent:800_000,deposit:0})],
  });
  const partial=product({
    id:'partial',
    photoUrl:'https://example.com/c.jpg',
    vehicle:{...product().vehicle,matchLevel:'MODEL'},
    specs:{modelYear:2026,mileageKm:10_000},
    offers:[offer({monthlyRent:500_000,deposit:0})],
  });
  const queried=[exactOld,exactNew,partial]
    .map((p)=>matchProduct(p,{subModelIds:['sub-dn8']}))
    .filter((x):x is NonNullable<typeof x>=>!!x);
  // PARTIAL has newer year / shorter mileage, but EXACT must still remain first (S-12).
  assert.deepEqual(sortFinderMatches(queried,'year').map((x)=>x.product.id),['exact-new','exact-old','partial']);
  assert.deepEqual(sortFinderMatches(queried,'mile').map((x)=>x.product.id),['exact-new','exact-old','partial']);
});

test('same-car-many sort counts manufacturer + model in the filtered result',()=>{
  const a1=product({id:'a1',vehicle:{...product().vehicle,manufacturerId:'현대',modelId:'그랜저'}});
  const a2=product({id:'a2',vehicle:{...product().vehicle,manufacturerId:'현대',modelId:'그랜저'}});
  const b=product({id:'b',vehicle:{...product().vehicle,manufacturerId:'기아',modelId:'K5'}});
  const matches=findProducts([b,a1,a2],input());
  assert.deepEqual(sortFinderMatches(matches,'many').map((x)=>x.product.id).slice(0,2).sort(),['a1','a2']);
});

test('popular sort uses the same model ordering baseline as White Label',()=>{
  const k5=product({id:'k5',vehicle:{...product().vehicle,modelId:'K5'},photoUrl:'https://example.com/k5.jpg'});
  const sorento=product({id:'sorento',vehicle:{...product().vehicle,modelId:'쏘렌토'},photoUrl:'https://example.com/s.jpg'});
  const unknown=product({id:'unknown',vehicle:{...product().vehicle,modelId:'미등록모델'},photoUrl:'https://example.com/u.jpg'});
  const matches=findProducts([unknown,k5,sorento],input());
  assert.deepEqual(sortFinderMatches(matches,'popular').map((x)=>x.product.id),['sorento','k5','unknown']);
});


test('model facet trusts confirmed vehicle identity and ignores UNMATCHED leftovers',()=>{
  const confirmed=product({
    id:'confirmed-model',
    vehicle:{...product().vehicle,matchLevel:'MODEL',manufacturerId:'현대',modelId:'그랜저'},
  });
  const unmatched=product({
    id:'unmatched-leftover',
    vehicle:{...product().vehicle,matchLevel:'UNMATCHED',manufacturerId:'현대',modelId:'그랜저',nodeId:''},
  });
  const selection=emptyFinderSelection();
  selection.model=['그랜저'];

  assert.deepEqual(findProducts([confirmed,unmatched],input({selection})).map((x)=>x.product.id),['confirmed-model']);

  const pool=findProducts([confirmed,unmatched],input());
  const modelCandidates=pool.filter((m)=>finderAxisMatches(m,'model','그랜저'));
  assert.deepEqual(modelCandidates.map((x)=>x.product.id),['confirmed-model']);
});

test('manufacturer facet also ignores UNMATCHED identity leftovers',()=>{
  const confirmed=product({
    id:'confirmed-maker',
    vehicle:{...product().vehicle,matchLevel:'MODEL',manufacturerId:'현대',modelId:'그랜저'},
  });
  const unmatched=product({
    id:'unmatched-maker',
    vehicle:{...product().vehicle,matchLevel:'UNMATCHED',manufacturerId:'현대',modelId:'',nodeId:''},
  });
  const pool=findProducts([confirmed,unmatched],input());
  assert.deepEqual(pool.filter((m)=>finderAxisMatches(m,'maker','현대')).map((x)=>x.product.id),['confirmed-maker']);
});
