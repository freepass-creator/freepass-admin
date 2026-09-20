import assert from 'node:assert/strict';
import test from 'node:test';
import { adminActorProvider, adminRepositories, adminRuntimeMode } from './admin-runtime';

test('development uses the durable file adapter path',()=>{
  assert.equal(adminRuntimeMode({NODE_ENV:'development'}),'FILE_DEV');
  const repos=adminRepositories({NODE_ENV:'development',FPA_DATA_DIR:'/tmp/freepass-admin-runtime-test'});
  assert.ok(repos.products);
  assert.ok(repos.applications);
});

test('production persistence is fail-closed until approved adapter is bound',()=>{
  assert.equal(adminRuntimeMode({NODE_ENV:'production'}),'UNBOUND_PRODUCTION');
  assert.throws(
    ()=>adminRepositories({NODE_ENV:'production'}),
    /ADMIN_PRODUCTION_PERSISTENCE_ADAPTER_NOT_BOUND/,
  );
});

test('production actor boundary is fail-closed until auth adapter is bound',()=>{
  assert.throws(
    ()=>adminActorProvider({NODE_ENV:'production'}),
    /ADMIN_PRODUCTION_ACTOR_ADAPTER_NOT_BOUND/,
  );
});
