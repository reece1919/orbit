const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const W = require("../writing.js");

class Control {
  value = ""; checked = false; disabled = false; hidden = false; textContent = ""; innerHTML = "";
  listeners = new Map();
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
  async emit(type, target = this) { for (const fn of this.listeners.get(type) || []) await fn({ preventDefault() {}, target }); }
  focus() {} showModal() {} close() {}
}
function fixture(fields = { description: "Current description.", excerpt: "Current teaser.", custom1: "Keep block one.", custom2: "", custom3: "", custom4: "", custom5: "" }) {
  const html = readFileSync(require.resolve("../index.html"), "utf8");
  const controls = new Map([...html.matchAll(/id="([\w-]+)"/g)].map(m => ["#" + m[1], new Control()]));
  controls.set("#entry-form [name=title]", new Control());
  const $ = selector => { assert.ok(controls.has(selector), selector); return controls.get(selector); };
  const source = { kind: "category", title: "Places", fields };
  let marks = 0;
  const context = { window: { DriftmarkWriting: W }, confirm: () => true,
    document: { querySelector: $, querySelectorAll: () => [], getElementById: id => $("#" + id) } };
  vm.runInNewContext(readFileSync(require.resolve("../workbench.js"), "utf8"), context);
  const desk = context.window.DriftmarkWorkbench.init({ getEntries: () => [], getSelected: () => "entry",
    getRecord: () => ({ title: "Places", category: "Lore", world_anvil: source }), markDirty: () => marks++, status() {}, download() {} });
  const open = article => desk.open({ category: "Lore", world_anvil: source, article });
  open();
  const navigate = async id => $("#section-nav").emit("click", { closest: () => ({ dataset: { section: id } }) });
  return { $, desk, open, navigate, marks: () => marks };
}
test("category desk shows source as a reference and starts with no selected or populated drafts", () => {
  const f = fixture();
  assert.equal(f.$("#category-field-source").value, "Current description.");
  assert.equal(f.$("#section-draft").value, ""); assert.equal(f.$("#category-field-include").checked, false);
  assert.equal(f.$("#add-section").hidden, true); assert.deepEqual(W.categoryChanges(f.desk.collect()), {});
});
test("typing selects only the active field and preserves drafts across navigation and reload", async () => {
  const f = fixture(); f.$("#section-draft").value = "My page description."; await f.$("#section-draft").emit("input");
  await f.navigate("excerpt"); assert.equal(f.$("#section-draft").value, "");
  f.$("#section-draft").value = "My short teaser."; await f.$("#section-draft").emit("input");
  await f.navigate("custom1"); assert.equal(f.$("#category-field-include").checked, false);
  const saved = JSON.parse(JSON.stringify(f.desk.collect())); f.open(saved);
  assert.deepEqual(W.categoryChanges(f.desk.collect()), { description: "My page description.", excerpt: "My short teaser." });
  await f.navigate("description"); assert.equal(f.$("#section-draft").value, "My page description.");
  f.$("#category-field-include").checked = false; await f.$("#category-field-include").emit("change");
  assert.deepEqual(W.categoryChanges(f.desk.collect()), { excerpt: "My short teaser." });
  assert.equal(f.desk.collect().sections[0].draft, "My page description.");
});
test("using current text requires an author action and keeps untouched fields excluded", async () => {
  const f = fixture(); await f.$("#category-field-use-current").emit("click");
  assert.equal(f.$("#section-draft").value, "Current description.");
  assert.deepEqual(W.categoryChanges(f.desk.collect()), { description: "Current description." });
  await f.navigate("custom1"); assert.equal(f.$("#section-draft").value, "");
  assert.equal(f.$("#category-field-source").value, "Keep block one."); assert.equal(f.$("#category-field-include").checked, false);
});
test("selecting an empty category draft explicitly stages a clear without clearing other fields", async () => {
  const f = fixture(); f.$("#category-field-include").checked = true; await f.$("#category-field-include").emit("change");
  assert.deepEqual(W.categoryChanges(f.desk.collect()), { description: "" });
  assert.match(f.$("#category-field-note").textContent, /empty draft clears/);
});
test("missing source fields remain draftable but cannot be automatically selected for a write", async () => {
  const f = fixture({ description: "Main source" }); await f.navigate("custom5");
  assert.equal(f.$("#category-field-include").disabled, true); assert.equal(f.$("#category-field-use-current").disabled, true);
  f.$("#section-draft").value = "Private draft."; await f.$("#section-draft").emit("input");
  assert.deepEqual(W.categoryChanges(f.desk.collect()), {}); assert.equal(f.desk.collect().sections[6].draft, "Private draft.");
});
test("an AI plan can update a category outline without inserting prose or changing field routing", async () => {
  const f = fixture(); f.$("#section-draft").value = "My draft."; await f.$("#section-draft").emit("input");
  f.$("#brief-json").value = JSON.stringify({ version: 1, article_title: "Places", purpose: "Help readers explore", audience: "New readers",
    sections: [{ id: "description", title: "Renamed by AI", points: [{ text: "Cover the geography", status: "needs_checking", source: "" }],
      questions: [], prompt: "Write about this in your own words", references: [] }] });
  await f.$("#check-brief").emit("click"); assert.equal(f.$("#apply-brief").disabled, false);
  await f.$("#apply-brief").emit("click");
  const a = f.desk.collect(); assert.equal(a.sections.length, 7); assert.equal(a.sections[0].title, "Main description");
  assert.equal(a.sections[0].draft, "My draft."); assert.equal(a.sections[0].points[0].text, "Cover the geography");
  assert.deepEqual(W.categoryChanges(a), { description: "My draft." });
});
