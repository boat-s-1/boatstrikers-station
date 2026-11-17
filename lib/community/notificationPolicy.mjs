// Pure, fail-closed notification policy for future web/PWA/native delivery.
// No DB writes, push sends or external channel calls are performed here.
export const NOTIFICATION_TYPES = Object.freeze({
  thread_reply: 'thread_reply',
  prediction_published: 'prediction_published',
  favorite_racer_update: 'favorite_racer_update',
  service_notice: 'service_notice',
});
export const NOTIFICATION_CHANNELS = Object.freeze({
  in_app: 'in_app',
  web_push: 'web_push',
  native_push: 'native_push',
});
const TYPES = new Set(Object.values(NOTIFICATION_TYPES));
const CHANNELS = new Set(Object.values(NOTIFICATION_CHANNELS));

export function canQueueNotification(event, recipient, preference) {
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      !recipient || typeof recipient !== 'object' || Array.isArray(recipient)) return false;
  if (!TYPES.has(event.type) || !CHANNELS.has(event.channel)) return false;
  if (typeof event.recipientUserId !== 'string' || event.recipientUserId.length === 0 ||
      event.recipientUserId !== recipient.userId) return false;
  if (recipient.accountStatus !== 'active' || recipient.withdrawn === true ||
      recipient.blocked === true) return false;
  if (event.authorizedByServer !== true) return false;
  if (event.type === 'thread_reply' && event.canRecipientReadThread !== true) return false;
  if (event.type === 'prediction_published' && event.canRecipientReadPrediction !== true) return false;
  if (event.channel === 'in_app') return true; // inbox is the canonical channel
  if (!preference || typeof preference !== 'object' || Array.isArray(preference)) return false;
  if (preference.userId !== recipient.userId || preference.type !== event.type ||
      preference.channel !== event.channel || preference.enabled !== true) return false;
  if (event.channel === 'web_push') return recipient.webPushSubscribed === true;
  if (event.channel === 'native_push') return recipient.nativePushSubscribed === true;
  return false;
}
