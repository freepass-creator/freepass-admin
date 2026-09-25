"""Reviewed integration of pinned UI with core; only the expected unresolved merge."""
from pathlib import Path
import subprocess,re
UI='0ce9df1772eb35e289d94b1a9fbc1f2cb286b75a'
CORE='27e3c4385132f45715f388c82c115151e05bd634'
def git(*args): return subprocess.check_output(['git',*args],text=True)
def put(path,text): Path(path).write_text(text)
def source(ref,path): return git('show',f'{ref}:{path}')
def replace(path,old,new):
    text=Path(path).read_text()
    assert old in text, (path,old)
    put(path,text.replace(old,new))
def choose(path,choices):
    text=Path(path).read_text()
    pat=r'^<<<<<<< HEAD\n(.*?)^=======\n(.*?)^>>>>>>> [^\n]+\n'
    parts=list(re.finditer(pat,text,re.M|re.S));assert len(parts)==len(choices),(path,len(parts),len(choices))
    i=iter(choices)
    put(path,re.sub(pat,lambda m: m.group(next(i)),text,flags=re.M|re.S))
expected={
'src/adapters/erp5/product-repository.ts','src/app/_design/FilterSheet.tsx',
'src/app/intake/IntakeDetailPanel.tsx','src/app/intake/NewIntakePanel.tsx','src/app/intake/actions.ts',
'src/app/products/workspace-config.test.ts','src/app/products/workspace-config.ts','src/app/products/workspace.tsx',
'src/server/data-status.ts','src/server/erp5.test.ts','src/server/erp5.ts','src/server/freepass-data.ts'}
assert set(git('diff','--name-only','--diff-filter=U').splitlines())==expected
assert git('rev-parse','MERGE_HEAD').strip()==UI
choose('src/adapters/erp5/product-repository.ts',[2])
choose('src/app/_design/FilterSheet.tsx',[1])
choose('src/app/intake/IntakeDetailPanel.tsx',[2,2])
choose('src/app/intake/NewIntakePanel.tsx',[2,2])
choose('src/app/intake/actions.ts',[1,2,1])
# The catalog contract is authoritative; Admin workflow composition remains separate.
for path in ['src/server/freepass-data.ts','src/server/erp5.ts','src/server/erp5.test.ts']:
    put(path,source(UI,path))
with Path('src/server/erp5.ts').open('a') as f:
    f.write("\n/** Admin workflow adapters share the existing explicit write gate. */\nexport { writeEnabled, WriteDisabledError, type ClaimView } from '../adapters/erp5/settlement-repository';\nexport { loadFeeRuleSet as feeRuleSet } from '../adapters/erp5/fee-rules';\nexport { ERP5_PROJECT_ID, erp5Ready } from '../adapters/erp5/firestore';\n")
choose('src/server/data-status.ts',[2,2])
replace('src/server/data-status.ts',"import { ERP5_PROJECT_ID, erp5Ready } from '../adapters/erp5/firestore';\nimport { writeEnabled } from '../adapters/erp5/settlement-repository';", "import { ERP5_PROJECT_ID, erp5Ready, writeEnabled } from './erp5';\nimport { esign } from './esign';")
replace('src/server/data-status.ts','freePassDataReady()','erp5Ready()')
replace('src/server/data-status.ts','freePassDataWriteEnabled()','writeEnabled()')
# Keep centralized Finder semantics, not an older duplicated UI search engine.
for path in ['src/app/products/workspace-config.ts','src/app/products/workspace-config.test.ts','src/app/products/workspace.tsx']:
    put(path,source(CORE,path))
p='src/app/products/workspace.tsx'
replace(p,'ActionBar, EmptyState, PanelHeader, SearchField','ActionBar, EmptyState, Notice, PanelHeader, SearchField')
replace(p,'''  let all: Awaited<ReturnType<typeof productList>>;
  try { all = await productList(); }
  catch (e) {
    return <><h1>상품찾기</h1><p className="fn-err">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></>;
  }''','''  // Catalog authority stays FreePass Data; OBSERVE uses its explicit legacy bridge.
  const all = await productList();''')
replace(p,"supplier: 많은순(pool.map((h) => h.product.supplierName ?? h.product.supplierId))", "supplier: 많은순(pool.flatMap((h) => h.matchedOffers.map((o) => o.supplierName ?? o.supplierId ?? h.product.supplierName ?? h.product.supplierId)))")
replace(p,'{car.supplierName ?? car.supplierId}', '{sel.lead?.supplierName ?? sel.lead?.supplierId ?? car.supplierName ?? car.supplierId}')
replace(p,"catch (e) { intakeErr = (e as Error).message; }", "catch { intakeErr = '접수 목록을 불러오지 못했습니다. 다시 시도해 주세요.'; }")
text=Path(p).read_text()
text=re.sub(r'<EmptyState>ERP5[^<]*\{intakeErr\}</EmptyState>', '<Notice tone="warn">{intakeErr}</Notice>',text)
put(p,text)
# Workflow calls cross Admin composition; catalog calls keep Data's reader.
for p in ['src/app/c/actions.ts','src/server/contracts.ts','src/app/settlement/page.tsx','src/app/esign/page.tsx','src/app/intake/IntakeDetailPanel.tsx','src/app/_design/AdminChrome.tsx']:
    text=Path(p).read_text().replace("from '../../server/freepass-data'", "from '../../server/erp5'").replace("from './freepass-data'", "from './erp5'")
    text=text.replace('freePassDataWriteEnabled','writeEnabled').replace('freePassDataReady','erp5Ready')
    text=text.replace("import { writeEnabled } from '../../adapters/erp5/settlement-repository';", "import { writeEnabled } from '../../server/erp5';")
    put(p,text)
replace('src/app/products/workspace.tsx', "import { productList, settlements, today } from '../../server/freepass-data';", "import { productList } from '../../server/freepass-data';\nimport { settlements, today } from '../../server/erp5';")
replace('src/app/intake/actions.ts',"import { feeRuleSet, productByIdFresh, settlements, today, WriteDisabledError } from '../../server/freepass-data';", "import { productByIdFresh } from '../../server/freepass-data';\nimport { feeRuleSet, settlements, today, WriteDisabledError } from '../../server/erp5';")
replace('src/app/intake/NewIntakePanel.tsx',"import { writeEnabled } from '../../adapters/erp5/settlement-repository';", "import { writeEnabled } from '../../server/erp5';")
replace('src/app/_design/AdminChrome.tsx',"data.ok ? '프리패스 데이터 연결됨' : '프리패스 데이터 연결 필요'", "data.ok ? '데이터 설정됨' : '데이터 설정 필요'")
# Supplier is an Offer fact; fallback only for legacy Offers lacking both name/id.
p='src/domain/search/finder.ts'
replace(p,"['term', 'rent', 'dep', 'mile']", "['term', 'rent', 'dep', 'mile', 'supplier']")
replace(p,"'status', 'vc', 'kind', 'perk', 'supplier', 'maker'", "'status', 'vc', 'kind', 'perk', 'maker'")
replace(p,"    case 'supplier': return (product.supplierName??product.supplierId)===key;\n",'')
replace(p,'function offerAxisMatches(offer:Offer,axis:OfferFinderAxis,key:string):boolean {',"export function offerAxisMatches(offer:Offer,axis:OfferFinderAxis,key:string,product?:Pick<CanonicalProduct,'supplierId'|'supplierName'>):boolean {")
replace(p,"    case 'term': return String(offer.termMonths)===key;", "    case 'supplier': return (offer.supplierName??offer.supplierId??product?.supplierName??product?.supplierId)===key;\n    case 'term': return String(offer.termMonths)===key;")
replace(p,'offerAxisMatches(offer,axis as OfferFinderAxis,key)', 'offerAxisMatches(offer,axis as OfferFinderAxis,key,match.product)')
replace(p,'offerAxisMatches(offer,axis,key)', 'offerAxisMatches(offer,axis,key,product)')
# Both UI supplier regression and existing mileage regressions stay executable.
p='src/app/products/workspace-config.test.ts'
with Path(p).open('a') as f:
    f.write("\nimport { offerAxisMatches } from '../../domain/search/finder';\n\ntest('supplier facet is Offer-level so one Product preserves multiple suppliers', () => {\n  const a: Offer = { ...offer('a', 500_000), supplierId: 'SUP-A', supplierName: '공급사 A' };\n  const b: Offer = { ...offer('b', 510_000), supplierId: 'SUP-B', supplierName: '공급사 B' };\n  assert.equal(offerAxisMatches(a, 'supplier', '공급사 A'), true);\n  assert.equal(offerAxisMatches(a, 'supplier', '공급사 B'), false);\n  assert.equal(offerAxisMatches(b, 'supplier', '공급사 B'), true);\n});\n")
p='src/domain/search/__tests__/finder.test.ts'
with Path(p).open('a') as f:
    f.write("""
test('supplier and rent must match the same Offer; facade supplier cannot override it',()=>{
  const p=product({supplierId:'PARENT',supplierName:'원상품 공급사',offers:[
    offer({id:'cheap-a',supplierId:'A',supplierName:'공급사 A',monthlyRent:500_000}),
    offer({id:'costly-b',supplierId:'B',supplierName:'공급사 B',monthlyRent:900_000}),
  ]});
  const selection=emptyFinderSelection();
  selection.supplier=['공급사 B']; selection.rent=['r50'];
  assert.equal(matchFinderProduct(p,input({selection})),null);
  selection.rent=['r90'];
  assert.deepEqual(matchFinderProduct(p,input({selection}))?.matchedOfferIds,['costly-b']);
  selection.supplier=['원상품 공급사'];
  assert.equal(matchFinderProduct(p,input({selection})),null);
});
""")
# Replace the conflicting architectural assumption with strict ownership gates.
put('src/server/freepass-data-boundary.test.ts', '''import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).replaceAll('\\\\', '/');
    return entry.isDirectory() ? sources(path) : /\\.tsx?$/.test(path) && !/\\.test\\.tsx?$/.test(path) ? [path] : [];
  });
}

test('UI and services cannot bypass Catalog or Admin workflow composition roots', () => {
  const violations = [...sources('src/app'), ...sources('src/services')].filter((path) =>
    /(?:from|import\\()\\s*['"][^'"]*(?:adapters\\/erp5|firebase-admin|firebase\\/database)/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(violations, []);
});

test('FreePass Data catalog authority never absorbs Admin workflow ownership', () => {
  const catalog = readFileSync('src/server/freepass-data.ts', 'utf8');
  const workflows = readFileSync('src/server/erp5.ts', 'utf8');
  assert.match(catalog, /new AdminCatalogSwitchboard\\(legacyProducts, freepassDataProducts\\)/);
  assert.doesNotMatch(catalog, /Erp5SettlementRepository|Erp5ContractRepository|esignRepository|firebase-admin/);
  assert.match(workflows, /new Erp5SettlementRepository\\(\\)/);
  assert.match(workflows, /new Erp5ContractRepository\\(\\)/);
  assert.doesNotMatch(workflows, /new Erp5ProductRepository|firebase-admin/);
});

test('Catalog callers never reach directly for ERP5 product persistence', () => {
  const allowed = new Set(['src/server/freepass-data.ts']);
  const violations = sources('src/server').filter((path) => !allowed.has(path)
    && /from\\s+['"][^'"]*adapters\\/erp5\\/product-repository/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(violations, []);
});
''')
for path in expected:
    assert not re.search(r'^(<<<<<<<|=======|>>>>>>>)',Path(path).read_text(),re.M),path
subprocess.run(['git','add','src'],check=True)
