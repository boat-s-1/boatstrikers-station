import test from 'node:test';
import assert from 'node:assert/strict';
import { withGamagoriLease } from './gamagori-chart-lease.mjs';

test('lease blocks concurrent work and releases only the matching owner', async () => {
  let owner; let releaseWork;
  const db = { async rpc(name, args) {
    if (name.endsWith('acquire_lease')) {
      if (owner) return {data:false};
      owner = args.p_owner; return {data:true};
    }
    assert.equal(args.p_owner, owner); owner = undefined; return {data:true};
  }};
  const first = withGamagoriLease(db, () => new Promise(r => { releaseWork = r; }));
  await new Promise(r => setImmediate(r));
  assert.deepEqual(await withGamagoriLease(db, () => {throw Error('must not run')}), {busy:true});
  releaseWork('done'); assert.deepEqual(await first, {busy:false,value:'done'});
  assert.equal(owner,undefined);
});
test('work error still releases; acquire error never starts work', async () => {
  let released=0;
  const db = {async rpc(name){if(name.endsWith('release_lease'))released++;return {data:true}}};
  await assert.rejects(withGamagoriLease(db,async()=>{throw Error('work failed')}),/work failed/);
  assert.equal(released,1);
  await assert.rejects(withGamagoriLease({rpc:async()=>({error:{}})},()=>assert.fail()),/lease_acquire_failed/);
});
