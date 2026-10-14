import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { CATEGORY_FIELDS, categoryDTO, createHandler, ORIGIN, WORLD, OWNER, SERVICE } from "../../supabase/functions/driftmark-worldanvil/core.mjs";

const W = createRequire(import.meta.url)("../writing.js");
const ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", OTHER = "11111111-2222-3333-4444-555555555555";
const TOKEN = "category-test-private-credential";
const category = () => ({ id: ID, title: "Places", world: { id: WORLD }, state: "private", isEditable: true,
  subscribergroups: [{ id: OTHER }], parent: { id: OTHER }, description: "Current description.", excerpt: "Current teaser.",
  custom1: "Keep block one.", custom2: null, custom3: "Keep block three.", custom4: "", custom5: "Keep block five.",
  isDraft: null, isWip: null, isBook: true, displayBookTitle: false, isCollapsed: false, position: 3,
  pagecover: { id: 41 }, bookcover: { id: 42 }, defaultarticlecover: null, articleRedirect: null,
  cssClasses: "keep-layout", systemMeta: '{"layout":"grid"}', url: "https://www.worldanvil.com/w/test/c/places" });
const hash = async raw => (await categoryDTO(raw)).version_hash;
function fixture({ raw = category(), auth = { id: OWNER, aal: "aal2" }, mutate, failPatch = false } = {}) {
  let current = structuredClone(raw), reads = 0; const calls = [], vault = [];
  const handle = createHandler({ authorize: async () => auth, connections: { read: async owner => { vault.push(owner); return TOKEN; } },
    fetcher: async (url, options) => {
      const parsed = new URL(url); assert.equal(parsed.origin, SERVICE);
      assert.equal(options.headers["x-auth-token"], TOKEN); assert.equal(parsed.searchParams.get("id"), ID);
      assert.equal(parsed.searchParams.has("token"), false); calls.push({ url, ...options });
      if (options.method === "PATCH") {
        if (failPatch) throw Error("private upstream detail: " + TOKEN);
        const patch = JSON.parse(options.body); current = { ...current, ...patch, ...(mutate ? mutate(current, patch) : {}) };
        return Response.json({ success: true });
      }
      assert.equal(parsed.pathname, "/category"); assert.equal(parsed.searchParams.get("granularity"), "2");
      reads++; return Response.json({ category: current });
    } });
  const request = async body => {
    const response = await handle(new Request("https://test.invalid", { method: "POST", headers: { Origin: ORIGIN,
      Authorization: "Bearer test.jwt", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    return { status: response.status, data: await response.json() };
  };
  return { request, calls, vault, get: () => current, reads: () => reads };
}
const update = async (raw = category(), changes = { description: "My own updated description." }) => ({
  action: "update_category", category_id: ID, expected_hash: await hash(raw), reviewed: true, changes });

test("category reads return the seven official fields without credentials", async () => {
  const f = fixture(), r = await f.request({ action: "category", category_id: ID });
  assert.equal(r.status, 200); assert.equal(r.data.category.kind, "category");
  assert.deepEqual(Object.keys(r.data.category.fields), CATEGORY_FIELDS);
  assert.equal(r.data.category.fields.custom2, ""); assert.equal(r.data.category.metadata_confirmed, true);
  assert.doesNotMatch(JSON.stringify(r.data), /category-test-private-credential/);
});
test("reviewed category writes send only changed fields and preserve all others", async () => {
  const f = fixture(), r = await f.request(await update(category(), { description: "My paragraph.", excerpt: category().excerpt, custom5: "" }));
  assert.equal(r.status, 200); assert.equal(r.data.verified, true);
  assert.deepEqual(JSON.parse(f.calls.find(c => c.method === "PATCH").body), { description: "My paragraph.", custom5: "" });
  assert.equal(f.get().excerpt, category().excerpt); assert.equal(f.get().custom1, category().custom1);
  assert.equal(f.get().state, "private"); assert.equal(f.get().systemMeta, category().systemMeta);
  assert.equal(f.get().parent.id, OTHER); assert.equal(f.get().subscribergroups[0].id, OTHER);
  assert.equal(f.reads(), 2);
});
test("each of the seven category text fields can be edited separately", async () => {
  for (const key of CATEGORY_FIELDS) {
    const f = fixture(), r = await f.request(await update(category(), { [key]: "Own words for " + key }));
    assert.equal(r.status, 200, key); assert.deepEqual(Object.keys(JSON.parse(f.calls.find(c => c.method === "PATCH").body)), [key]);
  }
});
test("stale category, wrong world, unknown privacy and missing permissions prevent PATCH", async () => {
  for (const change of [{ description: "Changed elsewhere." }, { world: { id: OTHER } }, { state: null },
    { isEditable: false }, { subscribergroups: undefined }]) {
    const f = fixture({ raw: { ...category(), ...change } }), r = await f.request(await update());
    assert.ok([403, 409].includes(r.status)); assert.equal(f.calls.some(c => c.method === "PATCH"), false);
    assert.equal(r.data.may_have_written, false);
  }
});
test("category operations retain owner and MFA checks before reading saved credentials", async () => {
  for (const auth of [null, { id: OTHER, aal: "aal2" }, { id: OWNER, aal: "aal1" }]) {
    const f = fixture({ auth });
    for (const body of [{ action: "category", category_id: ID }, await update()]) {
      const r = await f.request(body); assert.equal(r.status, 403);
    }
    assert.equal(f.vault.length, 0); assert.equal(f.calls.length, 0);
  }
});
test("category writes reject unreviewed, non-text, oversized and protected fields", async () => {
  for (const extra of [{ reviewed: false }, { changes: {} }, { changes: { content: "Wrong API field" } },
    { changes: { description: 3 } }, { changes: { description: "x".repeat(80001) } },
    { changes: { description: "Own text", parent: { id: OTHER } } }, { state: "public" }, { token: TOKEN }]) {
    const f = fixture(), r = await f.request({ ...await update(), ...extra });
    assert.equal(r.status, 400); assert.equal(f.calls.length, 0);
    assert.doesNotMatch(JSON.stringify(r.data), /category-test-private-credential|x{100}/);
  }
});
test("missing category field is not treated as an empty writable field", async () => {
  const raw = category(); delete raw.custom5;
  const f = fixture({ raw }), r = await f.request(await update(raw, { custom5: "Own text" }));
  assert.equal(r.status, 409); assert.equal(r.data.code, "field_unavailable"); assert.equal(f.calls.some(c => c.method === "PATCH"), false);
});
test("matching category drafts do not perform an unnecessary write", async () => {
  const f = fixture(), r = await f.request(await update(category(), { description: category().description }));
  assert.equal(r.status, 409); assert.equal(r.data.code, "no_changes"); assert.equal(f.calls.length, 1);
});
test("read-back detects changed untouched text, privacy, hierarchy and layout", async () => {
  for (const change of [{ description: "Proxy ignored text" }, { custom1: "Unexpected block change" }, { state: "public" },
    { parent: null }, { subscribergroups: [] }, { pagecover: null }, { systemMeta: "different" },
    { cssClasses: "different" }, { title: "different" }, { isEditable: false }]) {
    const f = fixture({ mutate: () => change }), r = await f.request(await update());
    assert.equal(r.status, 502, JSON.stringify(change)); assert.equal(r.data.verified, undefined); assert.equal(r.data.may_have_written, true);
  }
});
test("uncertain category network errors are sanitized and never claim success", async () => {
  const f = fixture({ failPatch: true }), r = await f.request(await update());
  assert.equal(r.status, 502); assert.equal(r.data.may_have_written, true); assert.equal(r.data.verified, undefined);
  assert.doesNotMatch(JSON.stringify(r.data), /private upstream detail|category-test-private-credential/);
});
test("category fingerprints ignore views and subscriber order but track meaningful changes", async () => {
  const raw = category(), original = await hash(raw);
  assert.equal(original, await hash({ ...raw, views: 999 }));
  const groups = [{ id: OTHER }, { id: ID }];
  assert.equal(await hash({ ...raw, subscribergroups: groups }), await hash({ ...raw, subscribergroups: [...groups].reverse() }));
  for (const change of [{ custom5: "New block" }, { excerpt: "New teaser" }, { parent: null }, { state: "public" },
    { systemMeta: "different" }, { updateDate: "later" }]) assert.notEqual(original, await hash({ ...raw, ...change }));
});
test("category browser paginates the existing service without credentials in the response", async () => {
  const calls = [];
  const handle = createHandler({ authorize: async () => ({ id: OWNER, aal: "aal2" }), connections: { read: async () => TOKEN },
    fetcher: async (url, options) => { calls.push({ url, options }); return Response.json({ categories: Array.from({ length: 100 }, () => ({ id: ID, title: "Places" })) }); } });
  const r = await handle(new Request("https://test.invalid", { method: "POST", headers: { Origin: ORIGIN }, body: JSON.stringify({ action: "categories", offset: 100 }) }));
  const data = await r.json(); assert.equal(data.offset, 100); assert.equal(data.has_more, true);
  assert.deepEqual(JSON.parse(calls[0].options.body), { limit: "100", offset: "100" });
  assert.equal(new URL(calls[0].url).searchParams.get("id"), WORLD);
});
test("category source snapshots strip auth and unknown field data from backups", async () => {
  const context = { window: { DriftmarkWriting: W } };
  vm.runInNewContext(readFileSync(new URL("../worldanvil.js", import.meta.url), "utf8"), context);
  const dto = await categoryDTO(category()), clean = context.window.DriftmarkWorldAnvil.normalizeSource({
    ...dto, token: TOKEN, authorization: TOKEN, fields: { ...dto.fields, token: TOKEN, state: "public" } });
  assert.equal(clean.kind, "category"); assert.equal(clean.fields.description, category().description);
  assert.doesNotMatch(JSON.stringify(clean), /category-test-private-credential/);
  assert.equal(context.window.DriftmarkWorldAnvil.normalizeSource({ ...dto, kind: "unknown" }), null);
});

const brief = id => W.parseBrief(JSON.stringify({ version: 1, article_title: "Places", purpose: "Help readers explore", audience: "New readers",
  sections: [{ id, title: "AI plan label", points: [{ text: "Planning point", status: "needs_checking", source: "" }],
    questions: ["Author decision?"], prompt: "Write this in your own words.", references: [] }] }));
test("category starter leaves every draft empty and every field excluded", () => {
  const a = W.normalizeCategoryArticle(); assert.equal(a.kind, "category"); assert.equal(a.sections.length, 7);
  assert.deepEqual(W.categoryChanges(a), {}); assert.equal(W.articleContent(a), "");
  for (const s of a.sections) { assert.equal(s.draft, ""); assert.equal(s.include, false); }
});
test("category AI plans preserve author drafts, decisions and chosen field IDs", () => {
  const a = W.normalizeCategoryArticle(); a.sections[0].draft = "My words."; a.sections[0].decisions = "Keep my decision.";
  a.sections[0].include = true; a.sections[6].draft = "My block."; a.sections[6].include = true;
  const result = W.applyBrief(a, brief("description")).article;
  assert.equal(result.sections[0].draft, "My words."); assert.equal(result.sections[0].decisions, "Keep my decision.");
  assert.equal(result.sections[0].title, "Main description"); assert.equal(result.sections[6].draft, "My block.");
  assert.deepEqual(W.categoryChanges(W.normalizeCategoryArticle(JSON.parse(JSON.stringify(result)))), { description: "My words.", custom5: "My block." });
  assert.throws(() => W.applyBrief(a, brief("new-field")), /field IDs/);
});
test("category updates use only selected author text with exact whitespace and explicit clears", () => {
  const a = W.normalizeCategoryArticle(); a.sections[0].draft = "  My BBCode [b]text[/b].\n"; a.sections[0].include = true;
  a.sections[0].decisions = "Private decision"; a.sections[1].draft = "Private unselected draft"; a.sections[6].include = true;
  assert.deepEqual(W.categoryChanges(a), { description: "  My BBCode [b]text[/b].\n", custom5: "" });
  assert.doesNotMatch(JSON.stringify(W.categoryChanges(a)), /Planning|Private|Write this/);
});
test("category planning prompts include current fields and require fixed IDs with no prose", () => {
  const text = W.planningPrompt({ title: "Places", category: "Lore", world_anvil: { kind: "category", fields: { description: "Source text" } } }, W.normalizeCategoryArticle(), []);
  assert.match(text, /category-page planning brief/); assert.match(text, /Keep the field IDs exactly/);
  assert.match(text, /Source text/); assert.match(text, /Do not write paragraphs/);
  const bad = JSON.parse(JSON.stringify(brief("description"))); bad.sections[0].include = true;
  assert.throws(() => W.parseBrief(JSON.stringify(bad)), /not a planning field/);
});
