import assert from 'node:assert/strict';
import test from 'node:test';
import { EnvReferenceMaster } from './reference-master';

test('dev reference master exposes only explicitly configured channel ids',async()=>{
  const master=new EnvReferenceMaster({
    FPA_DEV_SALES_CHANNEL_IDS:'channel-a, channel-b, channel-a',
    FPA_DEV_ACTOR_ID:'admin-a',
    FPA_DEV_ASSIGNEE_IDS:'admin-b',
  });
  assert.deepEqual((await master.listSalesChannels()).map((x)=>x.id),['channel-a','channel-b']);
  assert.deepEqual((await master.listAssignees()).map((x)=>x.id),['admin-a','admin-b']);
  assert.equal((await master.getSalesChannel('free-text')),null);
  assert.equal((await master.getAssignee('unknown')),null);
});
