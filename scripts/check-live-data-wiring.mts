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
const server=await read('src/server/erp5.ts');
const productRepo=await read('src/adapters/erp5/product-repository.ts');
const settlementRepo=await read('src/adapters/erp5/settlement-repository.ts');
const status=await read('src/server/data-status.ts');

const must=(ok:boolean,msg:string)=>{if(!ok)errors.push(msg)};

must(/redirect\(['\"]\/intake['\"]\)/.test(rootPage),'root route must enter the real /intake workspace');
must(!/INITIAL_APPS|const\s+PRODUCTS\s*=|MOCK_|fixtureData|demoData/.test(rootPage),'root route must not contain local fake runtime data');
must(/redirect\(['\"]\/intake['\"]\)/.test(designPage),'legacy /design route must redirect to /intake');
must(!/INITIAL_APPS|const\s+PRODUCTS\s*=|MOCK_|fixtureData|demoData/.test(designPage),'legacy /design route must not contain fake runtime data');
must(intakeListPage.includes("redirect(`/intake?${u}`)"),'legacy /intake/list route must redirect to canonical /intake workspace');

must(/productList\(\)/.test(product),'products workspace must read productList()');
must(/settlements\.list\(\)/.test(product),'intake workspace must read settlements.list()');
must(/settlements\.list\(\)/.test(settlement),'settlement route must read settlements.list()');
must(/settlements\.clawbacks\(\)/.test(settlement),'settlement route must read clawbacks');
must(/settlements\.invoices\(/.test(settlement),'settlement route must read issued invoices');
must(/contracts\.list\(\)/.test(esign),'esign route must read contracts.list()');
must(/new Erp5ProductRepository\(\)/.test(server),'server must use Erp5ProductRepository');
must(/new Erp5SettlementRepository\(\)/.test(server),'server must use Erp5SettlementRepository');
must(/new Erp5ContractRepository\(\)/.test(server),'server must use Erp5ContractRepository');
must(/collection\('products'\)/.test(productRepo),'product repository must read ERP5 products collection');
must(/const ROWS = 'settlement_rows'/.test(settlementRepo),'settlement repository must use settlement_rows');
must(/const CASH_EVENTS = 'settlement_cash_events'/.test(settlementRepo),'cash movement ledger must use settlement_cash_events');
must(/async cashEvents\(\)/.test(settlementRepo),'cash movement ledger read must be exposed for runtime status/audit');
must(/ERP5_WRITE/.test(settlementRepo),'settlement writes must be explicitly gated');
must(/adminDataStatus/.test(status),'live data status probe missing');

for(const [name,src] of [['products',product],['settlement',settlement],['esign',esign]] as const){
  must(!/INITIAL_APPS|const\s+PRODUCTS\s*=|MOCK_|fixtureData|demoData/.test(src),`${name} route contains local fake runtime data`);
}

if(errors.length){
  console.error('LIVE DATA WIRING CHECK FAILED');
  for(const e of errors)console.error(`- ${e}`);
  process.exitCode=1;
}else{
  console.log('LIVE DATA WIRING CHECK PASS');
  console.log('- products -> Erp5ProductRepository / products');
  console.log('- intake + settlement -> Erp5SettlementRepository / settlement_rows');
  console.log('- settlement -> clawbacks + invoices + lifecycle actions + cash events');
  console.log('- esign -> Erp5ContractRepository / contract');
  console.log('- writes remain fail-closed unless ERP5_WRITE=on');
}
