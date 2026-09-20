import { readFile } from 'node:fs/promises';

type Check={id:string;ok:boolean;detail:string};
const checks:Check[]=[];

async function text(path:string){
  return readFile(path,'utf8');
}
function add(id:string,ok:boolean,detail:string){
  checks.push({id,ok,detail});
}
function has(source:string,needle:string){
  return source.includes(needle);
}

const [
  root,
  products,
  intake,
  intakeNew,
  settlement,
  settlementActions,
  settlementService,
  settlementDomain,
  runtime,
  authConfig,
  authSession,
  erp5,
  erp5Product,
  freepassDataProduct,
  productSearch,
  applicationCreate,
  settlementPricingPort,
  settlementPricingService,
  erp5Application,
  erp5Operations,
  intakeActions,
  applicationService,
  referenceMaster,
  repositoryPort,
  fileRepositories,
  fileOperations,
  erp5OperationsForBilling,
  smoke,
  dataShadow,
  env,
  pkg,
  workflow,
]=await Promise.all([
  text('src/app/page.tsx'),
  text('src/app/products/page.tsx'),
  text('src/app/intake/page.tsx'),
  text('src/app/intake/new/page.tsx'),
  text('src/app/settlement/page.tsx'),
  text('src/app/settlement/actions.ts'),
  text('src/services/settlement-operations.ts'),
  text('src/domain/settlement/settlement.ts'),
  text('src/server/admin-runtime.ts'),
  text('src/server/auth/config.ts'),
  text('src/server/auth/session.ts'),
  text('src/adapters/erp5/firestore.ts'),
  text('src/adapters/erp5/product-repository.ts'),
  text('src/adapters/freepass-data/product-repository.ts'),
  text('src/domain/search/match-product.ts'),
  text('src/domain/application/create-application.ts'),
  text('src/ports/settlement-pricing.ts'),
  text('src/services/settlement-pricing.ts'),
  text('src/adapters/erp5/application-repository.ts'),
  text('src/adapters/erp5/operations-repository.ts'),
  text('src/app/intake/actions.ts'),
  text('src/services/applications.ts'),
  text('src/server/admin-masters.ts'),
  text('src/ports/repositories.ts'),
  text('src/adapters/store/repositories.ts'),
  text('src/adapters/store/operations-repository.ts'),
  text('src/adapters/erp5/operations-repository.ts'),
  text('scripts/admin-vertical-smoke.mts'),
  text('scripts/admin-data-shadow.mts'),
  text('.env.example'),
  text('package.json'),
  text('.github/workflows/backend-check.yml'),
]);

add('root.real-entry',
  has(root,"redirect('/products')")&&!has(root,'const PRODUCTS'),
  'Root must redirect to real product search and must not contain the old hardcoded catalog.');

for(const [id,source] of [
  ['products',products],
  ['intake',intake],
  ['intake-new',intakeNew],
  ['settlement',settlement],
] as const){
  add('page.auth.'+id,
    has(source,'requireAdminPageActor')&&has(source,'await requireAdminPageActor()'),
    id+' must require a verified server-side Admin actor before reading operational data.');
}

add('actor.session-bound',
  has(runtime,'sessionActorProvider')&&!/freepasserp3|freepasserp4/i.test(runtime),
  'Runtime ActorProvider must come from the Admin session boundary and must not fall back to ERP4 authentication.');

add('auth.explicit-project',
  has(authConfig,'FPA_AUTH_PROJECT_ID_REQUIRED')&&has(authConfig,'FPA_AUTH_PROJECT_ID_MISMATCH'),
  'Auth project must be explicit and service-account project_id must match.');

add('auth.uid-authority',
  has(authConfig,'FPA_ADMIN_UIDS_REQUIRED')&&has(authConfig,'ADMIN_UID_NOT_ALLOWED')&&!has(authConfig,'FPA_ADMIN_EMAILS'),
  'Admin authorization must be UID based; email alone must not grant ADMIN.');

add('auth.production-no-dev-fallback',
  has(authConfig,"return'UNBOUND_PRODUCTION'")&&has(authSession,'ADMIN_PRODUCTION_AUTH_NOT_BOUND'),
  'Production must fail closed when Firebase Auth is not explicitly selected.');

add('erp5.exact-project',
  has(erp5,"ERP5_PROJECT_ID='freepasserp5'")&&has(erp5,'ERP5_PROJECT_ID_MISMATCH'),
  'ERP5 persistence must bind only to the exact freepasserp5 project.');

add('erp5.namespace-required',
  has(erp5,'ERP5_ADMIN_NAMESPACE_REQUIRED')&&has(erp5,'ERP5_ADMIN_NAMESPACE'),
  'Admin-owned write collections must require an explicit namespace.');

add('erp5.write-gate',
  has(erp5,'ERP5_WRITE_DISABLED')&&has(erp5,"==='on'"),
  'ERP5 mutation must remain closed unless ERP5_WRITE=on.');

add('erp5.product-read-only',
  has(erp5Product,'ERP5_PRODUCT_WRITE_FORBIDDEN'),
  'Canonical Product adapter must remain read-only.');

add('catalog.source-split',
  has(runtime,'FPA_PRODUCT_SOURCE')&&has(runtime,'FREEPASS_DATA')&&has(runtime,'adminProductSourceMode'),
  'Catalog read source must be independently switchable from Admin operational persistence.');

add('catalog.data-contract',
  has(freepassDataProduct,'freepass-data.admin-catalog/v1')
    &&has(freepassDataProduct,'/v1/views/admin-catalog/products'),
  'FreePass Data adapter must pin the versioned Admin Catalog consumer contract.');

add('catalog.data-no-zero-guess',
  has(freepassDataProduct,"term.depositState === 'ZERO'")
    &&has(freepassDataProduct,"term.depositState === 'KNOWN'")
    &&has(freepassDataProduct,'UNKNOWN and NOT_APPLICABLE must never be silently converted to zero'),
  'FreePass Data deposit semantics must preserve unknown/not-applicable instead of coercing to zero.');

add('catalog.data-read-only',
  has(freepassDataProduct,'FREEPASS_DATA_PRODUCT_WRITE_FORBIDDEN'),
  'FreePass Data catalog adapter must remain read-only until command cutover.');

add('catalog.offer-supplier-authority',
  has(productSearch,'offer.supplierId ?? product.supplierId')
    &&has(applicationCreate,'offer.supplierId ?? input.product.supplierId'),
  'Supplier authority must follow the selected Offer for multi-supplier Data products.');

add('catalog.data-shadow-command',
  has(pkg,'"admin:data-shadow"')&&has(dataShadow,'compareProductSources')
    &&has(dataShadow,'FPA_DATA_SHADOW_STRICT'),
  'Admin must provide an explicit ERP5-vs-FreePass-Data shadow parity command before read cutover.');

add('catalog.provenance-to-intake',
  has(applicationCreate,'sourceSnapshotId: input.product.sourceSnapshotId')
    &&has(applicationCreate,'supplierProductKey: input.product.supplierProductKey'),
  'Application Snapshot must preserve upstream catalog release/source provenance.');

add('settlement.pricing-layer-boundary',
  has(settlementPricingPort,'SettlementCatalogFacts')
    &&has(settlementPricingPort,'SettlementOperationalFacts')
    &&has(settlementPricingPort,'SettlementPricingProvider'),
  'Settlement pricing contract must keep catalog facts separate from Admin operational facts.');

add('settlement.pricing-provenance',
  has(settlementPricingService,'sourceOfferId')
    &&has(settlementPricingService,'sourceOfferRevision')
    &&has(settlementPricingService,'sourcePriceTermKey')
    &&has(settlementPricingService,'sourceSnapshotId'),
  'Settlement pricing input must retain Data release and Offer/PriceTerm provenance.');

add('erp5.application-transaction',
  has(erp5Application,'runTransaction')&&has(erp5Application,"erp5AdminCollection('applications')")&&has(erp5Application,"erp5AdminCollection('counters')"),
  'Application persistence must use namespaced collections and transaction-based sequencing.');

add('erp5.operations-transaction',
  has(erp5Operations,'runTransaction')&&has(erp5Operations,"erp5AdminCollection('performances')")&&has(erp5Operations,"erp5AdminCollection('settlements')"),
  'Performance/Settlement persistence must preserve transactional boundaries.');

add('master.runtime-bound',
  has(referenceMaster,'Erp5ReferenceMaster')&&has(referenceMaster,'EnvReferenceMaster'),
  'Reference Master must be selected by runtime mode.');

add('master.intake-action-bound',
  has(intakeActions,'adminReferenceMaster()'),
  'Intake Server Action must provide the runtime Reference Master.');

add('master.service-enforced',
  has(applicationService,'requireActiveSalesChannel')&&has(applicationService,'requireActiveAssignee')
    &&has(applicationService,'SALES_CHANNEL_NOT_ACTIVE')&&has(applicationService,'ASSIGNEE_NOT_ACTIVE'),
  'Application Service must fail closed on non-master channel or assignee ids.');

add('master.dev-explicit',
  has(env,'FPA_DEV_SALES_CHANNEL_IDS=channel-dev'),
  'Development channel master must be explicit in the environment contract.');

add('idempotency.semantic-service',
  has(applicationService,'submissionFingerprint(input)')&&has(applicationService,'storedSubmissionFingerprint(already)')
    &&has(applicationService,'IDEMPOTENCY_KEY_REUSE'),
  'Application Service must compare semantic fingerprints before replay.');

add('idempotency.atomic-port',
  has(repositoryPort,'submissionFingerprint: string'),
  'Application repository atomic create contract must receive the semantic fingerprint.');

add('idempotency.atomic-file',
  has(fileRepositories,'storedSubmissionFingerprint(existing) !== submissionFingerprint'),
  'File repository must reject different payloads inside the atomic create boundary.');

add('idempotency.atomic-erp5',
  has(erp5Application,'storedSubmissionFingerprint(application)!==submissionFingerprint'),
  'ERP5 transaction must reject different payloads inside the atomic create boundary.');

add('smoke.script-registered',
  has(pkg,'"admin:smoke"')&&has(pkg,'scripts/admin-vertical-smoke.mts'),
  'package.json must expose the full vertical smoke command.');

add('smoke.ci-enforced',
  has(workflow,'npm run admin:smoke'),
  'backend-check must execute the Admin vertical smoke before readiness/build.');

add('billing.evidence-domain-gate',
  has(settlementDomain,"billing.status !== 'EVIDENCE_COMPLETE'")&&has(settlementDomain,'Billing invoice evidence must be complete before collection.'),
  'Collection must remain fail-closed until invoice evidence is complete.');

add('billing.evidence-service',
  has(settlementService,'recordBillingEvidence')&&has(settlementService,'recordBillingInvoiceEvidence'),
  'Settlement service must expose actor-backed billing evidence recording.');

add('billing.evidence-ui',
  has(settlement,'recordBillingEvidenceAction')&&has(settlementActions,'recordBillingEvidence(deps()'),
  'Settlement UI and Server Action must expose the invoice evidence step before collection.');

add('billing.evidence-file-persistence',
  has(fileOperations,'mutateBilling')&&has(fileOperations,'BILLING_IDENTITY_IMMUTABLE'),
  'Development operations repository must persist billing evidence without changing billing identity.');

add('billing.evidence-erp5-persistence',
  has(erp5OperationsForBilling,'mutateBilling')&&has(erp5OperationsForBilling,'runTransaction'),
  'ERP5 operations repository must persist billing evidence transactionally.');

add('billing.evidence-smoke',
  has(smoke,'SMOKE-INVOICE-001')&&has(smoke,"billingWithEvidence.status,'EVIDENCE_COMPLETE'"),
  'Vertical smoke must prove invoice evidence survives before collection.');

for(const key of [
  'FPA_REPOSITORY_MODE=erp5',
  'FPA_PRODUCT_SOURCE=freepass-data',
  'FREEPASS_DATA_BASE_URL=https://data.internal.example',
  'FREEPASS_DATA_SERVICE_TOKEN=<service-token>',
  'ERP5_ADMIN_NAMESPACE=freepass_admin_v1',
  'ERP5_WRITE=on',
  'FPA_AUTH_MODE=firebase',
  'FPA_AUTH_PROJECT_ID=<independent-auth-project-id>',
  'FPA_ADMIN_UIDS=uid-1,uid-2',
]){
  add('env.'+key.split('=')[0].toLowerCase(),
    has(env,key),
    '.env.example must document '+key+'.');
}

const failed=checks.filter((x)=>!x.ok);
console.log(JSON.stringify({
  schema:'freepass-admin-readiness/v1',
  status:failed.length?'FAIL':'PASS',
  totals:{checks:checks.length,pass:checks.length-failed.length,fail:failed.length},
  checks,
},null,2));

if(failed.length)process.exitCode=1;
