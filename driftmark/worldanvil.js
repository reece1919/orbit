/* Tokens are submitted once to private storage and never returned to this UI. */
(function () {
  "use strict";
  const $ = q => document.querySelector(q), W = window.DriftmarkWriting;
  const WORLD = "3449e76f-83f2-4aa4-b1ec-40b2b0a8397b";
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function normalizeSource(s) {
    if (!s || typeof s !== "object" || typeof s.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id) ||
      s.world_id !== WORLD || typeof s.content !== "string" || s.content.length > 2000000 ||
      typeof s.version_hash !== "string" || !/^[a-f0-9]{64}$/.test(s.version_hash)) return null;
    return { id: s.id, world_id: WORLD, title: String(s.title || "Untitled article").slice(0, 150),
      content: s.content, url: W.url(s.url), version_hash: s.version_hash,
      state: ["private", "public"].includes(s.state) ? s.state : "unknown",
      isDraft: typeof s.isDraft === "boolean" ? s.isDraft : null, isWip: typeof s.isWip === "boolean" ? s.isWip : null,
      isEditable: s.isEditable === true, read_at: String(s.read_at || "").slice(0, 100) };
  }
  window.DriftmarkWorldAnvil = {
    normalizeSource,
    init(options) {
      let connected = false, saved = false, owner = "", busy = false, rows = [], offset = 0, more = false, reader = null, review = null;
      let generation = 0, connecting = false;
      const connectionStatus = message => { $("#wa-status").textContent = message; };
      function recordChanged() {
        const s = options.getSource();
        $("#wa-linked").hidden = !s;
        $("#wa-review").hidden = !s;
        $("#wa-linked-title").textContent = s ? "World Anvil: " + s.title + " · " + s.state + (s.isWip ? " · WIP" : "") : "";
        $("#wa-review").disabled = !connected || busy;
        $("#wa-connect").disabled = busy || !options.getOwner();
        $("#wa-browse").disabled = !connected || busy;
        $("#wa-disconnect").hidden = !saved;
        $("#wa-disconnect").disabled = busy;
      }
      function setBusy(value) {
        busy = value;
        ["#wa-connect-submit", "#wa-page-previous", "#wa-page-next", "#wa-load-page", "#wa-add-reference", "#wa-attach", "#wa-save-update"].forEach(q => $(q).disabled = value);
        recordChanged();
        $("#wa-page-previous").disabled = value || offset === 0;
        $("#wa-page-next").disabled = value || !more;
        $("#wa-save-update").disabled = value || !connected || !review || !$("#wa-review-ack").checked || !review.source.isEditable || review.sent;
      }
      async function call(action, body = {}) {
        const client = options.getClient();
        const requestOwner = options.getOwner(), requestGeneration = generation;
        if (!client || !requestOwner || (!["configure", "status", "forget"].includes(action) && !connected))
          throw Error("Sign in to ORBIT and connect your World Anvil user token first.");
        let result;
        try { result = await client.functions.invoke("driftmark-worldanvil", { body: { action, ...body } }); }
        catch (_) {
          const failure = Error(action === "update" ? "The connection response was lost. Read the destination again before retrying." :
            "The connection response was lost. Refresh to check your saved connection.");
          failure.mayHaveWritten = action === "update"; throw failure;
        }
        if (generation !== requestGeneration || options.getOwner() !== requestOwner) {
          const failure = Error("Your connection changed while this request was running.");
          failure.mayHaveWritten = action === "update"; throw failure;
        }
        const { data, error } = result;
        if (error) {
          let detail = null;
          try { if (error.context?.clone) detail = await error.context.clone().json(); } catch (_) {}
          const failure = Error(detail?.error || "The private World Anvil connection could not complete this request. Check your ORBIT sign-in and authenticator verification.");
          failure.code = detail?.code;
          failure.hasSavedConnection = !!detail?.has_saved_connection;
          failure.mayHaveWritten = typeof detail?.may_have_written === "boolean" ? detail.may_have_written : action === "update";
          throw failure;
        }
        if (data?.error) { const failure = Error(data.error); failure.mayHaveWritten = !!data.may_have_written; throw failure; }
        return data;
      }
      function clear() {
        generation++; connecting = false; connected = false; saved = false; rows = []; offset = 0; more = false; review = null; reader = null;
        ["#wa-token", "#wa-reader-content", "#wa-before", "#wa-after", "#wa-search"].forEach(q => $(q).value = "");
        $("#wa-review-ack").checked = false; $("#wa-save-update").disabled = true;
        $("#wa-articles").textContent = "";
        ["#wa-reader-meta", "#wa-review-meta", "#wa-page-label"].forEach(q => $(q).textContent = "");
        ["#wa-connect-dialog", "#wa-browser-dialog", "#wa-reader-dialog", "#wa-review-dialog"].forEach(q => $(q).close());
        connectionStatus("Connect your existing World Anvil user token to browse and update articles."); recordChanged();
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
        } catch (error) {
          if (generation !== attempt) return;
          connected = false; saved = !!error.hasSavedConnection; connectionStatus(error.message);
        } finally { setBusy(false); }
      }
      function drawRows() {
        const term = $("#wa-search").value.toLowerCase().trim();
        const filtered = rows.filter(r => r.title.toLowerCase().includes(term));
        $("#wa-articles").innerHTML = filtered.length ? filtered.map(r => '<button type="button" class="item" data-wa-article="' +
          esc(r.id) + '"><strong>' + esc(r.title) + '</strong><small>Read the current World Anvil article</small></button>').join("") :
          '<p class="hint">No matching articles on this page.</p>';
        $("#wa-page-label").textContent = rows.length ? "Articles " + (offset + 1) + "–" + (offset + rows.length) : "No articles on this page";
      }
      async function loadRows() {
        if (busy) return;
        setBusy(true); $("#wa-browser-feedback").textContent = "Loading World Anvil articles…";
        try {
          const data = await call("articles", { offset });
          rows = Array.isArray(data.articles) ? data.articles : []; more = !!data.has_more;
          drawRows(); $("#wa-browser-feedback").textContent = "Search this page or choose an article.";
        } catch (error) { $("#wa-browser-feedback").textContent = error.message; }
        finally { setBusy(false); }
      }
      function fillReader(s) {
        reader = s;
        $("#wa-reader-title").textContent = s.title;
        $("#wa-reader-meta").textContent = s.state + (s.isDraft ? " · Draft" : "") + (s.isWip ? " · WIP" : "") + " · Read " + new Date(s.read_at).toLocaleString();
        $("#wa-reader-content").value = s.content;
        $("#wa-attach").hidden = !options.hasEntry();
        $("#wa-reader-feedback").textContent = "Add this as a reference, or attach it to the article you are writing.";
      }
      async function readArticle(id) {
        if (busy) return;
        setBusy(true); $("#wa-browser-feedback").textContent = "Reading the selected article…";
        try {
          const data = await call("article", { article_id: id }), s = normalizeSource(data.article);
          if (!s) throw Error("The article did not include a valid source snapshot.");
          fillReader(s); $("#wa-browser-dialog").close(); show("#wa-reader-dialog");
        } catch (error) { $("#wa-browser-feedback").textContent = error.message; }
        finally { setBusy(false); }
      }
      $("#wa-connect").addEventListener("click", () => {
        $("#wa-token").value = ""; $("#wa-connect-feedback").textContent = ""; show("#wa-connect-dialog");
      });
      $("#wa-connect-form").addEventListener("submit", async event => {
        event.preventDefault(); if (busy) return;
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
        finally { connecting = false; setBusy(false); }
      });
      $("#wa-connect-dialog").addEventListener("close", () => { $("#wa-token").value = ""; if (connecting) { generation++; connecting = false; } });
      document.querySelectorAll("[data-wa-close]").forEach(b => b.addEventListener("click", () => document.getElementById(b.dataset.waClose).close()));
      $("#wa-disconnect").addEventListener("click", async () => {
        if (busy || !saved) return;
        setBusy(true);
        try {
          await call("forget"); clear(); connectionStatus("Saved connection removed. Your private writing is preserved.");
        } catch (error) { connectionStatus(error.message); }
        finally { setBusy(false); }
      });
      $("#wa-browse").addEventListener("click", () => { show("#wa-browser-dialog"); void loadRows(); });
      $("#wa-load-page").addEventListener("click", () => void loadRows());
      $("#wa-search").addEventListener("input", drawRows);
      $("#wa-articles").addEventListener("click", e => { const b = e.target.closest("[data-wa-article]"); if (b) void readArticle(b.dataset.waArticle); });
      $("#wa-page-previous").addEventListener("click", () => { offset = Math.max(0, offset - 50); void loadRows(); });
      $("#wa-page-next").addEventListener("click", () => { if (more) { offset += 50; void loadRows(); } });
      $("#wa-add-reference").addEventListener("click", async () => {
        if (!reader || busy) return;
        setBusy(true);
        try {
          if (await options.addReference(reader)) $("#wa-reader-dialog").close();
          else $("#wa-reader-feedback").textContent = "Save or back up your current edits before opening this reference. Your editor has been preserved.";
        } catch (_) { $("#wa-reader-feedback").textContent = "The reference could not be saved. Your current editor is preserved."; }
        finally { setBusy(false); }
      });
      $("#wa-attach").addEventListener("click", () => {
        if (!reader || busy) return;
        options.attach(reader); recordChanged(); $("#wa-reader-dialog").close();
      });
      $("#wa-review").addEventListener("click", async () => {
        if (busy || options.isSaving()) return;
        const linked = options.getSource(), content = options.getArticleText();
        if (!linked || !content.trim()) { options.status("Write a section draft before reviewing a World Anvil update.", true); return; }
        review = null; $("#wa-review-ack").checked = false; $("#wa-save-update").disabled = true;
        $("#wa-before").value = ""; $("#wa-after").value = content; $("#wa-review-meta").textContent = "";
        $("#wa-review-feedback").textContent = "Reading the current destination article…";
        show("#wa-review-dialog"); setBusy(true);
        try {
          const data = await call("article", { article_id: linked.id }), s = normalizeSource(data.article);
          if (!s) throw Error("The destination article could not be verified.");
          review = { source: s, content, sent: false };
          $("#wa-review-title").textContent = "Review update: " + s.title;
          $("#wa-before").value = s.content;
          $("#wa-review-meta").textContent = "Destination: " + s.state + (s.isDraft ? " · Draft" : "") + (s.isWip ? " · WIP" : "") + " · Main article text will be replaced.";
          $("#wa-review-feedback").textContent = !s.isEditable ? "World Anvil did not confirm permission to edit this article." :
            s.version_hash !== linked.version_hash ? "World Anvil has changed since your last read. Review its current text carefully before saving." :
            "Review both versions. Privacy, WIP status, title, and category are preserved.";
        } catch (error) { $("#wa-review-feedback").textContent = error.message; }
        finally { setBusy(false); }
      });
      $("#wa-review-ack").addEventListener("change", () => setBusy(busy));
      $("#wa-save-update").addEventListener("click", async () => {
        if (!review || review.sent || !review.source.isEditable || !$("#wa-review-ack").checked || busy) return;
        // Every attempt consumes this review. A new review must read the current
        // destination, even if the write's response is lost after it succeeds.
        const pending = review; pending.sent = true;
        setBusy(true); $("#wa-review-feedback").textContent = "Saving reviewed text and checking World Anvil…";
        try {
          const data = await call("update", { article_id: pending.source.id, expected_hash: pending.source.version_hash,
            content: pending.content, reviewed: true });
          const source = normalizeSource(data?.article);
          if (!data?.verified || !source) { const failure = Error("The update could not be verified. Check World Anvil before sending it again."); failure.mayHaveWritten = true; throw failure; }
          const cloudSaved = await options.afterWrite(source);
          $("#wa-review-feedback").textContent = cloudSaved ? "Saved to World Anvil and verified. Your private workspace is saved too." :
            "Saved to World Anvil and verified. Save to cloud to keep the updated source link with your draft.";
          $("#wa-review-ack").checked = false; recordChanged();
        } catch (error) {
          $("#wa-review-feedback").textContent = error.message + (error.mayHaveWritten ? " Check the destination before sending another update." : "");
          $("#wa-review-ack").checked = false;
        } finally { setBusy(false); }
      });
      recordChanged();
      return {
        recordChanged, restore,
        accountChanged(id) {
          if (owner !== id) clear();
          owner = id; recordChanged();
        }
      };
    }
  };
})();
