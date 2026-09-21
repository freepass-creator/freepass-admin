import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { buildConsentProfile } from '../../domain/esign/consents';
import { DOCUMENT_PRESETS } from '../../domain/esign/required-documents';
import type { EsignSnapshot } from '../../domain/esign/types';
import { validateSubmission } from './submission';

function chunk(type:string,data:Buffer){
  const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
  return Buffer.concat([len,Buffer.from(type),data,Buffer.alloc(4)]);
}
function meaningfulSignature(){
  const w=600,h=180,row=w*4+1,raw=Buffer.alloc(row*h);
  for(let y=0;y<h;y++){
    raw[y*row]=0;
    for(let x=0;x<w;x++){
      const i=y*row+1+x*4;
      raw[i]=255;raw[i+1]=255;raw[i+2]=255;raw[i+3]=0;
    }
  }
  for(let y=80;y<96;y++)for(let x=100;x<500;x++){
    const i=y*row+1+x*4;
    raw[i]=20;raw[i+1]=20;raw[i+2]=20;raw[i+3]=255;
  }
  const ih=Buffer.alloc(13);
  ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
  const png=Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',ih),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0)),
  ]);
  return 'data:image/png;base64,'+png.toString('base64');
}

function snapshot(over:Partial<EsignSnapshot>={}):EsignSnapshot{
  const requiredDocuments=DOCUMENT_PRESETS.personal.map(x=>({...x}));
  return {
    contractId:'c1',
    contractCode:'FP-1',
    customerName:'홍길동',
    customerPhone:'01012345678',
    customerType:'개인',
    vehicleName:'GV70',
    plate:'12가3456',
    supplierCode:'S1',
    supplierName:'공급사',
    contractKind:'rent_return',
    insuranceSide:'회사포함',
    rent:690000,
    termMonths:36,
    deposit:0,
    contractDate:'2026-09-20',
    templateVersion:'v1',
    agreementVersion:'a1',
    templateState:{},
    templateFields:{},
    requiredDocuments,
    consentProfile:buildConsentProfile({
      customerType:'개인',
      paymentMethod:'계좌이체',
      gpsInstalled:'미장착',
      screeningCriteria:'무심사',
      requiredDocuments,
    }),
    ...over,
  };
}

function payload(s:EsignSnapshot){
  return {
    customer_name:'홍길동',
    customer_phone:'010-1234-5678',
    customer_birth:'1983-09-26',
    customer_address:'서울시',
    driver_license_no:'11-11-111111-11',
    emergency_relation:'가족',
    emergency_name:'김가족',
    emergency_phone:'010-9999-8888',
    signature:meaningfulSignature(),
    consents:[...s.consentProfile.requiredKeys],
    summaryConfirmedAt:1,
    agreementReadAt:1,
    uploaded_documents:s.requiredDocuments.filter(x=>x.required).map(x=>x.key),
  };
}

test('valid personal submission passes with exact required consents and documents',()=>{
  const s=snapshot();
  const result=validateSubmission(payload(s),s);
  assert.equal(result.name,'홍길동');
  assert.equal(result.phone,'01012345678');
});

test('missing consent fails closed',()=>{
  const s=snapshot();
  const p=payload(s);
  p.consents=p.consents.filter(x=>x!=='privacy');
  assert.throws(()=>validateSubmission(p,s),/필수 약관 동의/);
});

test('missing required document fails closed',()=>{
  const s=snapshot();
  const p=payload(s);
  p.uploaded_documents=[];
  assert.throws(()=>validateSubmission(p,s),/필수서류/);
});

test('corporate delegated signer requires delegation evidence',()=>{
  const requiredDocuments=DOCUMENT_PRESETS.corporate.map(x=>({...x}));
  const s=snapshot({
    customerType:'법인',
    requiredDocuments,
    consentProfile:buildConsentProfile({
      customerType:'법인',
      paymentMethod:'계좌이체',
      gpsInstalled:'미장착',
      screeningCriteria:'무심사',
      requiredDocuments,
    }),
  });
  const p:any=payload(s);
  delete p.customer_birth;
  delete p.driver_license_no;
  p.signer_name='김대리';
  p.signer_role='위임받은 임직원';
  p.uploaded_documents=['business_registration','corporate_registry','corporate_seal'];
  assert.throws(()=>validateSubmission(p,s),/위임장|재직증명서|필수서류/);
});
