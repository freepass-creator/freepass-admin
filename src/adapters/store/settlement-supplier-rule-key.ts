import type {
  SettlementSupplierRuleIdentity,
  SettlementSupplierRuleKeyProvider,
} from '../../ports/settlement-supplier-rule-key';

export class EnvSettlementSupplierRuleKeyProvider implements SettlementSupplierRuleKeyProvider{
  private readonly values:Record<string,string>;

  constructor(env:NodeJS.ProcessEnv=process.env){
    const raw=String(env.FPA_DEV_SETTLEMENT_SUPPLIER_RULE_KEYS||'{}').trim()||'{}';
    let parsed:unknown;
    try{parsed=JSON.parse(raw);}catch{throw new Error('FPA_DEV_SETTLEMENT_SUPPLIER_RULE_KEYS_INVALID');}
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)){
      throw new Error('FPA_DEV_SETTLEMENT_SUPPLIER_RULE_KEYS_INVALID');
    }
    this.values=Object.fromEntries(
      Object.entries(parsed as Record<string,unknown>)
        .map(([id,key])=>[id.trim(),String(key??'').trim()])
        .filter(([id,key])=>id&&key),
    );
  }

  async resolve(supplierId:string):Promise<SettlementSupplierRuleIdentity|null>{
    const id=supplierId.trim();
    const ruleKey=this.values[id];
    return ruleKey?{supplierId:id,ruleKey}:null;
  }
}
