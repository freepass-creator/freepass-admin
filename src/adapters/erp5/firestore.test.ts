import assert from 'node:assert/strict';
import test from 'node:test';
import {
  erp5AdminCollection,
  erp5AdminNamespace,
  erp5WriteEnabled,
  parseErp5ServiceAccount,
  requireErp5Write,
} from './firestore';

const sa=JSON.stringify({
  project_id:'freepasserp5',
  client_email:'admin@example.invalid',
  private_key:'-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n',
});

test('ERP5 service account must be explicitly bound to freepasserp5',()=>{
  assert.equal(parseErp5ServiceAccount({ERP5_FIREBASE_SERVICE_ACCOUNT_JSON:sa}).project_id,'freepasserp5');
  assert.throws(
    ()=>parseErp5ServiceAccount({ERP5_FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({
      project_id:'wrong-project',client_email:'x',private_key:'y',
    })}),
    /ERP5_PROJECT_ID_MISMATCH/,
  );
});

test('Admin write namespace is required and collection names stay namespaced',()=>{
  assert.throws(()=>erp5AdminNamespace({}),/ERP5_ADMIN_NAMESPACE_REQUIRED/);
  const env={ERP5_ADMIN_NAMESPACE:'freepass_admin_v1'};
  assert.equal(erp5AdminCollection('applications',env),'freepass_admin_v1_applications');
  assert.equal(erp5AdminCollection('ledger',env),'freepass_admin_v1_ledger');
});

test('ERP5 write path is closed unless ERP5_WRITE=on',()=>{
  assert.equal(erp5WriteEnabled({}),false);
  assert.throws(()=>requireErp5Write({}),/ERP5_WRITE_DISABLED/);
  assert.equal(erp5WriteEnabled({ERP5_WRITE:'on'}),true);
  assert.doesNotThrow(()=>requireErp5Write({ERP5_WRITE:'on'}));
});
