/* Safe World Anvil BBCode views. HTML is generated from an allowlist, never trusted source HTML. */
(function (root) {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tags = { b: "strong", i: "em", u: "u", s: "s", small: "small", sup: "sup", sub: "sub", mark: "mark",
    h1: "h1", h2: "h2", h3: "h3", h4: "h4", p: "p", quote: "blockquote", aloud: "blockquote", code: "code",
    ul: "ul", ol: "ol", li: "li", list: "ul", table: "table", tr: "tr", td: "td", th: "th",
    center: "div", left: "div", right: "div", justify: "div", in: "div", url: "a" };
  const singles = new Set(["br", "hr", "img", "articleblock", "world", "map", "block", "blocklink", "book", "secret", "toc", "articletoc", "breadcrumb", "roll", "youtube", "spotify", "soundcloud", "discord", "pdf", "currentdate", "user", "usercard", "follow", "tagged", "taggedblocks", "pin", "redacted", "licence", "worldmeta", "familytree", "diplomacy", "manuscript"]);
  const labels = { img: "Image", articleblock: "Article card", map: "Map", block: "Statblock", secret: "Secret", toc: "World contents", articletoc: "Article contents", container: "Custom layout", section: "Custom styling", row: "Columns", subcontainer: "Restricted content", userstate: "Audience-specific content", comment: "Hidden comment", mention: "Article link", wiki: "Article link", noparse: "Literal text" };
  let serial = 0;
  function safeUrl(value) {
    const text = String(value || "").trim();
    if (/^#[a-z0-9_-]+$/i.test(text)) return text;
    try { const u = new URL(text); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href.replace(/\[/g, "%5B").replace(/\]/g, "%5D") : ""; }
    catch (_) { return ""; }
  }
  function parse(value) {
    const source = String(value ?? "");
    const pattern = /\[noparse\][\s\S]*?\[\/noparse\]|\/\*[\s\S]*?\*\/|@\[([^\]\n]{1,500})\]\(([^)\n]{1,700})\)|\[\[([^\]\n]{1,500})\]\]|\[(\/?)([a-z][\w-]*|\*)(?:([:=|])([^\]\n]{0,2000}))?\]/gi;
    const tokens = [...source.matchAll(pattern)].map(m => ({ start: m.index, end: m.index + m[0].length, raw: m[0],
      atom: /^\[noparse\]/i.test(m[0]) ? "noparse" : m[0].startsWith("/*") ? "comment" : m[1] ? "mention" : m[3] ? "wiki" : "", label: m[1] || m[3] || "",
      closing: !!m[4], tag: (m[5] || "").toLowerCase(), arg: m[7] || "", pair: -1 }));
    const stack = []; let literalIndex = -1;
    tokens.forEach((t, i) => {
      if (literalIndex >= 0) {
        if (t.closing && t.tag === "noparse") { tokens[literalIndex].pair = i; literalIndex = -1; }
        return;
      }
      if (t.atom || singles.has(t.tag) || t.tag === "*") return;
      if (!t.closing) { if (t.tag === "noparse") literalIndex = i; else if (stack.length < 512) stack.push(i); }
      else { const at = stack.findLastIndex(index => tokens[index].tag === t.tag); if (at >= 0) { tokens[stack[at]].pair = i; stack.length = at; } }
    });
    function children(from, to, first, last, depth) {
      const result = []; let cursor = from;
      const text = end => { if (end > cursor) result.push({ tag: "text", raw: source.slice(cursor, end) }); };
      for (let i = first; i < last; i++) {
        const t = tokens[i]; if (t.start < cursor) continue;
        if (t.pair >= last || t.closing || (!t.atom && t.pair < 0 && !singles.has(t.tag) && !t.arg && t.tag !== "*")) continue;
        text(t.start);
        if (t.pair >= 0) {
          const close = tokens[t.pair], body = source.slice(t.end, close.start);
          result.push({ tag: t.tag, arg: t.arg, raw: source.slice(t.start, close.end), open: t.raw, close: close.raw, body,
            children: depth < 50 && t.tag !== "noparse" ? children(t.end, close.start, i + 1, t.pair, depth + 1) : [],
            opaque: depth >= 50 || !Object.hasOwn(tags, t.tag) });
          cursor = close.end; i = t.pair;
        } else {
          result.push({ tag: t.atom || t.tag, arg: t.arg, raw: t.raw, body: t.atom === "noparse" ? t.raw.slice(9, -10) : "", label: t.label, opaque: true }); cursor = t.end;
        }
      }
      text(to); return result;
    }
    return children(0, source.length, 0, tokens.length, 0);
  }
  function textOf(nodes) {
    return nodes.map(n => {
      if (n.tag === "text") return n.raw;
      if (n.tag === "comment") return "";
      if (n.tag === "noparse") return n.body;
      if (n.tag === "mention" || n.tag === "wiki") return n.label;
      if (n.tag === "br" || n.tag === "hr") return "\n";
      const body = n.children?.length ? textOf(n.children) : n.body || "";
      return body ? body + (/^(h[1-4]|p|li|quote|tr|ul|ol|list)$/.test(n.tag) ? "\n" : "") : "";
    }).join("");
  }
  function plainText(source) { return textOf(parse(source)).replace(/\n{3,}/g, "\n\n").trim(); }
  function literal(text) { return String(text).replace(/\[/g, "[noparse][[/noparse]").replace(/\/\*/g, "[noparse]/*[/noparse]"); }
  function createDocument(value) {
    const source = String(value ?? ""), records = new Map(), prefix = "bb" + (++serial) + "-"; let next = 0, initial = null;
    function render(n, parent = "") {
      if (n.tag === "text" && !n.raw.trim() && /^(table|tr|ul|ol|list)$/.test(parent)) return "";
      // Invalid block nesting would make the browser move nodes and duplicate source on a later edit.
      const allowed = n.tag === "table" ? ["tr"] : n.tag === "tr" ? ["td", "th"] : null;
      if ((allowed && n.children?.some(c => c.tag === "text" ? c.raw.trim() : !allowed.includes(c.tag))) ||
          (n.tag === "p" && n.children?.some(c => /^(h[1-4]|p|quote|table|ul|ol|list)$/.test(c.tag)))) n = { ...n, opaque: true };
      const id = prefix + (++next), attrs = ' data-bb-node="' + id + '"'; records.set(id, { node: n, html: null });
      if (n.tag === "text") return "<span" + attrs + ">" + esc(n.raw) + "</span>";
      if (n.tag === "br" || n.tag === "hr") return "<" + n.tag + attrs + ">";
      if (n.tag === "noparse") return '<span contenteditable="false"' + attrs + ">" + esc(n.body) + "</span>";
      if (n.opaque) {
        const title = Object.hasOwn(labels, n.tag) ? labels[n.tag] : "World Anvil " + n.tag.replace(/-/g, " ");
        const preview = n.label || (n.tag === "comment" ? "" : textOf(n.children || []).trim());
        return '<span class="wa-preserved" contenteditable="false"' + attrs + ' title="Preserved exactly for World Anvil. Use BBCode view to edit this item."><span class="wa-preserved-label">' + esc(title) +
          (preview ? '</span><span class="wa-preserved-text">' + esc(preview) : " · preserved") + "</span></span>";
      }
      let htmlTag = tags[n.tag], extra = "", body = n.children.map(child => render(child, n.tag)).join("");
      if (n.tag === "url") {
        const href = safeUrl((n.arg || textOf(n.children)).replace(/\|(?:tab|parent)$/, ""));
        if (href) extra = ' href="' + esc(href) + '" target="_blank" rel="noopener noreferrer"'; else htmlTag = "span";
      }
      if (/^(center|left|right|justify|in)$/.test(n.tag)) extra += ' class="wa-align-' + n.tag + '"';
      if (n.tag === "aloud") extra += ' class="wa-aloud"';
      if (n.tag === "list" && /^(1|a)$/i.test(n.arg)) htmlTag = "ol";
      if (["ul", "ol", "list"].includes(n.tag) && !n.children.some(c => c.tag === "li")) {
        // World Anvil also accepts one hyphen per line and legacy [*] markers.
        const items = []; let current = null, valid = true;
        for (const child of n.children) {
          if (child.tag === "*") { current = []; items.push(current); }
          else if (child.tag !== "text") { if (current) current.push(child); else valid = false; }
          else for (const piece of child.raw.split(/((?:^|\n)[ \t]*-[ \t]+)/)) {
            if (/^(?:\n)?[ \t]*-[ \t]+$/.test(piece)) { current = []; items.push(current); }
            else if (current) current.push({ tag: "text", raw: piece }); else if (piece.trim()) valid = false;
          }
        }
        if (items.length && valid) body = items.map(item => "<li>" + item.map(child => render(child)).join("") + "</li>").join("");
      }
      return "<" + htmlTag + attrs + extra + ">" + body + "</" + htmlTag + ">";
    }
    const html = parse(source).map(child => render(child)).join("");
    function bind(element) {
      for (const el of element.querySelectorAll("[data-bb-node]")) {
        const record = records.get(el.getAttribute("data-bb-node")); if (record && record.html === null) record.html = el.outerHTML;
      }
      if (initial === null) initial = element.innerHTML;
    }
    function read(element) {
      if (element.innerHTML === initial) return source;
      function visit(el) {
        if (el.nodeType === 3) return literal(el.nodeValue);
        if (el.nodeType !== 1) return "";
        const record = records.get(el.getAttribute("data-bb-node"));
        if (record && (record.node.opaque || el.outerHTML === record.html)) return record.node.raw;
        const tag = el.tagName.toLowerCase(), children = () => [...el.childNodes].map(visit).join("");
        const body = children();
        if (record && record.node.open && tags[record.node.tag] === tag && tag !== "a") return record.node.open + body + record.node.close;
        if (tag === "br") return "[br]";
        if (tag === "hr") return "[hr]";
        if (tag === "a") {
          const href = safeUrl(el.getAttribute("href"));
          const original = record?.node.arg && safeUrl(record.node.arg.replace(/\|(?:tab|parent)$/, ""));
          if (href && href === original) return record.node.open + body + record.node.close;
          return href ? "[url:" + href + "]" + body + "[/url]" : body;
        }
        if (tag === "li") return "\n- " + body;
        if (tag === "ul" || tag === "ol") return "[" + tag + "]" + body + "\n[/" + tag + "]";
        const bb = { strong: "b", b: "b", em: "i", i: "i", u: "u", s: "s", strike: "s", del: "s", small: "small", sup: "sup", sub: "sub", mark: "mark", blockquote: "quote", code: "code", pre: "code", p: "p", div: "p", h1: "h1", h2: "h2", h3: "h3", h4: "h4", table: "table", tr: "tr", td: "td", th: "th" }[tag];
        if (bb) return "[" + bb + "]" + body + "[/" + bb + "]";
        let styled = body;
        if (el.style?.fontWeight === "bold" || Number(el.style?.fontWeight) >= 600) styled = "[b]" + styled + "[/b]";
        if (el.style?.fontStyle === "italic") styled = "[i]" + styled + "[/i]";
        if (el.style?.textDecorationLine?.includes("underline")) styled = "[u]" + styled + "[/u]";
        return styled;
      }
      if (!element.textContent && element.childNodes.length === 1 && element.firstChild?.nodeName === "BR") return "";
      return [...element.childNodes].map(visit).join("");
    }
    return { source, html, records, bind, read };
  }
  const views = new WeakMap();
  function copy(event, element, doc) {
    const selection = element.ownerDocument.defaultView.getSelection();
    if (!event.clipboardData || !selection.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.commonAncestorContainer)) return;
    let fragment = range.cloneContents(), ancestor = range.commonAncestorContainer;
    if (ancestor.nodeType === 3) ancestor = ancestor.parentNode;
    const container = element.ownerDocument.createElement("div");
    let preserved = null;
    while (ancestor && ancestor !== element) {
      const record = doc.records.get(ancestor.getAttribute?.("data-bb-node"));
      if (record?.node.opaque) { preserved = record.node.raw; break; }
      if (/^(SPAN|STRONG|B|EM|I|U|S|A|MARK|SMALL|SUP|SUB|CODE)$/.test(ancestor.tagName)) {
        const wrapper = ancestor.cloneNode(false); wrapper.appendChild(fragment); fragment = wrapper;
      }
      ancestor = ancestor.parentNode;
    }
    container.appendChild(fragment);
    const bb = preserved ?? doc.read(container);
    event.clipboardData.setData("application/x-driftmark-bbcode", bb);
    event.clipboardData.setData("text/plain", plainText(bb)); event.preventDefault();
  }
  function show(element, source) {
    if (views.get(element)?.source === String(source ?? "")) return;
    const doc = createDocument(source); element.innerHTML = doc.html; doc.bind(element); views.set(element, doc);
    if (!element.dataset.bbCopy) { element.dataset.bbCopy = "1"; element.addEventListener("copy", event => copy(event, element, views.get(element))); }
  }
  const api = { parse, render: source => createDocument(source).html, plainText, safeUrl, createDocument, show, copy };
  if (typeof module === "object" && module.exports) module.exports = api; else root.DriftmarkFormat = api;
})(typeof window === "object" ? window : globalThis);
