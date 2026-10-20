/* ORBIT Journal v1.2 — multi-mode private writing with private MFA-gated Supabase storage.
 * Separate from PULSE and ORBIT local workspace sync. Never caches journal text in localStorage. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const form = $("journal-form");
  if (!form) return;

  const search = $("journal-search");
  const kindFilter = $("journal-kind-filter");
  const promptPanel = $("journal-prompt-panel");
  const promptHeading = $("journal-prompt-heading");
  const promptText = $("journal-prompt-text");
  const promptNext = $("journal-prompt-next");
  const modeHint = $("journal-mode-hint");
  const editorTitle = $("journal-editor-title");
  const tarotPanel = $("journal-tarot");
  const tarotCardsHost = $("journal-tarot-cards");
  const tarotSpread = $("journal-tarot-spread");
  const tarotAdd = $("journal-tarot-add");
  const bodyLabel = $("journal-body-label");
  const feedbackCopy = $("journal-feedback-copy");
  const feedbackFocus = $("journal-feedback-focus");
  const feedbackStatus = $("journal-feedback-status");
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

  // Hand-authored, deterministic prompts: no external AI or API key is required.
  const MODES = {
    reflection: {
      label: "Self-reflection", heading:"A question to explore",
      hint:"A place to be curious about yourself. Answer only what feels useful.",
      placeholder:"Start wherever the question takes you. You don't need a perfect answer.",
      prompts:[
        "What has been taking up the most space in your mind lately, and why?",
        "When did you feel most like yourself recently?",
        "What is something you handled differently than you would have a year ago?",
        "What emotion have you been avoiding, and what might it be asking for?",
        "What has been easier lately? What has been harder?",
        "Where did you set a boundary that mattered to you?",
        "What is a belief about yourself you might be ready to reconsider?",
        "What part of your day felt genuinely satisfying?",
        "What do you wish you had said in a recent conversation?",
        "Where are you spending energy that you would rather spend elsewhere?",
        "What is one thing you want to stop measuring yourself against?",
        "What small change would make the next week feel more intentional?",
        "What does feeling safe and settled look like to you right now?",
        "When did curiosity lead you somewhere unexpected?",
        "What have you learned from a recent disappointment?",
        "What are you proud of that might go unnoticed by anyone else?",
        "What do you need more of in your everyday life?",
        "What would you tell the version of yourself from six months ago?",
        "What feels unfinished, and what would taking one step look like?",
        "What has surprised you about yourself this month?"
      ]
    },
    story: {
      label:"Story practice", heading:"Your writing challenge",
      hint:"Try a scene, dialogue, or opening paragraph. The prompt belongs to this entry even if you change it later.",
      placeholder:"Write the scene. Follow the interesting detail; editing can come later.",
      prompts:[
        "A stranger leaves a key on your table and says, 'You already know which door.' Begin the scene.",
        "Write a conversation in which both people want the same thing, but neither will admit it.",
        "Describe a city where everyone must tell the truth after sunset. Show someone trying not to.",
        "A character receives a letter addressed to their childhood imaginary friend.",
        "Write a scene with a major betrayal, but never use the word 'betrayal.'",
        "Someone inherits a house where every room is a different season.",
        "Open a story with the sentence: 'The last train arrived carrying only one passenger.'",
        "Write about a person who discovers their reflection has been practicing different expressions.",
        "Two rivals are trapped together during a storm. Let the dialogue reveal their history.",
        "A shop sells memories but refuses to purchase one particular memory. Show why.",
        "Write a scene set at a dinner party where every guest has a secret agenda.",
        "A detective finds evidence that points to a crime that will happen tomorrow.",
        "Describe an ordinary walk that slowly becomes unsettling, without showing anything supernatural.",
        "An apprentice mage accidentally casts a spell that makes a town forget one word.",
        "Write from the viewpoint of a creature who has mistaken a human for a mythical being.",
        "A person wakes in a borrowed body with a note reading, 'Do not trust the owner.'",
        "Write the same argument twice: once from each character's point of view.",
        "At a market, a merchant offers to trade you a single extra hour of life. What is the price?",
        "A warrior returns home to find the war has been erased from everyone's memory.",
        "Write a scene where an unexpected act of kindness changes the stakes of a conflict."
      ]
    },
    dream: {
      label:"Dream log", heading:"",
      hint:"Capture fragments quickly: people, places, feelings, strange details, or how it ended. It doesn't have to make sense.",
      placeholder:"I remember... Where was I? Who was there? What happened? How did it feel when I woke?",
      prompts:[]
    },
    gratitude: {
      label:"Gratitude", heading:"A small thing worth keeping",
      hint:"Notice something good without forcing a positive spin on the whole day.",
      placeholder:"What is something you'd like to remember or appreciate?",
      prompts:[
        "What ordinary comfort are you grateful to have today?",
        "Who did something thoughtful for you recently, even something small?",
        "What moment made today a little better?",
        "What ability or skill are you glad you have developed?",
        "What part of your home feels most comforting right now?",
        "What is something in nature you noticed and appreciated?",
        "What challenge has shown you a strength you didn't know you had?",
        "What small freedom in your life do you appreciate?",
        "What made you laugh unexpectedly?",
        "What is one thing your past self did that you can thank them for?",
        "What experience are you glad you said yes to?",
        "What is something good you can look forward to?"
      ]
    },
    freewrite: {
      label:"Free writing", heading:"",
      hint:"No format, no prompt, no expectations. You decide what belongs here.",
      placeholder:"What's on your mind? Write as much or as little as you like…",
      prompts:[]
    },
    tarot: {
      label:"Tarot journal", heading:"",
      hint:"Record a spread, the cards and your personal interpretation. Tarot is a reflection tool, not a factual prediction.",
      placeholder:"What stands out in these cards? How does the reading connect with your question, feelings or choices?",
      prompts:[]
    }
  };

  // Rider–Waite–Smith-style naming is used for a searchable 78-card log.
  // Cards are manually selected: no draws, predictions, account connections or AI costs.
  const TAROT_MAJOR = [
    "The Fool","The Magician","The High Priestess","The Empress","The Emperor",
    "The Hierophant","The Lovers","The Chariot","Strength","The Hermit",
    "Wheel of Fortune","Justice","The Hanged Man","Death","Temperance",
    "The Devil","The Tower","The Star","The Moon","The Sun","Judgement","The World"
  ];
  const TAROT_RANKS = ["Ace","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Page","Knight","Queen","King"];
  const TAROT_CARDS = TAROT_MAJOR.concat(["Wands","Cups","Swords","Pentacles"]
    .flatMap(suit => TAROT_RANKS.map(rank => rank + " of " + suit)));
  const TAROT_SPREADS = {
    single:["Single card"],
    past_present_future:["Past","Present","Future"],
    situation_action_outcome:["Situation","Action","Outcome"],
    five_card:["Situation","Challenge","Underlying influence","Guidance","Possible direction"],
    custom:["Card 1"]
  };
  const safeSpread = value => Object.hasOwn(TAROT_SPREADS, value) ? value : "single";
  const safeTarotData = data => data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const tarotLabel = (tag, title) => {
    const label = document.createElement("label");
    label.textContent = title;
    const field = document.createElement(tag);
    label.append(field);
    return [label,field];
  };
  function readTarotCards() {
    return [...tarotCardsHost.querySelectorAll(".journal-tarot-card")].map(row => ({
      position:row.querySelector('[data-tarot-field="position"]').value,
      card:row.querySelector('[data-tarot-field="card"]').value,
      orientation:row.querySelector('[data-tarot-field="orientation"]').value,
      meaning:row.querySelector('[data-tarot-field="meaning"]').value
    }));
  }
  function addTarotCard(card, index, spread) {
    const row = document.createElement("div");
    row.className = "journal-tarot-card";
    const head = document.createElement("div");
    head.className = "journal-tarot-card-head";
    const number = document.createElement("strong");
    number.textContent = "Card " + (index + 1);
    head.append(number);
    if (spread === "custom") {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "journal-tarot-remove";
      remove.textContent = "Remove";
      remove.dataset.tarotRemove = String(index);
      head.append(remove);
    }
    const grid = document.createElement("div");
    grid.className = "journal-tarot-card-grid";
    const [positionLabel,position] = tarotLabel("input","Position");
    position.dataset.tarotField = "position";
    position.maxLength = 100;
    position.value = spread === "custom" ? (card?.position || "Card " + (index + 1)) : TAROT_SPREADS[spread][index];
    position.readOnly = spread !== "custom";
    const [cardLabel,cardSelect] = tarotLabel("select","Card drawn");
    cardSelect.dataset.tarotField = "card";
    const blank = new Option("Select card…","");
    cardSelect.add(blank);
    for (const name of TAROT_CARDS) cardSelect.add(new Option(name,name));
    cardSelect.value = TAROT_CARDS.includes(card?.card) ? card.card : "";
    const [orientationLabel,orientation] = tarotLabel("select","Orientation");
    orientation.dataset.tarotField = "orientation";
    orientation.add(new Option("Upright","upright"));
    orientation.add(new Option("Reversed","reversed"));
    orientation.value = card?.orientation === "reversed" ? "reversed" : "upright";
    const [meaningLabel,meaning] = tarotLabel("textarea","Your interpretation (optional)");
    meaning.dataset.tarotField = "meaning";
    meaning.rows = 2;
    meaning.maxLength = 700;
    meaning.placeholder = "What does this card mean to you in this position?";
    meaning.value = card?.meaning || "";
    grid.append(positionLabel,cardLabel,orientationLabel);
    meaningLabel.className = "journal-tarot-card-meaning";
    row.append(head,grid,meaningLabel);
    tarotCardsHost.append(row);
  }
  function renderTarot(data, keepCards = false) {
    const saved = safeTarotData(data);
    const spread = safeSpread(form.elements.tarot_spread.value);
    const previous = keepCards ? readTarotCards() : (Array.isArray(saved.cards) ? saved.cards : []);
    const positions = spread === "custom"
      ? previous.slice(0,7).length ? previous.slice(0,7) : [{position:"Card 1"}]
      : TAROT_SPREADS[spread].map((position,i) => ({...previous[i],position}));
    tarotCardsHost.replaceChildren();
    positions.forEach((item,i) => addTarotCard(item,i,spread));
    tarotAdd.hidden = spread !== "custom";
    tarotAdd.disabled = busy || !owner || positions.length >= 7;
  }
  function populateTarot(data) {
    const saved = safeTarotData(data);
    form.elements.tarot_question.value = typeof saved.question === "string" ? saved.question : "";
    form.elements.tarot_deck.value = typeof saved.deck === "string" ? saved.deck : "";
    form.elements.tarot_spread.value = safeSpread(saved.spread);
    renderTarot(saved);
  }
  function collectTarot() {
    if (activeKind !== "tarot") return {};
    const spread = safeSpread(form.elements.tarot_spread.value);
    const question = form.elements.tarot_question.value.trim();
    const deck = form.elements.tarot_deck.value.trim();
    const cards = readTarotCards().map(x => ({
      position:x.position.trim(),card:x.card,orientation:x.orientation,meaning:x.meaning.trim()
    }));
    if (!cards.length || cards.length > 7) throw new Error("Choose between one and seven cards.");
    if (cards.some(x => !x.position || !TAROT_CARDS.includes(x.card)))
      throw new Error("Choose a tarot card and position for every slot.");
    return {spread,question,deck,cards};
  }
  function feedbackRequestText() {
    const writing = form.elements.body.value.trim();
    if (!writing) throw new Error("Write something before requesting feedback.");
    const choices = {
      story:"Evaluate narrative craft, character motivation, pacing, imagery and what holds attention.",
      style:"Focus on clarity, sentence-level style, rhythm and flow.",
      dialogue:"Focus on dialogue realism, subtext, voice and characterization.",
      structure:"Focus on progression, organization, transitions and overall coherence.",
      reflective:"Ask two or three thoughtful, nonjudgmental questions. Do not diagnose, interpret dreams as fact, or predict the future."
    };
    const request = choices[feedbackFocus.value] || choices.style;
    const tarotSummary = activeKind === "tarot"
      ? "\nTarot cards (for reflection only):\n" + readTarotCards().map(x =>
          x.position + ": " + (x.card || "(not selected)") + " (" + x.orientation + ")" +
          (x.meaning.trim() ? " — " + x.meaning.trim() : "")).join("\n")
      : "";
    return [
      "Please give me constructive, specific feedback on this piece of writing.",
      request,
      "Start with two strengths. Then give up to three actionable improvements with examples. Preserve my voice, do not rewrite the entire piece without asking, and keep feedback encouraging but substantive.",
      "This is a writing critique, not therapy, prophecy or a request to diagnose me.",
      "",
      "Journal type: " + MODES[activeKind].label,
      "Title: " + (form.elements.title.value.trim() || "Untitled"),
      activePrompt ? "Original writing prompt: " + activePrompt : "",
      tarotSummary,
      "My writing:",
      writing
    ].filter(line => line !== "").join("\n");
  }
  async function copyFeedbackRequest() {
    if (!owner || busy) return;
    feedbackStatus.textContent = "";
    try {
      const message = feedbackRequestText();
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable in this browser.");
      await navigator.clipboard.writeText(message);
      feedbackStatus.textContent = "Copied. Paste into ChatGPT only if you want to share this writing for feedback. Nothing has been sent automatically.";
    } catch (error) {
      feedbackStatus.textContent = error.message || "Could not copy. Try a different browser.";
    }
  }

  const normalizeKind = value => Object.hasOwn(MODES,value) ? value : "freewrite";
  function firstPrompt(kind) {
    const bank = MODES[kind]?.prompts || [];
    if (!bank.length) return "";
    // Local-calendar-day rotation. Prompts repeat only after their category's full cycle.
    const day = Math.floor(Date.parse(today()+"T00:00:00Z") / 86400000);
    return bank[((day % bank.length) + bank.length) % bank.length];
  }
  function renderMode() {
    const config = MODES[activeKind];
    document.querySelectorAll("[data-journal-mode]").forEach(button => {
      const selected = button.dataset.journalMode === activeKind;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-current", selected ? "true" : "false");
    });
    editorTitle.textContent = activeId ? "Edit " + config.label.toLowerCase() : config.label;
    modeHint.textContent = config.hint;
    form.elements.body.placeholder = config.placeholder;
    promptPanel.hidden = !activePrompt;
    promptHeading.textContent = config.heading || "Writing prompt";
    promptText.textContent = activePrompt;
    promptNext.disabled = !owner || busy || !config.prompts.length;
    promptNext.hidden = !config.prompts.length;
    tarotPanel.hidden = activeKind !== "tarot";
    bodyLabel.textContent = activeKind === "tarot" ? "Reading reflection / personal interpretation" : "Journal entry";
  }

  let owner = "", db = null, entries = [], activeId = null, version = null;
  let activeKind = "freewrite", activePrompt = "";
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
    const onlyKind = kindFilter.value;
    const matches = entries.filter(e => (onlyKind === "all" || normalizeKind(e.entry_kind) === onlyKind) &&
      (!q || [e.title, e.body, e.writing_prompt, MODES[normalizeKind(e.entry_kind)].label,
        e.feedback_notes || "", JSON.stringify(e.tarot_data || {}), (e.tags || []).join(" ")]
        .join(" ").toLowerCase().includes(q)));
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
      list.textContent = q || onlyKind !== "all" ? "No entries match your filters." : "No entries yet. Pick a writing mode to get started.";
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
      date.textContent = displayDate(entry.entry_date) + " · " + MODES[normalizeKind(entry.entry_kind)].label;
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
    promptNext.disabled = !owner || busy || !MODES[activeKind].prompts.length;
    tarotAdd.disabled = !owner || busy || readTarotCards().length >= 7;
    feedbackCopy.disabled = !owner || busy;
  }
  function warnIfDirty() {
    return dirty && !window.confirm("You have unsaved journal changes. Discard them?");
  }
  function openEntry(entry, requestedKind = "freewrite") {
    if (warnIfDirty()) return;
    activeId = entry?.id || null;
    version = entry?.updated_at || null;
    activeKind = normalizeKind(entry?.entry_kind || requestedKind);
    activePrompt = entry ? (entry.writing_prompt || "") : firstPrompt(activeKind);
    form.elements.entry_date.value = entry?.entry_date || today();
    form.elements.title.value = entry?.title || "";
    form.elements.body.value = entry?.body || "";
    form.elements.tags.value = (entry?.tags || []).join(", ");
    form.elements.feedback_notes.value = entry?.feedback_notes || "";
    feedbackFocus.value = activeKind === "story" ? "story" : "reflective";
    feedbackStatus.textContent = "Nothing is sent automatically. Copy a request only if you choose to share your writing.";
    populateTarot(entry?.tarot_data);
    dirty = false;
    selectedLabel.textContent = entry ? "Editing " + displayDate(entry.entry_date) : "New " + MODES[activeKind].label.toLowerCase() + " entry";
    deleteButton.hidden = !entry;
    status(entry ? "Saved privately. Make changes, then select Save." : "Choose what to write. Select Save entry when ready.");
    renderMode();
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
    dirty = false;
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
          .select("id,entry_date,title,body,tags,entry_kind,writing_prompt,feedback_notes,tarot_data,created_at,updated_at")
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
      let tarotData;
      try { tarotData = collectTarot(); }
      catch (error) { status(error.message, true); return; }
      const payload = {entry_date:entryDate, title, body, tags, entry_kind:activeKind,
        writing_prompt:activePrompt,feedback_notes:form.elements.feedback_notes.value,tarot_data:tarotData};
      const query = selected
        ? client.from("orbit_journal_entries").update(payload).eq("id", selected).eq("owner_id", id).eq("updated_at", lastVersion)
        : client.from("orbit_journal_entries").insert({...payload, owner_id:id});
      const {data, error} = await query.select("id,entry_date,title,body,tags,entry_kind,writing_prompt,feedback_notes,tarot_data,created_at,updated_at").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("This entry changed on another device. Copy your unsaved text, then reload the journal before saving.");
      if (owner !== id || db !== client || stamp !== epoch) return;
      entries = [data, ...entries.filter(e => e.id !== data.id)];
      sorted();
      activeId = data.id;
      version = data.updated_at;
      dirty = false;
      selectedLabel.textContent = "Editing " + displayDate(data.entry_date);
      renderMode();
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
    const data = {format:"orbit-journal-v3", exported_at:new Date().toISOString(),
      entries:entries.map(e => ({entry_date:e.entry_date, entry_kind:normalizeKind(e.entry_kind),
        writing_prompt:e.writing_prompt || "", title:e.title, body:e.body, tags:e.tags,
        feedback_notes:e.feedback_notes || "",tarot_data:e.tarot_data || {},
        created_at:e.created_at, updated_at:e.updated_at}))};
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
    activeKind = "freewrite";
    activePrompt = "";
    busy = false;
    loaded = false;
    fullyLoaded = false;
    search.value = "";
    form.reset();
    form.elements.entry_date.value = today();
    deleteButton.hidden = true;
    selectedLabel.textContent = id ? "Private journal" : "Sign in to open the Journal";
    kindFilter.value = "all";
    renderMode();
    status(id ? "Checking your private journal…" : "Sign in with your ORBIT account to access private entries.");
    renderFields();
    renderList();
    if (id) void refresh();
  }
  form.addEventListener("submit", save);
  form.addEventListener("input", () => { if (owner && !busy) { dirty = true; status("Unsaved changes · select Save entry to keep them."); } });
  $("journal-new").addEventListener("click", () => openEntry(null, "freewrite"));
  document.querySelectorAll("[data-journal-mode]").forEach(button => {
    button.addEventListener("click", () => openEntry(null, normalizeKind(button.dataset.journalMode)));
  });
  promptNext.addEventListener("click", () => {
    const bank = MODES[activeKind].prompts;
    if (!bank.length || busy) return;
    const index = bank.indexOf(activePrompt);
    activePrompt = bank[(index + 1 + bank.length) % bank.length];
    dirty = true;
    renderMode();
    status("New prompt selected. It will be saved together with your entry.");
  });
  $("journal-reload").addEventListener("click", () => { if (!busy) void refresh(); });
  deleteButton.addEventListener("click", remove);
  exportButton.addEventListener("click", downloadBackup);
  search.addEventListener("input", renderList);
  kindFilter.addEventListener("change", renderList);
  feedbackCopy.addEventListener("click", () => { void copyFeedbackRequest(); });
  tarotSpread.addEventListener("change", () => { renderTarot({},true); dirty = true; status("Spread changed — save to keep it."); });
  tarotAdd.addEventListener("click", () => {
    if (form.elements.tarot_spread.value !== "custom" || busy) return;
    const prev = readTarotCards();
    if (prev.length >= 7) return;
    renderTarot({cards:[...prev,{position:"Card " + (prev.length + 1)}]},false);
    dirty = true;
    status("Card added — save to keep this spread.");
  });
  tarotCardsHost.addEventListener("click", event => {
    const remove = event.target.closest("[data-tarot-remove]");
    if (!remove || form.elements.tarot_spread.value !== "custom" || busy) return;
    const prev = readTarotCards();
    if (prev.length <= 1) return;
    const index = Number(remove.dataset.tarotRemove);
    renderTarot({cards:prev.filter((_,i) => i !== index)},false);
    dirty = true;
    status("Card removed — save to keep this spread.");
  });
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