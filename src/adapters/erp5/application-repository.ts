import type { DocumentData } from 'firebase-admin/firestore';
import { assertApplicationMutation } from '../../domain/application/invariants';
import type { Application } from '../../domain/application/types';
import type { ApplicationRepository } from '../../ports/repositories';
import { erp5, erp5AdminCollection, requireErp5Write } from './firestore';

function applicationOf(data:DocumentData,id:string):Application{
  const value={...data,id:data.id??id} as Application;
  if(!value.id||!value.applicationNumber||!value.submissionId||!value.snapshot){
    throw new Error('ERP5_APPLICATION_SHAPE_INVALID:'+id);
  }
  return value;
}

export class Erp5ApplicationRepository implements ApplicationRepository{
  private collection(){return erp5().collection(erp5AdminCollection('applications'));}
  private counters(){return erp5().collection(erp5AdminCollection('counters'));}

  async createSequenced(
    datePrefix:string,
    submissionId:string,
    build:(sequence:number)=>Application,
  ):Promise<{application:Application;created:boolean}>{
    requireErp5Write();
    const db=erp5();
    const collection=this.collection();
    const counterRef=this.counters().doc(datePrefix);

    return db.runTransaction(async(tx)=>{
      const existing=await tx.get(collection.where('submissionId','==',submissionId).limit(1));
      if(!existing.empty){
        const doc=existing.docs[0];
        return{application:applicationOf(doc.data(),doc.id),created:false};
      }

      const counter=await tx.get(counterRef);
      const last=Number(counter.data()?.lastSequence??0);
      const sequence=Number.isSafeInteger(last)&&last>=0?last+1:1;
      const application=build(sequence);
      if(application.submissionId!==submissionId)throw new Error('APPLICATION_SUBMISSION_ID_MISMATCH');

      const ref=collection.doc(application.id);
      const collision=await tx.get(ref);
      if(collision.exists)throw new Error('APPLICATION_ID_COLLISION');

      tx.create(ref,application);
      tx.set(counterRef,{lastSequence:sequence,updatedAt:new Date().toISOString()},{merge:true});
      return{application,created:true};
    });
  }

  async get(id:string):Promise<Application|null>{
    const doc=await this.collection().doc(id).get();
    return doc.exists?applicationOf(doc.data()!,doc.id):null;
  }

  async findBySubmissionId(submissionId:string):Promise<Application|null>{
    const snap=await this.collection().where('submissionId','==',submissionId).limit(1).get();
    if(snap.empty)return null;
    const doc=snap.docs[0];
    return applicationOf(doc.data(),doc.id);
  }

  async list():Promise<Application[]>{
    const snap=await this.collection().get();
    return snap.docs
      .map((doc)=>applicationOf(doc.data(),doc.id))
      .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }

  async mutate(id:string,change:(current:Application)=>Application):Promise<Application>{
    requireErp5Write();
    const db=erp5();
    const ref=this.collection().doc(id);
    return db.runTransaction(async(tx)=>{
      const doc=await tx.get(ref);
      if(!doc.exists)throw new Error('APPLICATION_NOT_FOUND');
      const current=applicationOf(doc.data()!,doc.id);
      const next=change(structuredClone(current));
      assertApplicationMutation(current,next);
      tx.set(ref,next);
      return next;
    });
  }
}
