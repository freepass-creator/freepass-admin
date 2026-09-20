import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { CanonicalProduct } from '../src/domain/product/types';
import { FileProductRepository } from '../src/adapters/store/repositories';

const input=process.argv[2];
if(!input){
  console.error('Usage: npm run products:import -- <canonical-products.json>');
  process.exit(2);
}

const raw=JSON.parse(await readFile(resolve(input),'utf8')) as unknown;
if(!Array.isArray(raw)) throw new Error('Canonical product export must be a JSON array.');

function isString(v:unknown):v is string{return typeof v==='string'&&v.trim().length>0;}
function validateProduct(value:unknown,index:number):asserts value is CanonicalProduct{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`products[${index}] must be an object`);
  const p=value as Record<string,unknown>;
  if(!isString(p.id))throw new Error(`products[${index}].id is required`);
  if(!Number.isInteger(p.version)||Number(p.version)<1)throw new Error(`products[${index}].version must be a positive integer`);
  if(!isString(p.supplierId))throw new Error(`products[${index}].supplierId is required`);
  if(!p.vehicle||typeof p.vehicle!=='object')throw new Error(`products[${index}].vehicle is required`);
  if(!Array.isArray(p.offers)||p.offers.length===0)throw new Error(`products[${index}].offers must not be empty`);
}

raw.forEach(validateProduct);
const products=raw as CanonicalProduct[];
const ids=products.map(x=>x.id);
if(new Set(ids).size!==ids.length)throw new Error('Duplicate product id in canonical export.');

const repo=new FileProductRepository(process.env.FPA_DATA_DIR);
await repo.replaceAll(products);

console.log(JSON.stringify({
  status:'IMPORTED_FILE_DEV_ONLY',
  product_count:products.length,
  target:process.env.FPA_DATA_DIR||'.data',
  warning:'This is not production SSOT synchronization.',
},null,2));
