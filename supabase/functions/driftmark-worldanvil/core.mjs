export const ORIGIN = "https://reece1919.github.io";
export const SERVICE = "https://worldanvil-proxy.onrender.com";
export const WORLD = "3449e76f-83f2-4aa4-b1ec-40b2b0a8397b";
export const OWNER = "48c2d998-89ca-48bc-ac6f-0a45d8f25b5a";
export const CATEGORY_FIELDS = ["description", "excerpt", "custom1", "custom2", "custom3", "custom4", "custom5"];
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const object = value => !!value && typeof value === "object" && !Array.isArray(value);
export class Failure extends Error {
  constructor(message, status = 400, code = "request_failed") { super(message); this.status = status; this.code = code; }
}
export function entity(raw, kind) {
  for (const candidate of [raw?.[kind], raw?.data?.[kind], raw?.data, raw?.entity, raw]) {
    if (object(candidate) && typeof candidate.id === "string") return candidate;
  }
  throw new Failure("The connection returned an unexpected " + kind + " response.", 502, "unexpected_response");
}
export function listing(raw, kind) {
  if (Array.isArray(raw)) return raw;
  for (const candidate of [raw?.[kind], raw?.data?.[kind], raw?.entities, raw?.results, raw?.items, raw?.data]) {
    if (Array.isArray(candidate)) return candidate;
  }
  throw new Failure("The connection returned an unexpected " + kind + " list.", 502, "unexpected_response");
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export async function digest(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function articleWorld(article) { return typeof article.world === "string" ? article.world : article.world?.id; }
function protectedFields(article) {
  const referenceId = value => typeof value === "string" ? value : value?.id || null;
  return { id: article.id, world: articleWorld(article), title: article.title,
    state: article.state, isDraft: article.isDraft, isWip: article.isWip,
    category: referenceId(article.category), articleParent: referenceId(article.articleParent),
    templateType: article.templateType };
}
function sourceURL(value) {
  try { const parsed = new URL(value || "");
    if (parsed.protocol === "https:" && /(^|\.)worldanvil\.com$/i.test(parsed.hostname) && !parsed.username && !parsed.password) return parsed.href;
  } catch (_) { /* Private pages may have no public URL. */ }
  return "";
}
function categoryProtected(c) {
  const ref = value => typeof value === "string" || typeof value === "number" ? value : value?.id ?? null;
  const groups = Array.isArray(c.subscribergroups) ? c.subscribergroups.map(ref).sort() : c.subscribergroups;
  return { id: c.id, world: articleWorld(c), title: c.title, slug: c.slug, state: c.state,
    subscribergroups: groups, parent: ref(c.parent), articleRedirect: ref(c.articleRedirect),
    pagecover: ref(c.pagecover), bookcover: ref(c.bookcover), defaultarticlecover: ref(c.defaultarticlecover),
    icon: c.icon, isBook: c.isBook, displayBookTitle: c.displayBookTitle, isCollapsed: c.isCollapsed,
    position: c.position, cssClasses: c.cssClasses, systemMeta: c.systemMeta,
    folderId: c.folderId, tags: c.tags, isDraft: c.isDraft, isWip: c.isWip, isEditable: c.isEditable };
}
export async function categoryDTO(raw, expectedId) {
  const c = entity(raw, "category");
  if (!uuid(c.id) || (expectedId && c.id !== expectedId) || articleWorld(c) !== WORLD)
    throw new Failure("This category is not confirmed as part of Driftbound.", 403, "wrong_world");
  const fields = {};
  for (const key of CATEGORY_FIELDS) {
    if (!Object.hasOwn(c, key)) continue;
    if (c[key] !== null && typeof c[key] !== "string") throw new Failure("The category returned an unexpected text field.", 502, "unexpected_response");
    fields[key] = c[key] ?? "";
  }
  if (!Object.hasOwn(fields, "description")) throw new Failure("This category's description was not returned.", 502, "missing_content");
  const state = ["public", "private"].includes(c.state) ? c.state : "unknown";
  const groupsConfirmed = Object.hasOwn(c, "subscribergroups") && (c.subscribergroups === null ||
    (Array.isArray(c.subscribergroups) && c.subscribergroups.every(g => uuid(typeof g === "string" ? g : g?.id))));
  return { kind: "category", id: c.id, world_id: WORLD, title: String(c.title || "Untitled category").slice(0, 150),
    fields, url: sourceURL(c.url), state, isEditable: c.isEditable === true,
    metadata_confirmed: state !== "unknown" && groupsConfirmed,
    version_hash: await digest({ ...categoryProtected(c), fields, updateDate: c.updateDate, isEditable: c.isEditable }),
    read_at: new Date().toISOString() };
}
export async function articleDTO(raw, expectedId) {
  const a = entity(raw, "article");
  if (!uuid(a.id) || (expectedId && a.id !== expectedId) || articleWorld(a) !== WORLD)
    throw new Failure("This article is not confirmed as part of Driftbound.", 403, "wrong_world");
  if (typeof a.content !== "string") throw new Failure("This article's main text was not returned.", 502, "missing_content");
  let url = "";
  try { const parsed = new URL(a.url || a.permalink || "");
    if (parsed.protocol === "https:" && /(^|\.)worldanvil\.com$/i.test(parsed.hostname) && !parsed.username && !parsed.password) url = parsed.href;
  } catch (_) { /* A missing public URL does not prevent private reference use. */ }
  return { id: a.id, title: String(a.title || "Untitled article").slice(0, 150), content: a.content, url,
    world_id: WORLD, state: ["public", "private"].includes(a.state) ? a.state : "unknown",
    isDraft: typeof a.isDraft === "boolean" ? a.isDraft : null,
    isWip: typeof a.isWip === "boolean" ? a.isWip : null,
    isEditable: a.isEditable === true,
    // View counters and presentation metadata can change simply by reading.
    version_hash: await digest({ ...protectedFields(a), content: a.content,
      updateDate: a.updateDate, isEditable: a.isEditable }), read_at: new Date().toISOString() };
}
async function limitedText(response, maximum = 2000000) {
  if (!response.body) return "";
  const reader = response.body.getReader(), chunks = []; let length = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break;
      length += value.length; if (length > maximum) { await reader.cancel(); throw new Failure("The source returned too much data.", 413); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(joined);
}
export function createHandler(deps) {
  const reply = (data, status = 200) => Response.json(data, { status, headers: {
    "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin", "Cache-Control": "no-store" } });
  async function upstream(token, path, method = "GET", params = {}, body) {
    const url = new URL(path, SERVICE);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    let response;
    try { response = await deps.fetcher(url.href, { method, headers: { "x-auth-token": token,
      "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "DRIFTMARK (https://reece1919.github.io/orbit/driftmark/, 0.4)" },
      body: body === undefined ? undefined : JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(40000) }); }
    catch (_) { throw new Failure("The World Anvil connection did not respond. Try reading the destination again.", 502, "upstream_unavailable"); }
    if ([401, 403].includes(response.status)) throw new Failure("World Anvil did not accept this token or its permissions. Check the token used by your GPT.", 401, "token_rejected");
    if (response.status === 429) throw new Failure("World Anvil is temporarily limiting requests. Wait before trying again.", 429, "rate_limited");
    if (!response.ok) throw new Failure("The World Anvil connection returned an error (" + response.status + ").", 502, "upstream_error");
    const text = await limitedText(response);
    try { return text ? JSON.parse(text) : {}; } catch (_) { throw new Failure("The World Anvil response was not valid JSON.", 502, "unexpected_response"); }
  }
  async function identity(token) {
    const user = entity(await upstream(token, "/identity"), "identity");
    if (!user.id.trim() || user.id.length > 200 || /[\u0000-\u001f\u007f]/.test(user.id))
      throw new Failure("The connection did not confirm a World Anvil identity.", 502);
    const worlds = listing(await upstream(token, "/user/worlds", "POST", { id: user.id }, {}), "worlds");
    const world = worlds.find(w => w.id === WORLD);
    if (!world) throw new Failure("This token did not grant access to the Driftbound world.", 403, "wrong_world");
    return { world: { id: WORLD, title: String(world.title || world.name || "Driftbound").slice(0, 150) } };
  }
  return async function handle(req) {
    if (req.headers.get("Origin") !== ORIGIN) return reply({ error: "Origin not allowed." }, 403);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
      "Access-Control-Max-Age": "600", "Vary": "Origin" } });
    if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);
    let mayHaveWritten = false, hasSavedConnection = false;
    try {
      const auth = await deps.authorize(req.headers.get("Authorization") || "");
      if (!auth || auth.id !== OWNER || auth.aal !== "aal2") throw new Failure("Sign in to ORBIT and complete authenticator verification.", 403, "authentication_required");
      const text = await limitedText(new Response(req.body), 300000);
      let input; try { input = JSON.parse(text); } catch (_) { throw new Failure("Send a valid connection request."); }
      if (!object(input)) throw new Failure("Send a valid connection request.");
      const fields = { status: ["action", "token"], configure: ["action", "token"], forget: ["action"],
        articles: ["action", "token", "offset", "category_id"], categories: ["action", "token", "offset"],
        category: ["action", "category_id"], update_category: ["action", "category_id", "expected_hash", "changes", "reviewed"],
        article: ["action", "token", "article_id"], update: ["action", "token", "article_id", "expected_hash", "content", "reviewed"] }[input.action];
      if (!Array.isArray(fields) || Object.keys(input).some(key => !fields.includes(key))) throw new Failure("Unsupported connection operation.");
      if (input.action === "forget") {
        await deps.connections.remove(auth.id);
        return reply({ connected: false, saved: false });
      }
      // Older open tabs may still send their session credential. New clients
      // send it only when saving a connection; all other calls use the Vault.
      let token = input.token;
      if (input.action !== "configure" && token === undefined) {
        token = await deps.connections.read(auth.id); hasSavedConnection = !!token;
      }
      if (input.action === "status" && !token) return reply({ connected: false, saved: false, needs_token: true });
      if (typeof token !== "string" || !token.length || token.length > 500 || /[\s\u0000-\u001f\u007f]/.test(token))
        throw new Failure("Enter the World Anvil user token used by your GPT.", 409, "setup_required");
      if (input.action === "configure") {
        const verified = await identity(token);
        // Preserve the previous saved connection if verification or storage fails.
        await deps.connections.write(auth.id, token); hasSavedConnection = true;
        return reply({ connected: true, saved: true, ...verified });
      }
      if (input.action === "status") return reply({ connected: true, saved: hasSavedConnection, ...await identity(token) });
      if (input.action === "categories") {
        const offset = input.offset ?? 0;
        if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new Failure("Invalid page.");
        const raw = await upstream(token, "/world/categories", "POST", { id: WORLD }, { limit: "100", offset: String(offset) });
        const list = listing(raw, "categories").filter(c => uuid(c.id));
        return reply({ categories: list.map(c => ({ id: c.id, title: String(c.title || c.name || "Untitled category").slice(0, 200) })), offset, has_more: list.length >= 100 });
      }
      if (input.action === "articles") {
        const offset = input.offset ?? 0;
        if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new Failure("Invalid page.");
        if (input.category_id && !uuid(input.category_id)) throw new Failure("Invalid category.");
        const body = { limit: "50", offset: String(offset), ...(input.category_id ? { category: { id: input.category_id } } : {}) };
        const raw = await upstream(token, "/world/articles", "POST", { id: WORLD }, body);
        const list = listing(raw, "articles").filter(a => uuid(a.id));
        return reply({ articles: list.map(a => ({ id: a.id, title: String(a.title || a.name || "Untitled article").slice(0, 200) })), offset, has_more: list.length >= 50 });
      }
      if (["category", "update_category"].includes(input.action)) {
        if (!uuid(input.category_id)) throw new Failure("Choose a valid World Anvil category.");
        if (input.action === "update_category" && (input.reviewed !== true || !object(input.changes) ||
          !Object.keys(input.changes).length || Object.keys(input.changes).some(key => !CATEGORY_FIELDS.includes(key) ||
            typeof input.changes[key] !== "string" || input.changes[key].length > 80000) ||
          typeof input.expected_hash !== "string" || !/^[a-f0-9]{64}$/.test(input.expected_hash)))
          throw new Failure("Review the selected category text fields before saving. Each field is limited to 80,000 characters.");
        const raw = await upstream(token, "/category", "GET", { id: input.category_id, granularity: 2 });
        const current = await categoryDTO(raw, input.category_id);
        if (input.action === "category") return reply({ category: current });
        if (!current.isEditable) throw new Failure("World Anvil did not confirm permission to edit this category.", 403, "not_editable");
        if (!current.metadata_confirmed) throw new Failure("World Anvil did not confirm the category's privacy settings. No update was sent.", 409, "metadata_unconfirmed");
        if (current.version_hash !== input.expected_hash) throw new Failure("The World Anvil category changed after your review. Read the latest fields and review again.", 409, "source_changed");
        const changes = {};
        for (const [key, value] of Object.entries(input.changes)) {
          if (!Object.hasOwn(current.fields, key)) throw new Failure("World Anvil did not return this category field. No update was sent.", 409, "field_unavailable");
          if (value !== current.fields[key]) changes[key] = value;
        }
        if (!Object.keys(changes).length) throw new Failure("The selected category fields already match your draft.", 409, "no_changes");
        // Send only reviewed text fields. Blank values are explicit, reviewed clears.
        mayHaveWritten = true;
        await upstream(token, "/category", "PATCH", { id: input.category_id }, changes);
        const savedRaw = await upstream(token, "/category", "GET", { id: input.category_id, granularity: 2 });
        const saved = await categoryDTO(savedRaw, input.category_id);
        if (await digest(saved.fields) !== await digest({ ...current.fields, ...changes }) ||
          await digest(categoryProtected(entity(raw, "category"))) !== await digest(categoryProtected(entity(savedRaw, "category"))))
          throw new Failure("The category update was submitted but read-back did not match. Read the destination before sending another update.", 502, "verification_uncertain");
        return reply({ verified: true, category: saved });
      }
      if (!uuid(input.article_id)) throw new Failure("Choose a valid World Anvil article.");
      const raw = await upstream(token, "/article", "GET", { id: input.article_id, granularity: 2 });
      const current = await articleDTO(raw, input.article_id);
      if (input.action === "article") return reply({ article: current });
      if (input.reviewed !== true || typeof input.content !== "string" || !input.content.trim() || input.content.length > 240000 ||
        typeof input.expected_hash !== "string" || !/^[a-f0-9]{64}$/.test(input.expected_hash)) throw new Failure("Review a non-empty article draft before saving.");
      if (!current.isEditable) throw new Failure("World Anvil did not confirm permission to edit this article.", 403, "not_editable");
      if (current.state === "unknown" || current.isDraft === null || current.isWip === null)
        throw new Failure("World Anvil did not confirm the article's privacy and draft status. No update was sent.", 409, "metadata_unconfirmed");
      if (current.version_hash !== input.expected_hash) throw new Failure("The World Anvil article changed after your review. Read the latest text and review the update again.", 409, "source_changed");
      // Content is the only editable upstream field. Privacy, title, category and WIP flags are never sent.
      mayHaveWritten = true;
      await upstream(token, "/article", "PATCH", { id: input.article_id }, { content: input.content });
      const savedRaw = await upstream(token, "/article", "GET", { id: input.article_id, granularity: 2 });
      const saved = await articleDTO(savedRaw, input.article_id);
      if (saved.content !== input.content || await digest(protectedFields(entity(raw, "article"))) !== await digest(protectedFields(entity(savedRaw, "article"))))
        throw new Failure("The update was submitted but read-back did not match. Check World Anvil before sending another update.", 502, "verification_uncertain");
      return reply({ verified: true, article: saved });
    } catch (error) {
      const e = error instanceof Failure ? error : new Failure("The private connection could not complete this request.", 503, "connection_error");
      return reply({ error: e.message, code: e.code, may_have_written: mayHaveWritten, has_saved_connection: hasSavedConnection }, e.status);
    }
  };
}
