import type { CanonicalProduct } from '../../domain/product/types';
import type { ProductRepository } from '../../ports/repositories';
import { erp5, ERP5_PROJECT_ID } from './firestore';
import { loadMasterIndex } from './vehicle-master';
import { toCanonicalProduct, type Erp5Doc, type SkipReason } from './to-canonical';

export type Erp5ReadReport={
  project:string;readAt:string;docs:number;mapped:number;
  skipped:Record<SkipReason,number>;warnings:number;
};

const emptySkipped=():Record<SkipReason,number>=>({
  NOT_LISTABLE:0,NO_CAR_NUMBER:0,NO_PRICE:0,NO_VALID_OFFER:0,
});

export class Erp5ProductRepository implements ProductRepository{
  private lastReport:Erp5ReadReport|null=null;
  report(){return this.lastReport;}

  async list():Promise<CanonicalProduct[]>{
    const db=erp5();
    const readAt=new Date().toISOString();
    const [products,policies,master]=await Promise.all([
      db.collection('products').get(),
      db.collection('policy').get(),
      loadMasterIndex(),
    ]);
    const policyBy=new Map<string,Erp5Doc>();
    for(const doc of policies.docs)policyBy.set(doc.id,doc.data() as Erp5Doc);

    const rows:CanonicalProduct[]=[];
    const skipped=emptySkipped();
    let warnings=0;
    for(const doc of products.docs){
      const data=doc.data() as Erp5Doc;
      const code=String(data.policy_code??'').trim();
      const result=toCanonicalProduct(data,doc.id,code?policyBy.get(code):undefined,master);
      if(!result.ok){skipped[result.reason]+=1;continue;}
      if(result.warnings.length)warnings+=1;
      rows.push(result.product);
    }
    this.lastReport={project:ERP5_PROJECT_ID,readAt,docs:products.size,mapped:rows.length,skipped,warnings};
    return rows;
  }

  async get(id:string):Promise<CanonicalProduct|null>{
    const db=erp5();
    let doc=await db.collection('products').doc(id).get();
    if(!doc.exists){
      const hit=await db.collection('products').where('product_code','==',id).limit(1).get();
      if(hit.empty)return null;
      doc=hit.docs[0];
    }
    const data=doc.data() as Erp5Doc;
    const code=String(data.policy_code??'').trim();
    const [policy,master]=await Promise.all([
      code?db.collection('policy').doc(code).get():Promise.resolve(null),
      loadMasterIndex(),
    ]);
    const result=toCanonicalProduct(data,doc.id,policy?.exists?(policy.data() as Erp5Doc):undefined,master);
    return result.ok?result.product:null;
  }

  async save():Promise<CanonicalProduct>{
    throw new Error('ERP5_PRODUCT_WRITE_FORBIDDEN');
  }
}
