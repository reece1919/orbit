/* Incoming sources refresh references. Author-owned fields never participate in the merge. */
(function (root) {
  "use strict";
  const WORLD = "3449e76f-83f2-4aa4-b1ec-40b2b0a8397b";
  const uuid = v => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  function normalizeLink(value) {
    if (!value || value.kind !== "article" || value.world_id !== WORLD || !uuid(value.id)) return null;
    return { kind: "article", id: value.id, world_id: WORLD, source_title: String(value.source_title || value.title || "Untitled article").slice(0, 150),
      presence: ["present", "not_seen"].includes(value.presence) ? value.presence : "unknown",
      text_status: ["available", "cached", "unavailable"].includes(value.text_status) ? value.text_status : "pending",
      source_changed: value.source_changed === true, checked_at: String(value.checked_at || "").slice(0, 100) };
  }
  function key(entry) {
    const source = entry?.world_anvil;
    if (source?.kind === "category") return null;
    if (source && (!source.kind || source.kind === "article") && source.world_id === WORLD && uuid(source.id)) return source.id;
    return normalizeLink(entry?.world_anvil_link)?.id || null;
  }
  function linkFor(entry) {
    const id = key(entry); if (!id) return null;
    const previous = normalizeLink(entry.world_anvil_link);
    return previous?.id === id ? previous : normalizeLink({ kind: "article", id, world_id: WORLD,
      source_title: entry.world_anvil?.title, text_status: entry.world_anvil ? "available" : "pending" });
  }
  function reconcileIndex(entries, rows, { complete = false, checked_at = new Date().toISOString(), makeEntry } = {}) {
    const remote = new Map();
    for (const row of rows) {
      if (!uuid(row?.id) || typeof row.title !== "string") throw Error("World Anvil returned an invalid article index.");
      remote.set(row.id, { id: row.id, title: row.title.slice(0, 150) });
    }
    const matched = new Set(), used = new Set(entries.map(e => e.id)); let missing = 0;
    const next = entries.map(entry => {
      const id = key(entry); if (!id) return entry;
      const row = remote.get(id), previous = linkFor(entry);
      if (!row && !complete) return entry;
      if (row) matched.add(id); else missing++;
      return { ...entry, world_anvil_link: normalizeLink({ ...previous, presence: row ? "present" : "not_seen",
        source_title: row?.title || previous.source_title, checked_at }) };
    });
    for (const row of remote.values()) if (!matched.has(row.id)) {
      let id = "wa-" + row.id; while (used.has(id)) id += "-import";
      used.add(id);
      const entry = makeEntry(row, id, checked_at);
      if (!entry) throw Error("The imported article could not be added safely.");
      next.push({ ...entry, world_anvil_link: normalizeLink({ kind: "article", id: row.id, world_id: WORLD,
        source_title: row.title, presence: "present", text_status: "pending", checked_at }) });
    }
    return { entries: next, added: remote.size - matched.size, matched: matched.size, missing };
  }
  function reconcileSources(entries, sources, failed = [], checked_at = new Date().toISOString()) {
    const incoming = new Map(sources.map(s => [s.id, s])), failures = new Set(failed); let updated = 0;
    const next = entries.map(entry => {
      const id = key(entry); if (!id) return entry;
      const source = incoming.get(id), previous = linkFor(entry);
      if (source) {
        if (source.kind !== "article" || source.world_id !== WORLD || !uuid(source.id)) throw Error("The incoming source is not a Driftbound article.");
        const changed = !!entry.world_anvil && entry.world_anvil.version_hash !== source.version_hash;
        if (!entry.world_anvil || changed) updated++;
        return { ...entry, world_anvil: source, world_anvil_link: normalizeLink({ ...previous,
          source_title: source.title, presence: "present", text_status: "available", checked_at,
          source_changed: previous.source_changed || changed }) };
      }
      if (failures.has(id)) return { ...entry, world_anvil_link: normalizeLink({ ...previous,
        text_status: entry.world_anvil ? "cached" : "unavailable", checked_at }) };
      return entry;
    });
    return { entries: next, updated };
  }
  // Read requests only. Checkpoint after the index and each small content batch.
  // Cancellation retains completed checkpoints; an owner change prevents new ones.
  async function loadArticles({ request, normalizeSource, apply, current, cancelled, progress, batchSize = 10 }) {
    const rows = new Map(); let offset = 0, complete = false, stopped = null;
    const guard = () => { if (!current()) throw Error("The account changed during reconciliation."); };
    while (!cancelled()) {
      guard(); progress({ phase: "index", listed: rows.size });
      try {
        const page = await request("articles", { offset }); guard();
        if (!Array.isArray(page?.articles) || typeof page.has_more !== "boolean" || page.articles.length > 50)
          throw Error("World Anvil returned an incomplete article index.");
        const before = rows.size;
        for (const row of page.articles) {
          if (!uuid(row?.id) || typeof row.title !== "string") throw Error("World Anvil returned an invalid article index.");
          rows.set(row.id, { id: row.id, title: row.title.slice(0, 150) });
        }
        if (!page.has_more) { complete = true; break; }
        if (rows.size === before || page.articles.length !== 50 || offset >= 100000)
          throw Error("World Anvil did not return the next complete article page.");
        offset += 50;
      } catch (error) { if (!current()) throw error; stopped = error; break; }
    }
    guard();
    if (rows.size || complete) {
      const saved = await apply({ index: [...rows.values()], complete, sources: [], failed: [] }); guard();
      if (!saved) throw Error("Reconciliation stopped because the private workspace could not be saved. Your writing is preserved.");
    }
    if (!complete || stopped || cancelled()) return { listed: rows.size, read: 0, failed: 0, complete: false,
      stopped: cancelled() ? "Stopped by you." : stopped?.message || "The article listing was not completed." };
    let sources = [], failed = [], read = 0, errors = 0;
    async function checkpoint() {
      if (!sources.length && !failed.length) return;
      guard(); const saved = await apply({ sources, failed }); guard();
      if (!saved) throw Error("Reconciliation stopped because the private workspace could not be saved. Your writing is preserved.");
      sources = []; failed = [];
    }
    for (const row of rows.values()) {
      if (cancelled()) break;
      guard(); progress({ phase: "text", listed: rows.size, read, failed: errors, title: row.title });
      try {
        const data = await request("article", { article_id: row.id }); guard();
        const source = normalizeSource(data?.article);
        if (!source || source.kind !== "article" || source.id !== row.id) throw Error("The article source could not be verified.");
        sources.push(source); read++;
      } catch (error) {
        if (!current()) throw error;
        failed.push(row.id); errors++;
        if (!["missing_content", "unexpected_response", "upstream_error", "wrong_world"].includes(error.code)) { stopped = error; break; }
      }
      if (sources.length + failed.length >= batchSize) await checkpoint();
    }
    await checkpoint(); guard();
    return { listed: rows.size, read, failed: errors, complete: !cancelled() && !stopped && errors === 0,
      stopped: cancelled() ? "Stopped by you." : stopped?.message || "" };
  }
  const api = { normalizeLink, key, linkFor, reconcileIndex, reconcileSources, loadArticles };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.DriftmarkReconcile = api;
})(typeof window !== "undefined" ? window : globalThis);
