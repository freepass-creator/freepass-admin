import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertApprovedRelease,
  parseAdminCutoverApproval,
  tokenSha256,
} from '../freepass-data-admin-cutover';

const NOW=Date.parse('2026-09-26T08:00:00.000Z');
const token='t'.repeat(40);
const env={
  FREEPASS_DATA_BASE_URL:'https://data.example.test',
  FREEPASS_DATA_ADMIN_CATALOG_TOKEN:token,
};
const approval=(targetStage:'SHADOW_READ'|'PARITY_VERIFIED'|'FREEPASS_DATA_READ')=>JSON.stringify({
  consumerId:'freepass-admin-catalog',
  fromStage:targetStage==='SHADOW_READ'?'OBSERVE':targetStage==='PARITY_VERIFIED'?'SHADOW_READ':'PARITY_VERIFIED',
  targetStage,
  baseOrigin:'https://data.example.test',
  tokenSha256:tokenSha256(token),
  evidence:{
    contractReady:true,
    authenticationVerified:true,
    legacyReadVerified:true,
    freepassReadVerified:true,
    parityVerified:targetStage!=='SHADOW_READ',
    fallbackVerified:targetStage==='FREEPASS_DATA_READ',
    productionReadbackVerified:targetStage==='FREEPASS_DATA_READ',
    approvedRelease:targetStage==='SHADOW_READ'?null:{
      projectionId:'admin-catalog',
      releaseId:'rel-1',
      manifestId:'manifest-1',
      inputDigest:'input-1',
      dataDigest:'data-1',
      observedAt:'2026-09-26T07:30:00.000Z',
    },
  },
  holdReasons:[],
  approvalRef:'ops-cutover-1',
  approvedAt:'2026-09-26T07:40:00.000Z',
  validUntil:'2026-10-03T07:40:00.000Z',
});

test('Admin cutover stages accept only the next approved stage with required evidence',()=>{
  for(const stage of ['SHADOW_READ','PARITY_VERIFIED','FREEPASS_DATA_READ'] as const){
    assert.equal(parseAdminCutoverApproval(approval(stage),env,stage,NOW,stage).ok,true,stage);
  }
  const skipped=JSON.parse(approval('FREEPASS_DATA_READ')) as Record<string,unknown>;
  skipped.fromStage='OBSERVE';
  assert.equal(parseAdminCutoverApproval(JSON.stringify(skipped),env,'FREEPASS_DATA_READ',NOW,'FREEPASS_DATA_READ').ok,false);
});

test('Admin cutover approval is bound to Data origin and consumer token',()=>{
  assert.equal(parseAdminCutoverApproval(approval('SHADOW_READ'),{
    ...env,FREEPASS_DATA_BASE_URL:'https://other.example.test',
  },'SHADOW_READ',NOW,'SHADOW_READ').ok,false);
  assert.equal(parseAdminCutoverApproval(approval('SHADOW_READ'),{
    ...env,FREEPASS_DATA_ADMIN_CATALOG_TOKEN:'x'.repeat(40),
  },'SHADOW_READ',NOW,'SHADOW_READ').ok,false);
});

test('PARITY and final read require approved release evidence and no HOLD reasons',()=>{
  const missing=JSON.parse(approval('PARITY_VERIFIED')) as any;
  missing.evidence.approvedRelease=null;
  assert.equal(parseAdminCutoverApproval(JSON.stringify(missing),env,'PARITY_VERIFIED',NOW,'PARITY_VERIFIED').ok,false);

  const held=JSON.parse(approval('FREEPASS_DATA_READ')) as any;
  held.holdReasons=['presentation parity incomplete'];
  assert.equal(parseAdminCutoverApproval(JSON.stringify(held),env,'FREEPASS_DATA_READ',NOW,'FREEPASS_DATA_READ').ok,false);
});

test('final read requires fallback and production readback evidence',()=>{
  const noFallback=JSON.parse(approval('FREEPASS_DATA_READ')) as any;
  noFallback.evidence.fallbackVerified=false;
  assert.equal(parseAdminCutoverApproval(JSON.stringify(noFallback),env,'FREEPASS_DATA_READ',NOW,'FREEPASS_DATA_READ').ok,false);
  const noReadback=JSON.parse(approval('FREEPASS_DATA_READ')) as any;
  noReadback.evidence.productionReadbackVerified=false;
  assert.equal(parseAdminCutoverApproval(JSON.stringify(noReadback),env,'FREEPASS_DATA_READ',NOW,'FREEPASS_DATA_READ').ok,false);
});

test('cutover approval expires and cannot target a different mode',()=>{
  const expired=JSON.parse(approval('PARITY_VERIFIED')) as any;
  expired.validUntil='2026-09-26T07:50:00.000Z';
  assert.equal(parseAdminCutoverApproval(JSON.stringify(expired),env,'PARITY_VERIFIED',NOW,'PARITY_VERIFIED').ok,false);
  assert.equal(parseAdminCutoverApproval(approval('PARITY_VERIFIED'),env,'FREEPASS_DATA_READ',NOW,'FREEPASS_DATA_READ').ok,false);
});

test('approved release must still match the live ACTIVE release exactly',()=>{
  const parsed=parseAdminCutoverApproval(approval('PARITY_VERIFIED'),env,'PARITY_VERIFIED',NOW,'PARITY_VERIFIED');
  assert.equal(parsed.ok,true);
  if(!parsed.ok)return;
  const meta={
    projectionId:'admin-catalog' as const,
    releaseId:'rel-1',
    manifestId:'manifest-1',
    inputDigest:'input-1',
    dataDigest:'data-1',
    policyParity:'COMPLETE' as const,
  };
  assert.equal(assertApprovedRelease(parsed.approval,meta),null);
  assert.equal(assertApprovedRelease(parsed.approval,{...meta,dataDigest:'changed'}),'FREEPASS_DATA_APPROVED_RELEASE_MISMATCH');
  assert.equal(assertApprovedRelease(parsed.approval,{...meta,policyParity:'INCOMPLETE'}),'FREEPASS_DATA_POLICY_PARITY_INCOMPLETE');
});


test('runtime default cannot self-promote beyond the centrally observed OBSERVE stage',()=>{
  const shadow=parseAdminCutoverApproval(approval('SHADOW_READ'),env,'SHADOW_READ',NOW);
  assert.equal(shadow.ok,false);
  assert.match(shadow.ok?'':shadow.reason,/중앙 FreePass Data 레지스트리 단계\(OBSERVE\)/);
});
