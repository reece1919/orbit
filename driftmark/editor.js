/* A visual editor backed by canonical BBCode, with undo isolated to the active section. */
(function () {
  "use strict";
  const F = window.DriftmarkFormat;
  window.DriftmarkEditor = { create({ onChange }) {
    const $ = q => document.querySelector(q), visual = $("#section-visual"), source = $("#section-draft"), toolbar = $("#draft-toolbar");
    let doc, last = "", mode = "visual", bookmark = null, composing = false;
    let history = [], position = 0, typedAt = 0;
    const feedback = text => { $("#draft-format-feedback").textContent = text; };
    function paint(value) {
      last = String(value || ""); source.value = last; doc = F.createDocument(last);
      visual.innerHTML = doc.html; doc.bind(visual); bookmark = null; feedback("");
    }
    function setValue(value) { paint(value); history = [last]; position = 0; typedAt = 0; }
    function getValue() { return mode === "source" ? source.value : doc.read(visual); }
    function changed(event) {
      if (composing) return;
      const value = getValue();
      if (value.length > 80000) { paint(last); feedback("This section reached its 80,000-character limit. Put more writing in another section."); return; }
      if (value === last) return;
      const now = Date.now(), typing = event?.inputType === "insertText";
      history = history.slice(0, position + 1);
      if (typing && typedAt && now - typedAt < 700 && position > 0) history[position] = value;
      else { history.push(value); if (history.length > 100) history.shift(); position = history.length - 1; }
      typedAt = typing ? now : 0; last = value; source.value = value; onChange();
    }
    function focus() { (mode === "source" ? source : visual).focus(); }
    function remember() {
      const selection = window.getSelection();
      if (selection.rangeCount && visual.contains(selection.getRangeAt(0).commonAncestorContainer)) {
        bookmark = selection.getRangeAt(0).cloneRange();
        const block = String(document.queryCommandValue?.("formatBlock") || "p").toLowerCase().replace(/[<>]/g, "");
        $("#draft-block").value = ["h2", "h3", "h4", "blockquote"].includes(block) ? block : "p";
        for (const button of toolbar.querySelectorAll('[data-format="bold"], [data-format="italic"], [data-format="underline"]'))
          button.setAttribute("aria-pressed", String(!!document.queryCommandState?.(button.dataset.format)));
      }
    }
    function restore() {
      visual.focus(); const selection = window.getSelection();
      if (bookmark && visual.contains(bookmark.commonAncestorContainer)) { selection.removeAllRanges(); selection.addRange(bookmark); }
      else { const range = document.createRange(); range.selectNodeContents(visual); range.collapse(false); selection.removeAllRanges(); selection.addRange(range); }
    }
    function command(name, value = null) {
      if (name === "undo" || name === "redo") {
        const next = position + (name === "undo" ? -1 : 1);
        if (next < 0 || next >= history.length) return;
        position = next; typedAt = 0; paint(history[position]); restore(); onChange(); return;
      }
      if (mode !== "visual") return;
      typedAt = 0;
      restore();
      // Native formatting commands handle selections spanning several paragraphs.
      document.execCommand("styleWithCSS", false, false);
      document.execCommand(name, false, value); remember(); changed();
    }
    function switchMode(next) {
      if (next === mode) return;
      const value = getValue();
      if (value.length > 80000) { feedback("This section exceeds 80,000 characters. Shorten it before switching views."); return; }
      mode = next; paint(value);
      source.hidden = mode !== "source"; visual.hidden = mode !== "visual"; $("#draft-format-controls").hidden = mode !== "visual";
      $("#draft-link-panel").hidden = true;
      $("#draft-visual-mode").setAttribute("aria-pressed", String(mode === "visual"));
      $("#draft-source-mode").setAttribute("aria-pressed", String(mode === "source")); focus();
    }
    toolbar.hidden = false; source.hidden = true; visual.hidden = false;
    document.addEventListener("selectionchange", remember);
    $("#draft-visual-mode").addEventListener("click", () => switchMode("visual"));
    $("#draft-source-mode").addEventListener("click", () => switchMode("source"));
    toolbar.addEventListener("mousedown", event => { if (event.target.closest("button[data-format]")) event.preventDefault(); });
    toolbar.addEventListener("click", event => {
      const button = event.target.closest("[data-format]"); if (!button) return;
      if (button.dataset.format === "link") { remember(); $("#draft-link-panel").hidden = false; $("#draft-link-url").value = ""; $("#draft-link-url").focus(); return; }
      command(button.dataset.format);
    });
    $("#draft-block").addEventListener("change", () => { command("formatBlock", $("#draft-block").value); });
    function applyLink() {
      const href = F.safeUrl($("#draft-link-url").value);
      if (!href) { feedback("Use an https:// or http:// link, or a #section anchor."); $("#draft-link-url").focus(); return; }
      restore(); const selection = window.getSelection();
      if (selection.isCollapsed) document.execCommand("insertText", false, href);
      if (selection.isCollapsed) { // Select the just-inserted address before linking it.
        const range = selection.getRangeAt(0); range.setStart(range.startContainer, Math.max(0, range.startOffset - href.length)); selection.removeAllRanges(); selection.addRange(range);
      }
      bookmark = selection.getRangeAt(0).cloneRange(); command("createLink", href);
      $("#draft-link-panel").hidden = true; feedback("");
    }
    $("#draft-link-apply").addEventListener("click", applyLink);
    $("#draft-link-url").addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); applyLink(); } });
    $("#draft-link-cancel").addEventListener("click", () => { $("#draft-link-panel").hidden = true; focus(); });
    visual.addEventListener("compositionstart", () => { composing = true; });
    visual.addEventListener("compositionend", () => { composing = false; changed(); });
    visual.addEventListener("input", changed);
    source.addEventListener("input", changed);
    visual.addEventListener("click", event => { if (event.target.closest("a")) event.preventDefault(); });
    visual.addEventListener("copy", event => F.copy(event, visual, doc));
    visual.addEventListener("cut", event => {
      F.copy(event, visual, doc); if (event.defaultPrevented) command("delete");
    });
    visual.addEventListener("paste", event => {
      event.preventDefault();
      const bb = event.clipboardData?.getData("application/x-driftmark-bbcode"), text = event.clipboardData?.getData("text/plain") || "";
      if ((bb || text).length > 80000) { feedback("That text is too long for one section. Bring it across in smaller sections."); return; }
      if (bb) {
        const incoming = F.createDocument(bb), container = document.createElement("div"); container.innerHTML = incoming.html; incoming.bind(container);
        for (const [id, record] of incoming.records) doc.records.set(id, record);
        command("insertHTML", incoming.html);
      } else command("insertText", text);
    });
    // Drop must never insert unsanitized HTML, image fetches, or local-file URLs.
    visual.addEventListener("drop", event => { event.preventDefault(); feedback("Paste text into the draft to bring it across."); });
    visual.addEventListener("keydown", event => {
      if (event.key === "Escape") $("#draft-link-panel").hidden = true;
    });
    [visual, source].forEach(element => {
      element.addEventListener("beforeinput", event => {
        if (["historyUndo", "historyRedo"].includes(event.inputType)) { event.preventDefault(); command(event.inputType === "historyUndo" ? "undo" : "redo"); }
      });
      element.addEventListener("keydown", event => {
        if ((event.ctrlKey || event.metaKey) && !event.altKey && ["z", "y"].includes(event.key.toLowerCase())) {
          event.preventDefault(); command(event.key.toLowerCase() === "y" || event.shiftKey ? "redo" : "undo");
        }
      });
    });
    setValue("");
    return { getValue, setValue, focus };
  } };
})();
