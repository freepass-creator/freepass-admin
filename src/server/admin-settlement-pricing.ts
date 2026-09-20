import { Erp5SettlementSupplierRuleKeyProvider } from '../adapters/erp5/settlement-supplier-rule-key';
import { FpSettlementPricingProvider } from '../adapters/settlement-pricing/fp-settlement-provider';
import { EnvSettlementSupplierRuleKeyProvider } from '../adapters/store/settlement-supplier-rule-key';
import type { SettlementPricingProvider } from '../ports/settlement-pricing';
import { adminRuntimeMode } from './admin-runtime';

export function adminSettlementPricingProvider(
  env:NodeJS.ProcessEnv=process.env,
):SettlementPricingProvider{
  const mode=adminRuntimeMode(env);
  if(mode==='ERP5'){
    return new FpSettlementPricingProvider(
      new Erp5SettlementSupplierRuleKeyProvider(env),
    );
  }
  if(mode==='FILE_DEV'){
    return new FpSettlementPricingProvider(
      new EnvSettlementSupplierRuleKeyProvider(env),
    );
  }
  throw new Error('ADMIN_PRODUCTION_SETTLEMENT_PRICING_NOT_BOUND');
}
