import fs from 'node:fs';

const read = path => fs.readFileSync(path,'utf8');
const readJson = path => JSON.parse(read(path));
const fail = (condition,message) => { if(!condition) throw new Error(message); };

const shadow = readJson('contracts/ai-core/governance-p0.shadow.json');
const pkg = readJson('package.json');
const release = read('docs/RELEASE.md');
const ssot = read('docs/SSOT.md');
const workflow = read('.github/workflows/backend-check.yml');

fail(shadow.core_source.revision === '8bd7fb26338b32abca914995fcd767c8e131ab03','GOVERNANCE_CORE_CANDIDATE_REVISION_DRIFT');
fail(shadow.project_source.revision === '2aede7df82591470308f25bd3ccd4e5358aa7c3c','ADMIN_SHADOW_SOURCE_REVISION_DRIFT');

for(const script of ['typecheck','test','build']){
  fail(typeof pkg.scripts?.[script] === 'string','ADMIN_BUILD_SCRIPT_MISSING:'+script);
  fail(workflow.includes(`npm run ${script}`),'ADMIN_CI_GATE_MISSING:'+script);
}
fail(workflow.includes('npm ci'),'ADMIN_CI_INSTALL_MISSING');

const verified = release.match(/Verified baseline:[\s\S]*?revision:\s*`([0-9a-f]{40})`/i)?.[1] || null;
fail(Boolean(verified),'ADMIN_RELEASE_VERIFIED_BASELINE_MISSING');

const blockers=[];
if(verified !== shadow.project_source.revision) blockers.push('RELEASE_EVIDENCE_STALE');
if(/Production deployment:\s*NOT VERIFIED/i.test(release) || /운영 Release target\s*\|\s*없음\s*\|\s*NOT VERIFIED/i.test(ssot)){
  blockers.push('PRODUCTION_TARGET_UNVERIFIED');
}
if(/Production Auth\/Permission:\s*NOT VERIFIED/i.test(release) || /운영 Auth\/Permission\s*\|\s*없음\s*\|\s*NOT VERIFIED/i.test(ssot)){
  blockers.push('PRODUCTION_AUTH_UNVERIFIED');
}
if(/Production persistence:\s*NOT VERIFIED/i.test(release) || /운영 Product DB\s*\|\s*없음\s*\|\s*NOT VERIFIED/i.test(ssot)){
  blockers.push('PRODUCTION_PERSISTENCE_UNVERIFIED');
}
if(/Runtime smoke against production binding:\s*NOT VERIFIED/i.test(release)){
  blockers.push('PRODUCTION_RUNTIME_SMOKE_UNVERIFIED');
}

const expected=[...shadow.expected_blockers].sort();
const actual=[...new Set(blockers)].sort();
fail(JSON.stringify(actual)===JSON.stringify(expected),
  'ADMIN_GOVERNANCE_HOLD_SET_DRIFT expected='+JSON.stringify(expected)+' actual='+JSON.stringify(actual));

console.log(JSON.stringify({
  status:'SHADOW_HOLD',
  source_revision:shadow.project_source.revision,
  release_verified_revision:verified,
  blockers:actual,
  interpretation:'Current source/CI is newer than the pinned release evidence and production bindings remain unverified.'
},null,2));
