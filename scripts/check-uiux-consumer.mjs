#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=(p)=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const sha256=(p)=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');

function gitShow(repoPath,revision,filePath){
  const r=spawnSync('git',['show',`${revision}:${filePath}`],{cwd:repoPath,encoding:'utf8',windowsHide:true});
  if(r.status!==0) throw new Error(`AI_CORE_SOURCE_UNAVAILABLE:${filePath}`);
  return r.stdout;
}

function localEvidencePath(ref){
  if(/^https?:\/\//.test(ref)) return null;
  return ref.split('#')[0];
}

export function validateConsumer({root=ROOT,aiCorePath=process.env.AI_CORE_PATH||path.resolve(ROOT,'..','ai-core')}={}){
  const errors=[];
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'.ai-core','ui-ux.consumer.json'),'utf8'));
  const authority=JSON.parse(fs.readFileSync(path.join(root,'.devcenter','design-authority.json'),'utf8'));

  if(manifest.contract!=='ai-core-ui-ux-consumer/v1') errors.push('UIUX_CONSUMER_CONTRACT_INVALID');
  if(manifest.product?.id!=='freepass-admin'||manifest.product?.repository!=='freepass-creator/freepass-admin') errors.push('UIUX_CONSUMER_IDENTITY_INVALID');
  if(!/^[a-f0-9]{40}$/.test(manifest.product?.mapping_base_revision??'')) errors.push('UIUX_MAPPING_BASE_REVISION_INVALID');
  if(manifest.ai_core?.revision!==authority.ai_core?.revision) errors.push('UIUX_CORE_REVISION_AUTHORITY_MISMATCH');
  if(manifest.ai_core?.feature_registry_version!==authority.ai_core?.feature_registry_version) errors.push('UIUX_FEATURE_VERSION_AUTHORITY_MISMATCH');
  if(manifest.adoption_status!=='MAPPED') errors.push('UIUX_CONSUMER_STATUS_MUST_BE_MAPPED');

  const featureRegistry=JSON.parse(gitShow(aiCorePath,manifest.ai_core.revision,'registry/ui-ux-features.json'));
  if(featureRegistry.contract!=='ai-core-ui-ux-feature-registry/v1') errors.push('UIUX_FEATURE_REGISTRY_CONTRACT_INVALID');
  if(featureRegistry.version!==manifest.ai_core.feature_registry_version) errors.push('UIUX_FEATURE_REGISTRY_VERSION_MISMATCH');
  const featureIds=new Set(featureRegistry.features.map((f)=>f.id));

  const required=new Set(manifest.required_feature_ids??[]);
  const bindings=new Map((manifest.feature_bindings??[]).map((b)=>[b.feature_id,b]));
  for(const id of required){
    if(!featureIds.has(id)) errors.push(`UIUX_FEATURE_UNKNOWN:${id}`);
    if(!bindings.has(id)) errors.push(`UIUX_FEATURE_BINDING_MISSING:${id}`);
  }
  for(const id of bindings.keys()) if(!required.has(id)) errors.push(`UIUX_FEATURE_BINDING_UNDECLARED:${id}`);

  for(const ref of manifest.local_authorities??[]){
    const p=localEvidencePath(ref);
    if(p&&!fs.existsSync(path.join(root,p))) errors.push(`UIUX_LOCAL_AUTHORITY_MISSING:${p}`);
  }
  for(const binding of manifest.feature_bindings??[]){
    for(const ref of binding.local_evidence??[]){
      const p=localEvidencePath(ref);
      if(p&&!fs.existsSync(path.join(root,p))) errors.push(`UIUX_LOCAL_EVIDENCE_MISSING:${binding.feature_id}:${p}`);
    }
  }

  if(authority.contract!=='devcenter-design-authority/v1') errors.push('DESIGN_AUTHORITY_CONTRACT_INVALID');
  const approved=authority.approved_visual;
  if(!approved?.path||!fs.existsSync(path.join(root,approved.path))) errors.push('DESIGN_APPROVED_VISUAL_MISSING');
  else if(sha256(approved.path)!==approved.sha256) errors.push('DESIGN_APPROVED_VISUAL_HASH_MISMATCH');
  if(approved.status!=='USER_APPROVED') errors.push('DESIGN_APPROVAL_STATUS_INVALID');

  const base=spawnSync('git',['cat-file','-e',`${manifest.product.mapping_base_revision}^{commit}`],{cwd:root,encoding:'utf8',windowsHide:true});
  if(base.status!==0) errors.push('UIUX_MAPPING_BASE_REVISION_NOT_FOUND');

  return {status:errors.length?'FAIL':'PASS',errors,feature_count:required.size,ai_core_revision:manifest.ai_core.revision,approved_visual_sha256:approved.sha256};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  try{
    const result=validateConsumer();
    console.log(JSON.stringify(result,null,2));
    process.exitCode=result.status==='PASS'?0:1;
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message},null,2));
    process.exitCode=1;
  }
}
