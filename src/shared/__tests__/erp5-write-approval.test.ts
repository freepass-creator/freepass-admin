import test from 'node:test';
import assert from 'node:assert/strict';
import { assertErp5MaintenanceWrite, erp5WriteGate, parseErp5WriteApproval } from '../erp5-write-approval';

const NOW = Date.parse('2026-09-26T07:00:00.000Z');
const approval = JSON.stringify({
  projectId: 'freepasserp5',
  iamVerified: true,
  iamRef: 'iam-check-20260926',
  backupRestoreVerified: true,
  backupRestoreRef: 'restore-drill-20260926',
  serviceAccountEmail: 'admin@freepasserp5.iam.gserviceaccount.com',
  productionOrigin: 'https://freepass-admin.vercel.app',
  approvalRef: 'ops-20260926',
  approvedAt: '2026-09-26T06:30:00.000Z',
  validUntil: '2026-10-03T06:30:00.000Z',
});

test('production ERP5 writes fail closed without IAM/backup approval receipt', () => {
  const base = {
    ERP5_WRITE: 'on',
    VERCEL: '1',
    VERCEL_ENV: 'production',
    APP_BASE_URL: 'https://freepass-admin.vercel.app',
    ERP5_FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      project_id:'freepasserp5',
      client_email:'admin@freepasserp5.iam.gserviceaccount.com',
      private_key:'k',
    }),
  };
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
    projectId: 'freepasserp3', iamVerified: true, iamRef: 'iam1', backupRestoreVerified: true, backupRestoreRef: 'bak1',
    approvalRef: 'x123', serviceAccountEmail: 'admin@freepasserp5.iam.gserviceaccount.com',
    productionOrigin: 'https://freepass-admin.vercel.app',
    approvedAt: '2026-09-26T06:30:00.000Z',
    validUntil: '2026-10-03T06:30:00.000Z',
  }), NOW).ok, false);
  assert.equal(parseErp5WriteApproval(JSON.stringify({
    projectId: 'freepasserp5', iamVerified: false, iamRef: 'iam1', backupRestoreVerified: true, backupRestoreRef: 'bak1',
    approvalRef: 'x123', serviceAccountEmail: 'admin@freepasserp5.iam.gserviceaccount.com',
    productionOrigin: 'https://freepass-admin.vercel.app',
    approvedAt: '2026-09-26T06:30:00.000Z',
    validUntil: '2026-10-03T06:30:00.000Z',
  }), NOW).ok, false);
  assert.equal(parseErp5WriteApproval(JSON.stringify({
    projectId: 'freepasserp5', iamVerified: true, iamRef: 'iam1', backupRestoreVerified: false, backupRestoreRef: 'bak1',
    approvalRef: 'x123', serviceAccountEmail: 'admin@freepasserp5.iam.gserviceaccount.com',
    productionOrigin: 'https://freepass-admin.vercel.app',
    approvedAt: '2026-09-26T06:30:00.000Z',
    validUntil: '2026-10-03T06:30:00.000Z',
  }), NOW).ok, false);
  assert.equal(parseErp5WriteApproval(JSON.stringify({
    projectId: 'freepasserp5', iamVerified: true, iamRef: 'iam1', backupRestoreVerified: true, backupRestoreRef: 'bak1',
    approvalRef: 'x123', approvedAt: '2026-09-26T08:00:00.000Z',
  }), NOW).ok, false);
});


test('write approval requires separate trace references for IAM and backup/restore', () => {
  const missingIamRef = JSON.stringify({
    projectId:'freepasserp5', iamVerified:true,
    backupRestoreVerified:true, backupRestoreRef:'restore-1',
    approvalRef:'ops-1', approvedAt:'2026-09-26T06:30:00.000Z',
  });
  const missingBackupRef = JSON.stringify({
    projectId:'freepasserp5', iamVerified:true, iamRef:'iam-1',
    backupRestoreVerified:true,
    approvalRef:'ops-1', approvedAt:'2026-09-26T06:30:00.000Z',
  });
  assert.equal(parseErp5WriteApproval(missingIamRef, NOW).ok, false);
  assert.equal(parseErp5WriteApproval(missingBackupRef, NOW).ok, false);
});


test('direct maintenance --apply requires the same approval receipt', () => {
  assert.doesNotThrow(() => assertErp5MaintenanceWrite({}, false, 'dry-run', NOW));
  assert.throws(
    () => assertErp5MaintenanceWrite({ ERP5_WRITE:'on' }, true, 'maint', NOW),
    /write approval missing/,
  );
  assert.doesNotThrow(() => assertErp5MaintenanceWrite({
    ERP5_WRITE:'on', ERP5_WRITE_APPROVAL_JSON:approval,
  }, true, 'maint', NOW, 'admin@freepasserp5.iam.gserviceaccount.com'));
  assert.doesNotThrow(() => assertErp5MaintenanceWrite({
    ERP5_WRITE:'on', FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',
  }, true, 'maint', NOW));
});


test('only localhost Firestore emulator endpoints bypass production approval', () => {
  assert.equal(erp5WriteGate({
    ERP5_WRITE:'on', NODE_ENV:'production', FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',
  }, false, NOW).mode, 'EMULATOR');
  const remote = erp5WriteGate({
    ERP5_WRITE:'on', NODE_ENV:'production', FIRESTORE_EMULATOR_HOST:'10.0.0.20:8080',
  }, false, NOW);
  assert.equal(remote.enabled, false);
  assert.equal(remote.mode, 'HOLD');
  assert.throws(
    () => assertErp5MaintenanceWrite({
      ERP5_WRITE:'on', FIRESTORE_EMULATOR_HOST:'10.0.0.20:8080',
    }, true, 'maint', NOW),
    /remote FIRESTORE_EMULATOR_HOST/,
  );
});


test('production approval is bound to the actual service account and origin', () => {
  const env = {
    ERP5_WRITE:'on', VERCEL:'1', VERCEL_ENV:'production',
    APP_BASE_URL:'https://freepass-admin.vercel.app',
    ERP5_FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({
      project_id:'freepasserp5',
      client_email:'admin@freepasserp5.iam.gserviceaccount.com',
      private_key:'k',
    }),
    ERP5_WRITE_APPROVAL_JSON:approval,
  };
  assert.equal(erp5WriteGate(env,false,NOW).enabled,true);
  assert.equal(erp5WriteGate({
    ...env,
    APP_BASE_URL:'https://other.vercel.app',
  },false,NOW).enabled,false);
  assert.equal(erp5WriteGate({
    ...env,
    ERP5_FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({
      project_id:'freepasserp5',
      client_email:'other@freepasserp5.iam.gserviceaccount.com',
      private_key:'k',
    }),
  },false,NOW).enabled,false);
});

test('expired production approval fails closed', () => {
  const expired = JSON.parse(approval) as Record<string,unknown>;
  expired.validUntil='2026-09-26T06:45:00.000Z';
  assert.equal(parseErp5WriteApproval(JSON.stringify(expired),NOW).ok,false);
});
