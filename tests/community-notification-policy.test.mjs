import test from 'node:test';
import assert from 'node:assert/strict';
import { canQueueNotification } from '../lib/community/notificationPolicy.mjs';

const recipient = { userId: 'user-a', accountStatus: 'active', withdrawn: false, blocked: false, webPushSubscribed: true, nativePushSubscribed: false };
const event = { type: 'thread_reply', channel: 'in_app', recipientUserId: 'user-a', authorizedByServer: true, canRecipientReadThread: true };
const pref = { userId: 'user-a', type: 'thread_reply', channel: 'web_push', enabled: true };

test('authorized reply notification reaches own in-app inbox without external signup', () => {
  assert.equal(canQueueNotification(event, recipient), true);
});
test('no client or other-user notification injection', () => {
  assert.equal(canQueueNotification({...event,authorizedByServer:false},recipient),false);
  assert.equal(canQueueNotification({...event,recipientUserId:'user-b'},recipient),false);
  assert.equal(canQueueNotification({...event,authorizedByServer:'true'},recipient),false);
});
test('withdrawn blocked or inactive recipients never receive notifications', () => {
  assert.equal(canQueueNotification(event,{...recipient,withdrawn:true}),false);
  assert.equal(canQueueNotification(event,{...recipient,blocked:true}),false);
  assert.equal(canQueueNotification(event,{...recipient,accountStatus:'suspended'}),false);
});
test('private thread and prediction visibility is rechecked', () => {
  assert.equal(canQueueNotification({...event,canRecipientReadThread:false},recipient),false);
  assert.equal(canQueueNotification({...event,type:'prediction_published',canRecipientReadPrediction:false},recipient),false);
  assert.equal(canQueueNotification({...event,type:'prediction_published',canRecipientReadPrediction:true},recipient),true);
});
test('web push requires exact user preference and subscription', () => {
  const push={...event,channel:'web_push'};
  assert.equal(canQueueNotification(push,recipient,pref),true);
  assert.equal(canQueueNotification(push,recipient,{...pref,userId:'user-b'}),false);
  assert.equal(canQueueNotification(push,recipient,{...pref,enabled:false}),false);
  assert.equal(canQueueNotification(push,{...recipient,webPushSubscribed:false},pref),false);
});
test('native push disabled until explicit opt-in and subscription', () => {
  const push={...event,channel:'native_push'};
  assert.equal(canQueueNotification(push,recipient,{...pref,channel:'native_push'}),false);
  assert.equal(canQueueNotification(push,{...recipient,nativePushSubscribed:true},{...pref,channel:'native_push'}),true);
});
test('unknown types, channels and malformed objects fail closed', () => {
  assert.equal(canQueueNotification({...event,type:'constructor'},recipient),false);
  assert.equal(canQueueNotification({...event,channel:'discord'},recipient),false);
  assert.equal(canQueueNotification(null,recipient),false);
  assert.equal(canQueueNotification(event,null),false);
  assert.equal(canQueueNotification({...event,channel:'web_push'},recipient,null),false);
});
