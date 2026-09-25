import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT=process.cwd();
const SCAN_ROOTS=['src/app','src/server'];
const ALLOWED=new Set([
  'src/server/freepass-data.ts',
  'src/server/erp5.ts', // deprecated compatibility re-export only
  'src/server/freepass-data-boundary.test.ts',
]);
const FORBIDDEN=[
  /adapters\/erp5\/(?:firestore|product-repository|settlement-repository|contract-repository|fee-rules)/,
  /server\/erp5['"]/,
  /from\s+['"]\.\/erp5['"]/,
  /from\s+['"]\.\.\/.*\/server\/erp5['"]/,
];

function files(dir:string):string[]{
  const out:string[]=[];
  for(const name of readdirSync(join(ROOT,dir))){
    const abs=join(ROOT,dir,name);
    const rel=relative(ROOT,abs).replaceAll('\\','/');
    if(statSync(abs).isDirectory())out.push(...files(rel));
    else if(/\.(?:ts|tsx)$/.test(name))out.push(rel);
  }
  return out;
}

test('FreePass Admin app/server uses FreePass Data as the only ERP5/Firestore gateway',()=>{
  const violations:{file:string;rule:string}[]=[];
  for(const root of SCAN_ROOTS){
    for(const file of files(root)){
      if(ALLOWED.has(file))continue;
      const source=readFileSync(join(ROOT,file),'utf8');
      for(const rule of FORBIDDEN){
        if(rule.test(source))violations.push({file,rule:String(rule)});
      }
    }
  }
  assert.deepEqual(violations,[],[
    'Firebase/ERP5 adapter direct access is forbidden outside src/server/freepass-data.ts.',
    'Read/write flow must be: Admin -> FreePass Data -> repository -> Firestore.',
    JSON.stringify(violations,null,2),
  ].join('\n'));
});

test('deprecated server/erp5 module contains no adapter or Firebase implementation',()=>{
  const source=readFileSync(join(ROOT,'src/server/erp5.ts'),'utf8');
  assert.doesNotMatch(source,/adapters\/erp5|firebase-admin|new Erp5/);
  assert.match(source,/from '\.\/freepass-data'/);
});
