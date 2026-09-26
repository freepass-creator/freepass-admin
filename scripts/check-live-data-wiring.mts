import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const read=(p:string)=>readFile(path.join(root,p),'utf8');
const errors:string[]=[];

const rootPage=await read('src/app/page.tsx');
const designPage=await read('src/app/design/page.tsx');
const intakeListPage=await read('src/app/intake/list/page.tsx');
const product=await read('src/app/products/workspace.tsx');
const settlement=await read('src/app/settlement/page.tsx');
const esign=await read('src/app/esign/page.tsx');
const esignRuntime=await read('src/server/esign.ts');
const esignRepo=await read('src/adapters/erp5/esign-repository.ts');
const esignService=await read('src/services/esign/service.ts');
const compatibility=await read('src/server/erp5.ts');
const server=await read('src/server/freepass-data.ts');
const catalogServer=server;
const catalogSwitch=await read('src/adapters/freepass-data/admin-catalog-reader.ts');
const catalogClient=await read('src/adapters/freepass-data/admin-catalog-client.ts');
const productRepo=await read('src/adapters/erp5/product-repository.ts');
const settlementRepo=await read('src/adapters/erp5/settlement-repository.ts');
const intakeActions=await read('src/app/intake/actions.ts');
const status=await read('src/server/data-status.ts');

const must=(ok:boolean,msg:string)=>{if(!ok)errors.push(msg)};

must(/redirect\(['\"]\/intake['\"]\)/.test(rootPage),'root route must enter the real /intake workspace');
must(!/INITIAL_APPS|const\s+PRODUCTS\s*=|MOCK_|fixtureData|demoData/.test(rootPage),'root route must not contain local fake runtime data');
must(/redirect\(['\"]\/intake['\"]\)/.test(designPage),'legacy /design route must redirect to /intake');
must(!/INITIAL_APPS|const\s+PRODUCTS\s*=|MOCK_|fixtureData|demoData/.test(designPage),'legacy /design route must not contain fake runtime data');
must(intakeListPage.includes("redirect(`/intake?${u}`)"),'legacy /intake/list route must redirect to canonical /intake workspace');

must(/from ['"]\.\.\/\.\.\/server\/freepass-data['"]/.test(product),'products workspace must enter through FreePass Data catalog boundary');
must(/productList\(\)/.test(product),'products workspace must read productList()');
must(/settlements\.list\(\)/.test(product),'intake workspace must read settlements.list()');
must(/settlements\.list\(\)/.test(settlement),'settlement route must read settlements.list()');
must(/settlements\.clawbacks\(\)/.test(settlement),'settlement route must read clawbacks');
must(/settlements\.invoices\(/.test(settlement),'settlement route must read issued invoices');
must(/contracts\.list\(\)/.test(esign),'esign route must read contracts.list()');
must(/new EsignService\(esignRepository, esignAssets, esignFinalDocumentRenderer\)/.test(esignRuntime),'esign runtime must compose EsignService with Data ports and the production PDF renderer');
must(/from '\.\.\/adapters\/esign\/puppeteer-final-document-renderer'/.test(esignRuntime),'esign runtime must use the server Chromium PDF renderer (no mock renderer)');
must(/const SESSIONS='esign_session'/.test(esignRepo),'esign repository must use esign_session');
must(/const PRIVATE='esign_private'/.test(esignRepo),'esign repository must keep private submissions separate');
must(/const EVENTS='esign_event'/.test(esignRepo),'esign repository must persist esign events');
must(/writeEnabled/.test(esignRepo),'esign writes must use the shared ERP5 write gate');
must(/PUBLIC_BASE_URL/.test(esignService) && /new URL\(raw\)/.test(esignService),'esign issue must require an absolute public base');
must(!/adapters\/erp5|new Erp5/.test(compatibility) && /from '\.\/freepass-data'/.test(compatibility),'ERP5 compatibility alias must only forward to the FreePass Data gateway');
must(/from '\.\/freepass-data'/.test(esignRuntime),'esign persistence ports must come through the FreePass Data gateway');
must(/new AdminCatalogSwitchboard\(legacyProducts,\s*freepassDataProducts\)/.test(catalogServer),'Catalog server must compose legacy + FreePass Data shadow readers behind AdminCatalogReader');
must(/new Erp5ProductRepository\(\)/.test(catalogServer),'Catalog OBSERVE mode must keep the explicit legacy ERP5 bridge');
must(/FREEPASS_DATA_ADMIN_CATALOG_READ_MODE/.test(catalogSwitch),'Admin Catalog switchboard must use the central FreePass Data read-mode key');
must(/'OBSERVE'/.test(catalogSwitch),'Admin Catalog default stage must remain OBSERVE until cutover evidence exists');
must(/mode !== 'SHADOW_READ'/.test(catalogSwitch) && /compareAdminCatalogShadow/.test(catalogSwitch),'SHADOW_READ must compare Data independently while keeping legacy output');
must(/FREEPASS_DATA_READ/.test(catalogSwitch) && /parity\/fallback\/readback/.test(catalogSwitch),'final Data-read modes must remain fail closed until cutover evidence exists');
must(/freepass-admin-catalog/.test(catalogClient),'FreePass Data client must use the dedicated Admin consumer identity');
must(/cache:\s*'no-store'/.test(catalogClient) && /AbortSignal\.timeout\(5_000\)/.test(catalogClient),'FreePass Data shadow client must be no-store and timeout bounded');
must(/FREEPASS_DATA_ADMIN_CATALOG_TOKEN/.test(catalogClient),'FreePass Data Admin Catalog token binding missing');
must(/new Erp5SettlementRepository\(\)/.test(server),'FreePass Data gateway must use Erp5SettlementRepository');
must(/new Erp5ContractRepository\(\)/.test(server),'FreePass Data gateway must use Erp5ContractRepository');
must(/collection\('products'\)/.test(productRepo),'product repository must read ERP5 products collection');
must(/const ROWS = 'settlement_rows'/.test(settlementRepo),'settlement repository must use settlement_rows');
must(/const CASH_EVENTS = 'settlement_cash_events'/.test(settlementRepo),'cash movement ledger must use settlement_cash_events');
must(/async cashEvents\(\)/.test(settlementRepo),'cash movement ledger read must be exposed for runtime status/audit');
must(/ERP5_WRITE/.test(settlementRepo),'settlement writes must be explicitly gated');
must(/erp5WriteGate/.test(settlementRepo),'settlement writes must pass the shared production approval gate');
must(/planClaimResponse/.test(settlementRepo),'claim link response must be final and retry-idempotent in the settlement transaction');
must(/CLAIM_LINK_BASE/.test(intakeActions) && /new URL\(rawBase\)/.test(intakeActions),'claim link creation must require an absolute public base before token creation');
must(/adminDataStatus/.test(status),'live data status probe missing');
must(/writeGate\(\)/.test(status),'data-status must expose the fail-closed ERP5 write gate, not only a boolean');
must(/adminCatalogListFresh\(\)/.test(status),'data-status must bypass product cache through the FreePass Data catalog boundary');
must(/authority:\s*'FREEPASS_DATA'/.test(status),'data-status must identify FreePass Data as the data authority');
must(!/productList\(\)/.test(status),'data-status must not report the cached productList as a live repository probe');

for(const [name,src] of [['products',product],['settlement',settlement],['esign',esign]] as const){
  must(!/INITIAL_APPS|const\s+PRODUCTS\s*=|MOCK_|fixtureData|demoData/.test(src),`${name} route contains local fake runtime data`);
}

if(errors.length){
  console.error('LIVE DATA WIRING CHECK FAILED');
  for(const e of errors)console.error(`- ${e}`);
  process.exitCode=1;
}else{
  console.log('LIVE DATA WIRING CHECK PASS');
  console.log('- products -> FreePass Data AdminCatalogReader boundary (OBSERVE default; SHADOW_READ compares Data but returns legacy; final cutover gated)');
  console.log('- intake + settlement -> FreePass Data gateway -> Erp5SettlementRepository / settlement_rows');
  console.log('- settlement -> clawbacks + invoices + lifecycle actions + cash events');
  console.log('- esign list and persistence -> FreePass Data gateway -> shared contract/session/private/Storage adapters');
  console.log('- esign runtime -> EsignService / esign_session + esign_private + Storage + Chromium PDF renderer');
  console.log('- writes remain fail-closed unless ERP5_WRITE=on');
}
