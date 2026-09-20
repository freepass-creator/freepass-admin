import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from './types';
import { firstOfferForTerm, offerTerms, offersForTerm } from './offer-terms';

const offer=(id:string,termMonths:number,annualMileageKm:number):Offer=>({
  id,
  termMonths,
  monthlyRent:700000,
  annualMileageKm,
  policyValues:[],
});

test('supplier-defined arbitrary terms are preserved and sorted without fixed month assumptions',()=>{
  const offers=[
    offer('o48',48,20000),
    offer('o13',13,20000),
    offer('o27',27,20000),
  ];
  assert.deepEqual(offerTerms(offers),[13,27,48]);
});

test('same term may contain multiple condition variants such as mileage',()=>{
  const offers=[
    offer('o36-20k',36,20000),
    offer('o36-30k',36,30000),
    offer('o48',48,20000),
  ];
  assert.deepEqual(offerTerms(offers),[36,48]);
  assert.deepEqual(
    offersForTerm(offers,36).map((item)=>[item.id,item.annualMileageKm]),
    [['o36-20k',20000],['o36-30k',30000]],
  );
  assert.equal(firstOfferForTerm(offers,36)?.id,'o36-20k');
});
