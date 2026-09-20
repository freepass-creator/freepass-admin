import assert from 'node:assert/strict';
import test from 'node:test';
import { adminActorProvider, adminProductSourceMode, adminRepositories, adminRuntimeMode } from './admin-runtime';

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

test('production actor boundary stays fail-closed unless firebase auth mode is explicitly bound',async()=>{
  const provider=adminActorProvider({
    NODE_ENV:'production',
    FPA_REPOSITORY_MODE:'erp5',
  });
  await assert.rejects(
    ()=>provider.requireActor(),
    /ADMIN_PRODUCTION_AUTH_NOT_BOUND/,
  );
});

test('development actor remains available without production auth configuration',async()=>{
  const provider=adminActorProvider({
    NODE_ENV:'development',
    FPA_DEV_ACTOR_ID:'dev-admin-test',
  });
  assert.deepEqual(await provider.requireActor(),{id:'dev-admin-test',type:'ADMIN'});
});

test('unknown repository modes are rejected',()=>{
  assert.throws(
    ()=>adminRuntimeMode({NODE_ENV:'development',FPA_REPOSITORY_MODE:'legacy'}),
    /FPA_REPOSITORY_MODE_INVALID/,
  );
});


test('catalog read source is independent from operational persistence',()=>{
  assert.equal(
    adminProductSourceMode({NODE_ENV:'development',FPA_REPOSITORY_MODE:'erp5'}),
    'ERP5',
  );
  assert.equal(
    adminProductSourceMode({
      NODE_ENV:'production',
      FPA_REPOSITORY_MODE:'erp5',
      FPA_PRODUCT_SOURCE:'freepass-data',
    }),
    'FREEPASS_DATA',
  );
  assert.equal(
    adminProductSourceMode({
      NODE_ENV:'development',
      FPA_REPOSITORY_MODE:'file',
      FPA_PRODUCT_SOURCE:'erp5',
    }),
    'ERP5',
  );
});

test('production file catalog source remains fail-closed',()=>{
  assert.equal(
    adminProductSourceMode({
      NODE_ENV:'production',
      FPA_REPOSITORY_MODE:'erp5',
      FPA_PRODUCT_SOURCE:'file',
    }),
    'UNBOUND_PRODUCTION',
  );
});

test('unknown catalog source modes are rejected',()=>{
  assert.throws(
    ()=>adminProductSourceMode({NODE_ENV:'development',FPA_PRODUCT_SOURCE:'legacy'}),
    /FPA_PRODUCT_SOURCE_INVALID/,
  );
});
