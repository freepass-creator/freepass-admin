import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyFinderSelection,
  findProducts,
  finderAxisMatches,
  matchFinderProduct,
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

  selection.rent=['r100'];
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
