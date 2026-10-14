const { test } = require("node:test");
const assert = require("node:assert/strict");
const R = require("../reconcile.js"), W = require("../writing.js");
const WORLD = "3449e76f-83f2-4aa4-b1ec-40b2b0a8397b";
const id = n => "aaaaaaaa-bbbb-cccc-dddd-" + String(n).padStart(12, "0");
const source = (n, content = "Existing source") => ({ kind: "article", world_id: WORLD, id: id(n), title: "Source " + n,
  content, version_hash: (content === "Existing source" ? "a" : "b").repeat(64) });
const makeEntry = (row, key, date) => ({ id: key, title: row.title, category: "Lore", body: "", article: W.starter("Lore"), created_at: date, updated_at: date });
const existing = n => ({ id: "local-" + n, title: "My own title", category: "Locations", status: "Drafting", tags: "My tag",
  url: "https://example.com/my-link", body: "My existing notes", article: { purpose: "My purpose", sections: [{ draft: "My exact words.\n", decisions: "My decision", reviewed: true }] },
  world_anvil: source(n), created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" });
test("index reconciliation adds new articles, retains missing and local-only entries, and never matches by title", () => {
  const input = [existing(1), existing(2), { ...existing(3), world_anvil: null, title: "New remote title" },
    { ...existing(4), world_anvil: { kind: "category", id: id(4) } }];
  const copy = structuredClone(input);
  const result = R.reconcileIndex(input, [{ id: id(1), title: "Remote renamed title" }, { id: id(5), title: "New remote title" }], { complete: true, makeEntry });
  assert.equal(result.entries.length, 5); assert.equal(result.added, 1); assert.equal(result.missing, 1);
  assert.deepEqual(input, copy);
  for (let i = 0; i < input.length; i++) {
    const { world_anvil_link, ...rest } = result.entries[i]; assert.deepEqual(rest, input[i]);
  }
  assert.equal(result.entries[0].world_anvil_link.source_title, "Remote renamed title");
  assert.equal(result.entries[1].world_anvil_link.presence, "not_seen");
  assert.equal(result.entries[2].world_anvil_link, undefined); assert.equal(result.entries[3].world_anvil_link, undefined);
  assert.ok(result.entries[4].article.sections.every(s => !s.draft));
});
test("source reconciliation replaces only source snapshots and preserves every author field", () => {
  const input = [existing(1)], copy = structuredClone(input);
  const listed = R.reconcileIndex(input, [{ id: id(1), title: "Remote title" }], { complete: true, makeEntry }).entries;
  const result = R.reconcileSources(listed, [source(1, "Changed external text")]);
  assert.equal(result.updated, 1); assert.equal(result.entries[0].world_anvil.content, "Changed external text");
  for (const key of ["title", "category", "status", "tags", "url", "body", "article", "created_at", "updated_at"])
    assert.deepEqual(result.entries[0][key], copy[0][key], key);
  assert.equal(result.entries[0].world_anvil_link.source_changed, true); assert.deepEqual(input, copy);
});
test("repeated imports use IDs without creating duplicates or deleting locally duplicated drafts", () => {
  const rows = [{ id: id(1), title: "Source" }, { id: id(1), title: "Source" }];
  const first = R.reconcileIndex([], rows, { complete: true, makeEntry });
  assert.equal(first.entries.length, 1);
  const second = R.reconcileIndex(first.entries, rows, { complete: true, makeEntry });
  assert.equal(second.entries.length, 1); assert.equal(second.added, 0);
  const duplicates = R.reconcileIndex([existing(1), { ...existing(1), id: "other-draft" }], rows, { complete: true, makeEntry });
  assert.equal(duplicates.entries.length, 2);
});
test("an incomplete listing never marks unreturned articles missing", () => {
  const input = [existing(1), existing(2)];
  const result = R.reconcileIndex(input, [{ id: id(1), title: "Source" }], { complete: false, makeEntry });
  assert.equal(result.entries[1], input[1]); assert.equal(result.missing, 0);
});
test("failed reads keep cached text and drafts, and pending rows still match future reads", () => {
  const list = R.reconcileIndex([existing(1)], [{ id: id(1), title: "One" }, { id: id(2), title: "Two" }], { complete: true, makeEntry }).entries;
  const failed = R.reconcileSources(list, [], [id(1), id(2)]).entries;
  assert.equal(failed[0].world_anvil.content, "Existing source"); assert.equal(failed[0].world_anvil_link.text_status, "cached");
  assert.equal(failed[1].world_anvil_link.text_status, "unavailable");
  const loaded = R.reconcileSources(failed, [source(2)]).entries;
  assert.equal(loaded.length, 2); assert.equal(loaded[1].world_anvil_link.text_status, "available");
  assert.equal(R.reconcileIndex(loaded, [{ id: id(1), title: "One" }, { id: id(2), title: "Two" }], { complete: true, makeEntry }).added, 0);
});
test("ID collision with an unlinked local draft creates a separate entry", () => {
  const local = { id: "wa-" + id(1), title: "My unlinked draft", article: { sections: [{ draft: "Keep it" }] } };
  const result = R.reconcileIndex([local], [{ id: id(1), title: "Remote" }], { complete: true, makeEntry });
  assert.equal(result.entries[0], local); assert.notEqual(result.entries[1].id, local.id);
});
test("serialized import links strip credentials and arbitrary remote data", () => {
  const clean = R.normalizeLink({ kind: "article", id: id(1), world_id: WORLD, source_title: "One", token: "private token", authorization: "private token" });
  assert.doesNotMatch(JSON.stringify(clean), /private token|authorization/);
  assert.equal(R.normalizeLink({ ...clean, world_id: id(2) }), null);
});
function loader(overrides = {}) {
  const applied = [], calls = [], states = []; let active = true, stop = false;
  const deps = { request: async (action, body) => {
    calls.push({ action, ...body }); return action === "articles" ? { articles: [{ id: id(1), title: "One" }], has_more: false } : { article: source(1) };
  }, normalizeSource: s => s, apply: async batch => { applied.push(structuredClone(batch)); return true; },
  current: () => active, cancelled: () => stop, progress: s => states.push(s), ...overrides };
  return { applied, calls, states, deps, run: () => R.loadArticles(deps), signout: () => { active = false; }, cancel: () => { stop = true; } };
}
test("the loader walks all pages and sends only credential-free read operations", async () => {
  const f = loader({ request: async (action, body) => {
    f.calls.push({ action, ...body });
    return action === "articles" ? { articles: Array.from({ length: body.offset ? 3 : 50 }, (_, n) => ({ id: id(body.offset + n), title: "Source" })), has_more: body.offset === 0 } :
      { article: source(Number(body.article_id.slice(-12))) };
  } });
  const result = await f.run(); assert.equal(result.listed, 53); assert.equal(result.read, 53); assert.equal(result.complete, true);
  assert.deepEqual(f.calls.filter(c => c.action === "articles").map(c => c.offset), [0, 50]);
  assert.equal(f.applied[0].index.length, 53); assert.equal(f.applied[0].complete, true);
  assert.equal(f.applied.slice(1).reduce((n, b) => n + b.sources.length, 0), 53);
  assert.ok(f.calls.every(c => ["articles", "article"].includes(c.action) && c.token === undefined));
});
test("a interrupted later page checkpoints partial additions without any missing flag", async () => {
  const f = loader({ request: async (_action, body) => {
    if (body.offset) throw Error("Network interrupted");
    return { articles: Array.from({ length: 50 }, (_, n) => ({ id: id(n), title: "Source" })), has_more: true };
  } });
  const result = await f.run(); assert.equal(result.complete, false); assert.match(result.stopped, /interrupted/);
  assert.equal(f.applied.length, 1); assert.equal(f.applied[0].complete, false);
});
test("repeated pagination and malformed page sizes cannot claim a complete scan", async () => {
  for (const size of [49, 50]) {
    const f = loader({ request: async () => ({ articles: Array.from({ length: size }, (_, n) => ({ id: id(n), title: "Source" })), has_more: true }) });
    const result = await f.run(); assert.equal(result.complete, false); assert.equal(f.applied[0].complete, false);
  }
});
test("one unavailable article does not discard cached successes or skip subsequent articles", async () => {
  const f = loader({ request: async (action, body) => {
    if (action === "articles") return { articles: [1, 2, 3].map(n => ({ id: id(n), title: "Source" })), has_more: false };
    if (body.article_id === id(2)) { const error = Error("No main text returned"); error.code = "missing_content"; throw error; }
    return { article: source(Number(body.article_id.slice(-12))) };
  } });
  const result = await f.run(); assert.equal(result.read, 2); assert.equal(result.failed, 1); assert.equal(result.complete, false);
  assert.deepEqual(f.applied.at(-1).failed, [id(2)]); assert.equal(f.applied.at(-1).sources.length, 2);
});
test("rate limits stop new reads while checkpointing successful sources", async () => {
  const f = loader({ request: async (action, body) => {
    if (action === "articles") return { articles: [1, 2, 3].map(n => ({ id: id(n), title: "Source" })), has_more: false };
    f.calls.push(body.article_id);
    if (body.article_id === id(2)) { const error = Error("Rate limited"); error.code = "rate_limited"; throw error; }
    return { article: source(1) };
  } });
  const result = await f.run(); assert.equal(result.complete, false); assert.deepEqual(f.calls, [id(1), id(2)]);
  assert.equal(f.applied.at(-1).sources.length, 1);
});
test("stopping a load keeps completed reads and does not request the rest", async () => {
  const f = loader({ request: async (action, body) => {
    if (action === "articles") return { articles: [1, 2].map(n => ({ id: id(n), title: "Source" })), has_more: false };
    f.cancel(); return { article: source(1) };
  } });
  const result = await f.run(); assert.match(result.stopped, /Stopped by you/); assert.equal(result.read, 1);
  assert.equal(f.applied.at(-1).sources.length, 1);
});
test("a late source after sign-out cannot reach a private checkpoint", async () => {
  const f = loader({ request: async action => {
    if (action === "articles") return { articles: [{ id: id(1), title: "One" }], has_more: false };
    f.signout(); return { article: source(1) };
  } });
  await assert.rejects(f.run(), /account changed/); assert.equal(f.applied.length, 1); assert.equal(f.applied[0].sources.length, 0);
});
test("a failed cloud checkpoint halts import without claiming completion", async () => {
  const f = loader({ apply: async () => false });
  await assert.rejects(f.run(), /private workspace could not be saved/); assert.equal(f.calls.length, 1);
});
