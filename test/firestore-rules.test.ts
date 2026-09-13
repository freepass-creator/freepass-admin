import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

let environment: RulesTestEnvironment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-freepasserp-v1',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    await assertSucceeds(setDoc(doc(context.firestore(), 'products', 'product-1'), { name: 'seed' }));
  });
});

after(async () => {
  await environment.cleanup();
});

for (const identity of [
  { label: 'unauthenticated', context: () => environment.unauthenticatedContext() },
  { label: 'SALES', context: () => environment.authenticatedContext('sales-1', { role: 'SALES' }) },
  { label: 'ADMIN', context: () => environment.authenticatedContext('admin-1', { role: 'ADMIN' }) },
]) {
  test(`${identity.label} browser access is denied for known and future collections`, async () => {
    const db = identity.context().firestore();
    await assertFails(getDoc(doc(db, 'products', 'product-1')));
    await assertFails(getDocs(collection(db, 'applications')));
    await assertFails(setDoc(doc(db, 'settlements', 'settlement-1'), {
      role: 'ADMIN', source: 'ADMIN', actorId: 'forged-admin',
    }));
    await assertFails(setDoc(doc(db, 'futureCollection', 'future-1', 'nested', 'nested-1'), { open: true }));
  });
}
