import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const gate = fileURLToPath(new URL('./check-dependency-audit.mjs', import.meta.url));
function report(vulnerabilities = {}) {
  const summary = { info:0, low:0, moderate:0, high:0, critical:0, total:0 };
  for (const v of Object.values(vulnerabilities)) { summary[v.severity]++; summary.total++; }
  return { auditReportVersion:2, vulnerabilities, metadata:{ vulnerabilities:summary } };
}
function run(value) {
  const dir = mkdtempSync(path.join(tmpdir(), 'admin-audit-'));
  try {
    const file = path.join(dir, 'report.json');
    writeFileSync(file, JSON.stringify(value));
    const result = spawnSync(process.execPath, [gate, file], {encoding:'utf8'});
    assert.equal(result.error, undefined);
    return result.status;
  } finally { rmSync(dir, {recursive:true, force:true}); }
}
const moderate = (name, via, range) => ({ name, severity:'moderate', isDirect:false, via, range });
const allowed = {
  gaxios:moderate('gaxios',['uuid'],'6.4.0 - 6.7.1'),
  uuid:moderate('uuid',[{source:1119441,url:'https://github.com/advisories/GHSA-w5hq-g745-h8pq'}],'<11.1.1'),
};

test('valid empty audit is accepted', () => assert.equal(run(report()),0));
test('existing reviewed transitive exceptions remain unchanged', () => assert.equal(run(report(allowed)),0));
test('empty report fails closed', () => assert.notEqual(run({}),0));
test('registry error cannot masquerade as an empty successful audit', () => assert.notEqual(run({...report(),error:{code:'ENOAUDIT'}}),0));
test('missing findings is not equivalent to zero findings', () => { const r=report();delete r.vulnerabilities;assert.notEqual(run(r),0); });
test('unknown audit format fails closed', () => assert.notEqual(run({...report(),auditReportVersion:1}),0));
test('inconsistent metadata fails closed', () => { const r=report();r.metadata.vulnerabilities.high=1;r.metadata.vulnerabilities.total=1;assert.notEqual(run(r),0); });
test('high vulnerability is rejected', () => assert.notEqual(run(report({other:{name:'other',severity:'high',isDirect:true,via:[],range:'*'}})),0));
test('unreviewed moderate is rejected', () => assert.notEqual(run(report({other:moderate('other',[],'*')})),0));
test('reviewed exception cannot change severity', () => assert.notEqual(run(report({uuid:{...allowed.uuid,severity:'high'}})),0));
