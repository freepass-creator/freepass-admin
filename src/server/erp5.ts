/**
 * Admin workflow repository composition.
 *
 * Product Catalog read authority lives in ./freepass-data.
 * This module owns the current Admin workflow persistence adapters only:
 * intake/settlement and contract/e-sign list facts.
 */
import { Erp5SettlementRepository } from '../adapters/erp5/settlement-repository';
import { Erp5ContractRepository } from '../adapters/erp5/contract-repository';

export const settlements = new Erp5SettlementRepository();
export const contracts = new Erp5ContractRepository();

/**
 * Compatibility re-export only. New Product consumers must import ./freepass-data directly.
 * Kept temporarily so older tests/tools fail gradually instead of inventing a second Catalog path.
 */
export { productList, productById, productByIdFresh, legacyProducts as products } from './freepass-data';

export const today = () => {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().slice(0, 10);
};

/** Admin workflow adapters share the existing explicit write gate. */
export { writeEnabled, WriteDisabledError, type ClaimView } from '../adapters/erp5/settlement-repository';
export { loadFeeRuleSet as feeRuleSet } from '../adapters/erp5/fee-rules';
export { ERP5_PROJECT_ID, erp5Ready } from '../adapters/erp5/firestore';
