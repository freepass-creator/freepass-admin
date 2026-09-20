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
  productFilterSheet,
  globalCss,
  productTypes,
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
  offerTermDomain,
  applicationCreate,
  settlementPricingPort,
  settlementPricingService,
  settlementPricingRuntime,
  settlementPricingProvider,
  settlementFeeRules,
  settlementSupplierResolver,
  performanceDomain,
  erp5Application,
  erp5Operations,
  intakeActions,
  applicationService,
  referenceMaster,
  repositoryPort,
  operationsPort,
  fileRepositories,
  fileOperations,
  erp5OperationsForBilling,
  smoke,
  dataShadow,
  f04Port,
  f04Service,
  f04LinkFile,
  f04LinkErp5,
  f04Runtime,
  env,
  pkg,
  workflow,
]=await Promise.all([
  text('src/app/page.tsx'),
  text('src/app/products/page.tsx'),
  text('src/app/products/ProductFilterSheet.tsx'),
  text('src/app/globals.css'),
  text('src/domain/product/types.ts'),
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
  text('src/domain/product/offer-terms.ts'),
  text('src/domain/application/create-application.ts'),
  text('src/ports/settlement-pricing.ts'),
  text('src/services/settlement-pricing.ts'),
  text('src/server/admin-settlement-pricing.ts'),
  text('src/adapters/settlement-pricing/fp-settlement-provider.ts'),
  text('src/adapters/settlement-pricing/fp-settlement-fee-table.ts'),
  text('src/adapters/erp5/settlement-supplier-rule-key.ts'),
  text('src/domain/performance/performance.ts'),
  text('src/adapters/erp5/application-repository.ts'),
  text('src/adapters/erp5/operations-repository.ts'),
  text('src/app/intake/actions.ts'),
  text('src/services/applications.ts'),
  text('src/server/admin-masters.ts'),
  text('src/ports/repositories.ts'),
  text('src/ports/operations.ts'),
  text('src/adapters/store/repositories.ts'),
  text('src/adapters/store/operations-repository.ts'),
  text('src/adapters/erp5/operations-repository.ts'),
  text('scripts/admin-vertical-smoke.mts'),
  text('scripts/admin-data-shadow.mts'),
  text('src/ports/legacy-f04.ts'),
  text('src/services/f04-bridge.ts'),
  text('src/adapters/store/f04-row-link-repository.ts'),
  text('src/adapters/erp5/f04-row-link-repository.ts'),
  text('src/server/admin-f04.ts'),
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

add('settlement.pricing-rule-provenance',
  has(settlementFeeRules,'ccc8b5456c79a00f00c3795ee87b94061f96791f')
    &&has(settlementPricingProvider,'ENGINE_REVISION')
    &&has(settlementPricingProvider,'feeRuleFor'),
  'Settlement auto-pricing must pin the reverse-imported proven fp-settlement fee-rule revision.');

add('settlement.pricing-supplier-identity',
  has(settlementSupplierResolver,'settlement_rule_key')
    &&has(settlementSupplierResolver,"partnerTypeLabel(data.partner_type??data.type,id)!=='공급사'"),
  'Stable supplier ids must resolve through a supplier master before fee-rule lookup.');

add('settlement.pricing-runtime',
  has(settlementPricingRuntime,'Erp5SettlementSupplierRuleKeyProvider')
    &&has(settlementPricingRuntime,'EnvSettlementSupplierRuleKeyProvider')
    &&has(settlementPricingRuntime,'FpSettlementPricingProvider'),
  'Pricing provider must be bound by runtime mode without changing workflow Domain.');

add('settlement.pricing-safe-review',
  has(settlementPricingProvider,"status:'REVIEW_REQUIRED'")
    &&has(settlementPricingProvider,'manualFeeDecision')
    &&has(settlementPricingProvider,'commercialForm')
    &&has(settlementPricingProvider,'vehiclePrice'),
  'Unknown/manual settlement rules must fail to review instead of guessing.');

add('settlement.pricing-ui-usecase',
  has(settlementService,'suggestPerformancePricing')
    &&has(settlementActions,'suggestPerformancePricing')
    &&has(settlement,'suggestAmounts'),
  'Existing settlement workflow must expose the pricing suggestion use case.');

add('settlement.pricing-evidence',
  has(performanceDomain,'applySuggestedSettlementAmounts')
    &&has(performanceDomain,'pricingEvidence')
    &&has(settlementDomain,'performance.pricingEvidence'),
  'Auto-pricing evidence must survive Performance and freeze into finalized Settlement.');

add('review.party-snapshot-binding',
  has(performanceDomain,'SALESPERSON_PARTY_MISMATCH')
    &&has(performanceDomain,'SUPPLIER_PARTY_MISMATCH')
    &&has(performanceDomain,'performance.snapshot.salesChannelId')
    &&has(performanceDomain,'performance.snapshot.supplierId'),
  'Sales channel and supplier review identities must match the frozen Performance Snapshot.');

add('settlement.action-selection-binding',
  has(settlementActions,'findSettlementByPerformanceId')
    &&has(settlementActions,'SETTLEMENT_SELECTION_MISMATCH')
    &&has(settlementActions,'settlementActionContext'),
  'Billing, cash, clawback and reversal actions must re-bind the selected Performance to its Settlement on the server.');

add('settlement.payout-ui-gate',
  has(settlement,'netBalance.collectionOutstanding===0')
    &&has(settlement,'netBalance.supplierRefundOutstanding===0')
    &&has(settlement,'공급사 순정산이 완료되어야 영업채널 지급'),
  'Payout UI must stay closed until the same AFTER_FULL_COLLECTION gate enforced by Domain is open.');

add('catalog.offer-supplier-ui',
  has(products,'x.supplierId??selected.product.supplierId')
    &&has(intakeNew,'offer.supplierId??product.supplierId')
    &&has(intakeNew,'depositLabel(offer)'),
  'Multi-supplier Offer identity and deposit semantics must remain visible through Product selection and Intake.');

add('ui.search-composition',
  has(products,'className="ui-search-discovery"')
    &&has(products,'data-ui-search-mode="search-filter"')
    &&has(products,'ProductFilterSheet')
    &&has(products,'data-ui-applied-filters')
    &&!has(products,'COMMON_TERMS'),
  'Product search must use AI Core SEARCH_FILTER composition without unproven persistent quick filters.');

add('ui.filter-sheet-approved',
  has(productFilterSheet,'filter-axis-map')
    &&has(productFilterSheet,'filter-axis-values')
    &&has(productFilterSheet,"router.replace('/products?'")
    &&has(productFilterSheet,'건 보기')
    &&!has(productFilterSheet,'필터 적용'),
  'Detailed filter must use the approved two-column immediate-apply sheet without an Apply/Cancel draft boundary.');

add('ui.master-detail-mobile',
  has(products,'className="workspace products-workspace ui-master-detail"')
    &&has(products,'data-mobile-view={mobileView}')
    &&has(products,'data-ui-master-detail-pane')
    &&has(products,'mobile-detail-back')
    &&has(globalCss,'products-workspace[data-mobile-view="list"]')
    &&has(globalCss,'products-workspace[data-mobile-view="detail"]'),
  'Desktop may use panes, but mobile Product browse must drill from list to one detail pane instead of stacking all panes.');

add('ui.photo-aware-product-card',
  has(productTypes,'primaryImageUrl?: string')
    &&has(products,'product.media?.primaryImageUrl')
    &&has(products,'사진 준비 중')
    &&has(products,'photo-sig')
    &&has(erp5Product,'ERP5_PRODUCT_WRITE_FORBIDDEN'),
  'Product cards must branch on real image availability and preserve the standard no-photo state.');

add('ui.product-action-hierarchy',
  has(products,'product-action-dock')
    &&has(products,'<ShareButton')
    &&has(products,'className="btn primary"')
    &&has(globalCss,'--fp-go:#1b3c63')
    &&has(globalCss,'.btn.primary'),
  'Product detail must keep Share secondary and Intake primary in the approved bottom action hierarchy.');

add('catalog.dynamic-offer-terms',
  has(offerTermDomain,'offerTerms')
    &&has(offerTermDomain,'offersForTerm')
    &&has(products,'className="ui-variant-selector term-picker"')
    &&has(products,'availableTerms.map')
    &&has(products,'termOffers.map')
    &&has(products,'annualMileageKm')
    &&!has(products,'COMMON_TERMS'),
  'Offer periods must come from supplier data and same-term condition variants must remain selectable.');

add('catalog.offer-condition-intake',
  has(intakeNew,'resolveOfferPolicies(product,offer)')
    &&has(intakeNew,'offer.annualMileageKm')
    &&has(intakeNew,'offer.prepayment')
    &&has(intakeNew,'depositLabel(offer)'),
  'Selected term-specific Offer conditions must remain visible immediately before intake snapshot.');

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

add('f04.bridge-phases',
  has(f04Port,"'OBSERVE'")&&has(f04Port,"'MIRROR_ADMIN_OWNED'")&&has(f04Port,"'ADMIN_SINGLE_WRITER'"),
  'F04 compatibility must use explicit transition phases instead of an implicit dual-writer fallback.');

add('f04.bridge-stable-id',
  has(f04Service,"'freepass-admin|'")&&has(f04Service,"'stl_'")&&has(f04Service,'f04SettlementCode'),
  'F04 bridge must use a deterministic Admin application identity mapping, not vehicle number as the system key.');

add('f04.bridge-field-ownership',
  has(f04Service,'분납여부 / 청구월 / 다음회차일 / 환수* / 요율 / 인센티브 / 가감')
    &&has(f04Service,"if(mode==='OBSERVE')return{}"),
  'Parallel F04 mirror must not overwrite transitional facts Admin does not own yet.');

add('f04.link-contract',
  has(f04Port,'F04RowLinkRepository')
    &&has(f04Port,'getByApplicationId')
    &&has(f04Port,'getBySettlementCode'),
  'F04 mirror must persist stable application/settlement-code row links.');

add('f04.link-file',
  has(f04LinkFile,'F04_APPLICATION_LINK_CONFLICT')
    &&has(f04LinkFile,'F04_SETTLEMENT_CODE_LINK_CONFLICT'),
  'Development F04 row links must reject remap and code collisions.');

add('f04.link-erp5',
  has(f04LinkErp5,"erp5AdminCollection('f04_links')")
    &&has(f04LinkErp5,'runTransaction'),
  'ERP5 F04 row links must live in a dedicated Admin namespace and bind transactionally.');

add('f04.link-runtime',
  has(f04Runtime,'Erp5F04RowLinkRepository')
    &&has(f04Runtime,'FileF04RowLinkRepository'),
  'F04 row-link persistence must follow Admin runtime mode.');

add('f04.link-exact-match-only',
  has(f04Service,'matchExistingF04Row')
    &&has(f04Service,"status:'AMBIGUOUS'")
    &&has(f04Service,'plateKey')
    &&has(f04Service,'customerName')
    &&has(f04Service,'receivedAt'),
  'Legacy F04 rows may auto-link only through one exact composite match; ambiguity must fail closed.');

add('clawback.domain-separate',
  has(settlementDomain,'createSettlementClawback')
    &&has(settlementDomain,'getClawbackSummary')
    &&has(settlementDomain,'otherClawbacks'),
  'Business clawback must remain an immutable separate fact with cumulative bounds and idempotent replay.');

add('clawback.operations-port',
  has(operationsPort,'ensureClawback')
    &&has(operationsPort,'listClawbacks'),
  'Operations repository must persist business clawbacks separately from ledger reversal.');

add('clawback.file-persistence',
  has(fileOperations,'schemaVersion: 3')
    &&has(fileOperations,'clawbacks:')
    &&has(fileOperations,'clawbackBillings:')
    &&has(fileOperations,'normalizeState'),
  'File operations state must migrate safely and retain separate clawback records.');

add('clawback.erp5-persistence',
  has(erp5OperationsForBilling,"erp5AdminCollection('clawbacks')")
    &&has(erp5OperationsForBilling,'ensureClawback'),
  'ERP5 operations must persist clawbacks in a dedicated Admin namespace collection.');

add('clawback.service-ui',
  has(settlementService,'createBusinessClawback')
    &&has(settlementActions,'createClawbackAction')
    &&has(settlement,'환수는 원 정산과 원장을 수정하지 않습니다'),
  'Settlement workflow must expose business clawback separately from ledger reversal.');

add('clawback.net-position',
  has(settlementDomain,'getSettlementNetBalance')
    &&has(settlementDomain,'supplierRefundOutstanding')
    &&has(settlementDomain,'channelRecoveryOutstanding'),
  'Clawback must reduce future collection/payout limits and expose refund/recovery excess separately.');

add('clawback.cash-domain',
  has(settlementDomain,'registerSupplierRefund')
    &&has(settlementDomain,'registerChannelRecovery')
    &&has(settlementDomain,"'SUPPLIER_REFUND'")
    &&has(settlementDomain,"'CHANNEL_RECOVERY'"),
  'Supplier refund and channel recovery must be separate cash accounts, not business REVERSAL.');

add('clawback.cash-service',
  has(settlementService,'recordSupplierRefund')
    &&has(settlementService,'recordChannelRecovery')
    &&has(settlementService,'listClawbacks(settlementId)'),
  'Clawback cash use cases must use the persisted business event and net settlement limits.');

add('clawback.cash-ui',
  has(settlement,'공급사 환불 필요')
    &&has(settlement,'영업채널 회수 필요')
    &&has(settlementActions,'supplierRefundAction')
    &&has(settlementActions,'channelRecoveryAction'),
  'Settlement UI must show and execute clawback refund/recovery separately from normal collection/payout.');

add('clawback.billing-domain',
  has(settlementDomain,'createClawbackBillingAdjustment')
    &&has(settlementDomain,'recordClawbackBillingInvoiceEvidence')
    &&has(settlementDomain,"direction:'CREDIT'"),
  'Clawback billing must be a separate CREDIT record and must not mutate original Billing.');

add('clawback.billing-port',
  has(operationsPort,'ensureClawbackBilling')
    &&has(operationsPort,'getClawbackBillingByClawbackId')
    &&has(operationsPort,'mutateClawbackBilling'),
  'Operations port must persist clawback billing credits independently.');

add('clawback.billing-file',
  has(fileOperations,'clawbackBillings')
    &&has(fileOperations,'CLAWBACK_BILLING_IDENTITY_IMMUTABLE'),
  'File repository must retain immutable clawback billing identity and evidence.');

add('clawback.billing-erp5',
  has(erp5OperationsForBilling,"erp5AdminCollection('clawback_billings')")
    &&has(erp5OperationsForBilling,'CLAWBACK_BILLING_IDENTITY_IMMUTABLE'),
  'ERP5 must store clawback billing credits in a dedicated Admin namespace.');

add('clawback.billing-service-ui',
  has(settlementService,'ensureClawbackBillingAdjustment')
    &&has(settlementService,'recordClawbackBillingEvidence')
    &&has(settlementActions,'createClawbackBillingAction')
    &&has(settlementActions,'recordClawbackBillingEvidenceAction')
    &&has(settlement,'환수 계산서 조정 생성'),
  'Settlement workflow must manage clawback billing creation/evidence beside, not inside, original billing.');

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
