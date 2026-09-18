import { createHash } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { erp5, erp5App, ERP5_PROJECT_ID } from './firestore';
import { WriteDisabledError, writeEnabled } from './settlement-repository';
import type { EsignAssetStore, EsignRepository } from '../../ports/esign/repositories';
import type { EsignPrivateSubmission, EsignSession } from '../../domain/esign/types';

const CONTRACTS='contract';
const SESSIONS='esign_session';
const PRIVATE='esign_private';
const EVENTS='esign_event';

const mustWrite=()=>{if(!writeEnabled()) throw new WriteDisabledError();};
const clean=<T extends Record<string,unknown>>(x:T)=>Object.fromEntries(Object.entries(x).filter(([,v])=>v!==undefined)) as T;

export class Erp5EsignRepository implements EsignRepository {
  async getContract(id:string){
    const d=await erp5().collection(CONTRACTS).doc(id).get();
    return d.exists ? ({ id:d.id, ...d.data() } as Record<string,unknown>) : null;
  }

  async createContract(id:string,data:Record<string,unknown>){
    mustWrite();
    const ref=erp5().collection(CONTRACTS).doc(id);
    await erp5().runTransaction(async tx=>{
      const d=await tx.get(ref);
      if(d.exists) throw new Error('같은 계약 ID가 이미 있습니다.');
      tx.create(ref,clean(data));
    });
  }

  async updateContract(id:string,patch:Record<string,unknown>){
    mustWrite();
    await erp5().collection(CONTRACTS).doc(id).update(clean({...patch,updated_at:Date.now()}));
  }

  async getCurrentSession(contractId:string):Promise<EsignSession|null>{
    const q=await erp5().collection(SESSIONS).where('contractId','==',contractId).get();
    const rows=q.docs.map(d=>({id:d.id,...d.data()} as EsignSession)).sort((a,b)=>b.issuedAt-a.issuedAt);
    return rows[0]??null;
  }

  async getSession(id:string):Promise<EsignSession|null>{
    const d=await erp5().collection(SESSIONS).doc(id).get();
    return d.exists ? ({id:d.id,...d.data()} as EsignSession) : null;
  }

  async findSessionByTokenHash(hash:string):Promise<EsignSession|null>{
    const q=await erp5().collection(SESSIONS).where('tokenHash','==',hash).limit(1).get();
    const d=q.docs[0]; return d?({id:d.id,...d.data()} as EsignSession):null;
  }

  async createSession(session:EsignSession,publicUrl:string){
    mustWrite();
    const db=erp5();
    const old=await db.collection(SESSIONS).where('contractId','==',session.contractId).get();
    const batch=db.batch();
    for(const d of old.docs){
      const x=d.data() as Partial<EsignSession>;
      if(!['signed','revoked'].includes(String(x.status))) batch.update(d.ref,{status:'revoked',revokedAt:Date.now()});
    }
    batch.create(db.collection(SESSIONS).doc(session.id),clean(session as unknown as Record<string,unknown>));
    batch.set(db.collection(PRIVATE).doc(session.id),{sessionId:session.id,contractId:session.contractId,publicUrl,createdAt:Date.now()},{merge:true});
    await batch.commit();
  }

  async updateSession(id:string,patch:Partial<EsignSession>){
    mustWrite();
    await erp5().collection(SESSIONS).doc(id).update(clean(patch as unknown as Record<string,unknown>));
  }

  async getPrivate(sessionId:string):Promise<(EsignPrivateSubmission&Record<string,unknown>)|null>{
    const d=await erp5().collection(PRIVATE).doc(sessionId).get();
    return d.exists ? d.data() as EsignPrivateSubmission&Record<string,unknown> : null;
  }

  async putPrivate(sessionId:string,data:Record<string,unknown>){
    mustWrite();
    await erp5().collection(PRIVATE).doc(sessionId).set(clean(data),{merge:true});
  }

  async appendEvent(contractId:string,sessionId:string,type:string,by:string,detail:Record<string,unknown>={}){
    mustWrite();
    await erp5().collection(EVENTS).add(clean({contractId,sessionId,type,by,at:Date.now(),...detail}));
  }
}

export class Erp5EsignAssetStore implements EsignAssetStore {
  private bucket(){
    const configured=process.env.ERP5_STORAGE_BUCKET?.trim();
    return getStorage(erp5App()).bucket(configured || `${ERP5_PROJECT_ID}.appspot.com`);
  }
  async put(path:string,bytes:Uint8Array,contentType:string){
    mustWrite();
    const file=this.bucket().file(path);
    await file.save(Buffer.from(bytes),{resumable:false,contentType,metadata:{cacheControl:'private,no-store'}});
    const sha256=createHash('sha256').update(bytes).digest('hex');
    return {path,sha256,size:bytes.byteLength};
  }
  async get(path:string,expectedSha256?:string){
    try{
      const file=this.bucket().file(path);
      const [meta]=await file.getMetadata();
      const [buf]=await file.download();
      const bytes=new Uint8Array(buf);
      if(expectedSha256&&createHash('sha256').update(bytes).digest('hex')!==expectedSha256)return null;
      return {bytes,contentType:String(meta.contentType||'application/octet-stream')};
    }catch{return null;}
  }
}

export const esignRepository=new Erp5EsignRepository();
export const esignAssets=new Erp5EsignAssetStore();
