import { createHash } from 'node:crypto';

export type AdminCutoverStage =
  | 'LEGACY_DIRECT'
  | 'OBSERVE'
  | 'SHADOW_READ'
  | 'PARITY_VERIFIED'
  | 'FREEPASS_DATA_READ';

export type ApprovedAdminRelease = {
  projectionId: 'admin-catalog';
  releaseId: string;
  manifestId: string;
  inputDigest: string;
  dataDigest: string;
  observedAt: string;
};

export type AdminCutoverEvidence = {
  contractReady: boolean;
  authenticationVerified: boolean;
  legacyReadVerified: boolean;
  freepassReadVerified: boolean;
  parityVerified: boolean;
  fallbackVerified: boolean;
  productionReadbackVerified: boolean;
  approvedRelease: ApprovedAdminRelease | null;
};

export type AdminCutoverApproval = {
  consumerId: 'freepass-admin-catalog';
  fromStage: AdminCutoverStage;
  targetStage: AdminCutoverStage;
  baseOrigin: string;
  tokenSha256: string;
  evidence: AdminCutoverEvidence;
  holdReasons: string[];
  approvalRef: string;
  approvedAt: string;
  validUntil: string;
};

export type AdminCutoverDecision =
  | { ok: true; approval: AdminCutoverApproval }
  | { ok: false; reason: string };

const ORDER: AdminCutoverStage[] = [
  'LEGACY_DIRECT','OBSERVE','SHADOW_READ','PARITY_VERIFIED','FREEPASS_DATA_READ',
];

/**
 * Central FreePass Data is the cutover authority. Admin must never promote itself
 * beyond the last centrally observed registry stage merely because an env JSON exists.
 *
 * Observed from freepass-creator/freepass-data main on 2026-09-26:
 * consumerId=freepass-admin-catalog, stage=OBSERVE.
 *
 * When central evidence advances, update this ceiling in a reviewed Admin PR after
 * re-reading the registry. Stale Admin code therefore blocks rather than over-authorizes.
 */
export const ADMIN_CATALOG_CENTRAL_STAGE: AdminCutoverStage = 'OBSERVE';

const requiredEvidence = (target: AdminCutoverStage): (keyof Omit<AdminCutoverEvidence,'approvedRelease'>)[] => {
  switch(target){
    case 'LEGACY_DIRECT': return [];
    case 'OBSERVE': return ['legacyReadVerified'];
    case 'SHADOW_READ': return ['contractReady','authenticationVerified','legacyReadVerified','freepassReadVerified'];
    case 'PARITY_VERIFIED': return ['contractReady','authenticationVerified','legacyReadVerified','freepassReadVerified','parityVerified'];
    case 'FREEPASS_DATA_READ': return [
      'contractReady','authenticationVerified','legacyReadVerified','freepassReadVerified',
      'parityVerified','fallbackVerified','productionReadbackVerified',
    ];
  }
};

const originOf = (raw: unknown): string | null => {
  const value=String(raw??'').trim();
  if(!value)return null;
  try{
    const u=new URL(value);
    if(u.protocol!=='https:' || (u.pathname!=='/'&&u.pathname!=='') || u.search || u.hash)return null;
    return u.origin;
  }catch{return null;}
};

export const tokenSha256 = (token: string) => createHash('sha256').update(token).digest('hex');

export function parseAdminCutoverApproval(
  raw: string | undefined,
  env: Record<string,string|undefined>,
  requestedStage: AdminCutoverStage,
  now=Date.now(),
): AdminCutoverDecision {
  if(!raw?.trim())return {ok:false,reason:'FREEPASS_DATA_ADMIN_CUTOVER_JSON이 없습니다'};
  let value:unknown;
  try{value=JSON.parse(raw);}catch{return {ok:false,reason:'FREEPASS_DATA_ADMIN_CUTOVER_JSON이 JSON이 아닙니다'};}
  if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,reason:'cutover approval은 객체여야 합니다'};
  const v=value as Record<string,unknown>;
  const consumerId=String(v.consumerId??'');
  if(consumerId!=='freepass-admin-catalog')return {ok:false,reason:'consumerId가 freepass-admin-catalog가 아닙니다'};
  const fromStage=String(v.fromStage??'') as AdminCutoverStage;
  const targetStage=String(v.targetStage??'') as AdminCutoverStage;
  if(!ORDER.includes(fromStage)||!ORDER.includes(targetStage))return {ok:false,reason:'알 수 없는 cutover stage입니다'};
  if(targetStage!==requestedStage)return {ok:false,reason:`승인 targetStage(${targetStage})와 요청 모드(${requestedStage})가 다릅니다`};
  if(ORDER.indexOf(targetStage)>ORDER.indexOf(ADMIN_CATALOG_CENTRAL_STAGE)){
    return {ok:false,reason:`중앙 FreePass Data 레지스트리 단계(${ADMIN_CATALOG_CENTRAL_STAGE})보다 앞설 수 없습니다`};
  }
  if(ORDER.indexOf(targetStage)>ORDER.indexOf(fromStage)+1)return {ok:false,reason:`stage skip은 허용되지 않습니다: ${fromStage} -> ${targetStage}`};

  const baseOrigin=originOf(v.baseOrigin);
  const actualOrigin=originOf(env.FREEPASS_DATA_BASE_URL);
  if(!baseOrigin||!actualOrigin||baseOrigin!==actualOrigin)return {ok:false,reason:'승인 FreePass Data origin과 FREEPASS_DATA_BASE_URL이 다릅니다'};
  const token=env.FREEPASS_DATA_ADMIN_CATALOG_TOKEN?.trim()??'';
  const tokenDigest=String(v.tokenSha256??'').trim();
  if(!token||tokenDigest.length!==64||tokenSha256(token)!==tokenDigest)return {ok:false,reason:'승인 consumer token과 실제 token이 다릅니다'};

  const evidenceRaw=v.evidence;
  if(!evidenceRaw||typeof evidenceRaw!=='object'||Array.isArray(evidenceRaw))return {ok:false,reason:'cutover evidence가 없습니다'};
  const e=evidenceRaw as Record<string,unknown>;
  for(const key of requiredEvidence(targetStage)){
    if(e[key]!==true)return {ok:false,reason:`missing evidence: ${key}`};
  }
  const releaseRaw=e.approvedRelease;
  let approvedRelease:ApprovedAdminRelease|null=null;
  if(ORDER.indexOf(targetStage)>=ORDER.indexOf('PARITY_VERIFIED')){
    if(!releaseRaw||typeof releaseRaw!=='object'||Array.isArray(releaseRaw))return {ok:false,reason:'missing evidence: approvedRelease'};
    const r=releaseRaw as Record<string,unknown>;
    const projectionId=String(r.projectionId??'');
    const releaseId=String(r.releaseId??'').trim();
    const manifestId=String(r.manifestId??'').trim();
    const inputDigest=String(r.inputDigest??'').trim();
    const dataDigest=String(r.dataDigest??'').trim();
    const observedAt=String(r.observedAt??'').trim();
    if(projectionId!=='admin-catalog')return {ok:false,reason:'approvedRelease projectionId가 admin-catalog가 아닙니다'};
    if(!releaseId||!manifestId||!inputDigest||!dataDigest)return {ok:false,reason:'approvedRelease identity/digest가 불완전합니다'};
    const observedMs=Date.parse(observedAt);
    if(!Number.isFinite(observedMs)||observedMs>now+5*60_000)return {ok:false,reason:'approvedRelease observedAt이 유효하지 않습니다'};
    approvedRelease={projectionId:'admin-catalog',releaseId,manifestId,inputDigest,dataDigest,observedAt};
  }

  const holdReasons=Array.isArray(v.holdReasons)?v.holdReasons.map(String).map(x=>x.trim()).filter(Boolean):[];
  if(ORDER.indexOf(targetStage)>=ORDER.indexOf('PARITY_VERIFIED')&&holdReasons.length){
    return {ok:false,reason:`cutover HOLD: ${holdReasons.join(' · ')}`};
  }
  const approvalRef=String(v.approvalRef??'').trim();
  if(approvalRef.length<4)return {ok:false,reason:'cutover approvalRef가 없습니다'};
  const approvedAt=String(v.approvedAt??'').trim();
  const validUntil=String(v.validUntil??'').trim();
  const approvedMs=Date.parse(approvedAt),validMs=Date.parse(validUntil);
  if(!Number.isFinite(approvedMs)||approvedMs>now+5*60_000)return {ok:false,reason:'cutover approvedAt이 유효하지 않습니다'};
  if(!Number.isFinite(validMs)||validMs<=approvedMs||validMs<=now)return {ok:false,reason:'cutover approval이 만료됐거나 validUntil이 유효하지 않습니다'};

  const evidence:AdminCutoverEvidence={
    contractReady:e.contractReady===true,
    authenticationVerified:e.authenticationVerified===true,
    legacyReadVerified:e.legacyReadVerified===true,
    freepassReadVerified:e.freepassReadVerified===true,
    parityVerified:e.parityVerified===true,
    fallbackVerified:e.fallbackVerified===true,
    productionReadbackVerified:e.productionReadbackVerified===true,
    approvedRelease,
  };
  return {ok:true,approval:{
    consumerId:'freepass-admin-catalog',fromStage,targetStage,baseOrigin,tokenSha256:tokenDigest,
    evidence,holdReasons,approvalRef,approvedAt,validUntil,
  }};
}

export function assertApprovedRelease(
  approval: AdminCutoverApproval,
  meta:{
    projectionId:'admin-catalog';
    releaseId:string; manifestId:string; inputDigest:string; dataDigest:string;
    policyParity:'COMPLETE'|'INCOMPLETE';
  },
): string|null {
  if(meta.policyParity!=='COMPLETE')return 'FREEPASS_DATA_POLICY_PARITY_INCOMPLETE';
  const expected=approval.evidence.approvedRelease;
  if(!expected)return 'FREEPASS_DATA_APPROVED_RELEASE_MISSING';
  if(
    meta.projectionId!==expected.projectionId ||
    meta.releaseId!==expected.releaseId ||
    meta.manifestId!==expected.manifestId ||
    meta.inputDigest!==expected.inputDigest ||
    meta.dataDigest!==expected.dataDigest
  )return 'FREEPASS_DATA_APPROVED_RELEASE_MISMATCH';
  return null;
}
