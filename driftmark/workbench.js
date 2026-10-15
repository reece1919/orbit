(function () {
  "use strict";
  const W = window.DriftmarkWriting;
  const $ = q => document.querySelector(q);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  window.DriftmarkWorkbench = {
    init(options) {
      let article = null, active = "", pending = null;
      const section = () => article?.sections.find(s => s.id === active);
      const mark = () => options.markDirty();
      function draftChanged() {
        if (article?.kind === "category" && !$("#category-field-include").disabled) $("#category-field-include").checked = true;
        $("#section-reviewed").checked = false; flush(); mark(); counts();
      }
      const draft = window.DriftmarkEditor?.create({ onChange: draftChanged }) || {
        getValue: () => $("#section-draft").value,
        setValue: text => { $("#section-draft").value = text; }, focus: () => $("#section-draft").focus()
      };
      if (!window.DriftmarkEditor) $("#section-draft").addEventListener("input", draftChanged);
      function showSource(id, text) {
        $(id).value = text;
        const preview = $(id + "-preview");
        if (window.DriftmarkFormat) window.DriftmarkFormat.show(preview, text); else preview.textContent = text;
      }
      function flush() {
        if (!article) return;
        article.purpose = $("#article-purpose").value;
        article.audience = $("#article-audience").value;
        article.canon_status = $("#article-canon").value;
        article.last_section_id = active;
        const s = section();
        if (s) {
          s.draft = draft.getValue();
          if (article.kind === "category") s.include = $("#category-field-include").checked;
          s.decisions = $("#section-decisions").value;
          s.reviewed = $("#section-reviewed").checked && !!s.draft.trim();
        }
      }
      function nav() {
        if (!article) return;
        $("#section-nav").innerHTML = article.sections.map((s, i) =>
          '<button type="button" data-section="' + esc(s.id) + '" class="section-tab' + (s.id === active ? " active" : "") +
          '" aria-current="' + (s.id === active ? "step" : "false") + '"><span>' + (i + 1) + ". " + esc(s.title) +
          '</span><small>' + (article.kind === "category" && s.include ? (s.draft ? "Included in update" : "Selected to clear") :
            s.reviewed ? "Reviewed" : s.draft.trim() ? "Draft written" : "To write") + "</small></button>").join("");
        const drafted = article.sections.filter(s => s.draft.trim()).length;
        const reviewed = article.sections.filter(s => s.reviewed && s.draft.trim()).length;
        $("#writing-progress").textContent = drafted + "/" + article.sections.length + " drafted · " + reviewed + " reviewed";
      }
      function counts() {
        const s = section(), n = W.wordCount(window.DriftmarkFormat ? window.DriftmarkFormat.plainText(s?.draft) : s?.draft);
        $("#word-count").textContent = n + (n === 1 ? " word" : " words");
        $("#section-reviewed").disabled = !s?.draft.trim();
        if (!s?.draft.trim()) $("#section-reviewed").checked = false;
        const index = article?.sections.findIndex(x => x.id === active) ?? -1;
        $("#previous-section").disabled = index <= 0;
        $("#next-section").disabled = index < 0 || index >= article.sections.length - 1;
        nav();
      }
      function references() {
        const available = options.getEntries().filter(e => e.id !== options.getSelected());
        $("#reference-count").textContent = "(" + (article?.reference_ids.length || 0) + " selected)";
        $("#reference-options").innerHTML = available.length ? available.map(e =>
          '<label class="check-line"><input type="checkbox" data-reference="' + esc(e.id) + '"' +
          (article?.reference_ids.includes(e.id) ? " checked" : "") + '><span><strong>' + esc(e.title) +
          "</strong><small>" + esc(e.category + " · " + e.status) + "</small></span></label>").join("") :
          '<p class="hint">Other atlas entries will appear here as you add them. Your existing notes are included in the brief too.</p>';
      }
      function renderSection() {
        const s = section();
        $("#section-workspace").hidden = !s;
        if (!s) { nav(); return; }
        $("#draft-heading").textContent = s.title;
        $("#point-list").innerHTML = s.points.length ? s.points.map((p, i) =>
          '<label class="check-line key-point"><input type="checkbox" data-point="' + i + '"' +
          (s.checked.includes(i) ? " checked" : "") + '><span>' + esc(p.text) +
          '<small class="point-status ' + p.status + '">' + esc(W.LABELS[p.status]) + "</small>" +
          (p.source ? '<small class="source-label">Source: ' + esc(p.source) + "</small>" : "") + "</span></label>").join("") :
          '<p class="hint">Add the points this section needs to cover, or import an AI planning brief.</p>';
        $("#section-questions").innerHTML = s.questions.length ? "<h5>Open questions</h5><ul>" +
          s.questions.map(q => "<li>" + esc(q) + "</li>").join("") + "</ul>" : "";
        $("#section-references").innerHTML = s.references.length ? "<h5>References for this section</h5>" +
          s.references.map(r => '<details><summary>' + (r.url ? '<a href="' + esc(r.url) +
          '" target="_blank" rel="noopener">' + esc(r.label) + " ↗</a>" : esc(r.label)) +
          "</summary>" + (r.excerpt ? "<blockquote>" + esc(r.excerpt) + "</blockquote>" :
          '<p class="hint">Open the reference to check the source.</p>') + "</details>").join("") : "";
        $("#writing-prompt").textContent = s.prompt || "Write this section in your own words, using the points and questions above.";
        draft.setValue(s.draft);
        $("#section-decisions").value = s.decisions;
        $("#section-reviewed").checked = s.reviewed;
        sourceControls();
        counts();
      }
      function sourceControls() {
        const s = section(); if (!s) return;
        const category = article.kind === "category", source = options.getRecord().world_anvil;
        const available = category && Object.hasOwn(source?.fields || {}, s.id);
        $("#category-field-controls").hidden = !category;
        showSource("#category-field-source", available ? source.fields[s.id] : "This field was not returned by World Anvil.");
        $("#article-use-current").hidden = category || source?.kind !== "article";
        $("#article-use-current").disabled = !source?.content || source.content.length > 80000;
        $("#category-field-use-current").disabled = !available || source.fields[s.id].length > 80000;
        $("#category-field-include").checked = s.include;
        $("#category-field-include").disabled = !available;
        $("#category-field-note").textContent = available ?
          "Only included fields are sent. An included empty draft clears this field after your review. BBCode is kept as written." :
          "You can keep a private draft, but this field cannot be sent until World Anvil returns its current text.";
      }
      function render() {
        if (!article) return;
        $("#add-section").hidden = article.kind === "category";
        $("#sections-heading").textContent = article.kind === "category" ? "Category page fields" : "Article sections";
        $("#export-article").textContent = article.kind === "category" ? "Export page drafts" : "Export your article";
        $("#article-purpose").value = article.purpose;
        $("#article-audience").value = article.audience;
        $("#article-canon").value = article.canon_status;
        $("#brief-origin").textContent = { starter: "Starter outline", ai_brief: "AI planning brief", manual: "Your section plan" }[article.origin];
        references(); renderSection();
      }
      function openDialog(selector) {
        const dialog = $(selector);
        if (typeof dialog.showModal !== "function") { options.status("This browser cannot open the writing dialog.", true); return; }
        dialog.showModal();
      }
      function editPlan() {
        flush(); const s = section(); if (!s) return;
        $("#plan-title").value = s.title; $("#plan-points").value = s.points.map(p => p.text).join("\n");
        $("#plan-title").disabled = article.kind === "category";
        $("#plan-questions").value = s.questions.join("\n"); $("#plan-prompt").value = s.prompt;
        $("#plan-feedback").textContent = ""; openDialog("#section-dialog");
      }
      async function copy(textarea, feedback) {
        const input = $(textarea);
        try { await navigator.clipboard.writeText(input.value); $(feedback).textContent = "Copied."; }
        catch (_) { input.focus(); input.select(); $(feedback).textContent = "Text selected. Use your device's Copy command."; }
      }
      function exportArticle() {
        flush();
        const title = options.getRecord().title || "Untitled article";
        $("#article-export-text").value = W.draftText(title, article, $("#article-export-format").value);
        const unfinished = article.sections.filter(s => s.draft.trim() && !s.reviewed).length;
        $("#article-export-feedback").textContent = unfinished ? unfinished + " drafted section(s) still to review." : "Your drafted sections are reviewed.";
      }
      document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => document.getElementById(b.dataset.close).close()));
      $("#section-nav").addEventListener("click", e => {
        const button = e.target.closest("[data-section]"); if (!button || !article) return;
        flush(); active = button.dataset.section; renderSection();
      });
      $("#category-field-include").addEventListener("change", () => { flush(); mark(); counts(); });
      $("#category-field-use-current").addEventListener("click", () => {
        if (article?.kind !== "category" || $("#category-field-use-current").disabled) return;
        flush(); const s = section(), text = options.getRecord().world_anvil?.fields[s.id];
        if (typeof text !== "string" || text.length > 80000) return;
        if (s.draft && s.draft !== text && !confirm("Replace this field's draft with the current World Anvil text?")) return;
        draft.setValue(text); $("#section-reviewed").checked = false; $("#category-field-include").checked = true;
        flush(); mark(); counts(); draft.focus();
      });
      $("#article-use-current").addEventListener("click", () => {
        if (article?.kind === "category") return;
        flush(); const s = section(), text = options.getRecord().world_anvil?.content;
        if (!s || typeof text !== "string" || !text || text.length > 80000) return;
        if (s.draft && s.draft !== text && !confirm("Replace this section's draft with the current World Anvil text? Other section drafts stay saved.")) return;
        draft.setValue(text); draftChanged(); draft.focus();
      });
      $("#section-decisions").addEventListener("input", () => { flush(); mark(); });
      $("#section-reviewed").addEventListener("change", () => { flush(); mark(); counts(); });
      ["#article-purpose", "#article-audience", "#article-canon"].forEach(q => $(q).addEventListener("input", () => { flush(); mark(); }));
      $("#point-list").addEventListener("change", e => {
        if (!e.target.matches("[data-point]")) return;
        const s = section(), n = Number(e.target.dataset.point);
        s.checked = e.target.checked ? [...new Set([...s.checked, n])] : s.checked.filter(x => x !== n);
        mark();
      });
      $("#reference-options").addEventListener("change", e => {
        if (!e.target.matches("[data-reference]") || !article) return;
        const ref = e.target.dataset.reference;
        if (e.target.checked && article.reference_ids.length >= 30) { e.target.checked = false; options.status("Choose at most 30 atlas references.", true); return; }
        article.reference_ids = e.target.checked ? [...new Set([...article.reference_ids, ref])] : article.reference_ids.filter(x => x !== ref);
        $("#reference-count").textContent = "(" + article.reference_ids.length + " selected)"; mark();
      });
      [["#previous-section", -1], ["#next-section", 1]].forEach(([q, offset]) => $(q).addEventListener("click", () => {
        flush(); const index = article.sections.findIndex(s => s.id === active) + offset;
        if (article.sections[index]) { active = article.sections[index].id; renderSection(); draft.focus(); }
      }));
      $("#add-section").addEventListener("click", () => {
        flush();
        if (article?.kind === "category") return;
        if (article.sections.length >= 30) { options.status("The outline already has 30 sections. Your retained drafts are preserved.", true); return; }
        const s = W.normalizeSection({ id: W.id(), title: "New section", prompt: "What do you want the reader to understand in this section? Write it in your own words." });
        article.sections.push(s); article.origin = "manual"; active = s.id; render(); mark(); editPlan();
      });
      $("#edit-section").addEventListener("click", editPlan);
      $("#save-plan").addEventListener("click", () => {
        const s = section();
        const lines = q => $(q).value.split("\n").map(t => t.trim()).filter(Boolean);
        const points = lines("#plan-points"), questions = lines("#plan-questions"), title = $("#plan-title").value.trim();
        if (!title || points.length > 30 || questions.length > 20 || [...points, ...questions].some(t => t.length > 2000)) {
          $("#plan-feedback").textContent = "Use a title, at most 30 short points and 20 questions (2,000 characters each)."; return;
        }
        if (article.kind !== "category") s.title = title;
        s.points = points.map(text => s.points.find(p => p.text === text) || { text, status: "needs_checking", source: "" });
        s.questions = questions; s.prompt = $("#plan-prompt").value; s.checked = []; s.reviewed = false; article.origin = "manual";
        mark(); render(); $("#section-dialog").close();
      });
      $("#prepare-brief").addEventListener("click", () => {
        flush();
        $("#handoff-text").value = W.planningPrompt(options.getRecord(), article, options.getEntries().filter(r => article.reference_ids.includes(r.id)));
        $("#handoff-feedback").textContent = ""; openDialog("#handoff-dialog");
      });
      $("#copy-handoff").addEventListener("click", () => void copy("#handoff-text", "#handoff-feedback"));
      $("#import-brief").addEventListener("click", () => {
        pending = null; $("#brief-json").value = ""; $("#brief-preview").hidden = true;
        $("#brief-feedback").textContent = ""; $("#apply-brief").disabled = true; openDialog("#brief-dialog");
      });
      $("#brief-json").addEventListener("input", () => {
        pending = null; $("#apply-brief").disabled = true; $("#brief-preview").hidden = true; $("#brief-feedback").textContent = "";
      });
      $("#check-brief").addEventListener("click", () => {
        try {
          flush(); pending = W.parseBrief($("#brief-json").value);
          const result = W.applyBrief(article, pending), title = options.getRecord().title;
          $("#brief-preview").innerHTML = "<h4>" + esc(pending.article_title) + "</h4><p>" + esc(pending.purpose) +
            "</p>" + pending.sections.map(s => '<section class="preview-section"><h5>' + esc(s.title) + "</h5><ul>" +
            s.points.map(p => "<li>" + esc(p.text) + "<small>" + esc(W.LABELS[p.status]) + (p.source ? " · " + esc(p.source) : "") + "</small></li>").join("") +
            "</ul>" + (s.questions.length ? "<h6>Questions</h6><ul>" + s.questions.map(q => "<li>" + esc(q) + "</li>").join("") + "</ul>" : "") +
            "<p><strong>Writing prompt:</strong> " + esc(s.prompt) + "</p>" +
            (s.references.length ? "<p><strong>References:</strong> " + s.references.map(r => esc(r.label)).join(", ") + "</p>" : "") + "</section>").join("");
          $("#brief-preview").hidden = false; $("#apply-brief").disabled = false;
          $("#brief-feedback").textContent = pending.sections.length + " planned sections. " +
            (result.retained ? result.retained + " existing section(s) with your writing or decisions will also be kept. " : "Existing section drafts are preserved. ") +
            (title && title !== pending.article_title ? "The current article title will stay “" + title + "”." : "");
        } catch (error) {
          pending = null; $("#apply-brief").disabled = true; $("#brief-preview").hidden = true; $("#brief-feedback").textContent = error.message;
        }
      });
      $("#apply-brief").addEventListener("click", () => {
        if (!pending) return;
        try {
          flush(); const result = W.applyBrief(article, pending);
          article = result.article; active = article.last_section_id;
          const titleInput = $("#entry-form [name=title]");
          if (!titleInput.value.trim()) titleInput.value = pending.article_title;
          render(); mark(); $("#brief-dialog").close(); pending = null;
          options.status("Section plan applied. Your writing is preserved. Save to keep these changes.");
        } catch (error) { $("#brief-feedback").textContent = error.message; }
      });
      $("#export-article").addEventListener("click", () => {
        flush();
        if (!article.sections.some(s => s.draft.trim())) { options.status("Write a section draft before exporting your article.", true); return; }
        exportArticle(); openDialog("#article-export-dialog");
      });
      $("#article-export-format").addEventListener("change", exportArticle);
      $("#copy-article").addEventListener("click", () => void copy("#article-export-text", "#article-export-feedback"));
      $("#download-article").addEventListener("click", () => options.download(
        $("#article-export-text").value, (options.getRecord().title || "driftbound-article").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80) + ".txt", "text/plain"));
      return {
        refreshSource: sourceControls,
        open(entry) {
          article = entry.world_anvil?.kind === "category" ? W.normalizeCategoryArticle(entry.article) : W.normalizeArticle(entry.article) || W.starter(entry.category);
          if (!article.sections.length) article.sections = W.starter(entry.category).sections;
          active = article.sections.some(s => s.id === article.last_section_id) ? article.last_section_id : article.sections[0].id;
          render();
        },
        collect() { flush(); return W.normalizeArticle(article); },
        changeCategory(category) {
          flush();
          if (article?.kind === "category") return;
          if (article?.origin !== "starter" || article.sections.some(s => s.draft.trim() || s.decisions.trim() || s.checked.length)) return;
          const fresh = W.starter(category);
          fresh.purpose = article.purpose; fresh.audience = article.audience; fresh.canon_status = article.canon_status;
          fresh.reference_ids = article.reference_ids;
          article = fresh; active = article.sections[0].id; render();
        },
        reset() { article = null; active = ""; pending = null; }
      };
    }
  };
})();
