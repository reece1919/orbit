import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { OWNER, WORLD, articleDTO, categoryDTO } from "../../supabase/functions/driftmark-worldanvil/core.mjs";

const TOKEN = "unit-test-session-credential";
const raw = { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", world: { id: WORLD },
  title: "Reference", content: "Existing source.", state: "private", isDraft: true, isWip: true, isEditable: true };

// A small DOM adapter exercises the actual module's event handlers without
// contacting an external service or requiring a signed-in browser.
class Control {
  value = ""; checked = false; disabled = false; hidden = false; textContent = ""; open = false;
  listeners = new Map();
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
  async emit(type, target = this) { for (const fn of this.listeners.get(type) || []) await fn({ preventDefault() {}, target }); }
  showModal() { this.open = true; }
  close() { if (this.open) { this.open = false; void this.emit("close"); } }
}
async function fixture(invoke, afterWrite = async () => true, supplied = null, changes = {}, callbacks = {}) {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const controls = new Map([...html.matchAll(/id="([\w-]+)"/g)].map(match => ["#" + match[1], new Control()]));
  const $ = id => { assert.ok(controls.has(id), id); return controls.get(id); };
  const source = supplied || await articleDTO(raw); let owner = OWNER; const calls = [];
  const context = { window: { DriftmarkWriting: createRequire(import.meta.url)("../writing.js") },
    document: { querySelector: $, querySelectorAll: () => [], getElementById: id => $("#" + id) } };
  vm.runInNewContext(readFileSync(new URL("../worldanvil.js", import.meta.url), "utf8"), context);
  const app = context.window.DriftmarkWorldAnvil.init({ getOwner: () => owner,
    getClient: () => ({ functions: { invoke: async (name, request) => {
      assert.equal(name, "driftmark-worldanvil"); calls.push(request.body);
      return invoke ? invoke(request.body) : { data: request.body.action === "configure" ? { connected: true, saved: true, world: { title: "Test world" } } : { article: source } };
    } } }), getSource: () => source, getArticleText: () => "[h2]My section[/h2]\nMy own writing.",
    getCategoryChanges: () => changes,
    hasEntry: () => true, isSaving: () => false, status() {}, attach() {}, addReference: async () => true, afterWrite, ...callbacks });
  app.accountChanged(OWNER);
  async function connect() { await $("#wa-connect").emit("click"); $("#wa-token").value = TOKEN; await $("#wa-connect-form").emit("submit"); }
  return { $, app, calls, connect, source, logout() { owner = ""; app.accountChanged(""); } };
}
test("saving clears the password field and forgetting uses no browser-held token", async () => {
  const f = await fixture(); await f.connect();
  assert.equal(f.$("#wa-token").value, ""); assert.equal(f.$("#wa-browse").disabled, false);
  assert.equal(f.calls[0].token, TOKEN);
  await f.$("#wa-disconnect").emit("click");
  assert.equal(f.$("#wa-browse").disabled, true); assert.equal(f.$("#wa-review").disabled, true);
  await f.$("#wa-review").emit("click"); assert.equal(f.calls.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[1])), { action: "forget" });
});
test("a connection that completes after sign-out cannot restore tab access", async () => {
  let resolve; const response = new Promise(done => { resolve = done; });
  const f = await fixture(() => response);
  await f.$("#wa-connect").emit("click"); f.$("#wa-token").value = TOKEN;
  const pending = f.$("#wa-connect-form").emit("submit");
  f.logout(); resolve({ data: { connected: true, saved: true, world: { title: "Test world" } } }); await pending;
  assert.equal(f.$("#wa-browse").disabled, true); assert.equal(f.$("#wa-token").value, "");
  assert.doesNotMatch(f.$("#wa-status").textContent, /^Connected/);
});
test("closing the connection form discards its late response", async () => {
  let resolve; const response = new Promise(done => { resolve = done; });
  const f = await fixture(() => response); await f.$("#wa-connect").emit("click"); f.$("#wa-token").value = TOKEN;
  const pending = f.$("#wa-connect-form").emit("submit"); f.$("#wa-connect-dialog").close();
  resolve({ data: { connected: true, saved: true } }); await pending; assert.equal(f.$("#wa-browse").disabled, true);
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
    if (body.action === "configure") return { data: { connected: true, saved: true } };
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
  const f = await fixture(body => ({ data: body.action === "configure" ? { connected: true, saved: true } :
    body.action === "update" ? { verified: true, article: source } : { article: source } }), async value => { cached = value; return false; });
  await f.connect(); await f.$("#wa-review").emit("click"); f.$("#wa-review-ack").checked = true; await f.$("#wa-save-update").emit("click");
  assert.equal(cached.content, source.content); assert.match(f.$("#wa-review-feedback").textContent, /Save to cloud/);
  assert.equal(f.$("#wa-save-update").disabled, true);
});

test("a new tab restores the saved account connection without receiving a token", async () => {
  let stored = false;
  const broker = body => ({ data: body.action === "configure" ? (stored = true, { connected: true, saved: true }) :
    { connected: stored, saved: stored, world: { title: "Test world" } } });
  const original = await fixture(broker); await original.connect(); original.logout();
  const reloaded = await fixture(broker); await reloaded.app.restore();
  assert.equal(reloaded.$("#wa-browse").disabled, false); assert.equal(reloaded.$("#wa-token").value, "");
  assert.equal(reloaded.calls.length, 1); assert.equal(reloaded.calls[0].action, "status");
  assert.equal(reloaded.calls[0].token, undefined); assert.doesNotMatch(JSON.stringify(reloaded.calls), /unit-test-session-credential/);
});
test("article operations after saving send no World Anvil token", async () => {
  const f = await fixture(); await f.connect(); await f.$("#wa-review").emit("click");
  assert.equal(f.calls[1].action, "article"); assert.equal(f.calls[1].token, undefined);
});
test("failed storage cannot be presented as a saved connection", async () => {
  const f = await fixture(() => ({ data: { connected: true, saved: false } })); await f.connect();
  assert.equal(f.$("#wa-browse").disabled, true); assert.match(f.$("#wa-connect-feedback").textContent, /saved connection/);
});
test("a late saved-connection check cannot restore access after sign-out", async () => {
  let resolve; const response = new Promise(done => { resolve = done; });
  const f = await fixture(() => response), pending = f.app.restore(); f.logout();
  resolve({ data: { connected: true, saved: true } }); await pending;
  assert.equal(f.$("#wa-browse").disabled, true); assert.equal(f.$("#wa-disconnect").hidden, true);
});
test("a rejected saved token can be forgotten without reconnecting it", async () => {
  const f = await fixture(body => body.action === "status" ?
    { error: { context: { clone: () => ({ json: async () => ({ error: "Token expired", has_saved_connection: true }) }) } } } :
    { data: { connected: false, saved: false } });
  await f.app.restore(); assert.equal(f.$("#wa-browse").disabled, true); assert.equal(f.$("#wa-disconnect").hidden, false);
  await f.$("#wa-disconnect").emit("click"); assert.equal(f.$("#wa-disconnect").hidden, true);
});

const categorySource = async extra => categoryDTO({ id: raw.id, world: { id: WORLD }, title: "Places", state: "private",
  isEditable: true, subscribergroups: [], description: "Existing description.", excerpt: "Keep this teaser.",
  custom1: "Keep this block.", custom2: "", custom3: "", custom4: "", custom5: "Clear this block.", ...extra });
test("category review sends only selected changed fields using the saved connection", async () => {
  const source = await categorySource(); let stored;
  const f = await fixture(body => ({ data: body.action === "status" ? { connected: true, saved: true } :
    body.action === "update_category" ? { verified: true, category: { ...source, fields: { ...source.fields, ...body.changes } } } :
      { category: source } }), async s => { stored = s; return true; }, source,
    { description: "My own page text.", excerpt: source.fields.excerpt, custom5: "" });
  await f.app.restore(); await f.$("#wa-review").emit("click");
  assert.match(f.$("#wa-before").value, /Existing description|Clear this block/);
  assert.doesNotMatch(f.$("#wa-before").value, /Keep this teaser|Keep this block/);
  assert.match(f.$("#wa-after").value, /My own page text|Empty field/);
  assert.match(f.$("#wa-review-ack-label").textContent, /clear/);
  f.$("#wa-review-ack").checked = true; await f.$("#wa-save-update").emit("click");
  const write = f.calls.find(c => c.action === "update_category");
  assert.deepEqual(JSON.parse(JSON.stringify(write.changes)), { description: "My own page text.", custom5: "" });
  assert.equal(write.token, undefined); assert.equal(stored.kind, "category"); assert.equal(stored.fields.custom1, "Keep this block.");
  assert.match(f.$("#wa-review-feedback").textContent, /verified/);
});
test("a lost category write response consumes review and sign-out clears its text", async () => {
  const source = await categorySource();
  const f = await fixture(body => {
    if (body.action === "status") return { data: { connected: true, saved: true } };
    if (body.action === "category") return { data: { category: source } };
    throw Error("Network response lost after write");
  }, async () => true, source, { description: "My own words." });
  await f.app.restore(); await f.$("#wa-review").emit("click"); f.$("#wa-review-ack").checked = true;
  await f.$("#wa-save-update").emit("click"); assert.equal(f.$("#wa-save-update").disabled, true);
  f.$("#wa-review-ack").checked = true; await f.$("#wa-save-update").emit("click");
  assert.equal(f.calls.filter(c => c.action === "update_category").length, 1);
  assert.match(f.$("#wa-review-feedback").textContent, /Check the destination/);
  f.logout(); assert.equal(f.$("#wa-before").value, ""); assert.equal(f.$("#wa-after").value, "");
  assert.equal(f.$("#wa-browse-categories").disabled, true);
});
test("category review cannot enable writing with missing privacy metadata or no changes", async () => {
  for (const extra of [{ subscribergroups: undefined }, {}]) {
    const source = await categorySource(extra), changes = Object.keys(extra).length ? { description: "My own words." } : { description: source.fields.description };
    const f = await fixture(body => ({ data: body.action === "status" ? { connected: true, saved: true } : { category: source } }),
      async () => true, source, changes);
    await f.app.restore(); await f.$("#wa-review").emit("click"); f.$("#wa-review-ack").checked = true;
    await f.$("#wa-review-ack").emit("change"); assert.equal(f.$("#wa-save-update").disabled, true);
    await f.$("#wa-save-update").emit("click"); assert.equal(f.calls.some(c => c.action === "update_category"), false);
  }
});

test("category browser reads a category and opens its own desk without reattaching an article", async () => {
  const source = await categorySource(); let added, attachments = 0;
  const f = await fixture(body => ({ data: body.action === "status" ? { connected: true, saved: true } :
    body.action === "categories" ? { categories: [{ id: source.id, title: "Places" }], has_more: false } : { category: source } }),
    async () => true, null, {}, { addReference: async value => { added = value; return true; }, attach: () => attachments++ });
  await f.app.restore(); await f.$("#wa-browse-categories").emit("click"); await new Promise(setImmediate);
  assert.equal(f.$("#wa-browser-kind").value, "categories");
  await f.$("#wa-articles").emit("click", { closest: () => ({ dataset: { waArticle: source.id } }) }); await new Promise(setImmediate);
  assert.equal(f.$("#wa-reader-dialog").open, true); assert.equal(f.$("#wa-attach").hidden, true);
  assert.match(f.$("#wa-reader-content").value, /Main description|Preview excerpt|Existing description/);
  await f.$("#wa-attach").emit("click"); assert.equal(attachments, 0);
  await f.$("#wa-add-reference").emit("click"); assert.equal(added.kind, "category");
  assert.equal(f.$("#wa-reader-dialog").open, false);
  assert.equal(f.calls.find(c => c.action === "category").token, undefined);
});
test("category pagination uses 100 rows and switches back to article pagination", async () => {
  const f = await fixture(body => ({ data: body.action === "status" ? { connected: true, saved: true } :
    body.action === "categories" ? { categories: Array.from({ length: 100 }, () => ({ id: raw.id, title: "Places" })), has_more: true } :
      { articles: [{ id: raw.id, title: "Article" }], has_more: false } }));
  await f.app.restore(); await f.$("#wa-browse-categories").emit("click"); await new Promise(setImmediate);
  await f.$("#wa-page-next").emit("click"); await new Promise(setImmediate);
  assert.equal(f.calls.filter(c => c.action === "categories").at(-1).offset, 100);
  f.$("#wa-browser-kind").value = "articles"; await f.$("#wa-browser-kind").emit("change"); await new Promise(setImmediate);
  assert.equal(f.calls.at(-1).action, "articles"); assert.equal(f.calls.at(-1).offset, 0);
  assert.match(f.$("#wa-browser-title").textContent, /articles/);
});
