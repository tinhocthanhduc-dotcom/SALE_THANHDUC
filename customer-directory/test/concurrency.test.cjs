"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { createApp } = require("../server.cjs");
test("two users create same tax simultaneously: one code, one duplicate response; replay has same code", async () => {
  const app = createApp({ actor: (req) => ({ id: req.headers["x-fixture-actor"], roles: ["sales"] }) });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + app.server.address().port + "/api", request = (actor, key) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-fixture-actor": actor }, body: JSON.stringify({ action: "create", idempotency_key: key, payload: { customer: { LOAI: "CONG_TY", TEN: "Mẫu đồng thời", MST: "0101234567" } } }) }).then((r) => r.json());
  try {
    const results = await Promise.all([request("one", "one"), request("two", "two")]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(results.find((r) => !r.ok).error, "DUPLICATE_TAX");
    assert.equal(app.driver.counter, 1);
    const winner = results[0].ok ? "one" : "two", replay = await request(winner, winner);
    assert.equal(replay.data.customer.MA_KHACH, "KTD-000001");
    assert.equal(replay.data.replayed, true);
  } finally {
    await new Promise((r) => app.server.close(r));
  }
});
