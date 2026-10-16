"use strict";
const { stable } = require("./repository.cjs"), { fail, access } = require("./core.cjs");
const equal = (a, b) => {
  a = String(a || "");
  b = String(b || "");
  let n = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) n |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return n === 0;
};
function authenticate(envelope, { clients, users, hmac, now = () => Date.now() }) {
  if (!envelope || !envelope.client_id || !envelope.signature) fail("HMAC_REQUIRED");
  const client = clients[envelope.client_id], actor = users[envelope.actor_id];
  if (!client || client.active === false || !client.secret || !actor || !client.actors?.includes(envelope.actor_id)) fail("AUTH_REQUIRED");
  if (!Number.isSafeInteger(envelope.timestamp) || Math.abs(now() - envelope.timestamp) > 3e5) fail("SIGNATURE_EXPIRED");
  const unsigned = { ...envelope };
  delete unsigned.signature;
  if (stable(unsigned).length > 15e5) fail("REQUEST_TOO_LARGE");
  const message=stable(unsigned),current=equal(hmac(message,client.secret),envelope.signature);
  const previous=client.previous_secret&&Number.isSafeInteger(client.previous_expires_at)&&now()<client.previous_expires_at
    ? equal(hmac(message,client.previous_secret),envelope.signature):false;
  if (!current&&!previous) fail("BAD_SIGNATURE");
  access(actor);
  return actor;
}
module.exports = { authenticate, equal };
