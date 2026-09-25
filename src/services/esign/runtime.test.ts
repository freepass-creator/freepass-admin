import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { EsignService } from './service';
import type { EsignAssetStore, EsignFinalDocumentRenderer, EsignRepository } from '../../ports/esign/repositories';
import type { ContractHandoffSource, EsignPrivateSubmission, EsignSession } from '../../domain/esign/types';
import { claimIsFresh, FINALIZE_CLAIM_TTL, SUBMIT_CLAIM_TTL } from '../../domain/esign/claim-ttl';

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
  async updateContract(id:string,patch:Record<string,unknown>){
    const current=this.contract.get(id); if(!current)throw new Error('missing contract');
    if(/취소|철회|해지/.test(String(current.contract_status??''))){
      throw new Error('취소·철회·해지 계약의 전자계약 상태는 변경할 수 없습니다.');
    }
    this.contract.set(id,{...current,...structuredClone(patch)});
  }
  async getCurrentSession(contractId:string){return [...this.sessions.values()].filter(x=>x.contractId===contractId).sort((a,b)=>b.issuedAt-a.issuedAt)[0]??null;}
  async getSession(id:string){return this.sessions.get(id)??null;}
  async findSessionByTokenHash(hash:string){return [...this.sessions.values()].find(x=>x.tokenHash===hash)??null;}
  async issueSession(
    session:EsignSession,
    publicUrl:string,
    contractPatch:Record<string,unknown>,
    actor:string,
  ){
    const current=this.contract.get(session.contractId); if(!current)throw new Error('missing contract');
    if(/취소|철회|해지/.test(String(current.contract_status??'')))throw new Error('계약 상태상 발행할 수 없습니다.');
    if(String(current.sign_status??'')==='서명완료')throw new Error('이미 서명완료된 계약입니다.');
    const old=await this.getCurrentSession(session.contractId);
    if(old?.status==='signed')throw new Error('이미 서명완료된 계약입니다.');
    if(old&&!['signed','revoked'].includes(old.status)){old.status='revoked';old.revokedAt=Date.now();}
    this.sessions.set(session.id,structuredClone(session));
    this.priv.set(session.id,{sessionId:session.id,contractId:session.contractId,publicUrl});
    this.contract.set(session.contractId,{...current,...structuredClone(contractPatch)});
    this.events.push({contractId:session.contractId,sessionId:session.id,type:'issued',by:actor,detail:{revision:session.revision},at:Date.now()});
  }

  async updateSession(id:string,patch:Partial<EsignSession>){Object.assign(this.sessions.get(id)!,structuredClone(patch));}
  async transitionSession(id:string,allowed:EsignSession['status'][],patch:Partial<EsignSession>){
    const s=this.sessions.get(id); if(!s||!allowed.includes(s.status)) return false;
    Object.assign(s,structuredClone(patch)); return true;
  }
  async cancelContract(contractId:string,reason:string,actor:string){
    const contract=this.contract.get(contractId); if(!contract)throw new Error('missing contract');
    if(!reason.trim())throw new Error('계약 취소 사유를 적어 주세요.');
    const session=await this.getCurrentSession(contractId);
    if(contract.contract_status==='계약취소'){
      if(contract.contract_cancel_reason&&contract.contract_cancel_reason!==reason.trim()){
        throw new Error('이미 다른 사유로 계약취소 처리된 계약입니다 — 기존 취소 기록을 확인해 주세요.');
      }
      if(session&&!['signed','revoked'].includes(session.status)){
        session.status='revoked';
        session.revokedAt=Date.now();
      }
      return {cancelled:false,session:session?structuredClone(session):null,signedDocumentPreserved:session?.status==='signed'};
    }
    if(contract.__testDelivered)throw new Error('이미 인도된 계약은 계약취소가 아니라 계약해지 절차로 처리합니다.');
    if(contract.__testSettlementStarted)throw new Error('정산 흔적이 있는 계약은 계약취소로 처리할 수 없습니다 — 데이터 상태를 확인한 뒤 계약해지 절차를 사용합니다.');
    const now=Date.now();
    if(session?.status==='approving'&&claimIsFresh(session.approvingAt,now,FINALIZE_CLAIM_TTL))throw new Error('전자계약 승인 처리 중입니다');
    if(session?.status==='submitting'&&claimIsFresh(session.submittingAt,now,SUBMIT_CLAIM_TTL))throw new Error('고객 제출 처리 중입니다');

    const signedDocumentPreserved=session?.status==='signed';
    let nextSession=session?structuredClone(session):null;
    if(session&&!['signed','revoked'].includes(session.status)){
      session.status='revoked';
      session.revokedAt=Date.now();
      nextSession=structuredClone(session);
    }
    this.contract.set(contractId,{
      ...contract,
      contract_status:'계약취소',
      contract_cancel_reason:reason.trim(),
      cancelled:true,
      settleExclude:true,
    });
    this.events.push({contractId,sessionId:session?.id??'',type:'contract_cancelled',by:actor,detail:{reason:reason.trim(),signedDocumentPreserved},at:Date.now()});
    return {cancelled:true,session:nextSession,signedDocumentPreserved};
  }
  async revokeSession(sessionId:string,contractId:string,actor:string){
    const session=this.sessions.get(sessionId); if(!session)throw new Error('missing');
    if(session.status==='signed')throw new Error('서명완료 계약의 전자계약 발행은 철회할 수 없습니다.');
    if(session.status==='revoked')return {revoked:false,session:structuredClone(session)};
    if(!['sent','opened','in_progress','rejected'].includes(session.status))throw new Error('제출·승인 처리 중인 링크는 철회할 수 없습니다.');
    session.status='revoked'; session.revokedAt=Date.now();
    this.contract.set(contractId,{...(this.contract.get(contractId)||{}),sign_status:'미발송',sign_revoked_at:Date.now(),esign_progress:0});
    this.events.push({contractId,sessionId,type:'revoked',by:actor,detail:{},at:Date.now()});
    return {revoked:true,session:structuredClone(session)};
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

function completeFakePdf(){
  return new Uint8Array(Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.alloc(2_048,0x20),
    Buffer.from('\n%%EOF\n'),
  ]));
}

class Renderer implements EsignFinalDocumentRenderer {
  calls=0;
  async render(){this.calls+=1;return {bytes:completeFakePdf(),contentType:'application/pdf' as const};}
}

class InvalidRenderer implements EsignFinalDocumentRenderer {
  calls=0;
  async render(){
    this.calls+=1;
    return {bytes:new Uint8Array(Buffer.from('%PDF-1.4\ntruncated')),contentType:'application/pdf' as const};
  }
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

class ReadbackFailAssets extends Assets {
  async get(path:string,expected?:string){
    if(path.startsWith('esign-final/'))return null;
    return super.get(path,expected);
  }
}

class HashMismatchAssets extends Assets {
  async put(path:string,bytes:Uint8Array,contentType:string){
    const stored=await super.put(path,bytes,contentType);
    return path.startsWith('esign-final/')
      ? {...stored,sha256:'0'.repeat(64)}
      : stored;
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


async function seedPendingReview(
  svc:EsignService,
  repo:Repo,
  assets:Assets,
  options:{missingSignature?:boolean;missingRequiredDocument?:boolean}={},
){
  process.env.PUBLIC_BASE_URL='https://admin.example.test';
  repo.contract.set('c1',contract());
  const issued=await svc.issue('c1','tester');
  const session=await repo.getCurrentSession('c1');
  assert.ok(session);
  session!.status='pending_review';
  session!.submittedAt=Date.now();

  let signaturePath='',signatureSha256='';
  if(!options.missingSignature){
    const signatureAsset=await assets.put(
      'sig.png',
      new Uint8Array([137,80,78,71,13,10,26,10]),
      'image/png',
    );
    signaturePath=signatureAsset.path;
    signatureSha256=signatureAsset.sha256;
  }
  const idCard=await assets.put('id.jpg',new Uint8Array([0xff,0xd8,0xff,0xd9]),'image/jpeg');
  const selfie=await assets.put('selfie.jpg',new Uint8Array([0xff,0xd8,0xff,0xd9]),'image/jpeg');
  const required=issued.session.snapshot.requiredDocuments.filter(d=>d.required);
  const supportingDocuments=[];
  for(let i=0;i<required.length;i++){
    if(options.missingRequiredDocument&&i===0)continue;
    const d=required[i]!;
    const a=await assets.put('doc/'+d.key,new Uint8Array(Buffer.from('%PDF-1.4\n'+d.key)),'application/pdf');
    supportingDocuments.push({key:d.key,path:a.path,sha256:a.sha256,label:d.label});
  }
  if(options.missingRequiredDocument)assert.ok(required.length>0);

  repo.priv.set(session!.id,{
    sessionId:session!.id,contractId:'c1',customerName:'홍길동',customerPhone:'01012345678',
    customerAddress:'서울시',emergencyRelation:'가족',emergencyName:'김가족',emergencyPhone:'01099998888',
    consents:[...issued.session.snapshot.consentProfile.requiredKeys],consentTimes:{},sectionConfirmations:{},
    summaryConfirmedAt:Date.now(),agreementReadAt:Date.now(),
    signaturePath,signatureSha256,supportingDocuments,submittedAt:Date.now(),
    assets:{id_card:{...idCard,name:'id.jpg',contentType:'image/jpeg'},selfie:{...selfie,name:'selfie.jpg',contentType:'image/jpeg'}},
  });
  return {issued,session:session!};
}

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


test('esign revoke is idempotent before signed and signed remains immutable', async () => {
  process.env.PUBLIC_BASE_URL='https://admin.example.test';
  const repo=new Repo(), assets=new Assets(), svc=new EsignService(repo,assets);
  repo.contract.set('c1',contract());
  const issued=await svc.issue('c1','tester');

  await svc.revoke('c1','tester');
  assert.equal((await repo.getCurrentSession('c1'))?.status,'revoked');
  assert.equal(repo.contract.get('c1')?.sign_status,'미발송');

  await svc.revoke('c1','tester');
  assert.equal(repo.events.filter(e=>e.type==='revoked').length,1);

  const s=repo.sessions.get(issued.session.id)!;
  s.status='signed';
  s.finalizationId='finalize_signed_immutable';
  await assert.rejects(()=>svc.revoke('c1','tester'),/서명완료/);
  assert.equal(s.status,'signed');
});


test('signed contract cancellation before delivery preserves signed receipt and creates no settlement work', async () => {
  const repo=new Repo(), assets=new Assets(), renderer=new Renderer(), svc=new EsignService(repo,assets,renderer);
  repo.contract.set('c1',{...contract(),contract_status:'계약완료'});
  const session:EsignSession={
    id:'esg_signed_cancel',contractId:'c1',contractCode:'FP-1',tokenHash:'x',status:'signed',revision:1,
    issuedAt:1,issuedBy:'tester',expiresAt:2,progress:{},snapshot:{} as EsignSession['snapshot'],
    finalizationId:'finalize_cancel_test',documentSha256:'a'.repeat(64),documentStoragePath:'esign-final/FP-1/esg_signed_cancel.pdf',
  };
  repo.sessions.set(session.id,session);

  const first=await svc.cancelContract('c1','출고 전 고객 취소','tester');
  assert.equal(first.cancelled,true);
  assert.equal((await repo.getCurrentSession('c1'))?.status,'signed');
  assert.equal(repo.contract.get('c1')?.contract_status,'계약취소');
  assert.equal(repo.contract.get('c1')?.settleExclude,true);

  const second=await svc.cancelContract('c1','출고 전 고객 취소','tester');
  assert.equal(second.cancelled,false);
  assert.equal(repo.events.filter(e=>e.type==='contract_cancelled').length,1);
});

test('delivered or settlement-started contract must use termination instead of cancellation', async () => {
  const repo=new Repo(), assets=new Assets(), svc=new EsignService(repo,assets);
  const signed=(id:string):EsignSession=>({
    id,contractId:'c1',contractCode:'FP-1',tokenHash:'x',status:'signed',revision:1,
    issuedAt:1,issuedBy:'tester',expiresAt:2,progress:{},snapshot:{} as EsignSession['snapshot'],
    finalizationId:'finalize_'+id,
  });

  repo.contract.set('c1',{...contract(),contract_status:'계약완료',__testDelivered:true});
  repo.sessions.set('esg_delivered',signed('esg_delivered'));
  await assert.rejects(()=>svc.cancelContract('c1','취소','tester'),/계약해지/);

  repo.sessions.clear();
  repo.contract.set('c1',{...contract(),contract_status:'계약완료',__testSettlementStarted:true});
  repo.sessions.set('esg_settlement',signed('esg_settlement'));
  await assert.rejects(()=>svc.cancelContract('c1','취소','tester'),/계약해지/);
});


test('contract cancellation works before esign issuance and revokes an active signing session', async () => {
  const repo=new Repo(), assets=new Assets(), svc=new EsignService(repo,assets);

  repo.contract.set('c1',{...contract(),contract_status:'계약대기'});
  const noSession=await svc.cancelContract('c1','계약 접수 취소','tester');
  assert.equal(noSession.cancelled,true);
  assert.equal(noSession.session,null);
  assert.equal(noSession.signedDocumentPreserved,false);
  assert.equal(repo.contract.get('c1')?.contract_status,'계약취소');

  repo.contract.set('c2',{...contract(),contract_status:'계약대기'});
  repo.sessions.set('esg_active',{
    id:'esg_active',contractId:'c2',contractCode:'FP-2',tokenHash:'x2',status:'opened',revision:1,
    issuedAt:1,issuedBy:'tester',expiresAt:2,progress:{},snapshot:{} as EsignSession['snapshot'],
  });
  const active=await svc.cancelContract('c2','출고 전 취소','tester');
  assert.equal(active.cancelled,true);
  assert.equal(active.session?.status,'revoked');
  assert.equal(active.signedDocumentPreserved,false);
  assert.equal(repo.contract.get('c2')?.contract_status,'계약취소');
});



test('esign finalization rejects truncated PDF bytes before Storage/signing', async () => {
  const repo=new Repo(), assets=new Assets(), renderer=new InvalidRenderer(), svc=new EsignService(repo,assets,renderer);
  await seedPendingReview(svc,repo,assets);
  await assert.rejects(
    ()=>svc.approve('c1','finalize_invalid_pdf_1234567890','tester'),
    /완전한 PDF/,
  );
  assert.equal(renderer.calls,1);
  assert.equal((await repo.getCurrentSession('c1'))?.status,'pending_review');
  assert.notEqual(repo.contract.get('c1')?.sign_status,'서명완료');
  assert.equal([...assets.m.keys()].some(path=>path.startsWith('esign-final/')),false);
});

test('esign finalization rejects Storage upload hash mismatch', async () => {
  const repo=new Repo(), assets=new HashMismatchAssets(), renderer=new Renderer(), svc=new EsignService(repo,assets,renderer);
  await seedPendingReview(svc,repo,assets);
  await assert.rejects(
    ()=>svc.approve('c1','finalize_hash_mismatch_1234567890','tester'),
    /저장 검증/,
  );
  assert.equal(renderer.calls,1);
  assert.equal((await repo.getCurrentSession('c1'))?.status,'pending_review');
  assert.notEqual(repo.contract.get('c1')?.sign_status,'서명완료');
});

test('esign finalization rejects a missing verified signature before rendering', async () => {
  const repo=new Repo(), assets=new Assets(), renderer=new Renderer(), svc=new EsignService(repo,assets,renderer);
  await seedPendingReview(svc,repo,assets,{missingSignature:true});
  await assert.rejects(
    ()=>svc.approve('c1','finalize_no_signature_1234567890','tester'),
    /서명 원본/,
  );
  assert.equal(renderer.calls,0);
  assert.equal((await repo.getCurrentSession('c1'))?.status,'pending_review');
});

test('esign finalization rejects a missing required document before rendering', async () => {
  const repo=new Repo(), assets=new Assets(), renderer=new Renderer(), svc=new EsignService(repo,assets,renderer);
  await seedPendingReview(svc,repo,assets,{missingRequiredDocument:true});
  await assert.rejects(
    ()=>svc.approve('c1','finalize_missing_doc_1234567890','tester'),
    /필수 서류/,
  );
  assert.equal(renderer.calls,0);
  assert.equal((await repo.getCurrentSession('c1'))?.status,'pending_review');
});


test('contract cancellation retry repairs an active signing session and rejects reason drift', async () => {
  const repo=new Repo(), assets=new Assets(), svc=new EsignService(repo,assets);
  repo.contract.set('c1',{...contract(),contract_status:'계약취소',contract_cancel_reason:'고객 변심'});
  repo.sessions.set('esg_cancel_repair',{
    id:'esg_cancel_repair',contractId:'c1',contractCode:'FP-1',tokenHash:'x',status:'opened',revision:1,
    issuedAt:1,issuedBy:'tester',expiresAt:2,progress:{},snapshot:{} as EsignSession['snapshot'],
  });

  const repaired=await svc.cancelContract('c1','고객 변심','tester');
  assert.equal(repaired.cancelled,false);
  assert.equal(repaired.session?.status,'revoked');

  await assert.rejects(
    ()=>svc.cancelContract('c1','다른 사유','tester'),
    /다른 사유/,
  );
});


test('terminated contract cannot issue a new esign session', async () => {
  process.env.PUBLIC_BASE_URL='https://admin.example.test';
  const repo=new Repo(), assets=new Assets(), svc=new EsignService(repo,assets);
  repo.contract.set('c1',{...contract(),contract_status:'계약해지',sign_status:'서명완료'});
  await assert.rejects(()=>svc.issue('c1','tester'),/해지 계약/);
  assert.equal(repo.sessions.size,0);
});


test('stale esign contract update is blocked after cancellation', async () => {
  const repo=new Repo();
  repo.contract.set('c1',{...contract(),contract_status:'계약취소'});
  await assert.rejects(
    ()=>repo.updateContract('c1',{sign_status:'열람'}),
    /변경할 수 없습니다/,
  );
  assert.notEqual(repo.contract.get('c1')?.sign_status,'열람');
});


test('contract cancellation respects fresh claims but recovers stale claims', async () => {
  const repo=new Repo(), assets=new Assets(), svc=new EsignService(repo,assets);
  const mk=(id:string,status:'approving'|'submitting',at:number):EsignSession=>({
    id,contractId:'c1',contractCode:'FP-1',tokenHash:id,status,revision:1,
    issuedAt:1,issuedBy:'tester',expiresAt:Date.now()+100000,progress:{},snapshot:{} as EsignSession['snapshot'],
    ...(status==='approving'?{approvingAt:at,finalizationId:'finalize_claim_fresh_1234'}:{submittingAt:at}),
  });

  repo.contract.set('c1',{...contract(),contract_status:'계약완료'});
  repo.sessions.set('fresh_approve',mk('fresh_approve','approving',Date.now()));
  await assert.rejects(()=>svc.cancelContract('c1','취소','tester'),/승인 처리 중/);

  repo.sessions.clear();
  repo.sessions.set('stale_approve',mk('stale_approve','approving',Date.now()-FINALIZE_CLAIM_TTL-1));
  const staleApprove=await svc.cancelContract('c1','취소','tester');
  assert.equal(staleApprove.cancelled,true);
  assert.equal(staleApprove.session?.status,'revoked');

  repo.contract.set('c2',{...contract(),contract_status:'계약완료'});
  repo.sessions.clear();
  repo.sessions.set('fresh_submit',{
    ...mk('fresh_submit','submitting',Date.now()),
    contractId:'c2',
  });
  await assert.rejects(()=>svc.cancelContract('c2','취소','tester'),/제출 처리 중/);

  repo.sessions.clear();
  repo.sessions.set('stale_submit',{
    ...mk('stale_submit','submitting',Date.now()-SUBMIT_CLAIM_TTL-1),
    contractId:'c2',
  });
  const staleSubmit=await svc.cancelContract('c2','취소','tester');
  assert.equal(staleSubmit.cancelled,true);
  assert.equal(staleSubmit.session?.status,'revoked');
});
