import { createHash } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { erp5, erp5App, ERP5_PROJECT_ID } from './firestore';
import { WriteDisabledError, writeEnabled } from './settlement-repository';
import type { EsignAssetStore, EsignRepository } from '../../ports/esign/repositories';
import type { ContractHandoffSource, EsignPrivateSubmission, EsignSession } from '../../domain/esign/types';
import { withContractHandoffDigest } from '../../domain/esign/handoff';
import { toSettlementRow } from './to-settlement';
import { intakeEventDocId } from '../../domain/settlement/code';
import { finalizationBlockReason } from '../../domain/esign/finalization-gate';
import { claimIsFresh, FINALIZE_CLAIM_TTL, SUBMIT_CLAIM_TTL } from '../../domain/esign/claim-ttl';
import { contractIntakeLinkError } from '../../domain/contracts/link';
import { contractExitDecision } from '../../domain/esign/contract-exit';

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
      catalogSnapshot:(row.catalogSnapshot??null) as unknown as Record<string,unknown>|null,
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
      if(!intake.exists)throw new Error('접수를 찾을 수 없습니다.');
      if(existing.exists){
        const existingContract={id:existing.id,...existing.data()};
        const linked=String(intake.data()?.esignContractId??'').trim();
        if(linked && linked!==id)throw new Error('접수가 다른 전자계약에 이미 연결되어 있습니다.');
        if(!linked)tx.update(intakeRef,{esignContractId:id,updatedAt:Date.now()});
        return {created:false,contract:existingContract};
      }
      const current=this.handoffSource(intake.id,intake.data() as Record<string,unknown>);
      if(current.sourceDigest!==source.sourceDigest)throw new Error('접수 정보가 변경되었습니다 — 다시 불러온 뒤 계약을 만들어 주세요.');
      const stored=clean(data);
      const linked=String(intake.data()?.esignContractId??'').trim();
      if(linked && linked!==id)throw new Error('접수가 다른 전자계약에 이미 연결되어 있습니다.');
      tx.create(contractRef,stored);
      tx.update(intakeRef,{esignContractId:id,updatedAt:Date.now()});
      return {created:true,contract:{id,...stored}};
    });
  }

  async updateContract(id:string,patch:Record<string,unknown>){
    mustWrite();
    const db=erp5(), ref=db.collection(CONTRACTS).doc(id);
    await db.runTransaction(async tx=>{
      const d=await tx.get(ref);
      if(!d.exists)throw new Error('계약을 찾을 수 없습니다.');
      const status=String(d.data()?.contract_status??'').trim();
      if(/취소|철회|해지/.test(status)){
        throw new Error('취소·철회·해지 계약의 전자계약 상태는 변경할 수 없습니다.');
      }
      tx.update(ref,clean({...patch,updated_at:Date.now()}));
    });
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

  async issueSession(
    session:EsignSession,
    publicUrl:string,
    contractPatch:Record<string,unknown>,
    actor:string,
  ){
    mustWrite();
    const db=erp5();
    const lockRef=db.collection(LOCKS).doc(session.contractId);
    const contractRef=db.collection(CONTRACTS).doc(session.contractId);
    const nextRef=db.collection(SESSIONS).doc(session.id);
    const privateRef=db.collection(PRIVATE).doc(session.id);

    await db.runTransaction(async tx=>{
      const [lock,contractDoc,existing]=await Promise.all([
        tx.get(lockRef),tx.get(contractRef),tx.get(nextRef),
      ]);
      if(!contractDoc.exists)throw new Error('계약을 찾을 수 없습니다.');
      if(existing.exists)throw new Error('같은 전자계약 세션이 이미 있습니다.');

      const contractRaw=contractDoc.data() as Record<string,unknown>;
      const sourceIntakeId=String(contractRaw.source_intake_id??'').trim();
      const oldId=String(lock.data()?.currentSessionId??'').trim();
      const oldRef=oldId&&oldId!==session.id ? db.collection(SESSIONS).doc(oldId) : null;
      const intakeRef=sourceIntakeId ? db.collection(INTAKES).doc(sourceIntakeId) : null;
      const [oldDoc,intakeDoc]=await Promise.all([
        oldRef ? tx.get(oldRef) : Promise.resolve(null),
        intakeRef ? tx.get(intakeRef) : Promise.resolve(null),
      ]);
      if(intakeRef&&!intakeDoc?.exists)throw new Error('계약의 원본 접수를 찾을 수 없습니다.');

      const contractStatus=String(contractRaw.contract_status??'').trim();
      const intakeRaw=intakeDoc?.exists ? intakeDoc.data() as Record<string,unknown> : null;
      const linkError=contractIntakeLinkError(session.contractId,intakeRaw);
      if(linkError)throw new Error(linkError);
      const blocked=finalizationBlockReason(contractRaw,intakeRaw);
      if(blocked){
        if(blocked.includes('계약취소'))throw new Error('계약취소된 계약은 전자계약을 발행할 수 없습니다.');
        if(blocked.includes('계약해지'))throw new Error('계약해지된 계약은 전자계약을 발행할 수 없습니다.');
        throw new Error(blocked);
      }
      if(contractStatus==='계약철회')throw new Error('계약철회된 계약은 전자계약을 발행할 수 없습니다.');
      if(String(contractRaw.sign_status??'').trim()==='서명완료'){
        throw new Error('이미 서명완료된 계약입니다. 수정하려면 새 계약을 만들어야 합니다.');
      }

      const lockRevision=Number(lock.data()?.revision??0);
      if(oldId&&oldId!==session.id&&lockRevision>=session.revision){
        throw new Error('다른 전자계약 발행 요청이 먼저 완료되었습니다 — 다시 불러와 주세요.');
      }
      if(oldDoc?.exists&&String(oldDoc.data()?.status)==='signed'){
        throw new Error('이미 서명완료된 계약입니다. 수정하려면 새 계약을 만들어야 합니다.');
      }

      const now=Date.now();
      if(oldRef&&oldDoc?.exists&&!['signed','revoked'].includes(String(oldDoc.data()?.status))){
        tx.update(oldRef,{status:'revoked',revokedAt:now});
      }
      tx.create(nextRef,clean(session as unknown as Record<string,unknown>));
      tx.set(privateRef,{sessionId:session.id,contractId:session.contractId,publicUrl,createdAt:session.issuedAt},{merge:true});
      tx.set(lockRef,{currentSessionId:session.id,issuedAt:session.issuedAt,revision:session.revision},{merge:true});
      tx.update(contractRef,clean({...contractPatch,updated_at:now}));

      const eventRef=db.collection(EVENTS).doc(
        'evt_'+createHash('sha256').update(session.contractId+'|'+session.id+'|issued').digest('hex').slice(0,24),
      );
      tx.create(eventRef,{
        contractId:session.contractId,sessionId:session.id,type:'issued',by:actor,at:now,
        detail:{revision:session.revision},
      });
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

  async revokeSession(sessionId:string,contractId:string,actor:string){
    mustWrite();
    const db=erp5(), sessionRef=db.collection(SESSIONS).doc(sessionId), contractRef=db.collection(CONTRACTS).doc(contractId);
    return db.runTransaction(async tx=>{
      const [sessionDoc,contractDoc]=await Promise.all([tx.get(sessionRef),tx.get(contractRef)]);
      if(!sessionDoc.exists)throw new Error('전자계약 세션을 찾을 수 없습니다.');
      if(!contractDoc.exists)throw new Error('계약을 찾을 수 없습니다.');
      const session={id:sessionDoc.id,...sessionDoc.data()} as EsignSession;
      if(session.status==='signed')throw new Error('서명완료 계약의 전자계약 발행은 철회할 수 없습니다.');
      if(session.status==='revoked')return {revoked:false,session};
      if(!['sent','opened','in_progress','rejected'].includes(session.status)){
        throw new Error('제출·승인 처리 중인 링크는 철회할 수 없습니다.');
      }
      const now=Date.now();
      const contractRaw=contractDoc.data() as Record<string,unknown>;
      const sourceIntakeId=String(contractRaw.source_intake_id??'').trim();
      const intakeRef=sourceIntakeId ? db.collection(INTAKES).doc(sourceIntakeId) : null;
      const intakeDoc=intakeRef ? await tx.get(intakeRef) : null;
      if(intakeRef && !intakeDoc?.exists)throw new Error('계약의 원본 접수를 찾을 수 없습니다.');
      if(intakeDoc?.exists){
        const linkError=contractIntakeLinkError(contractId,intakeDoc.data() as Record<string,unknown>);
        if(linkError)throw new Error(linkError);
      }

      tx.update(sessionRef,{status:'revoked',revokedAt:now});
      tx.update(contractRef,{sign_status:'미발송',sign_revoked_at:now,esign_progress:0,updated_at:now});
      if(intakeRef && intakeDoc?.exists){
        tx.update(intakeRef,{esignRevokedAt:now,updatedAt:now,stateAt:new Date(now).toISOString()});
        const raw=intakeDoc.data() as Record<string,unknown>;
        const evRef=db.collection('settlement_events').doc(
          intakeEventDocId(raw.plate,raw.sourceProductId,raw.receivedAt,raw.intakeRequestId,raw.intakeIdentityMode),
        );
        const evKey='aud_esign_revoke_'+createHash('sha256').update(contractId+'|'+sessionId).digest('hex').slice(0,16);
        tx.set(evRef,{[evKey]:{at:now,by:actor,field:'전자계약',from:'활성',to:'철회',contractId,sessionId}},{merge:true});
      }
      const eventRef=db.collection(EVENTS).doc(
        'evt_'+createHash('sha256').update(contractId+'|'+sessionId+'|revoked').digest('hex').slice(0,24),
      );
      tx.set(eventRef,{contractId,sessionId,type:'revoked',by:actor,at:now,detail:{}},{merge:false});
      return {revoked:true,session:{...session,status:'revoked',revokedAt:now}};
    });
  }

  async cancelContract(contractId:string,reason:string,actor:string){
    mustWrite();
    const why=reason.trim();
    if(!why)throw new Error('계약 취소 사유를 적어 주세요.');
    const db=erp5(), contractRef=db.collection(CONTRACTS).doc(contractId);

    return db.runTransaction(async tx=>{
      const contractDoc=await tx.get(contractRef);
      if(!contractDoc.exists)throw new Error('계약을 찾을 수 없습니다.');
      const contractRaw=contractDoc.data() as Record<string,unknown>;
      const sourceIntakeId=String(contractRaw.source_intake_id??'').trim();
      if(!sourceIntakeId)throw new Error('계약의 원본 접수 연결이 없습니다.');

      const intakeRef=db.collection(INTAKES).doc(sourceIntakeId);
      const lockRef=db.collection(LOCKS).doc(contractId);
      const [intakeDoc,lockDoc]=await Promise.all([tx.get(intakeRef),tx.get(lockRef)]);
      if(!intakeDoc.exists)throw new Error('계약의 원본 접수를 찾을 수 없습니다.');
      const intake=intakeDoc.data() as Record<string,unknown>;
      const intakeLinkError=contractIntakeLinkError(contractId,intake);
      if(intakeLinkError)throw new Error(intakeLinkError);

      const sessionId=String(lockDoc.data()?.currentSessionId??'').trim()
        || String(contractRaw.esign_id??'').trim();
      const sessionRef=sessionId ? db.collection(SESSIONS).doc(sessionId) : null;
      const sessionDoc=sessionRef ? await tx.get(sessionRef) : null;
      const session=sessionDoc?.exists ? ({id:sessionDoc.id,...sessionDoc.data()} as EsignSession) : null;

      const alreadyAt=Number(intake.contractCancelledAt??0);
      if(alreadyAt>0){
        const storedReason=String(intake.contractCancellationReason??'').trim();
        if(storedReason&&storedReason!==why){
          throw new Error('이미 다른 사유로 계약취소 처리된 계약입니다 — 기존 취소 기록을 확인해 주세요.');
        }
        const now=Date.now();
        const repairRevoke=!!session&&!['signed','revoked'].includes(session.status);
        if(repairRevoke&&sessionRef){
          tx.update(sessionRef,{status:'revoked',revokedAt:now});
          tx.update(contractRef,{sign_status:'미발송',sign_revoked_at:now,esign_progress:0,updated_at:now});
          tx.update(intakeRef,{esignRevokedAt:now,updatedAt:now,stateAt:new Date(now).toISOString()});
          const repairEventRef=db.collection(EVENTS).doc(
            'evt_'+createHash('sha256').update(contractId+'|cancel-repair|'+session.id).digest('hex').slice(0,24),
          );
          tx.set(repairEventRef,{
            contractId,sessionId:session.id,type:'cancel_repaired_active_esign',by:actor,at:now,
            detail:{reason:storedReason||why},
          },{merge:false});
        }
        return {
          cancelled:false,
          session:repairRevoke&&session ? {...session,status:'revoked',revokedAt:now} as EsignSession : session,
          signedDocumentPreserved:session?.status==='signed',
        };
      }

      const exit=contractExitDecision(intake);
      if(exit.kind==='TERMINATION_REQUIRED'){
        if(exit.reason==='DELIVERED') throw new Error('이미 인도된 계약은 계약취소가 아니라 계약해지 절차로 처리합니다.');
        throw new Error('정산 흔적이 있는 계약은 계약취소로 처리할 수 없습니다 — 데이터 상태를 확인한 뒤 계약해지 절차를 사용합니다.');
      }

      const now=Date.now();
      if(session?.status==='approving' && claimIsFresh(session.approvingAt,now,FINALIZE_CLAIM_TTL)){
        throw new Error('전자계약 승인 처리 중입니다 — 승인 처리가 끝난 뒤 계약취소를 다시 실행해 주세요.');
      }
      if(session?.status==='submitting' && claimIsFresh(session.submittingAt,now,SUBMIT_CLAIM_TTL)){
        throw new Error('고객 제출 처리 중입니다 — 제출 처리가 끝난 뒤 계약취소를 다시 실행해 주세요.');
      }

      const signedDocumentPreserved=session?.status==='signed';
      const revokeSession=!!session && !['signed','revoked'].includes(session.status);

      tx.update(contractRef,{
        contract_status:'계약취소',
        contract_cancelled_at:now,
        contract_cancel_reason:why,
        ...(revokeSession ? {sign_status:'미발송',sign_revoked_at:now,esign_progress:0} : {}),
        updated_at:now,
      });
      tx.update(intakeRef,{
        cancelled:true,
        settleExclude:true,
        contractCancelledAt:now,
        contractCancellationReason:why,
        ...(revokeSession ? {esignRevokedAt:now} : {}),
        updatedAt:now,
        stateAt:new Date(now).toISOString(),
      });
      if(sessionRef && revokeSession)tx.update(sessionRef,{status:'revoked',revokedAt:now});

      const settlementEventRef=db.collection('settlement_events').doc(
        intakeEventDocId(intake.plate,intake.sourceProductId,intake.receivedAt,intake.intakeRequestId,intake.intakeIdentityMode),
      );
      const settlementEventKey='aud_contract_cancel_'+createHash('sha256').update(contractId+'|'+why).digest('hex').slice(0,16);
      tx.set(settlementEventRef,{[settlementEventKey]:{
        at:now,by:actor,field:'계약취소',from:'false',to:'true',reason:why,contractId,sessionId:session?.id??null,
      }},{merge:true});

      const eventRef=db.collection(EVENTS).doc(
        'evt_'+createHash('sha256').update(contractId+'|cancel|'+why).digest('hex').slice(0,24),
      );
      tx.set(eventRef,{
        contractId,sessionId:session?.id??'',type:'contract_cancelled',by:actor,at:now,
        detail:{reason:why,signedDocumentPreserved,sessionRevoked:revokeSession},
      },{merge:false});

      return {
        cancelled:true,
        session:session
          ? (revokeSession ? {...session,status:'revoked',revokedAt:now} as EsignSession : session)
          : null,
        signedDocumentPreserved,
      };
    });
  }

  async finalizeSigned(
    sessionId:string,
    finalizationId:string,
    sessionPatch:Partial<EsignSession>,
    contractPatch:Record<string,unknown>,
    actor:string,
    detail:Record<string,unknown>,
  ){
    mustWrite();
    const db=erp5(), sessionRef=db.collection(SESSIONS).doc(sessionId);
    return db.runTransaction(async tx=>{
      const sessionDoc=await tx.get(sessionRef);
      if(!sessionDoc.exists)throw new Error('전자계약 세션을 찾을 수 없습니다.');
      const current={id:sessionDoc.id,...sessionDoc.data()} as EsignSession;
      if(current.status==='signed'){
        if(current.finalizationId!==finalizationId)throw new Error('이미 다른 승인 요청으로 완료된 계약입니다.');
        return {finalized:false,session:current};
      }
      if(current.status!=='approving'||current.finalizationId!==finalizationId){
        throw new Error('승인 상태가 바뀌었습니다 — 다시 확인해 주세요.');
      }
      const contractRef=db.collection(CONTRACTS).doc(current.contractId);
      const contractDoc=await tx.get(contractRef);
      if(!contractDoc.exists)throw new Error('계약을 찾을 수 없습니다.');
      const contractRaw=contractDoc.data() as Record<string,unknown>;
      const sourceIntakeId=String(contractRaw.source_intake_id??'').trim();
      let intakeDoc: DocumentSnapshot | null=null;
      if(sourceIntakeId){
        intakeDoc=await tx.get(db.collection(INTAKES).doc(sourceIntakeId));
        if(!intakeDoc.exists)throw new Error('계약의 원본 접수를 찾을 수 없습니다.');
      }

      const intakeRawForGate=intakeDoc?.exists ? intakeDoc.data() as Record<string,unknown> : null;
      const finalLinkError=contractIntakeLinkError(current.contractId,intakeRawForGate);
      if(finalLinkError)throw new Error(finalLinkError);
      const blocked=finalizationBlockReason(contractRaw,intakeRawForGate);
      if(blocked)throw new Error(blocked);

      const signed=clean({...sessionPatch,status:'signed',finalizationId} as unknown as Record<string,unknown>);
      const finalizedAt=Date.now();
      tx.update(sessionRef,signed);
      tx.update(contractRef,clean({...contractPatch,updated_at:finalizedAt}));

      if(intakeDoc?.exists){
        const intakeRaw=intakeDoc.data() as Record<string,unknown>;
        tx.update(intakeDoc.ref,{paper:true,updatedAt:finalizedAt,stateAt:new Date(finalizedAt).toISOString()});
        const settlementEventRef=db.collection('settlement_events').doc(
          intakeEventDocId(
            intakeRaw.plate,intakeRaw.sourceProductId,intakeRaw.receivedAt,
            intakeRaw.intakeRequestId,intakeRaw.intakeIdentityMode,
          ),
        );
        const eventKey='aud_esign_'+createHash('sha256').update(current.contractId+'|'+finalizationId).digest('hex').slice(0,16);
        tx.set(settlementEventRef,{[eventKey]:{
          at:finalizedAt,by:actor,operationId:finalizationId,field:'계약서',from:String(intakeRaw.paper===true),to:'true',
          contractId:current.contractId,sessionId,
        }},{merge:true});
      }

      const eventRef=db.collection(EVENTS).doc(
        'evt_'+createHash('sha256').update(current.contractId+'|'+finalizationId).digest('hex').slice(0,24),
      );
      tx.set(eventRef,clean({
        contractId:current.contractId,sessionId,type:'approved',by:actor,at:Date.now(),detail,
      }),{merge:false});
      return {finalized:true,session:{...current,...signed,status:'signed'} as EsignSession};
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
