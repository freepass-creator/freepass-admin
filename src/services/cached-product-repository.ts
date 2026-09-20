import type { CanonicalProduct } from '../domain/product/types';
import type { ProductRepository } from '../ports/repositories';

type Cache={at:number;rows:CanonicalProduct[]}|null;

export class CachedProductRepository implements ProductRepository{
  private cache:Cache=null;

  constructor(
    private readonly inner:ProductRepository,
    private readonly ttlMs=60_000,
    private readonly now:()=>number=Date.now,
  ){}

  invalidate(){this.cache=null;}

  async list():Promise<CanonicalProduct[]>{
    if(this.cache&&this.now()-this.cache.at<this.ttlMs)return this.cache.rows;
    const rows=await this.inner.list();
    this.cache={at:this.now(),rows};
    return rows;
  }

  async get(id:string):Promise<CanonicalProduct|null>{
    if(this.cache&&this.now()-this.cache.at<this.ttlMs){
      const hit=this.cache.rows.find((row)=>row.id===id);
      if(hit)return hit;
    }
    return this.inner.get(id);
  }

  async save(product:CanonicalProduct):Promise<CanonicalProduct>{
    const saved=await this.inner.save(product);
    this.invalidate();
    return saved;
  }
}
