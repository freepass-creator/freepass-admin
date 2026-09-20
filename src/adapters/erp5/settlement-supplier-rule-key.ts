import type {
  SettlementSupplierRuleIdentity,
  SettlementSupplierRuleKeyProvider,
} from '../../ports/settlement-supplier-rule-key';
import { partnerTypeLabel } from '../../domain/reference-master/partner-type';
import { erp5 } from './firestore';

const text=(value:unknown)=>String(value??'').trim();
const yes=(value:unknown)=>value===true||value==='true'||value==='TRUE'||value===1;

function active(data:Record<string,unknown>){
  if(yes(data._deleted)||text(data.merged_into))return false;
  const status=text(data.status||data.partner_status).toLowerCase();
  return !['inactive','disabled','deleted','비활성','중지','폐기'].includes(status);
}

function identity(
  supplierId:string,
  data:Record<string,unknown>,
  docId:string,
):SettlementSupplierRuleIdentity|null{
  const id=text(data.partner_code)||docId;
  if(id!==supplierId&&docId!==supplierId)return null;
  if(partnerTypeLabel(data.partner_type??data.type,id)!=='공급사')return null;
  if(!active(data))return null;

  const explicit=text(
    data.settlement_rule_key
      ?? data.settlement_supplier_key
      ?? data.fee_rule_key,
  );
  const displayName=text(data.partner_name??data.name);
  const ruleKey=explicit||displayName;
  if(!ruleKey)return null;

  const revision=text(data.updated_at??data.updatedAt??data.stateAt)||undefined;
  return{
    supplierId,
    ruleKey,
    ...(displayName?{displayName}:{}),
    ...(revision?{sourceRevision:revision}:{}),
  };
}

/**
 * Transitional resolver over the ERP5 Partner Master.
 *
 * An explicit settlement_rule_key wins. Existing verified supplier display names
 * are accepted only as a compatibility rule-key; the pricing provider will still
 * reject them if the reverse-imported fee table has no matching rule.
 */
export class Erp5SettlementSupplierRuleKeyProvider implements SettlementSupplierRuleKeyProvider{
  constructor(private readonly env:NodeJS.ProcessEnv=process.env){}

  async resolve(supplierId:string):Promise<SettlementSupplierRuleIdentity|null>{
    const id=supplierId.trim();
    if(!id)return null;
    const db=erp5(this.env);

    const direct=await db.collection('partner').doc(id).get();
    if(direct.exists){
      const hit=identity(id,direct.data() as Record<string,unknown>,direct.id);
      if(hit)return hit;
    }

    const byCode=await db.collection('partner').where('partner_code','==',id).limit(1).get();
    if(!byCode.empty){
      const doc=byCode.docs[0];
      return identity(id,doc.data() as Record<string,unknown>,doc.id);
    }
    return null;
  }
}

/** Explicit map for tests/dev and future Data supplier-master handoff. */
export class MapSettlementSupplierRuleKeyProvider implements SettlementSupplierRuleKeyProvider{
  constructor(private readonly values:Record<string,string>){}

  async resolve(supplierId:string):Promise<SettlementSupplierRuleIdentity|null>{
    const id=supplierId.trim();
    const ruleKey=text(this.values[id]);
    return ruleKey?{supplierId:id,ruleKey}:null;
  }
}
