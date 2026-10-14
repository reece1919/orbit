import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { OWNER, WORLD, articleDTO } from "../../supabase/functions/driftmark-worldanvil/core.mjs";

const TOKEN = "unit-test-session-credential";
const raw = { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", world: { id: WORLD },
  title: "Reference", content: "Existing source.", state: "private", isDraft: true, isWip: true, isEditable: true };

// A small DOM adapter exercises the actual module's event handlers without
// contacting an external service or requiring a signed-in browser.
class Control {
  value = ""; checked = false; disabled = false; hidden = false; textContent = ""; open = false;
  listeners = new Map();
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
  async emit(type) { for (const fn of this.listeners.get(type) || []) await fn({ preventDefault() {}, target: this }); }
  showModal() { this.open = true; }
  close() { if (this.open) { this.open = false; void this.emit("close"); } }
}
async function fixture(invoke, afterWrite = async () => true) {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const controls = new Map([...html.matchAll(/id="([\w-]+)"/g)].map(match => ["#" + match[1], new Control()]));
  const $ = id => { assert.ok(controls.has(id), id); return controls.get(id); };
  const source = await articleDTO(raw); let owner = OWNER; const calls = [];
  const context = { window: { DriftmarkWriting: createRequire(import.meta.url)("../writing.js") },
    document: { querySelector: $, querySelectorAll: () => [], getElementById: id => $("#" + id) } };
  vm.runInNewContext(readFileSync(new URL("../worldanvil.js", import.meta.url), "utf8"), context);
  const app = context.window.DriftmarkWorldAnvil.init({ getOwner: () => owner,
    getClient: () => ({ functions: { invoke: async (name, request) => {
      assert.equal(name, "driftmark-worldanvil"); calls.push(request.body);
      return invoke ? invoke(request.body) : { data: request.body.action === "configure" ? { connected: true, world: { title: "Test world" } } : { article: source } };
    } } }), getSource: () => source, getArticleText: () => "[h2]My section[/h2]\nMy own writing.",
    hasEntry: () => true, isSaving: () => false, status() {}, attach() {}, addReference: async () => true, afterWrite });
  app.accountChanged(OWNER);
  async function connect() { await $("#wa-connect").emit("click"); $("#wa-token").value = TOKEN; await $("#wa-connect-form").emit("submit"); }
  return { $, app, calls, connect, source, logout() { owner = ""; app.accountChanged(""); } };
}
test("connection clears the password field and disconnect discards the session token", async () => {
  const f = await fixture(); await f.connect();
  assert.equal(f.$("#wa-token").value, ""); assert.equal(f.$("#wa-browse").disabled, false);
  assert.equal(f.calls[0].token, TOKEN);
  await f.$("#wa-disconnect").emit("click");
  assert.equal(f.$("#wa-browse").disabled, true); assert.equal(f.$("#wa-review").disabled, true);
  await f.$("#wa-review").emit("click"); assert.equal(f.calls.length, 1);
});
test("a connection that completes after sign-out cannot restore its token", async () => {
  let resolve; const response = new Promise(done => { resolve = done; });
  const f = await fixture(() => response);
  await f.$("#wa-connect").emit("click"); f.$("#wa-token").value = TOKEN;
  const pending = f.$("#wa-connect-form").emit("submit");
  f.logout(); resolve({ data: { connected: true, world: { title: "Test world" } } }); await pending;
  assert.equal(f.$("#wa-browse").disabled, true); assert.equal(f.$("#wa-token").value, "");
  assert.doesNotMatch(f.$("#wa-status").textContent, /^Connected/);
});
test("closing the connection form cancels a late credential response", async () => {
  let resolve; const response = new Promise(done => { resolve = done; });
  const f = await fixture(() => response); await f.$("#wa-connect").emit("click"); f.$("#wa-token").value = TOKEN;
  const pending = f.$("#wa-connect-form").emit("submit"); f.$("#wa-connect-dialog").close();
  resolve({ data: { connected: true } }); await pending; assert.equal(f.$("#wa-browse").disabled, true);
});
test("sign-out clears reference and review dialogs and keeps updates disabled", async () => {
  const f = await fixture(); await f.connect(); await f.$("#wa-review").emit("click");
  assert.equal(f.$("#wa-before").value, "Existing source."); assert.equal(f.$("#wa-review-dialog").open, true);
  f.logout(); assert.equal(f.$("#wa-review-dialog").open, false); assert.equal(f.$("#wa-before").value, "");
  assert.equal(f.$("#wa-after").value, ""); assert.equal(f.$("#wa-save-update").disabled, true);
});
test("lost write responses consume the review and cannot be blindly retried", async () => {
  const source = await articleDTO(raw);
  const f = await fixture(body => {
    if (body.action === "configure") return { data: { connected: true } };
    if (body.action === "article") return { data: { article: source } };
    throw Error("network lost after PATCH");
  });
  await f.connect(); await f.$("#wa-review").emit("click"); f.$("#wa-review-ack").checked = true;
  await f.$("#wa-save-update").emit("click");
  assert.equal(f.$("#wa-save-update").disabled, true); assert.match(f.$("#wa-review-feedback").textContent, /Check the destination/);
  f.$("#wa-review-ack").checked = true; await f.$("#wa-save-update").emit("click");
  assert.equal(f.calls.filter(call => call.action === "update").length, 1);
});
test("a verified external save reports a private cloud save failure accurately", async () => {
  const source = await articleDTO({ ...raw, content: "[h2]My section[/h2]\nMy own writing." }); let cached;
  const f = await fixture(body => ({ data: body.action === "configure" ? { connected: true } :
    body.action === "update" ? { verified: true, article: source } : { article: source } }), async value => { cached = value; return false; });
  await f.connect(); await f.$("#wa-review").emit("click"); f.$("#wa-review-ack").checked = true; await f.$("#wa-save-update").emit("click");
  assert.equal(cached.content, source.content); assert.match(f.$("#wa-review-feedback").textContent, /Save to cloud/);
  assert.equal(f.$("#wa-save-update").disabled, true);
});
