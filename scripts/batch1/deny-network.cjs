// Defense in depth for tests, not a replacement for the OS network namespace.
const deny = () => { throw new Error('BATCH1_NETWORK_DENIED'); };
globalThis.fetch = deny;
for (const [name, methods] of Object.entries({
  http: ['request', 'get'], https: ['request', 'get'],
  net: ['connect', 'createConnection', 'createServer'], tls: ['connect', 'createServer'],
  dns: ['lookup', 'resolve', 'resolve4', 'resolve6', 'reverse'], dgram: ['createSocket'],
})) {
  const mod = require('node:' + name);
  for (const method of methods) mod[method] = deny;
  if (name === 'dns') for (const method of methods) mod.promises[method] = deny;
}
require('node:net').Socket.prototype.connect = deny;
require('node:module').syncBuiltinESMExports();
