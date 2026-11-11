// Preload for FREE tests only. No real credential is inherited by test files.
for (const name of Object.keys(process.env)) if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name)) delete process.env[name];
const deny = () => { throw new Error('OFFLINE_TEST_NETWORK_DENIED'); };
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, init) => {
  // The one proxy compatibility test uses a dummy destination through its loopback mock proxy.
  let proxy;
  try { proxy = new URL(process.env.HTTP_PROXY); } catch { return deny(); }
  if (String(url) !== 'http://verification.invalid/mock' || proxy.hostname !== '127.0.0.1') return deny();
  return nativeFetch(url, init);
};
const net = require('node:net');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = typeof first === 'object' ? first.host : args[1];
  if (!['127.0.0.1', '::1'].includes(host)) return deny();
  return connect.apply(this, args);
};
require('node:module').syncBuiltinESMExports();
