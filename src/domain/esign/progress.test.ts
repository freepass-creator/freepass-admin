import assert from 'node:assert/strict';
import test from 'node:test';
import { adminStage, esignStage } from './progress';
import type { EsignSession } from './types';

const base = (): EsignSession => ({
  id:'s1',contractId:'c1',contractCode:'C1',tokenHash:'h',status:'sent',revision:1,
  issuedAt:1,issuedBy:'admin',expiresAt:Date.now()+100000,progress:{},
  snapshot:{
    contractId:'c1',contractCode:'C1',customerName:'홍길동',customerPhone:'01012345678',customerType:'개인',
    vehicleName:'GV70',plate:'12가3456',supplierCode:'S1',supplierName:'손오공',contractKind:'rent_return',insuranceSide:'회사포함',
    rent:500000,termMonths:36,deposit:0,contractDate:'2026-09-18',templateVersion:'v1',agreementVersion:'a1',
    templateState:{co:'auto',pd:'렌트선택형',ins:'포함',ct:'개인',car:'등록완료',tax:'개인'},
    templateFields:{},requiredDocuments:[],consentProfile:{version:'v',requiredKeys:['rental_terms','privacy'],atoms:[],gpsInstalled:'미장착',paymentMethod:'계좌이체',screeningCriteria:'무심사',cmsRequiredBeforeHandover:false},
  },
});

test('esign stage follows issue-open-progress-review-signed', () => {
  const s=base();
  assert.equal(esignStage(s).state,'발행');
  s.status='opened'; assert.equal(esignStage(s).state,'열람');
  s.status='in_progress'; s.progress={summary:2,information:3}; assert.equal(esignStage(s).state,'진행중');
  s.status='pending_review'; assert.equal(esignStage(s).state,'검토대기'); assert.equal(adminStage(s),'검토 대기');
  s.status='signed'; assert.equal(esignStage(s).state,'서명완료'); assert.equal(adminStage(s),'완료');
});

test('revoked and expired sessions never look active', () => {
  const s=base(); s.status='revoked'; assert.equal(esignStage(s).state,'철회');
  const e=base(); e.expiresAt=1; assert.equal(esignStage(e,2).state,'만료');
});
