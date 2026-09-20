export type SettlementSupplierRuleIdentity = {
  supplierId: string;
  ruleKey: string;
  displayName?: string;
  sourceRevision?: string;
};

/**
 * Stable supplier identity -> settlement fee-rule key.
 *
 * The pricing engine must never assume an internal supplier id is a human name.
 * A future FreePass Data supplier master can implement this port without changing
 * settlement pricing logic.
 */
export interface SettlementSupplierRuleKeyProvider {
  resolve(supplierId: string): Promise<SettlementSupplierRuleIdentity | null>;
}
