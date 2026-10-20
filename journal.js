/* ORBIT Journal v1.0 — standalone freeform writing with private MFA-gated Supabase storage.
 * Separate from PULSE and ORBIT local workspace sync. Never caches journal text in localStorage. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const form = $("journal-form");
  if (!form) return;

  const search = $("journal-search");
  const list = $("journal-entry-list");
  const count = $("journal-count");
  const feedback = $("journal-status");
  const fields = $("journal-fields");
  const saveButton = $("journal-save");
  const deleteButton = $("journal-delete");
  const selectedLabel = $("journal-selected-label");
  const exportButton = $("journal-export");
  const today = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  };
  const displayDate = value => {
    const d = new Date(value + "T12:00:00");
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric"});
  };
  let owner = "", db = null, entries = [], activeId = null, version = null;
  let dirty = false, busy = false, loaded = false, fullyLoaded = false, epoch = 0;

  function status(message, error) {
    feedback.textContent = message;
    feedback.classList.toggle("journal-error", Boolean(error));
  }
  function sorted() {
    entries.sort((a, b) =>
      String(b.entry_date).localeCompare(String(a.entry_date)) ||
      String(b.updated_at).localeCompare(String(a.updated_at)) ||
      String(b.id).localeCompare(String(a.id))
    );
  }
  function renderList() {
    const q = search.value.trim().toLowerCase();
    const matches = entries.filter(e => !q || [e.title, e.body, (e.tags || []).join(" ")].join(" ").toLowerCase().includes(q));
    count.textContent = matches.length + (q ? " matching" : " entries") + (!fullyLoaded && loaded ? " (recent only)" : "");
    list.replaceChildren();
    if (!owner) {
      list.textContent = "Sign in to see your private entries.";
      return;
    }
    if (!loaded) {
      list.textContent = "Loading private entries…";
      return;
    }
    if (!matches.length) {
      list.textContent = q ? "No entries match your search." : "No entries yet. Create your first entry.";
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const entry of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "journal-entry-item" + (entry.id === activeId ? " active" : "");
      button.dataset.journalId = entry.id;
      button.setAttribute("aria-current", entry.id === activeId ? "true" : "false");
      const date = document.createElement("small");
      date.textContent = displayDate(entry.entry_date);
      const title = document.createElement("strong");
      title.textContent = entry.title || "Untitled entry";
      const sample = document.createElement("span");
      sample.textContent = entry.body.replace(/\s+/g, " ").slice(0, 105);
      button.append(date, title, sample);
      fragment.append(button);
    }
    list.append(fragment);
  }
  function renderFields() {
    fields.disabled = !owner || busy;
    saveButton.disabled = !owner || busy;
    deleteButton.disabled = !owner || busy || !activeId;
    exportButton.disabled = !owner || !loaded || busy || !fullyLoaded;
  }
  function warnIfDirty() {
    return dirty && !window.confirm("You have unsaved journal changes. Discard them?");
  }
  function openEntry(entry) {
    if (warnIfDirty()) return;
    activeId = entry?.id || null;
    version = entry?.updated_at || null;
    form.elements.entry_date.value = entry?.entry_date || today();
    form.elements.title.value = entry?.title || "";
    form.elements.body.value = entry?.body || "";
    form.elements.tags.value = (entry?.tags || []).join(", ");
    dirty = false;
    selectedLabel.textContent = entry ? "Editing " + displayDate(entry.entry_date) : "New private entry";
    deleteButton.hidden = !entry;
    status(entry ? "Saved in your private journal. Make changes, then select Save." : "Write freely. Select Save entry when you are ready.");
    renderFields();
    renderList();
  }
  async function ensureMfa() {
    if (!db || !owner) throw new Error("Sign in to ORBIT before using the Journal.");
    const result = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (result.error) throw result.error;
    if (result.data?.currentLevel !== "aal2") throw new Error("Verify your authenticator in ORBIT before opening private journal entries.");
  }
  async function refresh() {
    if (!owner || !db) return;
    if (warnIfDirty()) return;
    const id = owner, client = db, stamp = ++epoch;
    busy = true;
    loaded = false;
    renderFields();
    renderList();
    status("Loading your private journal…");
    try {
      await ensureMfa();
      const rows = [];
      const pageSize = 200;
      let complete = false;
      for (let page = 0; page < 25; page++) {
        const {data, error} = await client.from("orbit_journal_entries")
          .select("id,entry_date,title,body,tags,created_at,updated_at")
          .eq("owner_id", id)
          .order("entry_date", {ascending:false})
          .order("updated_at", {ascending:false})
          .order("id", {ascending:false})
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (id !== owner || client !== db || stamp !== epoch) return;
        rows.push(...(data || []));
        if ((data || []).length < pageSize) { complete = true; break; }
      }
      entries = rows;
      sorted();
      loaded = true;
      fullyLoaded = complete;
      const stillOpen = entries.find(e => e.id === activeId);
      openEntry(stillOpen || entries[0] || null);
      status(complete ? "Private journal ready. Your entries are available on signed-in devices." :
        "The newest 5,000 entries are loaded. Older entries are not shown or included in export.", !complete);
    } catch (error) {
      if (id === owner && stamp === epoch) {
        entries = [];
        loaded = false;
        fullyLoaded = false;
        status(error?.message || "Could not load the journal.", true);
      }
    } finally {
      if (id === owner && stamp === epoch) {
        busy = false;
        renderFields();
        renderList();
      }
    }
  }
  function parseTags(value) {
    const tags = [...new Map(value.split(",").map(t => t.trim()).filter(Boolean)
      .map(t => [t.toLowerCase(), t])).values()];
    if (tags.length > 12) throw new Error("Use no more than 12 tags.");
    if (tags.some(t => t.length > 32)) throw new Error("Tags must be 32 characters or shorter.");
    return tags;
  }
  async function save(event) {
    event.preventDefault();
    if (!owner || !db || busy) return;
    const title = form.elements.title.value.trim();
    const body = form.elements.body.value.trim();
    const entryDate = form.elements.entry_date.value;
    if (!body) { status("Write an entry before saving.", true); form.elements.body.focus(); return; }
    if (!entryDate || body.length > 50000 || title.length > 180) { status("Check the entry date and length.", true); return; }
    let tags;
    try { tags = parseTags(form.elements.tags.value); }
    catch (e) { status(e.message, true); return; }
    const id = owner, client = db, selected = activeId, lastVersion = version, stamp = epoch;
    busy = true;
    renderFields();
    status("Saving privately…");
    try {
      await ensureMfa();
      const payload = {entry_date:entryDate, title, body, tags};
      const query = selected
        ? client.from("orbit_journal_entries").update(payload).eq("id", selected).eq("owner_id", id).eq("updated_at", lastVersion)
        : client.from("orbit_journal_entries").insert({...payload, owner_id:id});
      const {data, error} = await query.select("id,entry_date,title,body,tags,created_at,updated_at").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("This entry changed on another device. Copy your unsaved text, then reload the journal before saving.");
      if (owner !== id || db !== client || stamp !== epoch) return;
      entries = [data, ...entries.filter(e => e.id !== data.id)];
      sorted();
      activeId = data.id;
      version = data.updated_at;
      dirty = false;
      selectedLabel.textContent = "Editing " + displayDate(data.entry_date);
      deleteButton.hidden = false;
      status("Saved securely · " + new Date(data.updated_at).toLocaleString());
      renderList();
    } catch (error) {
      if (owner === id) status(error?.message || "Save failed. Your writing remains in the editor.", true);
    } finally {
      if (owner === id) { busy = false; renderFields(); }
    }
  }
  async function remove() {
    if (!activeId || !owner || busy) return;
    if (!window.confirm("Permanently delete this journal entry? This cannot be undone.")) return;
    const id = owner, selected = activeId, stamp = epoch, client = db;
    busy = true;
    renderFields();
    status("Deleting entry…");
    try {
      await ensureMfa();
      const {data, error} = await client.from("orbit_journal_entries").delete()
        .eq("owner_id", id).eq("id", selected).eq("updated_at", version)
        .select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("This entry was changed or removed on another device. Reload before deleting.");
      if (owner !== id || epoch !== stamp) return;
      entries = entries.filter(e => e.id !== selected);
      dirty = false;
      openEntry(entries[0] || null);
      status("Journal entry permanently deleted.");
    } catch (error) {
      if (owner === id) status(error?.message || "Delete failed.", true);
    } finally {
      if (owner === id) { busy = false; renderFields(); }
    }
  }
  function downloadBackup() {
    if (!loaded || !fullyLoaded || !owner) return;
    const data = {format:"orbit-journal-v1", exported_at:new Date().toISOString(),
      entries:entries.map(e => ({entry_date:e.entry_date, title:e.title, body:e.body, tags:e.tags, created_at:e.created_at, updated_at:e.updated_at}))};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:"application/json"}));
    const a = document.createElement("a");
    a.href = url;
    a.download = "orbit-journal-" + today() + ".json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("Export created. Store the unencrypted JSON file somewhere secure.");
  }
  function reset(nextUser) {
    const id = nextUser?.id || "";
    if (id === owner && (loaded || busy)) return;
    ++epoch;
    owner = id;
    db = id ? window.ORBITAuth?.client || null : null;
    entries = [];
    activeId = null;
    version = null;
    dirty = false;
    busy = false;
    loaded = false;
    fullyLoaded = false;
    search.value = "";
    form.reset();
    form.elements.entry_date.value = today();
    deleteButton.hidden = true;
    selectedLabel.textContent = id ? "Private journal" : "Sign in to open the Journal";
    status(id ? "Checking your private journal…" : "Sign in with your ORBIT account to access private entries.");
    renderFields();
    renderList();
    if (id) void refresh();
  }
  form.addEventListener("submit", save);
  form.addEventListener("input", () => { if (owner && !busy) { dirty = true; status("Unsaved changes · select Save entry to keep them."); } });
  $("journal-new").addEventListener("click", () => openEntry(null));
  $("journal-reload").addEventListener("click", () => { if (!busy) void refresh(); });
  deleteButton.addEventListener("click", remove);
  exportButton.addEventListener("click", downloadBackup);
  search.addEventListener("input", renderList);
  list.addEventListener("click", event => {
    const button = event.target.closest("[data-journal-id]");
    if (!button) return;
    const item = entries.find(e => e.id === button.dataset.journalId);
    if (item && item.id !== activeId) openEntry(item);
  });
  document.addEventListener("click", event => {
    const navigation = event.target.closest("[data-view]");
    if (!navigation || navigation.dataset.view === "journal" || !dirty) return;
    if (!window.confirm("Journal changes are not saved. Leave without saving?")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else {
      dirty = false;
    }
  }, true);
  window.addEventListener("beforeunload", event => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
  document.addEventListener("orbit:auth-changed", event => reset(event.detail?.user || null));
  if (window.ORBITAuth?.ready) void window.ORBITAuth.ready.then(() => reset(window.ORBITAuth.user || null));
  else reset(null);
})();