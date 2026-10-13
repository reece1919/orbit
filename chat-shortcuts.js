/* ORBIT v1.1.3 — ChatGPT quick links with private, cross-device chat URL. */
(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const auth = () => window.ORBITAuth;
  const launch = $("#orbit-edit-chat");
  const dialog = $("#orbit-chat-dialog");
  const form = $("#orbit-chat-form");
  const input = $("#orbit-chat-url");
  const feedback = $("#orbit-chat-error");
  const accountStatus = $("#orbit-chat-setting-status");
  const editButton = $("#orbit-chat-configure");
  const removeButton = $("#orbit-chat-remove");
  const saveButton = $("#orbit-chat-save");
  let owner = "";
  let url = "";
  let busy = false;
  let synced = false;

  function safeChatUrl(value) {
    try {
      const parsed = new URL(String(value || "").trim());
      const validPath = /^\/(?:c\/[a-zA-Z0-9-]{8,}|g\/[^/]+\/c\/[a-zA-Z0-9-]{8,})\/?$/.test(parsed.pathname);
      if (parsed.protocol !== "https:" || parsed.hostname !== "chatgpt.com" || parsed.username || parsed.password || !validPath) return "";
      return parsed.origin + parsed.pathname;
    } catch (_) { return ""; }
  }
  function status(message) {
    if (accountStatus) accountStatus.textContent = message;
  }
  function display() {
    if (!launch) return;
    launch.href = url || "#";
    launch.title = url ? "Open this ORBIT development conversation in ChatGPT" : "Set up the ORBIT development chat shortcut";
    launch.setAttribute("aria-label", launch.title);
    launch.classList.toggle("needs-setup", !url);
    if (url) launch.removeAttribute("aria-haspopup");
    else launch.setAttribute("aria-haspopup", "dialog");
    if (removeButton) removeButton.hidden = !url;
    status(!owner ? "Sign in to manage your ORBIT chat link." :
      url ? "Saved to your ORBIT account · available across devices." :
      synced ? "Not set up yet · paste this chat's URL once." : "Loading your saved chat link…");
  }
  function openEditor() {
    if (!owner) {
      status("Sign in to ORBIT to save the chat shortcut.");
      return;
    }
    if (!dialog?.showModal) { status("This browser cannot open the shortcut editor."); return; }
    if (feedback) feedback.textContent = "";
    if (input) input.value = url;
    dialog.showModal();
    input?.focus();
  }
  async function reload() {
    const id = owner;
    const client = auth()?.client;
    if (!id || !client) return;
    synced = false;
    display();
    try {
      const { data, error } = await client.from("orbit_chat_shortcuts").select("chat_url").eq("owner_id", id).maybeSingle();
      if (error) throw error;
      if (owner !== id) return;
      url = safeChatUrl(data?.chat_url || "");
      synced = true;
      display();
    } catch (err) {
      if (owner !== id) return;
      synced = true;
      url = "";
      display();
      status("Could not load this chat link. Try again in Settings.");
      console.warn("ORBIT development chat shortcut unavailable", err.message);
    }
  }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const valid = safeChatUrl(input?.value);
    if (!valid) {
      feedback.textContent = "Paste the address of this ChatGPT conversation (a https://chatgpt.com/c/… link). Shared read-only links or project homepages won't work.";
      return;
    }
    const id = owner;
    const client = auth()?.client;
    if (!id || !client) {
      feedback.textContent = "Sign in to ORBIT first.";
      return;
    }
    busy = true;
    saveButton.disabled = true;
    feedback.textContent = "Saving link to your private ORBIT account…";
    try {
      const { error } = await client.from("orbit_chat_shortcuts").upsert({
        owner_id: id, chat_url: valid, updated_at: new Date().toISOString()
      }, { onConflict: "owner_id" });
      if (error) throw error;
      if (owner !== id) return;
      url = valid;
      synced = true;
      display();
      dialog.close();
      status("Chat saved. Use Edit ORBIT in the header to open this conversation.");
    } catch (err) {
      feedback.textContent = "Unable to save link: " + (err.message || "Please retry.");
    } finally {
      busy = false;
      saveButton.disabled = false;
    }
  }
  async function remove() {
    if (busy || !owner) return;
    busy = true;
    removeButton.disabled = true;
    const id = owner;
    try {
      const { error } = await auth().client.from("orbit_chat_shortcuts").delete().eq("owner_id", id);
      if (error) throw error;
      if (owner !== id) return;
      url = "";
      synced = true;
      display();
      dialog.close();
      status("Chat link cleared; the header shortcut is ready for a new URL.");
    } catch (err) {
      feedback.textContent = "Unable to clear saved link: " + (err.message || "Please retry.");
    } finally {
      busy = false;
      removeButton.disabled = false;
    }
  }
  function accountChange(user) {
    const next = user?.id || "";
    if (next === owner && synced) return;
    owner = next;
    url = "";
    synced = !next;
    display();
    if (next) void reload();
  }
  launch?.addEventListener("click", event => {
    if (url && safeChatUrl(url)) return;
    event.preventDefault();
    openEditor();
  });
  editButton?.addEventListener("click", openEditor);
  $("#orbit-chat-cancel")?.addEventListener("click", () => dialog.close());
  $("#orbit-chat-close")?.addEventListener("click", () => dialog.close());
  form?.addEventListener("submit", save);
  removeButton?.addEventListener("click", () => void remove());
  document.addEventListener("orbit:auth-changed", event => accountChange(event.detail?.user || null));
  display();
  void auth().ready.then(() => accountChange(auth().user || null));
})();