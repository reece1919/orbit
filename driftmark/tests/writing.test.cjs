const { test } = require("node:test");
const assert = require("node:assert/strict");
const W = require("../writing.js");
const plan = () => ({
  version: 1, article_title: "Test article", purpose: "Help the author plan", audience: "New readers",
  sections: [{
    id: "opening", title: "Opening",
    points: [{ text: "PLANNING ONLY: cover this point", status: "needs_checking", source: "" }],
    questions: ["PLANNING ONLY: what remains undecided?"],
    prompt: "PLANNING ONLY: write in your own words",
    references: [{ label: "Reference", url: "https://example.com/reference", excerpt: "REFERENCE ONLY: quoted material" }]
  }]
});
test("AI brief creates a plan with no prose and cannot mark a section written", () => {
  const result = W.applyBrief(W.starter("Lore"), W.parseBrief(JSON.stringify(plan()))).article;
  assert.equal(result.sections[0].draft, "");
  assert.equal(result.sections[0].reviewed, false);
  assert.equal(W.draftText("Test", result, "bbcode"), "");
});
test("draft and decisions survive changed IDs, replaced outlines, and storage reload", () => {
  const current = W.normalizeArticle({ sections: [
    { id: "old-opening", title: "Opening", draft: "My opening prose.", decisions: "My author decision.", reviewed: true },
    { id: "closing", title: "Closing", draft: "My closing prose.", reviewed: true }
  ] });
  const result = W.applyBrief(current, W.parseBrief(JSON.stringify(plan())));
  assert.equal(result.retained, 1);
  const reloaded = W.normalizeArticle(JSON.parse(JSON.stringify(result.article)));
  assert.equal(reloaded.sections[0].draft, "My opening prose.");
  assert.equal(reloaded.sections[0].decisions, "My author decision.");
  assert.equal(reloaded.sections[0].reviewed, false);
  assert.equal(reloaded.sections[1].draft, "My closing prose.");
});
test("article export includes author drafts and headings only", () => {
  const article = W.applyBrief(W.starter("Lore"), W.parseBrief(JSON.stringify(plan()))).article;
  article.sections[0].draft = "MY OWN WORDS\nWith deliberate line breaks.";
  article.sections[0].decisions = "DECISION ONLY: do not export";
  article.sections[0].checked = [0];
  const output = W.draftText("Test article", JSON.parse(JSON.stringify(article)), "bbcode");
  assert.equal(output, "[h1]Test article[/h1]\n\n[h2]Opening[/h2]\nMY OWN WORDS\nWith deliberate line breaks.");
  assert.doesNotMatch(output, /PLANNING ONLY|REFERENCE ONLY|DECISION ONLY/);
});
test("AI imports reject prose, completion flags, unknown fields, and unsafe links", () => {
  for (const key of ["draft", "body", "reviewed", "completed", "__proto__"]) {
    const p = plan();
    Object.defineProperty(p.sections[0], key, { value: "AI supplied prose", enumerable: true });
    assert.throws(() => W.parseBrief(JSON.stringify(p)), /not a planning field/);
  }
  const p = plan(); p.sections[0].references[0].url = "javascript:alert(1)";
  assert.throws(() => W.parseBrief(JSON.stringify(p)), /HTTPS/);
});
test("claimed established points require source labels and duplicate IDs are rejected", () => {
  const p = plan(); p.sections[0].points[0].status = "established";
  assert.throws(() => W.parseBrief(JSON.stringify(p)), /source label/);
  p.sections[0].points[0].source = "Supplied article";
  assert.equal(W.parseBrief(JSON.stringify(p)).sections[0].points[0].source, "Supplied article");
  p.sections.push(p.sections[0]);
  assert.throws(() => W.parseBrief(JSON.stringify(p)), /unique/);
});
test("planning prompt includes only selected references and keeps source uncertainty explicit", () => {
  const prompt = W.planningPrompt({ title: "Test", category: "Lore", body: "My working notes" }, W.starter("Lore"),
    [{ title: "Selected source", status: "Drafting", url: "", body: "My source text" }]);
  assert.match(prompt, /Do not write paragraphs/);
  assert.match(prompt, /author_draft_for_reference_only/);
  assert.match(prompt, /in_world_uncertainty/);
  assert.match(prompt, /Selected source/);
});
test("fenced JSON is accepted and empty prose never counts as reviewed", () => {
  const fence = String.fromCharCode(96).repeat(3);
  assert.equal(W.parseBrief(fence + "json\n" + JSON.stringify(plan()) + "\n" + fence).version, 1);
  assert.equal(W.normalizeSection({ draft: "   \n", reviewed: true }).reviewed, false);
});
