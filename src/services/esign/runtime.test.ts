import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { EsignService } from './service';
import type { EsignAssetStore, EsignFinalDocumentRenderer, EsignRepository } from '../../ports/esign/repositories';
import type { ContractHandoffSource, EsignPrivateSubmission, EsignSession } from '../../domain/esign/types';

class Repo implements EsignRepository {
  contract = new Map<string, Record<string, unknown>>();
  intakes = new Map<string, ContractHandoffSource>();
  sessions = new Map<string, EsignSession>();
  priv = new Map<string, Record<string, unknown>>();
  events: Array<{ contractId:string; sessionId:string; type:string; at:number; by:string; detail:Record<string,unknown> }> = [];

  async getContract(id:string){return this.contract.get(id)??null;}
  async getIntakeContractSource(id:string){return this.intakes.get(id)??null;}
  async createContract(id:string,data:Record<string,unknown>){if(this.contract.has(id))throw new Error('dup');this.contract.set(id,{id,...structuredClone(data)});}
  async createContractFromIntake(source:ContractHandoffSource,id:string,data:Record<string,unknown>){
    if(this.contract.has(id))return {created:false,contract:structuredClone(this.contract.get(id)!)};
    const current=this.intakes.get(source.intakeId);
    if(!current)throw new Error('접수를 찾을 수 없습니다.');
    if(current.sourceDigest!==source.sourceDigest)throw new Error('접수 정보가 변경되었습니다 — 다시 불러온 뒤 계약을 만들어 주세요.');
    const contract={id,...structuredClone(data)};
    this.contract.set(id,contract);
    return {created:true,contract:structuredClone(contract)};
  }
  async updateContract(id:string,patch:Record<string,unknown>){this.contract.set(id,{...(this.contract.get(id)||{}),...structuredClone(patch)});}
  async getCurrentSession(contractId:string){return [...this.sessions.values()].filter(x=>x.contractId===contractId).sort((a,b)=>b.issuedAt-a.issuedAt)[0]??null;}
  async getSession(id:string){return this.sessions.get(id)??null;}
  async findSessionByTokenHash(hash:string){return [...this.sessions.values()].find(x=>x.tokenHash===hash)??null;}
  async createSession(session:EsignSession,publicUrl:string){
    for(const s of this.sessions.values()) if(s.contractId===session.contractId&&!['signed','revoked'].includes(s.status)) s.status='revoked';
    this.sessions.set(session.id,structuredClone(session));
    this.priv.set(session.id,{sessionId:session.id,contractId:session.contractId,publicUrl});
  }
  async updateSession(id:string,patch:Partial<EsignSession>){Object.assign(this.sessions.get(id)!,structuredClone(patch));}
  async transitionSession(id:string,allowed:EsignSession['status'][],patch:Partial<EsignSession>){
    const s=this.sessions.get(id); if(!s||!allowed.includes(s.status)) return false;
    Object.assign(s,structuredClone(patch)); return true;
  }
  async finalizeSigned(
    sessionId:string,finalizationId:string,sessionPatch:Partial<EsignSession>,contractPatch:Record<string,unknown>,
    actor:string,detail:Record<string,unknown>,
  ){
    const s=this.sessions.get(sessionId); if(!s)throw new Error('missing');
    if(s.status==='signed'){
      if(s.finalizationId!==finalizationId)throw new Error('different finalization');
      return {finalized:false,session:structuredClone(s)};
    }
    if(s.status!=='approving'||s.finalizationId!==finalizationId)throw new Error('bad state');
    Object.assign(s,structuredClone(sessionPatch),{status:'signed',finalizationId});
    this.contract.set(s.contractId,{...(this.contract.get(s.contractId)||{}),...structuredClone(contractPatch)});
    this.events.push({contractId:s.contractId,sessionId,type:'approved',by:actor,detail:structuredClone(detail),at:Date.now()});
    return {finalized:true,session:structuredClone(s)};
  }
  async getPrivate(id:string){return (this.priv.get(id)??null) as (EsignPrivateSubmission&Record<string,unknown>)|null;}
  async putPrivate(id:string,data:Record<string,unknown>){this.priv.set(id,{...(this.priv.get(id)||{}),...structuredClone(data)});}
  async appendEvent(contractId:string,sessionId:string,type:string,by:string,detail:Record<string,unknown>={}){
    this.events.push({contractId,sessionId,type,by,detail:structuredClone(detail),at:Date.now()});
  }
  async listEvents(contractId:string){
    return this.events.filter(x=>x.contractId===contractId).map(({type,at,by,detail})=>({type,at,by,detail})).sort((a,b)=>b.at-a.at);
  }
}

class ReadbackFailAssets extends Assets {
  async get(path:string,expected?:string){
    if(path.startsWith('esign-final/'))return null;
    return super.get(path,expected);
  }
}

class Renderer implements EsignFinalDocumentRenderer {
  calls=0;
  async render(){this.calls+=1;return {bytes:new Uint8Array(Buffer.from('%PDF-1.4\nsealed')),contentType:'application/pdf' as const};}
}

class Assets implements EsignAssetStore {
  m=new Map<string,{bytes:Uint8Array;contentType:string;sha256:string}>();
  async put(path:string,bytes:Uint8Array,contentType:string){
    const sha256=createHash('sha256').update(bytes).digest('hex');
    this.m.set(path,{bytes:new Uint8Array(bytes),contentType,sha256});
    return {path,sha256,size:bytes.length};
  }
  async get(path:string,expected?:string){
    const x=this.m.get(path);
    if(!x||expected&&x.sha256!==expected)return null;
    return {bytes:new Uint8Array(x.bytes),contentType:x.contentType};
  }
}

function chunk(type:string,data:Buffer){
  const len=Buffer.alloc(4); len.writeUInt32BE(data.length);
  return Buffer.concat([len,Buffer.from(type),data,Buffer.alloc(4)]);
}
function signature(){
  const w=600,h=180,row=w*4+1,raw=Buffer.alloc(row*h);
  for(let y=0;y<h;y++){
    raw[y*row]=0;
    for(let x=0;x<w;x++){const i=y*row+1+x*4;raw[i]=255;raw[i+1]=255;raw[i+2]=255;raw[i+3]=0;}
  }
  for(let y=80;y<96;y++)for(let x=100;x<500;x++){const i=y*row+1+x*4;raw[i]=20;raw[i+1]=20;raw[i+2]=20;raw[i+3]=255;}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
  return 'data:image/png;base64,'+Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0)),
  ]).toString('base64');
}

const contract = () => ({
  contract_code:'FP-1',contract_status:'계약대기',customer_name:'홍길동',customer_phone:'01012345678',customer_type:'개인',
  vehicle_name_snapshot:'GV70',car_number_snapshot:'12가3456',provider_company_code:'SONO',provider_company_name_snapshot:'손오공',
  rent_amount_snapshot:690000,rent_month_snapshot:36,deposit_amount_snapshot:0,contract_date:'2026-09-22',
  esign_contract_kind:'rent_return',esign_insurance_side:'회사포함',screening_criteria:'무심사',gps_installed:'미장착',payment_method:'계좌이체',
});

test('esign runtime: issue -> open -> assets -> submit -> review -> reject -> revoke', async () => {
  process.env.PUBLIC_BASE_URL='https://admin.example.test';
  const repo=new Repo(), assets=new Assets(), svc=new EsignService(repo,assets);
  repo.contract.set('c1',contract());

  const issued=await svc.issue('c1','tester');
  assert.equal(issued.publicUrl.startsWith('https://admin.example.test/sign/'),true);
  assert.equal(repo.contract.get('c1')?.sign_status,'발행');

  const token=issued.publicUrl.split('/').pop()!;
  await svc.publicView(token);
  assert.equal(repo.contract.get('c1')?.sign_status,'열람');

  await svc.progress(token,'summary');
  await svc.progress(token,'document');
  await svc.upload(token,'id_card','id.jpg','image/jpeg',new Uint8Array([0xff,0xd8,0xff,0xd9]));
  await svc.upload(token,'selfie','me.jpg','image/jpeg',new Uint8Array([0xff,0xd8,0xff,0xd9]));
  await svc.upload(token,'support:resident_register','rr.pdf','application/pdf',new Uint8Array(Buffer.from('%PDF-1.4\n')));

  const required=issued.session.snapshot.consentProfile.requiredKeys;
  await svc.submit(token,{
    customer_name:'홍길동',customer_phone:'01012345678',customer_birth:'1983-09-26',customer_address:'서울시',
    driver_license_no:'11-11-111111-11',emergency_relation:'가족',emergency_name:'김가족',emergency_phone:'01099998888',
    signature:signature(),consents:required,summaryConfirmedAt:Date.now(),agreementReadAt:Date.now(),sectionConfirmations:{agreement:Date.now()},
  });

  assert.equal(repo.contract.get('c1')?.sign_status,'검토대기');
  assert.equal((await repo.getCurrentSession('c1'))?.status,'pending_review');

  const state=await svc.adminState('c1');
  assert.equal(state.stage,'검토 대기');
  assert.equal(state.attention.includes('승인 필요'),true);
  assert.equal(state.review?.customerName,'홍길동');

  await svc.reject('c1','면허증 다시 제출',['id_card'],'tester');
  assert.equal((await repo.getCurrentSession('c1'))?.status,'rejected');
  assert.equal(repo.contract.get('c1')?.sign_status,'반려');

  await svc.revoke('c1','tester');
  assert.equal((await repo.getCurrentSession('c1'))?.status,'revoked');
  assert.equal(repo.contract.get('c1')?.sign_status,'미발송');
});

test('esign issue fails closed before creating a session when public base is missing', async () => {
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  const repo=new Repo(), assets=new Assets(), svc=new EsignService(repo,assets);
  repo.contract.set('c1',contract());

  await assert.rejects(()=>svc.issue('c1'),/공개 주소/);
  assert.equal(repo.sessions.size,0);
  assert.equal(repo.contract.get('c1')?.sign_status,undefined);
});


test('intake contract handoff is immutable and idempotent', async () => {
  const repo=new Repo(), assets=new Assets(), svc=new EsignService(repo,assets);
  repo.intakes.set('stl_1',{
    intakeId:'stl_1',sourceDigest:'digest-v1',customerName:'홍길동',vehicleName:'GV70',plate:'12가3456',
    supplierCode:'SONO',supplierName:'손오공',rent:690000,termMonths:36,deposit:0,
    sourceProductId:'prd_1',sourceProductVersion:7,sourceOfferId:'off_36',sourceSnapshotId:'snap_1',
    catalogSnapshot:{capturedAt:'2026-09-22T00:00:00.000Z'},
  });

  const input={
    intakeId:'stl_1',customerPhone:'01012345678',customerType:'개인' as const,
    contractDate:'2026-09-25',contractKind:'rent_return',insuranceSide:'회사포함' as const,
  };
  const first=await svc.createContractFromIntake(input,'tester');
  const second=await svc.createContractFromIntake({...input,contractDate:'2026-10-01'},'tester');
  assert.equal(first.created,true);
  assert.equal(second.created,false);
  assert.equal(second.id,first.id);
  assert.equal(second.code,first.code);

  const stored=repo.contract.get(first.id)!;
  assert.equal(stored.source_intake_id,'stl_1');
  assert.equal(stored.source_product_id,'prd_1');
  assert.equal(stored.source_offer_id,'off_36');
  assert.equal(stored.contract_source_digest,'digest-v1');
  assert.equal((stored.contract_source_snapshot as ContractHandoffSource).rent,690000);

  repo.intakes.set('stl_1',{...repo.intakes.get('stl_1')!,sourceDigest:'digest-v2',rent:710000});
  const third=await svc.createContractFromIntake(input,'tester');
  assert.equal(third.created,false);
  assert.equal(repo.contract.get(first.id)?.rent_amount_snapshot,690000);
});


test('esign finalization claims once, seals immutable PDF, and is idempotent', async () => {
  const repo=new Repo(), assets=new Assets(), renderer=new Renderer(), svc=new EsignService(repo,assets,renderer);
  repo.contract.set('c1',contract());
  const snapshot=(await (async()=>{
    process.env.PUBLIC_BASE_URL='https://admin.example.test';
    const issued=await svc.issue('c1','tester');
    return issued.session.snapshot;
  })());
  const current=await repo.getCurrentSession('c1');
  assert.ok(current);
  current!.status='pending_review';
  current!.submittedAt=Date.now();

  const signatureAsset=await assets.put('sig.png',new Uint8Array([137,80,78,71,13,10,26,10]),'image/png');
  const idCard=await assets.put('id.jpg',new Uint8Array([0xff,0xd8,0xff,0xd9]),'image/jpeg');
  const selfie=await assets.put('selfie.jpg',new Uint8Array([0xff,0xd8,0xff,0xd9]),'image/jpeg');
  const requiredDocs=[];
  for(const d of snapshot.requiredDocuments.filter(d=>d.required)){
    const a=await assets.put('doc/'+d.key,new Uint8Array(Buffer.from('%PDF-1.4\n'+d.key)),'application/pdf');
    requiredDocs.push({key:d.key,path:a.path,sha256:a.sha256,label:d.label});
  }
  repo.priv.set(current!.id,{
    sessionId:current!.id,contractId:'c1',customerName:'홍길동',customerPhone:'01012345678',
    customerAddress:'서울시',emergencyRelation:'가족',emergencyName:'김가족',emergencyPhone:'01099998888',
    consents:[...snapshot.consentProfile.requiredKeys],consentTimes:{},sectionConfirmations:{},
    summaryConfirmedAt:Date.now(),agreementReadAt:Date.now(),
    signaturePath:signatureAsset.path,signatureSha256:signatureAsset.sha256,
    supportingDocuments:requiredDocs,submittedAt:Date.now(),
    assets:{id_card:{...idCard,name:'id.jpg',contentType:'image/jpeg'},selfie:{...selfie,name:'selfie.jpg',contentType:'image/jpeg'}},
  });

  const operation='finalize_1234567890abcdef';
  const first=await svc.approve('c1',operation,'tester');
  assert.equal(first.finalized,true);
  assert.equal(first.session.status,'signed');
  assert.equal(repo.contract.get('c1')?.sign_status,'서명완료');
  assert.equal(repo.contract.get('c1')?.contract_status,'계약완료');
  assert.match(String(repo.contract.get('c1')?.esign_document_sha256),/^[a-f0-9]{64}$/);
  assert.equal(String(repo.contract.get('c1')?.esign_template_version),snapshot.templateVersion);

  const second=await svc.approve('c1',operation,'tester');
  assert.equal(second.finalized,false);
  assert.equal(renderer.calls,1);
  assert.equal(repo.events.filter(e=>e.type==='approved').length,1);
});

test('esign finalization fails closed when PDF renderer is unavailable', async () => {
  const repo=new Repo(), assets=new Assets(), svc=new EsignService(repo,assets);
  repo.contract.set('c1',contract());
  await assert.rejects(()=>svc.approve('c1','finalize_1234567890abcdef','tester'),/PDF 생성기/);
  assert.equal(repo.contract.get('c1')?.sign_status,undefined);
});


test('esign finalization blocks concurrent retry with the same finalization id', async () => {
  const repo=new Repo(), assets=new Assets(), renderer=new Renderer(), svc=new EsignService(repo,assets,renderer);
  repo.contract.set('c1',contract());
  process.env.PUBLIC_BASE_URL='https://admin.example.test';
  const issued=await svc.issue('c1','tester');
  const session=await repo.getCurrentSession('c1');
  assert.ok(session);
  session!.status='approving';
  session!.approvingAt=Date.now();
  session!.finalizationId='finalize_1234567890abcdef';

  await assert.rejects(
    ()=>svc.approve('c1','finalize_1234567890abcdef','tester'),
    /같은 승인 요청이 처리 중/,
  );
  assert.equal(renderer.calls,0);
});


test('esign finalization does not sign when stored PDF read-back fails', async () => {
  const repo=new Repo(), assets=new ReadbackFailAssets(), renderer=new Renderer(), svc=new EsignService(repo,assets,renderer);
  repo.contract.set('c1',contract());
  process.env.PUBLIC_BASE_URL='https://admin.example.test';
  const issued=await svc.issue('c1','tester');
  const session=await repo.getCurrentSession('c1');
  assert.ok(session);
  session!.status='pending_review';
  session!.submittedAt=Date.now();

  const signatureAsset=await assets.put('sig.png',new Uint8Array([137,80,78,71,13,10,26,10]),'image/png');
  const idCard=await assets.put('id.jpg',new Uint8Array([0xff,0xd8,0xff,0xd9]),'image/jpeg');
  const selfie=await assets.put('selfie.jpg',new Uint8Array([0xff,0xd8,0xff,0xd9]),'image/jpeg');
  const requiredDocs=[];
  for(const d of issued.session.snapshot.requiredDocuments.filter(d=>d.required)){
    const a=await assets.put('doc/'+d.key,new Uint8Array(Buffer.from('%PDF-1.4\n'+d.key)),'application/pdf');
    requiredDocs.push({key:d.key,path:a.path,sha256:a.sha256,label:d.label});
  }
  repo.priv.set(session!.id,{
    sessionId:session!.id,contractId:'c1',customerName:'홍길동',customerPhone:'01012345678',
    customerAddress:'서울시',emergencyRelation:'가족',emergencyName:'김가족',emergencyPhone:'01099998888',
    consents:[...issued.session.snapshot.consentProfile.requiredKeys],consentTimes:{},sectionConfirmations:{},
    summaryConfirmedAt:Date.now(),agreementReadAt:Date.now(),
    signaturePath:signatureAsset.path,signatureSha256:signatureAsset.sha256,
    supportingDocuments:requiredDocs,submittedAt:Date.now(),
    assets:{id_card:{...idCard,name:'id.jpg',contentType:'image/jpeg'},selfie:{...selfie,name:'selfie.jpg',contentType:'image/jpeg'}},
  });

  await assert.rejects(
    ()=>svc.approve('c1','finalize_readback_1234567890','tester'),
    /재조회 검증/,
  );
  assert.equal((await repo.getCurrentSession('c1'))?.status,'pending_review');
  assert.notEqual(repo.contract.get('c1')?.sign_status,'서명완료');
});


test('admin journey: intake -> contract -> esign submit -> approve -> signed', async () => {
  process.env.PUBLIC_BASE_URL='https://admin.example.test';
  const repo=new Repo(), assets=new Assets(), renderer=new Renderer(), svc=new EsignService(repo,assets,renderer);
  repo.intakes.set('stl_e2e',{
    intakeId:'stl_e2e',sourceDigest:'digest-e2e',customerName:'홍길동',vehicleName:'GV70',plate:'12가3456',
    supplierCode:'SONO',supplierName:'손오공',rent:690000,termMonths:36,deposit:0,
    sourceProductId:'prd_e2e',sourceProductVersion:9,sourceOfferId:'off_e2e',sourceSnapshotId:'snap_e2e',
    catalogSnapshot:{capturedAt:'2026-09-25T00:00:00.000Z'},
  });

  const created=await svc.createContractFromIntake({
    intakeId:'stl_e2e',customerPhone:'01012345678',customerType:'개인',
    contractDate:'2026-09-25',contractKind:'rent_return',insuranceSide:'회사포함',
  },'tester');
  assert.equal(created.created,true);
  assert.equal(repo.contract.get(created.id)?.source_intake_id,'stl_e2e');
  assert.equal(repo.contract.get(created.id)?.source_offer_id,'off_e2e');

  const issued=await svc.issue(created.id,'tester');
  const token=issued.publicUrl.split('/').pop()!;
  await svc.publicView(token);
  await svc.progress(token,'summary');
  await svc.progress(token,'document');
  await svc.upload(token,'id_card','id.jpg','image/jpeg',new Uint8Array([0xff,0xd8,0xff,0xd9]));
  await svc.upload(token,'selfie','me.jpg','image/jpeg',new Uint8Array([0xff,0xd8,0xff,0xd9]));
  for(const d of issued.session.snapshot.requiredDocuments.filter(d=>d.required)){
    await svc.upload(token,'support:'+d.key,d.key+'.pdf','application/pdf',new Uint8Array(Buffer.from('%PDF-1.4\n'+d.key)));
  }

  await svc.submit(token,{
    customer_name:'홍길동',customer_phone:'01012345678',customer_birth:'1983-09-26',customer_address:'서울시',
    driver_license_no:'11-11-111111-11',emergency_relation:'가족',emergency_name:'김가족',emergency_phone:'01099998888',
    signature:signature(),consents:issued.session.snapshot.consentProfile.requiredKeys,
    summaryConfirmedAt:Date.now(),agreementReadAt:Date.now(),sectionConfirmations:{agreement:Date.now()},
  });
  assert.equal((await repo.getCurrentSession(created.id))?.status,'pending_review');

  const approved=await svc.approve(created.id,'finalize_e2e_1234567890','tester');
  assert.equal(approved.finalized,true);
  assert.equal(approved.session.status,'signed');
  assert.equal(repo.contract.get(created.id)?.sign_status,'서명완료');
  assert.equal(repo.contract.get(created.id)?.contract_status,'계약완료');
  assert.equal(repo.contract.get(created.id)?.source_intake_id,'stl_e2e');
  assert.match(String(repo.contract.get(created.id)?.esign_document_sha256),/^[a-f0-9]{64}$/);
});
