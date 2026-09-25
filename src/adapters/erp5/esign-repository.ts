import { createHash } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { erp5, erp5App, ERP5_PROJECT_ID } from './firestore';
import { WriteDisabledError, writeEnabled } from './settlement-repository';
import type { EsignAssetStore, EsignRepository } from '../../ports/esign/repositories';
import type { ContractHandoffSource, EsignPrivateSubmission, EsignSession } from '../../domain/esign/types';
import { withContractHandoffDigest } from '../../domain/esign/handoff';
import { toSettlementRow } from './to-settlement';

const CONTRACTS='contract';
const SESSIONS='esign_session';
const PRIVATE='esign_private';
const EVENTS='esign_event';
const LOCKS='esign_issue_lock';
const INTAKES='settlement_rows';

const mustWrite=()=>{if(!writeEnabled()) throw new WriteDisabledError();};
const clean=<T extends Record<string,unknown>>(x:T)=>Object.fromEntries(Object.entries(x).filter(([,v])=>v!==undefined)) as T;

export class Erp5EsignRepository implements EsignRepository {
  async getContract(id:string){
    const d=await erp5().collection(CONTRACTS).doc(id).get();
    return d.exists ? ({ id:d.id, ...d.data() } as Record<string,unknown>) : null;
  }

  private handoffSource(id:string, raw:Record<string,unknown>):ContractHandoffSource{
    const { row }=toSettlementRow(raw,id);
    return withContractHandoffDigest({
      intakeId:id,
      customerName:String(row.customer??'').trim(),
      vehicleName:String(row.model??'').trim(),
      plate:row.plate,
      supplierCode:row.supplierCode,
      supplierName:row.supplier,
      rent:row.rent,
      termMonths:row.term,
      deposit:row.deposit,
      sourceProductId:row.catalogRef?.productId??null,
      sourceProductVersion:row.catalogRef?.productVersion??null,
      sourceOfferId:row.catalogRef?.offerId??null,
      sourceSnapshotId:row.catalogRef?.sourceSnapshotId??null,
      catalogSnapshot:(row.catalogSnapshot??null) as Record<string,unknown>|null,
    });
  }

  async getIntakeContractSource(intakeId:string){
    const d=await erp5().collection(INTAKES).doc(intakeId).get();
    return d.exists ? this.handoffSource(d.id,d.data() as Record<string,unknown>) : null;
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

  async createContractFromIntake(source:ContractHandoffSource,id:string,data:Record<string,unknown>){
    mustWrite();
    const db=erp5(), contractRef=db.collection(CONTRACTS).doc(id), intakeRef=db.collection(INTAKES).doc(source.intakeId);
    return db.runTransaction(async tx=>{
      const [existing,intake]=await Promise.all([tx.get(contractRef),tx.get(intakeRef)]);
      if(existing.exists)return {created:false};
      if(!intake.exists)throw new Error('접수를 찾을 수 없습니다.');
      const current=this.handoffSource(intake.id,intake.data() as Record<string,unknown>);
      if(current.sourceDigest!==source.sourceDigest)throw new Error('접수 정보가 변경되었습니다 — 다시 불러온 뒤 계약을 만들어 주세요.');
      tx.create(contractRef,clean(data));
      return {created:true};
    });
  }

  async updateContract(id:string,patch:Record<string,unknown>){
    mustWrite();
    await erp5().collection(CONTRACTS).doc(id).update(clean({...patch,updated_at:Date.now()}));
  }

  async getCurrentSession(contractId:string):Promise<EsignSession|null>{
    const db=erp5();
    const lock=await db.collection(LOCKS).doc(contractId).get();
    const currentId=String(lock.data()?.currentSessionId??'');
    if(currentId){
      const d=await db.collection(SESSIONS).doc(currentId).get();
      if(d.exists)return {id:d.id,...d.data()} as EsignSession;
    }
    const q=await db.collection(SESSIONS).where('contractId','==',contractId).get();
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
    const db=erp5(), lockRef=db.collection(LOCKS).doc(session.contractId);
    await db.runTransaction(async tx=>{
      const lock=await tx.get(lockRef);
      const oldId=String(lock.data()?.currentSessionId??'');
      if(oldId&&oldId!==session.id){
        const oldRef=db.collection(SESSIONS).doc(oldId), old=await tx.get(oldRef);
        if(old.exists&&!['signed','revoked'].includes(String(old.data()?.status))){
          tx.update(oldRef,{status:'revoked',revokedAt:Date.now()});
        }
      }
      const nextRef=db.collection(SESSIONS).doc(session.id);
      const existing=await tx.get(nextRef);
      if(existing.exists)throw new Error('같은 전자계약 세션이 이미 있습니다.');
      tx.create(nextRef,clean(session as unknown as Record<string,unknown>));
      tx.set(db.collection(PRIVATE).doc(session.id),{sessionId:session.id,contractId:session.contractId,publicUrl,createdAt:Date.now()},{merge:true});
      tx.set(lockRef,{currentSessionId:session.id,issuedAt:session.issuedAt,revision:session.revision},{merge:true});
    });
  }

  async updateSession(id:string,patch:Partial<EsignSession>){
    mustWrite();
    await erp5().collection(SESSIONS).doc(id).update(clean(patch as unknown as Record<string,unknown>));
  }

  async transitionSession(id:string,allowed:EsignSession['status'][],patch:Partial<EsignSession>):Promise<boolean>{
    mustWrite();
    const db=erp5(), ref=db.collection(SESSIONS).doc(id);
    return db.runTransaction(async tx=>{
      const d=await tx.get(ref); if(!d.exists)return false;
      const status=String(d.data()?.status) as EsignSession['status'];
      if(!allowed.includes(status))return false;
      tx.update(ref,clean(patch as unknown as Record<string,unknown>));
      return true;
    });
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
    await erp5().collection(EVENTS).add(clean({contractId,sessionId,type,by,at:Date.now(),detail}));
  }

  async listEvents(contractId:string){
    const q=await erp5().collection(EVENTS).where('contractId','==',contractId).get();
    return q.docs.map(d=>{
      const x=d.data();
      return {type:String(x.type??''),at:Number(x.at)||0,by:String(x.by??''),detail:(x.detail&&typeof x.detail==='object'&&!Array.isArray(x.detail)?x.detail:{}) as Record<string,unknown>};
    }).sort((a,b)=>b.at-a.at);
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
