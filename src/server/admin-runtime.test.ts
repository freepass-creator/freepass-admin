import assert from 'node:assert/strict';
import test from 'node:test';
import { adminActorProvider, adminRepositories, adminRuntimeMode } from './admin-runtime';

test('development defaults to durable file adapters',()=>{
  assert.equal(adminRuntimeMode({NODE_ENV:'development'}),'FILE_DEV');
  const repos=adminRepositories({NODE_ENV:'development',FPA_DATA_DIR:'/tmp/freepass-admin-runtime-test'});
  assert.ok(repos.products);
  assert.ok(repos.applications);
});

test('ERP5 repository mode is explicit',()=>{
  assert.equal(adminRuntimeMode({NODE_ENV:'development',FPA_REPOSITORY_MODE:'erp5'}),'ERP5');
  assert.equal(adminRuntimeMode({NODE_ENV:'production',FPA_REPOSITORY_MODE:'erp5'}),'ERP5');
});

test('production persistence is fail-closed when repository mode is not explicitly bound',()=>{
  assert.equal(adminRuntimeMode({NODE_ENV:'production'}),'UNBOUND_PRODUCTION');
  assert.throws(
    ()=>adminRepositories({NODE_ENV:'production'}),
    /ADMIN_PRODUCTION_PERSISTENCE_ADAPTER_NOT_BOUND/,
  );
});

test('production actor boundary stays fail-closed even when ERP5 persistence is selected',()=>{
  assert.throws(
    ()=>adminActorProvider({NODE_ENV:'production',FPA_REPOSITORY_MODE:'erp5'}),
    /ADMIN_PRODUCTION_ACTOR_ADAPTER_NOT_BOUND/,
  );
});

test('unknown repository modes are rejected',()=>{
  assert.throws(
    ()=>adminRuntimeMode({NODE_ENV:'development',FPA_REPOSITORY_MODE:'legacy'}),
    /FPA_REPOSITORY_MODE_INVALID/,
  );
});
