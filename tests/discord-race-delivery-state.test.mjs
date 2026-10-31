import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated state-machine contract tests, not route integration tests.
function harness() {
  const records = new Map();
  const posts = [];
  async function claim(key) {
    if (records.has(key)) return false;
    records.set(key, { state: 'sending' });
    return true;
  }
  async function deliver(key, send) {
    if (!await claim(key)) return 'skipped';
    try {
      const message = await send();
      if (!message?.id) throw new Error('missing id');
      records.set(key, { state: 'sent', id: message.id });
      return 'sent';
    } catch {
      records.set(key, { state: 'unknown' });
      return 'unknown';
    }
  }
  const send = async () => { posts.push('post'); return { id: `m${posts.length}` }; };
  return { records, posts, deliver, send };
}

test('concurrent claim sends only once', async () => {
  const h = harness();
  const out = await Promise.all([h.deliver('thread',h.send),h.deliver('thread',h.send)]);
  assert.deepEqual(out.sort(),['sent','skipped']); assert.equal(h.posts.length,1);
});
test('timeout marks unknown and never retries', async () => {
  const h = harness();
  assert.equal(await h.deliver('starter',async()=>{throw new Error('timeout')}),'unknown');
  assert.equal(await h.deliver('starter',h.send),'skipped'); assert.equal(h.posts.length,0);
});
test('partial failure preserves prior success', async () => {
  const h = harness();
  await h.deliver('ichika',h.send);
  await h.deliver('hatsune',async()=>{throw new Error('failure')});
  assert.equal(h.records.get('ichika').state,'sent');
  assert.equal(h.records.get('hatsune').state,'unknown');
});
test('rerun skips sent and resumes pending stages', async () => {
  const h = harness();
  await h.deliver('starter',h.send);
  assert.equal(await h.deliver('starter',h.send),'skipped');
  assert.equal(await h.deliver('kiina',h.send),'sent');
  assert.equal(h.posts.length,2);
});
