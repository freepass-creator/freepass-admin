import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { EsignService } from './service';
import type { EsignAssetStore, EsignRepository } from '../../ports/esign/repositories';
import type { EsignPrivateSubmission, EsignSession } from '../../domain/esign/types';

class Repo implements EsignRepository {
  contract = new Map<string, Record<string, unknown>>();
  sessions = new Map<string, EsignSession>();
  priv = new Map<string, Record<string, unknown>>();
  events: Array<{ contractId:string; sessionId:string; type:string; at:number; by:string; detail:Record<string,unknown> }> = [];

  async getContract(id:string){return this.contract.get(id)??null;}
  async createContract(id:string,data:Record<string,unknown>){if(this.contract.has(id))throw new Error('dup');this.contract.set(id,{id,...structuredClone(data)});}
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
  async getPrivate(id:string){return (this.priv.get(id)??null) as (EsignPrivateSubmission&Record<string,unknown>)|null;}
  async putPrivate(id:string,data:Record<string,unknown>){this.priv.set(id,{...(this.priv.get(id)||{}),...structuredClone(data)});}
  async appendEvent(contractId:string,sessionId:string,type:string,by:string,detail:Record<string,unknown>={}){
    this.events.push({contractId,sessionId,type,by,detail:structuredClone(detail),at:Date.now()});
  }
  async listEvents(contractId:string){
    return this.events.filter(x=>x.contractId===contractId).map(({type,at,by,detail})=>({type,at,by,detail})).sort((a,b)=>b.at-a.at);
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
