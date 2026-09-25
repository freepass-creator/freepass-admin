import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/check-dependency-audit.mjs <npm-audit.json>');
  process.exit(2);
}
const audit = JSON.parse(fs.readFileSync(file, 'utf8'));
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const summary = audit?.metadata?.vulnerabilities;
if (!isRecord(audit) || Object.hasOwn(audit, 'error') || audit.auditReportVersion !== 2
  || !isRecord(audit.vulnerabilities) || !isRecord(summary)
  || [...severities, 'total'].some(key => !Number.isInteger(summary[key]) || summary[key] < 0)) {
  console.error('DEPENDENCY AUDIT GATE FAILED: missing, invalid or errored npm audit report');
  process.exit(1);
}
const vulnerabilities = audit.vulnerabilities;
const entries = Object.entries(vulnerabilities);
if (entries.some(([name, value]) => !isRecord(value) || value.name !== name || !severities.includes(value.severity))
  || summary.total !== entries.length
  || severities.some(severity => summary[severity] !== entries.filter(([, value]) => value.severity === severity).length)) {
  console.error('DEPENDENCY AUDIT GATE FAILED: inconsistent vulnerability evidence');
  process.exit(1);
}

/*
 * Temporary, reviewed transitive exceptions.
 * - Both must remain moderate and indirect.
 * - uuid advisory GHSA-w5hq-g745-h8pq affects v3/v5/v6 buffer writes.
 * - gaxios 6.7.1 uses uuid v4() only for multipart boundary generation.
 * See docs/security/DEPENDENCY-AUDIT-2026-09-25.md.
 * Removing either finding is always allowed; widening/changing it requires review.
 */
const allowed = {
  gaxios: {
    severity: 'moderate',
    direct: false,
    range: '6.4.0 - 6.7.1',
    via: (v) => Array.isArray(v.via) && v.via.some((x) => x === 'uuid'),
  },
  uuid: {
    severity: 'moderate',
    direct: false,
    range: '<11.1.1',
    via: (v) => Array.isArray(v.via) && v.via.some((x) =>
      x !== null && typeof x === 'object' && (
        Number(x.source) === 1119441 ||
        String(x.url ?? '').includes('GHSA-w5hq-g745-h8pq')
      )),
  },
};

const failures = [];
for (const [name, v] of Object.entries(vulnerabilities)) {
  const rule = allowed[name];
  if (!rule) {
    failures.push(`unreviewed ${v.severity} vulnerability: ${name} (${v.range})`);
    continue;
  }
  if (v.severity !== rule.severity) failures.push(`${name}: severity changed to ${v.severity}`);
  if (Boolean(v.isDirect) !== rule.direct) failures.push(`${name}: direct dependency status changed`);
  if (String(v.range) !== rule.range) failures.push(`${name}: affected range changed to ${v.range}`);
  if (!rule.via(v)) failures.push(`${name}: advisory/dependency path changed`);
}
if (failures.length) {
  console.error('DEPENDENCY AUDIT GATE FAILED');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log('DEPENDENCY AUDIT GATE PASS', JSON.stringify(summary));
console.log('Reviewed temporary findings:', Object.keys(vulnerabilities).sort().join(', ') || 'none');
