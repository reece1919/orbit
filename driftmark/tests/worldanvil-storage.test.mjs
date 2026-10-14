import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler, OWNER, ORIGIN, WORLD } from "../../supabase/functions/driftmark-worldanvil/core.mjs";
import { createConnections } from "../../supabase/functions/driftmark-worldanvil/connections.mjs";

const TOKEN = "unit-test-vault-credential", ARTICLE = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
function backend(options = {}) {
  const values = options.values || new Map(), storageCalls = [], upstreamCalls = [];
  const connections = {
    async read(owner) { storageCalls.push(["read", owner]); return values.get(owner) || null; },
    async write(owner, value) { storageCalls.push(["write", owner]); values.set(owner, value); },
    async remove(owner) { storageCalls.push(["remove", owner]); values.delete(owner); },
    ...options.connections
  };
  const handler = createHandler({ connections,
    authorize: options.authorize || (async () => ({ id: OWNER, aal: "aal2" })),
    fetcher: async (url, request) => {
      upstreamCalls.push([url, request]); assert.equal(request.headers["x-auth-token"], TOKEN);
      assert.ok(!url.includes(TOKEN));
      if (options.rejectToken) return Response.json({ error: "Do not expose " + TOKEN }, { status: 401 });
      const path = new URL(url).pathname;
      if (path === "/identity") return Response.json({ id: ARTICLE });
      if (path === "/user/worlds") return Response.json({ worlds: [{ id: WORLD, title: "Test world" }] });
      return Response.json({ id: ARTICLE, world: { id: WORLD }, title: "Source", content: "Reference text", isEditable: true,
        state: "private", isDraft: true, isWip: true });
    }
  });
  async function call(body) {
    const response = await handler(new Request("https://test.invalid", { method: "POST",
      headers: { Origin: ORIGIN, Authorization: "Bearer test.jwt", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    return { status: response.status, data: await response.json() };
  }
  return { call, values, storageCalls, upstreamCalls };
}
test("verified configure saves once, and another request restores without a browser token", async () => {
  const first = backend(), configured = await first.call({ action: "configure", token: TOKEN });
  assert.equal(configured.status, 200); assert.equal(configured.data.saved, true); assert.equal(first.values.get(OWNER), TOKEN);
  const next = backend({ values: first.values }), restored = await next.call({ action: "status" });
  assert.equal(restored.status, 200); assert.equal(restored.data.connected, true); assert.equal(restored.data.saved, true);
  const article = await next.call({ action: "article", article_id: ARTICLE }); assert.equal(article.status, 200);
  for (const result of [configured, restored, article]) assert.doesNotMatch(JSON.stringify(result.data), /unit-test-vault-credential/);
});
test("World Anvil rejection does not replace the previous encrypted connection", async () => {
  const values = new Map([[OWNER, "previous-verified-credential"]]), b = backend({ values, rejectToken: true });
  const result = await b.call({ action: "configure", token: TOKEN });
  assert.equal(result.status, 401); assert.equal(values.get(OWNER), "previous-verified-credential");
  assert.equal(b.storageCalls.length, 0); assert.doesNotMatch(JSON.stringify(result.data), /unit-test-vault-credential/);
});
test("storage failure cannot claim a saved connection or leak its error details", async () => {
  const b = backend({ connections: { write: async () => { throw Error("private failure with " + TOKEN); } } });
  const result = await b.call({ action: "configure", token: TOKEN });
  assert.equal(result.status, 503); assert.equal(result.data.connected, undefined); assert.equal(result.data.saved, undefined);
  assert.doesNotMatch(JSON.stringify(result.data), /private failure|unit-test-vault-credential/);
});
test("unauthorized users never read, write, or delete saved credentials", async () => {
  for (const auth of [null, { id: ARTICLE, aal: "aal2" }, { id: OWNER, aal: "aal1" }]) {
    for (const body of [{ action: "status" }, { action: "forget" }, { action: "configure", token: TOKEN }]) {
      const b = backend({ authorize: async () => auth }), result = await b.call(body);
      assert.equal(result.status, 403); assert.equal(b.storageCalls.length, 0); assert.equal(b.upstreamCalls.length, 0);
    }
  }
});
test("forgetting deletes the saved credential and subsequent operations need setup", async () => {
  const b = backend({ values: new Map([[OWNER, TOKEN]]) });
  const forgotten = await b.call({ action: "forget" }); assert.equal(forgotten.status, 200); assert.equal(b.values.has(OWNER), false);
  const status = await b.call({ action: "status" }); assert.equal(status.data.connected, false); assert.equal(status.data.needs_token, true);
  const article = await b.call({ action: "article", article_id: ARTICLE }); assert.equal(article.status, 409); assert.equal(b.upstreamCalls.length, 0);
});
test("an expired saved credential is reported safely and remains available to forget", async () => {
  const b = backend({ values: new Map([[OWNER, TOKEN]]), rejectToken: true }), result = await b.call({ action: "status" });
  assert.equal(result.status, 401); assert.equal(result.data.has_saved_connection, true);
  assert.doesNotMatch(JSON.stringify(result.data), /unit-test-vault-credential|Do not expose/);
  const forgotten = await b.call({ action: "forget" }); assert.equal(forgotten.status, 200);
});
test("private RPC adapter uses only the connection endpoints and sanitizes database errors", async () => {
  const calls = [], connections = createConnections({ rpc: async (name, body) => {
    calls.push([name, body]); return { data: name === "driftmark_wa_read" ? TOKEN : null, error: null };
  } });
  await connections.write(OWNER, TOKEN); assert.equal(await connections.read(OWNER), TOKEN); await connections.remove(OWNER);
  assert.deepEqual(calls.map(call => call[0]), ["driftmark_wa_store", "driftmark_wa_read", "driftmark_wa_forget"]);
  const broken = createConnections({ rpc: async () => ({ error: { message: TOKEN } }) });
  await assert.rejects(() => broken.read(OWNER), error => !error.message.includes(TOKEN));
});
