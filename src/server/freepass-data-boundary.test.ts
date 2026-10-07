import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as gateway from './freepass-data';
import * as compatibility from './erp5';
import { validatePublishedReceipts } from '../adapters/freepass-data/admin-workflow-firestore';

test('monthly receipts use published source amounts and hold stale, partial or untyped reads', () => {
  const summary = { month: '2026-09', count: 34, claimAmount: 36582600, payAmount: 29322051,
    heldCount: 9, verification: 'BOOKED_SOURCE_AMOUNTS_NOT_ALL_SUPPLIER_CONFIRMED' };
  const rule = { monthlySummaryLedgerDigest: 'live', monthlyReceiptSummaries: { '2026-09': summary } };
  assert.deepEqual(validatePublishedReceipts(rule, 'live', 489), { status: 'READY', months: { '2026-09': summary } });
  assert.equal(validatePublishedReceipts({ ...rule, monthlyReceiptSummaries: { '2026-09': { ...summary, claimAmount: 12.5 } } }, 'live', 489).status, 'READY');
  for (const result of [validatePublishedReceipts(rule, 'stale', 489), validatePublishedReceipts(rule, 'live', 5000),
    validatePublishedReceipts(undefined, 'live', 489),
    validatePublishedReceipts({ ...rule, monthlyReceiptSummaries: { '2026-09': { ...summary, claimAmount: '36582600' } } }, 'live', 489),
    validatePublishedReceipts({ ...rule, monthlyReceiptSummaries: { '2026-09': { ...summary, verification: 'CONFIRMED' } } }, 'live', 489)]) {
    assert.equal(result.status, 'HOLD');
  }
});

test('screen receipt validation reuses the UI ledger snapshot and preserves rows on rule failure', async () => {
  const savedFetch = globalThis.fetch;
  const savedEnv = { ...process.env };
  const calls: string[] = [];
  let ruleFails = false;
  let saturated = false;
  try {
    process.env.FREEPASS_DATA_BASE_URL = 'https://data.example.test';
    process.env.FREEPASS_DATA_ADMIN_CATALOG_TOKEN = 'test-only-consumer-token-00000000000000';
    delete process.env.FPA_DEMO;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FREEPASS_DATA_GCP_WIF_AUDIENCE;
    delete process.env.FREEPASS_DATA_GCP_CALLER_SERVICE_ACCOUNT_EMAIL;
    delete process.env.VERCEL_OIDC_TOKEN;
    globalThis.fetch = async (_url, init) => {
      const spec = JSON.parse(String(init?.body));
      calls.push(spec.resource);
      if (spec.resource === 'settlementRows') {
        assert.equal(spec.limit, 5000);
        return Response.json({ schema: 'freepass-data.admin-workflow-read/v1', digest: 'live', docs: saturated
          ? Array.from({ length: 5000 }, (_, i) => ({ id: String(i), data: {} }))
          : [{ id: 'r', data: { code: 'r' } }] });
      }
      assert.equal(spec.resource, 'settlementRules');
      if (ruleFails) return Response.json({ code: 'UNAVAILABLE' }, { status: 503 });
      return Response.json({ schema: 'freepass-data.admin-workflow-read/v1', digest: 'rule', docs: [{ id: spec.id, data: {
        monthlySummaryLedgerDigest: 'live', monthlyReceiptSummaries: { '2026-09': {
          month: '2026-09', count: 1, claimAmount: 12.5, payAmount: 10, heldCount: 0,
          verification: 'BOOKED_SOURCE_AMOUNTS_NOT_ALL_SUPPLIER_CONFIRMED',
        } },
      } }] });
    };
    const ready = await gateway.settlements.listWithPublishedReceipts();
    assert.equal(ready.published.status, 'READY');
    assert.equal(ready.all.length, 1);
    assert.deepEqual(calls, ['settlementRules', 'settlementRows', 'settlementRules']);
    ruleFails = true;
    calls.length = 0;
    const held = await gateway.settlements.listWithPublishedReceipts();
    assert.equal(held.published.status, 'HOLD');
    assert.equal(held.all.length, 1);
    assert.deepEqual(calls, ['settlementRules', 'settlementRows']);
    saturated = true;
    await assert.rejects(() => gateway.settlements.listWithPublishedReceipts(), /전체 목록을 확인할 수 없습니다/);
  } finally {
    globalThis.fetch = savedFetch;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  }
});

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).replaceAll('\\', '/');
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

test('UI and services cannot bypass the FreePass Data persistence gateway', () => {
  const violations = [...sources('src/app'), ...sources('src/services')].filter((path) =>
    /(?:from|import\()\s*['"][^'"]*(?:adapters\/erp5|firebase-admin|firebase\/database)/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(violations, []);
});

test('browser Firebase SDK remains auth-only; Firestore uses the server gateway', () => {
  const violations = sources('src').filter((path) =>
    /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s*)['"](?:firebase\/firestore(?:\/[^'"]*)?|@firebase\/firestore)['"]/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(violations, [], 'client Firestore requires a fresh dependency compatibility review');
});

test('one FreePass Data gateway composes catalog and workflow persistence without owning business commands', () => {
  const data = readFileSync('src/server/freepass-data.ts', 'utf8');
  assert.match(data, /new AdminCatalogSwitchboard\(legacyProducts, freepassDataProducts\)/);
  assert.match(data, /new FreePassDataAdminCompatProductRepository\(\)/);
  assert.match(data, /adminCatalogReadMode\(\) === 'LEGACY_DIRECT'/);
  assert.match(data, /!adminCompatibilityTransportConfigured\(\)/);
  assert.match(data, /new Erp5SettlementRepository\(\)/);
  assert.match(data, /new Erp5ContractRepository\(\)/);
  assert.match(data, /export \{ esignAssets, esignRepository \} from/);
  assert.doesNotMatch(data, /firebase-admin|new EsignService|from ['"][^'"]*services\//);
});

test('server helpers cannot reach persistence on their own; identity reaches only the shared account authority', () => {
  // Owner, 2026-09-27: the shared login screen and the account authority both come from FreePass Data
  // (IDENTITY-AND-ACCESS.md). Identity may reach Firebase Auth and the shared identity_accounts
  // collection and nothing else; operational data still goes through the gateway alone.
  const allowed = new Set(['src/server/freepass-data.ts', 'src/server/identity.ts']);
  const violations = sources('src/server').filter((path) => !allowed.has(path)
    && /(?:from|import\()\s*['"][^'"]*(?:adapters\/erp5|firebase-admin|firebase\/database)/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(violations, []);

  /**
   * Assert on what the file DOES, not on what it says. Three assertions in this suite have now
   * tripped on their own explanatory comments, which is a test reporting a fault that is not there.
   */
  const code = (path: string) => readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const identity = code('src/server/identity.ts');
  // Identity never touches operational data, and never the retired ERP3/RTDB.
  assert.doesNotMatch(identity, /from ['"][^'"]*(?:adapters\/erp5|firebase\/database)/);
  assert.doesNotMatch(identity, /freepasserp3|AUTH_PROJECT_ID|ADMIN_EMAILS|ADMIN_UIDS/);
  const collections = [...identity.matchAll(/\.collection\('([^']+)'\)|\.collection\((\w+)\)/g)];
  assert.equal(collections.length, 1, 'identity reads exactly one collection');
  assert.match(identity, /const ACCOUNTS = 'identity_accounts'/);
  // The WIF REST read is bound to the same single collection as the emulator SDK path.
  assert.equal((identity.match(/fetch\(/g) ?? []).length, 1);
  assert.match(identity, /fetch\('https:\/\/firestore\.googleapis\.com\/v1\/projects\/' \+ config\.projectId/);
  assert.match(identity, /'\/databases\/\(default\)\/documents\/' \+ ACCOUNTS \+ '\/' \+ encodeURIComponent\(id\)/);
  assert.doesNotMatch(identity, /method:\s*['"](?:POST|PATCH|PUT|DELETE)['"]/);
  // The contract forbids an application minting its own session token or keeping its own allowlist.
  assert.match(identity, /createSessionCookie/);
  // Owner, 2026-09-27: the door asks only whether this is a real colleague, because FreePass
  // Data's approval overwrites grants with ['audit-dashboard'] and nothing can grant this app.
  // Pinned so it cannot drift back silently in either direction: restoring the grant check is a
  // deliberate edit here too, once that side merges grants per application.
  assert.doesNotMatch(identity, /grants\.includes\(APP_GRANT\)/);
  assert.match(identity, /a\?\.status === 'APPROVED'/);
  // Emulator journey cannot prove these two, so pin them here instead of letting them drift.
  // Revocation must be checked (the Auth emulator does not implement it for session cookies).
  assert.match(identity, /verifySessionCookie\(cookie, true\)/);
  // An unreachable authority denies rather than admits.
  assert.match(identity, /catch \{ who = null; \}/);
  assert.doesNotMatch(identity, /createHmac|scrypt|passwordHash/);
  // Authority must be re-resolved often enough that revocation lands (contract: at most 5 minutes).
  const ttl = identity.match(/AUTHORITY_TTL_MS = ([^;]+);/)?.[1] ?? '';
  assert.ok(/5 \* 60_000/.test(ttl), `authority cache must stay within 5 minutes, saw ${ttl}`);

  // The door itself holds no database and no password.
  const door = code('src/server/auth.ts');
  assert.doesNotMatch(door, /from ['"][^'"]*firebase|getFirestore\(|getAuth\(|initializeApp\(|\.collection\(/);
  assert.doesNotMatch(code('src/app/login/actions.ts'), /signIn\(|password/i);
  // The shared screen is worn, not edited: the app passes brand and policy only.
  const worn = code('src/app/login/LoginScreen.tsx');
  assert.match(worn, /policy: 'APPROVAL'/);
  assert.match(worn, /from '\.\/shared\/login\.js'/);
});

test('deprecated ERP5 alias preserves gateway instance identity instead of creating a second ledger', () => {
  const alias = readFileSync('src/server/erp5.ts', 'utf8');
  assert.doesNotMatch(alias, /adapters\/|new Erp5|const |function /);
  assert.equal(compatibility.settlements, gateway.settlements);
  assert.equal(compatibility.contracts, gateway.contracts);
  assert.equal(compatibility.esignRepository, gateway.esignRepository);
  assert.equal(compatibility.esignAssets, gateway.esignAssets);
  assert.equal(compatibility.productByIdFresh, gateway.productByIdFresh);
  assert.equal(compatibility.writeEnabled, gateway.writeEnabled);
});

test('electronic-signature service obtains persistence through Data while retaining renderer ownership', () => {
  const source = readFileSync('src/server/esign.ts', 'utf8');
  assert.match(source, /esignAssets, esignRepository \} from '\.\/freepass-data'/);
  assert.match(source, /new EsignService\(esignRepository, esignAssets, esignFinalDocumentRenderer\)/);
  assert.doesNotMatch(source, /adapters\/erp5/);
});


test('cutover stages never reuse the 60-second legacy UI cache', () => {
  const data = readFileSync('src/server/freepass-data.ts', 'utf8');
  assert.match(data, /const cacheable = mode === 'LEGACY_DIRECT' \|\| mode === 'OBSERVE'/);
  assert.match(data, /if \(cacheable && hit && hit\.mode === mode && Date\.now\(\) - hit\.at < TTL\)/);
  assert.match(data, /else delete g\.__fpaCatalog/);
});

test('operator parity audit is read-only, bounded and fail-closed', async () => {
  const row = {
    id: 'P-1', version: 1, supplierId: 'S-1', supplierProductKey: 'P-1',
    vehicle: {
      nodeId: 'V-1', originId: 'KR', manufacturerId: 'HYUNDAI', modelId: 'AVANTE',
      matchLevel: 'MODEL' as const,
    },
    specs: {}, offers: [], productPolicies: [], sourceSnapshotId: 'snapshot-1',
    updatedAt: '2026-09-29T00:00:00.000Z',
  } satisfies import('../domain/product/types').CanonicalProduct;
  const meta = {
    consumerId: 'freepass-admin-catalog' as const,
    projectionId: 'admin-catalog' as const,
    authority: 'CANONICAL_ACTIVE' as const,
    schemaVersion: '1.0.0' as const,
    releaseId: 'rel-1', manifestId: 'manifest-1', inputDigest: 'input-1',
    revision: 1, dataDigest: 'data-1', policyParity: 'COMPLETE' as const,
    commercialCoverage: 'COMPLETE' as const,
    generatedAt: '2026-09-29T00:00:00.000Z',
    activatedAt: '2026-09-29T00:00:00.000Z',
    missingPolicyOfferIds: [], invalidPolicyFactRefs: [], commercialMissingOfferIds: [],
  };
  const matched = await gateway.runAdminCatalogParityAudit({
    configured: true,
    readLegacy: async () => [row],
    readFreepass: async () => ({ rows: [row], meta }),
    now: () => Date.parse('2026-09-29T00:00:00.000Z'),
  });
  assert.equal(matched.readiness, 'READY');
  assert.equal(matched.comparisonStatus, 'MATCH');
  assert.deepEqual(matched.holdReasons, []);

  const held = await gateway.runAdminCatalogParityAudit({
    configured: true,
    readLegacy: async () => [row],
    readFreepass: async () => { throw new Error('secret-bearing transport detail'); },
  });
  assert.equal(held.readiness, 'HOLD');
  assert.equal(held.errorCode, 'FREEPASS_DATA_PARITY_AUDIT_FAILED');
  assert.equal(JSON.stringify(held).includes('secret-bearing'), false);

  const timed = await gateway.runAdminCatalogParityAudit({
    configured: true,
    readLegacy: () => new Promise(() => undefined),
    readFreepass: async () => ({ rows: [row], meta }),
    timeoutMs: 5,
  });
  assert.equal(timed.errorCode, 'FREEPASS_DATA_PARITY_AUDIT_TIMEOUT');

  const missing = await gateway.runAdminCatalogParityAudit({
    configured: false,
    readLegacy: async () => { throw new Error('must not read'); },
    readFreepass: async () => { throw new Error('must not read'); },
  });
  assert.equal(missing.readiness, 'NOT_CONFIGURED');
});


import {saveReceiptPdf,assertUniqueDocumentIds,verifyReceiptDocumentRun} from '../adapters/erp5/settlement-documents';
import {createHash} from 'node:crypto';
test('Drive PDF retries verify exact owner, folder and bytes instead of duplicating or overwriting a changed same-input artifact',async()=>{
  const saved=globalThis.fetch;const bytes=new Uint8Array(Buffer.from('test-pdf-bytes'));
  const md5=createHash('md5').update(bytes).digest('hex'),sha256=createHash('sha256').update(bytes).digest('hex');
  let writes=0,changed=false;
  try{
    globalThis.fetch=async(_url,init)=>{
      if(init?.method==='POST'||init?.method==='PATCH')writes++;
      return Response.json({id:'existing',name:'existing.pdf',mimeType:'application/pdf',parents:['folder'],owners:[{emailAddress:'pyh@teamjpk.com'}],trashed:false,md5Checksum:changed?'changed':md5,webViewLink:'https://drive.google.com/file/d/existing/view',appProperties:{receiptRun:'run',sha256}});
    };
    const result=await saveReceiptPdf({mode:'oauth',token:'test-only'},'folder','existing','existing.pdf','run',bytes,true);
    assert.equal(result.md5,md5);assert.equal(writes,0);
    changed=true;await assert.rejects(()=>saveReceiptPdf({mode:'oauth',token:'test-only'},'folder','existing','existing.pdf','run',bytes,true),/동일 입력 PDF/);
    assert.equal(writes,0);
  }finally{globalThis.fetch=saved;}
});

test('document ID reservations cannot alias two parties onto one Drive file',()=>{
  for(const ids of [['abcdefghij','abcdefghij'],['','klmnopqrst'],['abcdefghij'],['abcdefghij',12]])assert.throws(()=>assertUniqueDocumentIds(ids,2));
  assert.doesNotThrow(()=>assertUniqueDocumentIds(['abcdefghij','klmnopqrst'],2));
});

import puppeteer from 'puppeteer-core';
import {generateReceiptDocuments,type ReceiptDocumentRepository} from '../adapters/erp5/settlement-documents';
test('a live ledger change during batch rendering cannot be marked READY; missing existing targets never write',async()=>{
  const env={...process.env},savedFetch=globalThis.fetch,savedLaunch=puppeteer.launch;
  let reads=0,completed=false;
  const files=new Map<string,Record<string,unknown>>();
  const row={sourceReceiptRaw:Array.from({length:20},(_,i)=>i===18?2026:i===19?9:null),sourceReceiptClaim:100,sourceReceiptPay:80,supplier:'공급',channel:'채널',plate:'검증',receivedAt:'2026-09-01'};
  const party={name:'검증',bizNo:'1234567890',ceo:'',address:'',phone:'',bank:'',account:'',holder:''};
  const config={issuer:party,parties:{공급:party,채널:party},branding:{name:'검증',markMain:'freepass',markSub:'mobility',erpMain:'freepass',erpSub:'erp',tagline:'검증',bizNo:'1234567890',ceo:'',addr:'',web:'',erp:'',staff:'',staffPhone:'',phone:'',email:'',fax:''},folderId:'folder123456',existingFiles:{'2026-09|공급사|공급':{id:'supplier123456',name:'공급.pdf'},'2026-09|영업채널|채널':{id:'channel123456',name:'채널.pdf'}}};
  const repo={
    receiptDocumentPolicy:async()=>({}),receiptDocumentRun:async()=>null,
    listWithPublishedReceipts:async()=>({all:[{raw:row}],published:{status:'READY',months:{'2026-09':{count:1,claimAmount:100,payAmount:80}}},digest:++reads>=3?'changed':'same'}),
    beginReceiptDocumentRun:async(_key:string,month:string,fileIds:string[])=>({key:_key,month,fileIds,status:'RUNNING',createdAt:1791330000000,files:[]}),
    finishReceiptDocumentRun:async(_run:unknown,_files:unknown,complete:boolean)=>{completed=complete;},
  } as unknown as ReceiptDocumentRepository;
  const pdf=Buffer.from('%PDF-1.4\n/CreationDate (D:20260925083100+00\'00\')\n/ModDate (D:20260925083100+00\'00\')\n'+'x'.repeat(1200)+'\n%%EOF');
  try{
    Object.assign(process.env,{VERCEL:'1',SETTLEMENT_DRIVE_CLIENT_ID:'test',SETTLEMENT_DRIVE_CLIENT_SECRET:'test',SETTLEMENT_DRIVE_REFRESH_TOKEN:'test',SETTLEMENT_DOCUMENT_CONFIG_JSON:JSON.stringify(config),SETTLEMENT_CHROMIUM_EXECUTABLE_PATH:'test'});delete process.env.SETTLEMENT_DOCUMENT_CONFIG_FILE;
    for(const target of Object.values(config.existingFiles))files.set(target.id,{id:target.id,name:target.name,mimeType:'application/pdf',parents:[config.folderId],owners:[{emailAddress:'pyh@teamjpk.com'}],md5Checksum:'old',webViewLink:'https://drive.google.com/file/d/'+target.id+'/view'});
    globalThis.fetch=async(url,init)=>{
      const u=new URL(String(url));if(u.hostname==='oauth2.googleapis.com')return Response.json({access_token:'test'});
      const id=u.pathname.split('/').at(-1)!;if(id===config.folderId)return Response.json({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true},owners:[{emailAddress:'pyh@teamjpk.com'}]});
      const f=files.get(id);assert.ok(f);
      if(init?.method==='PATCH'){
        const blob=Buffer.from(await (init.body as Blob).arrayBuffer()),text=blob.toString('latin1');const start=text.indexOf('{'),end=text.indexOf('\r\n--',start);const metadata=JSON.parse(blob.subarray(start,end).toString('utf8'));
        const bstart=text.indexOf('%PDF-'),bend=text.indexOf('\r\n--',bstart);const bytes=blob.subarray(bstart,bend);Object.assign(f,metadata,{md5Checksum:createHash('md5').update(bytes).digest('hex')});
      }
      return Response.json(f);
    };
    puppeteer.launch=(async()=>({newPage:async()=>({setJavaScriptEnabled:async()=>{},setRequestInterception:async()=>{},on:()=>{},setContent:async()=>{},evaluate:async()=>({fonts:true,images:true,pages:1,overflow:false}),emulateMediaType:async()=>{},pdf:async()=>pdf,close:async()=>{}}),close:async()=>{}})) as unknown as typeof puppeteer.launch;
    await assert.rejects(()=>generateReceiptDocuments(repo,'2026-09','tester'),/원장이 변경/);assert.equal(completed,false);
    reads=0;process.env.SETTLEMENT_DOCUMENT_CONFIG_JSON=JSON.stringify({...config,existingFiles:{}});
    await assert.rejects(()=>generateReceiptDocuments(repo,'2026-09','tester'),/기존 문서 연결/);assert.equal(completed,false);
  }finally{puppeteer.launch=savedLaunch;globalThis.fetch=savedFetch;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);}
});

test('a commit response alone never proves the READY run persisted with the intended artifacts',()=>{
  const files=[{id:'abcdefghij',name:'검증.pdf',url:'https://drive.google.com/file/d/abcdefghij/view',md5:'md5',sha256:'sha'}];
  const run={key:'k',month:'2026-09',status:'READY' as const,fileIds:['abcdefghij'],files,createdAt:1,leaseUntil:0,actor:'tester',attempt:'a'};
  for(const bad of [null,{...run,status:'RETRY' as const},{...run,files:[{...files[0],md5:'wrong'}]},{...run,fileIds:['wrong']}])assert.throws(()=>verifyReceiptDocumentRun(bad,'k','2026-09',files));
  assert.deepEqual(verifyReceiptDocumentRun(run,'k','2026-09',files),files);
});
