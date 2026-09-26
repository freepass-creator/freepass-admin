import test from 'node:test';
import assert from 'node:assert/strict';
import { erp5WriteGate, parseErp5WriteApproval } from '../erp5-write-approval';

const NOW = Date.parse('2026-09-26T07:00:00.000Z');
const approval = JSON.stringify({
  projectId: 'freepasserp5',
  iamVerified: true,
  backupRestoreVerified: true,
  approvalRef: 'ops-20260926',
  approvedAt: '2026-09-26T06:30:00.000Z',
});

test('production ERP5 writes fail closed without IAM/backup approval receipt', () => {
  const base = { ERP5_WRITE: 'on', VERCEL: '1', VERCEL_ENV: 'production' };
  assert.equal(erp5WriteGate(base, false, NOW).enabled, false);
  assert.equal(erp5WriteGate({ ...base, ERP5_WRITE_APPROVAL_JSON: '{}' }, false, NOW).enabled, false);
  assert.equal(erp5WriteGate({ ...base, ERP5_WRITE_APPROVAL_JSON: approval }, false, NOW).enabled, true);
});

test('Vercel preview never writes even if a production approval receipt is present', () => {
  const gate = erp5WriteGate({
    ERP5_WRITE: 'on', VERCEL: '1', VERCEL_ENV: 'preview', ERP5_WRITE_APPROVAL_JSON: approval,
  }, false, NOW);
  assert.equal(gate.enabled, false);
  assert.equal(gate.mode, 'HOLD');
});

test('Firestore emulator stays writable without production approval', () => {
  const gate = erp5WriteGate({
    ERP5_WRITE: 'on', NODE_ENV: 'production', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  }, false, NOW);
  assert.equal(gate.enabled, true);
  assert.equal(gate.mode, 'EMULATOR');
});

test('demo remains read-only and local explicit writes remain available', () => {
  assert.equal(erp5WriteGate({ ERP5_WRITE: 'on' }, true, NOW).enabled, false);
  assert.equal(erp5WriteGate({ ERP5_WRITE: 'on', NODE_ENV: 'development' }, false, NOW).enabled, true);
});

test('write approval receipt validates project, IAM, backup/restore and time', () => {
  assert.equal(parseErp5WriteApproval(approval, NOW).ok, true);
  assert.equal(parseErp5WriteApproval(JSON.stringify({
    projectId: 'freepasserp3', iamVerified: true, backupRestoreVerified: true,
    approvalRef: 'x123', approvedAt: '2026-09-26T06:30:00.000Z',
  }), NOW).ok, false);
  assert.equal(parseErp5WriteApproval(JSON.stringify({
    projectId: 'freepasserp5', iamVerified: false, backupRestoreVerified: true,
    approvalRef: 'x123', approvedAt: '2026-09-26T06:30:00.000Z',
  }), NOW).ok, false);
  assert.equal(parseErp5WriteApproval(JSON.stringify({
    projectId: 'freepasserp5', iamVerified: true, backupRestoreVerified: false,
    approvalRef: 'x123', approvedAt: '2026-09-26T06:30:00.000Z',
  }), NOW).ok, false);
  assert.equal(parseErp5WriteApproval(JSON.stringify({
    projectId: 'freepasserp5', iamVerified: true, backupRestoreVerified: true,
    approvalRef: 'x123', approvedAt: '2026-09-26T08:00:00.000Z',
  }), NOW).ok, false);
});
