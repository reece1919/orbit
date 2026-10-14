/* Tokens are submitted once to private storage and never returned to this UI. */
(function () {
  "use strict";
  const $ = q => document.querySelector(q), W = window.DriftmarkWriting;
  const WORLD = "3449e76f-83f2-4aa4-b1ec-40b2b0a8397b";
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function normalizeSource(s) {
    if (!s || typeof s !== "object" || typeof s.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id) ||
      s.world_id !== WORLD ||
      typeof s.version_hash !== "string" || !/^[a-f0-9]{64}$/.test(s.version_hash)) return null;
    const common = { id: s.id, world_id: WORLD, title: String(s.title || "Untitled page").slice(0, 150),
      url: W.url(s.url), version_hash: s.version_hash,
      state: ["private", "public"].includes(s.state) ? s.state : "unknown",
      isEditable: s.isEditable === true, read_at: String(s.read_at || "").slice(0, 100) };
    if (s.kind === "category") {
      if (!s.fields || typeof s.fields !== "object" || Array.isArray(s.fields)) return null;
      const fields = {}; let size = 0;
      for (const key of Object.keys(W.CATEGORY_FIELDS)) {
        if (!Object.hasOwn(s.fields, key)) continue;
        if (typeof s.fields[key] !== "string") return null;
        size += s.fields[key].length; fields[key] = s.fields[key];
      }
      if (size > 2000000 || !Object.hasOwn(fields, "description")) return null;
      return { ...common, kind: "category", fields, metadata_confirmed: s.metadata_confirmed === true };
    }
    if ((s.kind && s.kind !== "article") || typeof s.content !== "string" || s.content.length > 2000000) return null;
    return { ...common, kind: "article", content: s.content,
      isDraft: typeof s.isDraft === "boolean" ? s.isDraft : null, isWip: typeof s.isWip === "boolean" ? s.isWip : null };
  }
  const categoryText = fields => Object.entries(fields).map(([key, text]) => W.CATEGORY_FIELDS[key] + "\n" + (text || "[Empty field]")).join("\n\n────────────────\n\n");
  const editable = s => s?.isEditable && (s.kind !== "category" || s.metadata_confirmed);
  window.DriftmarkWorldAnvil = {
    normalizeSource,
    init(options) {
      let connected = false, saved = false, owner = "", busy = false, rows = [], offset = 0, more = false, reader = null, review = null;
      let generation = 0, connecting = false;
      let syncing = false, stopRequested = false;
      let browseKind = "articles";
      const connectionStatus = message => { $("#wa-status").textContent = message; };
      function recordChanged() {
        const s = options.getOwner() ? options.getSource() : null;
        const link = options.getOwner() ? options.getLink?.() : null;
        $("#wa-linked").hidden = !s && !link;
        $("#wa-review").hidden = !s;
        $("#wa-linked-title").textContent = s ? "World Anvil " + (s.kind === "category" ? "category" : "article") + ": " + s.title + " · " + s.state + (s.isWip ? " · WIP" : "") :
          link ? "World Anvil: " + link.source_title + " · source text not loaded" : "";
        $("#wa-linked-content").value = s ? s.kind === "category" ? categoryText(s.fields) : s.content : "";
        $("#wa-source-details").hidden = !s;
        $("#wa-review").disabled = !connected || busy;
        $("#wa-connect").disabled = busy || !options.getOwner();
        $("#wa-browse").disabled = !connected || busy;
        $("#wa-browse-categories").disabled = !connected || busy;
        $("#wa-reconcile").disabled = !connected || busy;
        $("#wa-stop-sync").hidden = !syncing;
        $("#wa-stop-sync").disabled = stopRequested;
        $("#wa-disconnect").hidden = !saved;
        $("#wa-disconnect").disabled = busy;
      }
      function setBusy(value) {
        busy = value;
        ["#wa-connect-submit", "#wa-page-previous", "#wa-page-next", "#wa-load-page", "#wa-browser-kind", "#wa-add-reference", "#wa-attach", "#wa-save-update"].forEach(q => $(q).disabled = value);
        recordChanged();
        $("#wa-page-previous").disabled = value || offset === 0;
        $("#wa-page-next").disabled = value || !more;
        $("#wa-save-update").disabled = value || !connected || !review || !$("#wa-review-ack").checked || !editable(review.source) || review.sent;
      }
      async function call(action, body = {}) {
        const client = options.getClient();
        const requestOwner = options.getOwner(), requestGeneration = generation;
        if (!client || !requestOwner || (!["configure", "status", "forget"].includes(action) && !connected))
          throw Error("Sign in to ORBIT and connect your World Anvil user token first.");
        let result;
        const writing = ["update", "update_category"].includes(action);
        try { result = await client.functions.invoke("driftmark-worldanvil", { body: { action, ...body } }); }
        catch (_) {
          const failure = Error(writing ? "The connection response was lost. Read the destination again before retrying." :
            "The connection response was lost. Refresh to check your saved connection.");
          failure.mayHaveWritten = writing; throw failure;
        }
        if (generation !== requestGeneration || options.getOwner() !== requestOwner) {
          const failure = Error("Your connection changed while this request was running.");
          failure.mayHaveWritten = writing; throw failure;
        }
        const { data, error } = result;
        if (error) {
          let detail = null;
          try { if (error.context?.clone) detail = await error.context.clone().json(); } catch (_) {}
          const failure = Error(detail?.error || "The private World Anvil connection could not complete this request. Check your ORBIT sign-in and authenticator verification.");
          failure.code = detail?.code;
          failure.hasSavedConnection = !!detail?.has_saved_connection;
          failure.mayHaveWritten = typeof detail?.may_have_written === "boolean" ? detail.may_have_written : writing;
          throw failure;
        }
        if (data?.error) { const failure = Error(data.error); failure.mayHaveWritten = !!data.may_have_written; throw failure; }
        return data;
      }
      function clear() {
        stopRequested = true; syncing = false; busy = false;
        generation++; connecting = false; connected = false; saved = false; rows = []; offset = 0; more = false; review = null; reader = null;
        ["#wa-token", "#wa-reader-content", "#wa-before", "#wa-after", "#wa-search", "#wa-linked-content"].forEach(q => $(q).value = "");
        $("#wa-review-ack").checked = false; $("#wa-save-update").disabled = true;
        $("#wa-articles").textContent = "";
        ["#wa-reader-meta", "#wa-review-meta", "#wa-page-label"].forEach(q => $(q).textContent = "");
        ["#wa-connect-dialog", "#wa-browser-dialog", "#wa-reader-dialog", "#wa-review-dialog"].forEach(q => $(q).close());
        connectionStatus("Connect your existing World Anvil user token to browse articles and category pages."); setBusy(false);
        $("#wa-sync-status").textContent = "Sign in and connect World Anvil to load and reconcile articles.";
      }
      function show(q) { $(q).showModal(); }
      async function restore() {
        if (busy || !options.getOwner()) return;
        const attempt = generation;
        setBusy(true); connectionStatus("Checking your saved World Anvil connection…");
        try {
          const data = await call("status"); saved = data?.saved === true; connected = data?.connected === true && saved;
          connectionStatus(connected ? "Connected to " + (data.world?.title || "Driftbound") + " · saved with your ORBIT account" :
            "Connect your existing World Anvil user token once to save it with your account.");
          if (!connected) $("#wa-sync-status").textContent = "Your atlas is ready. Save your existing World Anvil connection to load and reconcile articles.";
        } catch (error) {
          if (generation !== attempt) return;
          connected = false; saved = !!error.hasSavedConnection; connectionStatus(error.message);
          $("#wa-sync-status").textContent = "World Anvil loading is unavailable. Your saved atlas and writing are preserved.";
        } finally { if (generation === attempt) setBusy(false); }
        if (generation === attempt && connected) await synchronize();
      }
      async function synchronize() {
        if (!options.applySync || busy || !connected) return;
        const attempt = generation, syncOwner = options.getOwner();
        const current = () => generation === attempt && options.getOwner() === syncOwner && connected;
        syncing = true; stopRequested = false; setBusy(true);
        $("#wa-sync-status").textContent = "Loading World Anvil articles. Your drafts and plans are preserved…";
        try {
          const result = await window.DriftmarkReconcile.loadArticles({ request: call, normalizeSource,
            apply: async batch => current() && await options.applySync(batch), current, cancelled: () => stopRequested,
            progress: p => {
              if (!current()) return;
              $("#wa-sync-status").textContent = p.phase === "index" ? "Reading the article list · " + p.listed + " found…" :
                "Loading reference text · " + p.read + "/" + p.listed + " read" + (p.failed ? " · " + p.failed + " unavailable" : "") + " · " + p.title;
            } });
          if (!current()) return;
          $("#wa-sync-status").textContent = result.complete ? "Reconciled " + result.listed + " articles · reference text loaded · your writing is preserved." :
            "Reconciliation incomplete · " + result.listed + " articles listed · " + result.read + " text(s) loaded · " + result.failed + " unavailable. " +
            (result.stopped || "Retry to check unavailable sources.") + " Saved checkpoints and your writing are preserved.";
        } catch (error) {
          if (current()) $("#wa-sync-status").textContent = error.message + " Your drafts and plans are preserved. Use Reconcile articles to retry.";
        } finally {
          if (generation === attempt) { syncing = false; setBusy(false); }
        }
      }
      function drawRows() {
        const term = $("#wa-search").value.toLowerCase().trim();
        const filtered = rows.filter(r => r.title.toLowerCase().includes(term));
        $("#wa-articles").innerHTML = filtered.length ? filtered.map(r => '<button type="button" class="item" data-wa-article="' +
          esc(r.id) + '"><strong>' + esc(r.title) + '</strong><small>Read the current World Anvil ' + (browseKind === "categories" ? "category page" : "article") + '</small></button>').join("") :
          '<p class="hint">No matching ' + browseKind + ' on this page.</p>';
        $("#wa-browser-title").textContent = "Driftbound " + (browseKind === "categories" ? "category pages" : "articles");
        $("#wa-page-label").textContent = rows.length ? (browseKind === "categories" ? "Categories " : "Articles ") + (offset + 1) + "–" + (offset + rows.length) : "No " + browseKind + " on this page";
      }
      async function loadRows() {
        if (busy) return;
        const attempt = generation;
        setBusy(true); $("#wa-browser-feedback").textContent = "Loading World Anvil " + browseKind + "…";
        try {
          const data = await call(browseKind, { offset });
          rows = Array.isArray(data[browseKind]) ? data[browseKind] : []; more = !!data.has_more;
          drawRows(); $("#wa-browser-feedback").textContent = "Search this page or choose a " + (browseKind === "categories" ? "category" : "article") + ".";
        } catch (error) { $("#wa-browser-feedback").textContent = error.message; }
        finally { if (generation === attempt) setBusy(false); }
      }
      function fillReader(s) {
        reader = s;
        $("#wa-reader-title").textContent = s.title;
        $("#wa-reader-meta").textContent = (s.kind === "category" ? "Category · " : "") + s.state + (s.isDraft ? " · Draft" : "") + (s.isWip ? " · WIP" : "") + " · Read " + new Date(s.read_at).toLocaleString();
        $("#wa-reader-content").value = s.kind === "category" ? categoryText(s.fields) : s.content;
        $("#wa-reader-label").textContent = s.kind === "category" ? "Current category fields" : "Current article text";
        $("#wa-add-reference").textContent = s.kind === "category" ? "Open category writing desk" : "Add to reference atlas";
        $("#wa-attach").hidden = !options.hasEntry() || s.kind === "category" || options.getSource()?.kind === "category";
        $("#wa-reader-feedback").textContent = s.kind === "category" ? "Open a private writing desk for this category. Its current text stays as a reference until you choose a starting draft." :
          "Add this as a reference, or attach it to the article you are writing.";
      }
      async function readArticle(id) {
        if (busy) return;
        const attempt = generation;
        setBusy(true); $("#wa-browser-feedback").textContent = "Reading the selected page…";
        try {
          const category = browseKind === "categories";
          const data = await call(category ? "category" : "article", category ? { category_id: id } : { article_id: id }), s = normalizeSource(category ? data.category : data.article);
          if (!s) throw Error("The page did not include a valid source snapshot.");
          fillReader(s); $("#wa-browser-dialog").close(); show("#wa-reader-dialog");
        } catch (error) { $("#wa-browser-feedback").textContent = error.message; }
        finally { if (generation === attempt) setBusy(false); }
      }
      $("#wa-connect").addEventListener("click", () => {
        $("#wa-token").value = ""; $("#wa-connect-feedback").textContent = ""; show("#wa-connect-dialog");
      });
      $("#wa-connect-form").addEventListener("submit", async event => {
        event.preventDefault(); if (busy) return;
        const attempt = generation;
        const candidate = $("#wa-token").value.trim(); $("#wa-token").value = "";
        if (!candidate) return;
        connecting = true; setBusy(true); $("#wa-connect-feedback").textContent = "Checking your existing World Anvil access…";
        try {
          const data = await call("configure", { token: candidate });
          if (!data?.connected || data.saved !== true) throw Error("World Anvil did not confirm a saved connection.");
          connecting = false; connected = true; saved = true; owner = options.getOwner();
          connectionStatus("Connected to " + (data.world?.title || "Driftbound") + " · saved with your ORBIT account");
          $("#wa-connect-dialog").close(); recordChanged();
        } catch (error) { $("#wa-connect-feedback").textContent = error.message; }
        finally { if (generation === attempt) { connecting = false; setBusy(false); } }
        if (generation === attempt && connected) await synchronize();
      });
      $("#wa-reconcile").addEventListener("click", () => void synchronize());
      $("#wa-stop-sync").addEventListener("click", () => { stopRequested = true; recordChanged(); });
      $("#wa-connect-dialog").addEventListener("close", () => { $("#wa-token").value = ""; if (connecting) { generation++; connecting = false; setBusy(false); } });
      document.querySelectorAll("[data-wa-close]").forEach(b => b.addEventListener("click", () => document.getElementById(b.dataset.waClose).close()));
      $("#wa-disconnect").addEventListener("click", async () => {
        if (busy || !saved) return;
        const attempt = generation;
        setBusy(true);
        try {
          await call("forget"); clear(); connectionStatus("Saved connection removed. Your private writing is preserved.");
        } catch (error) { connectionStatus(error.message); }
        finally { if (generation === attempt) setBusy(false); }
      });
      function openBrowser(kind) {
        if (busy || !connected) return;
        browseKind = kind; offset = 0; rows = []; more = false;
        $("#wa-browser-kind").value = kind; $("#wa-search").value = ""; drawRows();
        show("#wa-browser-dialog"); void loadRows();
      }
      $("#wa-browse").addEventListener("click", () => openBrowser("articles"));
      $("#wa-browse-categories").addEventListener("click", () => openBrowser("categories"));
      $("#wa-browser-kind").addEventListener("change", () => {
        if (busy) return;
        browseKind = $("#wa-browser-kind").value === "categories" ? "categories" : "articles";
        offset = 0; rows = []; more = false; drawRows(); void loadRows();
      });
      $("#wa-load-page").addEventListener("click", () => void loadRows());
      $("#wa-search").addEventListener("input", drawRows);
      $("#wa-articles").addEventListener("click", e => { const b = e.target.closest("[data-wa-article]"); if (b) void readArticle(b.dataset.waArticle); });
      $("#wa-page-previous").addEventListener("click", () => { if (busy) return; offset = Math.max(0, offset - (browseKind === "categories" ? 100 : 50)); void loadRows(); });
      $("#wa-page-next").addEventListener("click", () => { if (more && !busy) { offset += browseKind === "categories" ? 100 : 50; void loadRows(); } });
      $("#wa-add-reference").addEventListener("click", async () => {
        if (!reader || busy) return;
        const attempt = generation;
        setBusy(true);
        try {
          if (await options.addReference(reader)) $("#wa-reader-dialog").close();
          else $("#wa-reader-feedback").textContent = "Save or back up your current edits before opening this reference. Your editor has been preserved.";
        } catch (_) { $("#wa-reader-feedback").textContent = "The reference could not be saved. Your current editor is preserved."; }
        finally { if (generation === attempt) setBusy(false); }
      });
      $("#wa-attach").addEventListener("click", () => {
        if (!reader || reader.kind === "category" || options.getSource()?.kind === "category" || busy) return;
        options.attach(reader); recordChanged(); $("#wa-reader-dialog").close();
      });
      $("#wa-review").addEventListener("click", async () => {
        if (busy || options.isSaving()) return;
        const attempt = generation;
        const linked = options.getSource(), category = linked?.kind === "category";
        const content = category ? "" : options.getArticleText(), proposed = category ? options.getCategoryChanges() : null;
        if (!linked || (category ? !Object.keys(proposed).length : !content.trim())) {
          options.status(category ? "Write or select a category field to include before reviewing its update." : "Write a section draft before reviewing a World Anvil update.", true); return;
        }
        review = null; $("#wa-review-ack").checked = false; $("#wa-save-update").disabled = true;
        $("#wa-before").value = ""; $("#wa-after").value = content; $("#wa-review-meta").textContent = "";
        $("#wa-review-feedback").textContent = "Reading the current destination page…";
        show("#wa-review-dialog"); setBusy(true);
        try {
          const data = await call(category ? "category" : "article", category ? { category_id: linked.id } : { article_id: linked.id }),
            s = normalizeSource(category ? data.category : data.article);
          if (!s || (s.kind === "category") !== category) throw Error("The destination page could not be verified.");
          if (!$("#wa-review-dialog").open) return;
          let changes = null;
          if (category) {
            if (Object.keys(proposed).some(key => !Object.hasOwn(s.fields, key))) throw Error("A selected field was not returned by World Anvil. Read the category again before updating it.");
            changes = Object.fromEntries(Object.entries(proposed).filter(([key, value]) => value !== s.fields[key]));
            if (!Object.keys(changes).length) throw Error("The selected category fields already match your draft. No update is needed.");
          }
          review = { source: s, content, changes, sent: false };
          $("#wa-review-title").textContent = "Review update: " + s.title;
          $("#wa-before").value = category ? categoryText(Object.fromEntries(Object.keys(changes).map(key => [key, s.fields[key]]))) : s.content;
          $("#wa-after").value = category ? categoryText(changes) : content;
          $("#wa-review-ack-label").textContent = category ? "I reviewed the current fields and my changes, including any empty fields selected to clear." : "I reviewed the current article and my replacement text.";
          $("#wa-review-meta").textContent = "Destination: " + s.state + (s.isDraft ? " · Draft" : "") + (s.isWip ? " · WIP" : "") +
            (category ? " · " + Object.keys(changes).length + " category field(s) will change. Other fields are preserved." : " · Main article text will be replaced.");
          $("#wa-review-feedback").textContent = !editable(s) ? "World Anvil did not confirm edit permission and privacy settings for this page." :
            s.version_hash !== linked.version_hash ? "World Anvil has changed since your last read. Review its current text carefully before saving." :
            category ? "Review every included field. Empty proposed fields clear existing text. Privacy, hierarchy, covers, and layout are preserved." :
            "Review both versions. Privacy, WIP status, title, and category are preserved.";
        } catch (error) { $("#wa-review-feedback").textContent = error.message; }
        finally { if (generation === attempt) setBusy(false); }
      });
      $("#wa-review-ack").addEventListener("change", () => setBusy(busy));
      $("#wa-save-update").addEventListener("click", async () => {
        if (!review || review.sent || !editable(review.source) || !$("#wa-review-ack").checked || busy) return;
        const attempt = generation;
        // Every attempt consumes this review. A new review must read the current
        // destination, even if the write's response is lost after it succeeds.
        const pending = review; pending.sent = true;
        setBusy(true); $("#wa-review-feedback").textContent = "Saving reviewed text and checking World Anvil…";
        try {
          const category = pending.source.kind === "category";
          const data = await call(category ? "update_category" : "update", { expected_hash: pending.source.version_hash, reviewed: true,
            ...(category ? { category_id: pending.source.id, changes: pending.changes } : { article_id: pending.source.id, content: pending.content }) });
          const source = normalizeSource(category ? data?.category : data?.article);
          if (!data?.verified || !source || source.id !== pending.source.id || source.kind !== pending.source.kind) {
            const failure = Error("The update could not be verified. Check World Anvil before sending it again."); failure.mayHaveWritten = true; throw failure;
          }
          const cloudSaved = await options.afterWrite(source);
          $("#wa-review-feedback").textContent = cloudSaved ? "Saved to World Anvil and verified. Your private workspace is saved too." :
            "Saved to World Anvil and verified. Save to cloud to keep the updated source link with your draft.";
          $("#wa-review-ack").checked = false; recordChanged();
        } catch (error) {
          $("#wa-review-feedback").textContent = error.message + (error.mayHaveWritten ? " Check the destination before sending another update." : "");
          $("#wa-review-ack").checked = false;
        } finally { if (generation === attempt) setBusy(false); }
      });
      recordChanged();
      return {
        recordChanged, restore, synchronize,
        accountChanged(id) {
          if (owner !== id) clear();
          owner = id; recordChanged();
        }
      };
    }
  };
})();
