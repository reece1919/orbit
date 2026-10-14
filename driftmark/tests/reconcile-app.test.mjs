import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { articleDTO, OWNER, WORLD } from "../../supabase/functions/driftmark-worldanvil/core.mjs";
const require = createRequire(import.meta.url), W = require("../writing.js"), R = require("../reconcile.js");
const ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", NEW = "11111111-2222-3333-4444-555555555555";
const raw = (id = ID, content = "Original external text") => ({ id, title: id === ID ? "World Anvil renamed title" : "New article",
  world: { id: WORLD }, content, state: "private", isDraft: true, isWip: true, isEditable: true });
const clone = value => JSON.parse(JSON.stringify(value));
class Control {
  value = ""; hidden = false; disabled = false; checked = false; open = false; style = {}; listeners = new Map();
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
  async emit(type, target = this) { for (const fn of this.listeners.get(type) || []) await fn({ preventDefault() {}, target }); }
  showModal() { this.open = true; } close() { if (this.open) { this.open = false; void this.emit("close"); } }
  focus() {} click() {} remove() {} reportValidity() { return true; }
}
const drain = async () => { for (let i = 0; i < 6; i++) await new Promise(setImmediate); };
async function fixture({ broker, saved = true, conflict = false, initialAuth = true, initialAal = "aal2" } = {}) {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const controls = new Map([...html.matchAll(/id="([\w-]+)"/g)].map(m => ["#" + m[1], new Control()]));
  controls.set(".article-details", new Control()); controls.set("label[for=import]", new Control());
  const fields = new Map(["title", "category", "status", "tags", "url", "body"].map(n => [n, new Control()]));
  const $ = selector => { assert.ok(controls.has(selector), selector); return controls.get(selector); };
  $("#filter").value = "all";
  $("#entry-form").querySelector = selector => { const name = selector.match(/name="([^"]+)"/)[1]; return fields.get(name); };
  $("#entry-form").reset = () => { for (const f of fields.values()) f.value = ""; fields.get("category").value = "Locations"; fields.get("status").value = "Seed"; };
  let deskArticle, exported, authCallback, owner = initialAuth ? OWNER : "", waOptions, restorePromise, aal = initialAal;
  const calls = [], writes = [], windowListeners = new Map();
  const source = { ...await articleDTO(raw()), kind: "article" };
  const article = W.starter("Locations"); article.sections[0].draft = "My saved prose.\n"; article.sections[0].decisions = "My saved decision"; article.sections[0].reviewed = true;
  let cloud = { revision: 1, updated_at: "2026-10-01T00:00:00Z", payload: { version: 4, world: "Eilmark", entries: [
    { id: "saved-entry", title: "My dashboard title", category: "Locations", status: "Drafting", tags: "keep tags", body: "Keep my notes",
      url: "https://example.com/my-own-url", article, world_anvil: source, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" },
    { id: "local-only", title: "Only on dashboard", category: "Ideas", status: "Seed", body: "Keep this local work", article: W.starter("Ideas") }
  ] } };
  const original = clone(cloud.payload.entries);
  function query() {
    const filters = {}; let mode = "read", update;
    const q = { select() { return q; }, eq(key, value) { filters[key] = value; return q; },
      update(value) { mode = "update"; update = value; return q; }, insert() { throw Error("Unexpected insert"); },
      async maybeSingle() {
        if (mode === "read") return { data: clone(cloud), error: null };
        assert.equal(filters.owner_id, OWNER);
        if (conflict || filters.revision !== cloud.revision) return { data: null, error: null };
        cloud = { ...cloud, ...clone(update) }; writes.push(clone(update));
        return { data: { revision: cloud.revision, updated_at: cloud.updated_at }, error: null };
      } };
    return q;
  }
  const client = { from: () => query(), auth: { getUser: async () => ({ data: { user: owner ? { id: owner } : null } }),
    onAuthStateChange: fn => { authCallback = fn; }, mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: aal } }) } },
    functions: { invoke: async (_name, { body }) => {
      calls.push(clone(body));
      if (broker) return broker(body);
      return { data: body.action === "status" ? { connected: saved, saved } : body.action === "articles" ?
        { articles: [{ id: ID, title: "World Anvil renamed title" }, { id: NEW, title: "New article" }], has_more: false } :
        { article: await articleDTO(raw(body.article_id, "Latest external text")) } };
    } } };
  const context = { URL, Blob: class { constructor(parts) { this.parts = parts; } }, confirm: () => { throw Error("Unexpected discard prompt"); },
    setTimeout: fn => { fn(); }, document: { querySelector: $, querySelectorAll: () => [], getElementById: id => $("#" + id),
      body: { appendChild() {} }, createElement: () => new Control() },
    window: { DriftmarkWriting: W, DriftmarkReconcile: R, supabase: { createClient: () => client },
      URL: class extends URL { static createObjectURL(blob) { exported = blob.parts[0]; return "blob:test"; } static revokeObjectURL() {} },
      addEventListener: (type, fn) => windowListeners.set(type, fn),
      DriftmarkWorkbench: { init: () => ({ open(entry) { deskArticle = W.normalizeArticle(entry.article) || W.starter(entry.category); },
        collect: () => W.normalizeArticle(deskArticle), reset() { deskArticle = null; }, changeCategory() {} }) } } };
  vm.runInNewContext(readFileSync(new URL("../worldanvil.js", import.meta.url), "utf8"), context);
  const originalInit = context.window.DriftmarkWorldAnvil.init;
  context.window.DriftmarkWorldAnvil.init = options => {
    waOptions = options; const controller = originalInit(options), restore = controller.restore;
    controller.restore = () => { restorePromise = restore(); return restorePromise; }; return controller;
  };
  vm.runInNewContext(readFileSync(new URL("../app.js", import.meta.url), "utf8"), context);
  await drain();
  if (!broker) await restorePromise;
  return { $, fields, calls, writes, original, cloud: () => clone(cloud),
    options: () => waOptions, draft: () => deskArticle,
    open: async id => $("#list").emit("click", { closest: () => ({ dataset: { entry: id } }) }),
    backup: async () => { await $("#export").emit("click"); return JSON.parse(exported); },
    dirty: () => { let prevented = false; windowListeners.get("beforeunload")({ preventDefault() { prevented = true; } }); return prevented; },
    logout() { owner = ""; authCallback("SIGNED_OUT", null); },
    login() { owner = OWNER; authCallback("SIGNED_IN", { user: { id: OWNER } }); },
    verifyMFA() { aal = "aal2"; authCallback("MFA_CHALLENGE_VERIFIED", { user: { id: OWNER } }); },
    async settled() { await drain(); await restorePromise; } };
}
test("verified login automatically lists and imports all references while preserving saved writing", async () => {
  const f = await fixture();
  assert.ok(f.calls.some(c => c.action === "articles")); assert.equal(f.cloud().payload.version, 5);
  const entries = f.cloud().payload.entries; assert.equal(entries.length, 3);
  const old = entries.find(e => e.id === "saved-entry");
  for (const key of ["title", "category", "status", "tags", "url", "body", "article", "created_at", "updated_at"])
    assert.deepEqual(old[key], f.original[0][key], key);
  assert.equal(old.world_anvil.content, "Latest external text");
  assert.equal(entries.find(e => e.id === "local-only").body, "Keep this local work");
  assert.ok(entries.find(e => e.world_anvil?.id === NEW).article.sections.every(s => !s.draft));
  assert.ok(f.calls.every(c => c.token === undefined && !["update", "update_category"].includes(c.action)));
  assert.match(f.$("#wa-sync-status").textContent, /Reconciled 2 articles/);
});
test("background reconciliation preserves a dirty active editor and includes it in a backup", async () => {
  let finishRead; const waiting = new Promise(resolve => { finishRead = resolve; });
  const f = await fixture({ broker: async body => {
    if (body.action === "status") return { data: { connected: true, saved: true } };
    if (body.action === "articles") return { data: { articles: [{ id: ID, title: "External renamed title" }], has_more: false } };
    return waiting;
  } });
  await f.open("saved-entry"); f.fields.get("title").value = "Unsaved title";
  f.draft().sections[0].draft = "My NEW unsaved words.\n"; await f.$("#entry-form").emit("input"); assert.equal(f.dirty(), true);
  finishRead({ data: { article: await articleDTO(raw(ID, "Changed remote body")) } }); await drain();
  assert.equal(f.fields.get("title").value, "Unsaved title"); assert.equal(f.draft().sections[0].draft, "My NEW unsaved words.\n");
  assert.equal(f.dirty(), true); assert.equal(f.$("#wa-linked-content").value, "Changed remote body");
  const backup = await f.backup(), entry = backup.entries.find(e => e.id === "saved-entry");
  assert.equal(backup.includes_unsaved_editor, true); assert.equal(entry.title, "Unsaved title");
  assert.equal(entry.article.sections[0].draft, "My NEW unsaved words.\n"); assert.equal(entry.world_anvil.content, "Changed remote body");
  await f.$("#entry-form").emit("submit"); assert.equal(f.cloud().payload.entries[0].article.sections[0].draft, "My NEW unsaved words.\n");
});
test("refresh with unsaved writing reconciles references without a discard prompt", async () => {
  const f = await fixture(); await f.open("saved-entry"); f.fields.get("body").value = "Unsaved notes";
  await f.$("#entry-form").emit("input"); await f.$("#sync").emit("click"); await drain();
  assert.equal(f.fields.get("body").value, "Unsaved notes"); assert.equal(f.dirty(), true);
  assert.equal(f.cloud().payload.entries.length, 3);
});
test("cloud revision conflicts stop reconciliation and leave the saved atlas unchanged", async () => {
  const f = await fixture({ conflict: true });
  assert.equal(f.writes.length, 0); assert.equal(f.cloud().payload.version, 4); assert.equal(f.cloud().payload.entries.length, 2);
  assert.equal(f.calls.filter(c => c.action === "article").length, 0);
  assert.match(f.$("#wa-sync-status").textContent, /private workspace could not be saved/);
});
test("no saved connection keeps the private dashboard available without requesting article data", async () => {
  const f = await fixture({ saved: false }); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].action, "status");
  assert.equal(f.writes.length, 0); assert.equal(f.$("#workspace").hidden, false);
});
test("sign-out during a source read stops further writes and clears visible reference text", async () => {
  let finish; const pending = new Promise(resolve => { finish = resolve; });
  const f = await fixture({ broker: async body => ({ data: body.action === "status" ? { connected: true, saved: true } :
    body.action === "articles" ? { articles: [{ id: ID, title: "External" }], has_more: false } : await pending }) });
  const checkpoints = f.writes.length; await f.open("saved-entry"); f.logout();
  finish(await articleDTO(raw(ID, "Late remote text"))); await drain();
  assert.equal(f.writes.length, checkpoints); assert.equal(f.$("#workspace").hidden, true);
  assert.equal(f.$("#wa-linked-content").value, ""); assert.equal(f.$("#wa-reconcile").disabled, true);
});

test("signing in through ORBIT starts reconciliation in an already open dashboard", async () => {
  const f = await fixture({ initialAuth: false }); assert.equal(f.calls.length, 0);
  f.login(); await f.settled();
  assert.equal(f.$("#workspace").hidden, false); assert.ok(f.calls.some(c => c.action === "articles"));
  assert.equal(f.cloud().payload.entries.length, 3); assert.match(f.$("#wa-sync-status").textContent, /Reconciled/);
});
test("automatic sign-in waits for MFA before loading the private atlas and references", async () => {
  const f = await fixture({ initialAuth: false, initialAal: "aal1" }); f.login(); await f.settled();
  assert.equal(f.calls.length, 0); assert.equal(f.$("#workspace").hidden, true);
  f.verifyMFA(); await f.settled();
  assert.equal(f.$("#workspace").hidden, false); assert.ok(f.calls.some(c => c.action === "articles"));
});
