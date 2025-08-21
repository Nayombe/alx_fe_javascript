/* ==============================
   Dynamic Quote Generator — Sync + Conflict Resolution
   ============================== */

/** ---------- Storage Keys ---------- */
const LS_QUOTES_KEY = "dqg_quotes_sync_v1";
const LS_LAST_FILTER = "dqg_last_filter_sync_v1"; // 'all' or category
const SS_LAST_QUOTE = "dqg_last_quote_sync_v1";

/** ---------- Mock Server (JSONPlaceholder) ---------- */
const SERVER_ENDPOINT = "https://jsonplaceholder.typicode.com/posts";
const SYNC_INTERVAL_MS = 30000; // 30s periodic sync

/** ---------- Types ----------
 * @typedef {{id:string,text:string,category:string,source:'local'|'server'|'seed',updatedAt:string,synced?:boolean,serverId?:number}} Quote
 */

/** ---------- State ---------- */
let quotes = /** @type {Quote[]} */([]);
let conflicts = []; // { id, local: Quote, server: Quote }

/** ---------- DOM ---------- */
const noticeEl = document.getElementById("notice");
const quoteDisplay = document.getElementById("quoteDisplay");
const quoteList = document.getElementById("quoteList");
const categoryFilter = document.getElementById("categoryFilter");
const btnRandom = document.getElementById("btnRandom");
const btnSync = document.getElementById("btnSync");
const btnToggleConflicts = document.getElementById("btnToggleConflicts");
const btnClear = document.getElementById("btnClear");
const addFormMount = document.getElementById("addFormMount");
const conflictsPanel = document.getElementById("conflictsPanel");
const conflictsList = document.getElementById("conflictsList");

/** ---------- Defaults ---------- */
const DEFAULT_QUOTES = [
  { id: "seed-1", text: "The best way to predict the future is to invent it.", category: "Inspiration", source: "seed", updatedAt: new Date().toISOString(), synced: true },
  { id: "seed-2", text: "Life is what happens when you're busy making other plans.", category: "Life", source: "seed", updatedAt: new Date().toISOString(), synced: true },
  { id: "seed-3", text: "Simplicity is the ultimate sophistication.", category: "Wisdom", source: "seed", updatedAt: new Date().toISOString(), synced: true },
  { id: "seed-4", text: "Do not go where the path may lead; go instead where there is no path and leave a trail.", category: "Motivation", source: "seed", updatedAt: new Date().toISOString(), synced: true }
];

/** ---------- Utils ---------- */
const sanitize = (s) => String(s ?? "").trim();
const k = (q) => `${sanitize(q.category).toLowerCase()}||${sanitize(q.text).toLowerCase()}`;
function cryptoRandom() {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0].toString(36); }
  catch { return Math.floor(Math.random()*1e9).toString(36); }
}
function dedupeQuotes(arr) {
  const map = new Map();
  for (const q of arr) {
    const text = sanitize(q.text); const category = sanitize(q.category);
    if (!text || !category) continue;
    const norm = {
      id: q.id || `fix-${cryptoRandom()}`,
      text, category,
      source: q.source || "local",
      updatedAt: q.updatedAt || new Date().toISOString(),
      synced: !!q.synced,
      serverId: q.serverId ?? undefined
    };
    map.set(k(norm), norm);
  }
  return [...map.values()];
}

/** ---------- Storage ---------- */
function saveQuotes() {
  localStorage.setItem(LS_QUOTES_KEY, JSON.stringify(quotes));
}
function loadQuotes() {
  try {
    const raw = localStorage.getItem(LS_QUOTES_KEY);
    quotes = raw ? dedupeQuotes(JSON.parse(raw)) : dedupeQuotes(DEFAULT_QUOTES);
  } catch {
    quotes = dedupeQuotes(DEFAULT_QUOTES);
  }
  saveQuotes(); // normalize on load
}
function saveLastFilter(cat) { localStorage.setItem(LS_LAST_FILTER, cat); }
function loadLastFilter() { return localStorage.getItem(LS_LAST_FILTER) || "all"; }
function saveLastQuote(q) { try { sessionStorage.setItem(SS_LAST_QUOTE, JSON.stringify(q)); } catch {} }
function loadLastQuote() { try { const r = sessionStorage.getItem(SS_LAST_QUOTE); return r ? JSON.parse(r) : null; } catch { return null; } }

/** ---------- UI Helpers ---------- */
function showNotice(message, type = "info", ms = 3000) {
  noticeEl.textContent = message;
  noticeEl.className = `notice ${type} card show`;
  if (ms > 0) setTimeout(() => noticeEl.classList.remove("show"), ms);
}

/** ---------- Categories + Filter ---------- */
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))].sort((a,b)=>a.localeCompare(b));
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat; opt.textContent = cat;
    categoryFilter.appendChild(opt);
  }
  // Restore last filter
  const saved = loadLastFilter();
  categoryFilter.value = (saved === "all" || categories.includes(saved)) ? saved : "all";
}

/** Per requirement: expose filterQuotes and use selectedCategory variable */
function filterQuotes() {
  const selectedCategory = categoryFilter.value; // <- required name
  saveLastFilter(selectedCategory);
  renderQuoteList(selectedCategory);
  // Keep the random display in sync
  if (selectedCategory !== "all") {
    const pool = quotes.filter(q => q.category === selectedCategory);
    if (pool.length) {
      const random = pool[Math.floor(Math.random() * pool.length)];
      quoteDisplay.textContent = `“${random.text}” — ${random.category}`;
      saveLastQuote(random);
    } else {
      quoteDisplay.textContent = "No quotes available in this category ❗";
    }
  } else if (quotes.length) {
    const random = quotes[Math.floor(Math.random() * quotes.length)];
    quoteDisplay.textContent = `“${random.text}” — ${random.category}`;
    saveLastQuote(random);
  } else {
    quoteDisplay.textContent = "No quotes available. Add some!";
  }
}

/** ---------- Rendering ---------- */
function renderQuoteList(selectedCategory = loadLastFilter()) {
  const pool = selectedCategory === "all" ? quotes : quotes.filter(q => q.category === selectedCategory);
  quoteList.innerHTML = "";
  if (!pool.length) {
    const li = document.createElement("li");
    li.className = "quote-item";
    li.innerHTML = `<div class="quote-text">No quotes found for “${selectedCategory === "all" ? "All" : selectedCategory}”</div>`;
    quoteList.appendChild(li);
    return;
  }
  for (const q of pool) {
    const li = document.createElement("li");
    li.className = "quote-item";
    const left = document.createElement("div");
    left.innerHTML = `<div class="quote-text">“${q.text}”</div>
                      <div class="quote-meta">Category: <b>${q.category}</b> • Source: ${q.source}</div>`;
    const right = document.createElement("div");
    const del = document.createElement("button");
    del.className = "btn-danger"; del.textContent = "Remove";
    del.addEventListener("click", () => {
      quotes = quotes.filter(x => x.id !== q.id);
      saveQuotes(); populateCategories(); renderQuoteList(categoryFilter.value);
      showNotice("Quote removed.", "ok");
    });
    right.appendChild(del);
    li.append(left, right);
    quoteList.appendChild(li);
  }
}

/** ---------- Random Quote ---------- */
function showRandomQuote() {
  const selectedCategory = categoryFilter.value; // <- required name
  const pool = selectedCategory === "all" ? quotes : quotes.filter(q => q.category === selectedCategory);
  if (!pool.length) { quoteDisplay.textContent = "No quotes available in this category ❗"; return; }
  const random = pool[Math.floor(Math.random() * pool.length)];
  quoteDisplay.textContent = `“${random.text}” — ${random.category}`;
  saveLastQuote(random);
}

/** ---------- Add Quote (updates categories & storage) ---------- */
function addQuote() {
  const textEl = document.getElementById("newQuoteText");
  const catEl = document.getElementById("newQuoteCategory");
  const text = sanitize(textEl.value);
  const category = sanitize(catEl.value);
  if (!text || !category) { alert("Please enter both quote and category ❗"); return; }

  const newQ = {
    id: `local-${Date.now()}-${cryptoRandom()}`,
    text, category, source: "local",
    updatedAt: new Date().toISOString(),
    synced: false
  };
  if (quotes.some(q => k(q) === k(newQ))) { alert("That exact quote already exists."); return; }

  quotes.push(newQ); saveQuotes(); populateCategories(); renderQuoteList(categoryFilter.value);
  textEl.value = ""; catEl.value = ""; showNotice("Quote added ✔️", "ok");
}

/** ---------- Dynamic Add Quote Form ---------- */
function createAddQuoteForm() {
  const container = document.createElement("div");
  container.className = "card form-container";
  const title = document.createElement("h3"); title.textContent = "Add a New Quote";
  const row = document.createElement("div"); row.className = "row";
  const inputText = document.createElement("input");
  inputText.type = "text"; inputText.id = "newQuoteText"; inputText.placeholder = "Enter a new quote";
  const inputCat = document.createElement("input");
  inputCat.type = "text"; inputCat.id = "newQuoteCategory"; inputCat.placeholder = "Enter quote category";
  const btn = document.createElement("button");
  btn.textContent = "Add Quote"; btn.addEventListener("click", addQuote);
  row.append(inputText, inputCat, btn); container.append(title, row);
  addFormMount.innerHTML = ""; addFormMount.appendChild(container);
}

/** ---------- Server Sync & Conflict Resolution ---------- */
async function fetchServerQuotes() {
  // Map JSONPlaceholder posts -> Quote[]
  const res = await fetch(SERVER_ENDPOINT);
  const posts = await res.json();
  return posts.slice(0, 20).map(p => ({
    id: `server-${p.id}`,
    serverId: p.id,
    text: sanitize(p.title || `Post #${p.id}`),
    category: `Server-${p.userId}`,
    source: "server",
    updatedAt: new Date().toISOString(),
    synced: true
  }));
}

function detectConflicts(localArr, serverArr) {
  const byId = new Map(localArr.map(q => [q.id, q]));
  const found = [];
  for (const s of serverArr) {
    const match = byId.get(s.id);
    if (match && (match.text !== s.text || match.category !== s.category)) {
      found.push({ id: s.id, local: match, server: s });
    } else {
      // semantic conflict: same text, different category
      const sameText = localArr.find(q => sanitize(q.text).toLowerCase() === sanitize(s.text).toLowerCase() && q.category !== s.category);
      if (sameText) found.push({ id: s.id, local: sameText, server: s });
    }
  }
  return found;
}

function applyServerWins(localArr, serverArr) {
  const map = new Map(localArr.map(q => [q.id, q]));
  for (const s of serverArr) {
    const exists = map.get(s.id);
    if (!exists) map.set(s.id, s);
    else map.set(s.id, { ...s }); // overwrite — server wins
  }
  return dedupeQuotes([...map.values()]);
}

function renderConflicts() {
  conflictsList.innerHTML = "";
  btnToggleConflicts.textContent = `Conflicts (${conflicts.length})`;
  if (!conflicts.length) {
    conflictsList.innerHTML = `<div class="muted">No conflicts 🎉</div>`;
    return;
  }
  for (const c of conflicts) {
    const wrap = document.createElement("div");
    wrap.className = "conflict-item";
    wrap.innerHTML = `
      <div><b>ID:</b> ${c.id}</div>
      <div style="margin-top:6px;"><b>Server:</b> “${c.server.text}” <i>(${c.server.category})</i></div>
      <div><b>Local:</b> “${c.local.text}” <i>(${c.local.category})</i></div>
    `;
    const row = document.createElement("div"); row.className = "row";
    const useServer = document.createElement("button");
    useServer.className = "btn-ok"; useServer.textContent = "Use Server Version";
    useServer.addEventListener("click", () => {
      quotes = quotes.map(q => q.id === c.id ? { ...c.server } : q);
      saveQuotes(); renderQuoteList(categoryFilter.value);
      conflicts = conflicts.filter(x => x !== c); renderConflicts();
      showNotice("Conflict resolved: server version applied.", "ok");
    });
    const keepLocal = document.createElement("button");
    keepLocal.className = "btn-warn"; keepLocal.textContent = "Keep Local Version";
    keepLocal.addEventListener("click", () => {
      quotes = quotes.map(q => q.id === c.id ? { ...c.local, synced: false } : q);
      saveQuotes(); renderQuoteList(categoryFilter.value);
      conflicts = conflicts.filter(x => x !== c); renderConflicts();
      showNotice("Conflict resolved: kept local version (will try to re-sync).", "warn");
    });
    row.append(useServer, keepLocal); wrap.appendChild(row);
    conflictsList.appendChild(wrap);
  }
}

async function pushLocalChangesToServer() {
  // Simulate POST for unsynced local quotes (JSONPlaceholder won't persist, but we simulate ack)
  const unsynced = quotes.filter(q => q.source === "local" && !q.synced);
  for (const q of unsynced) {
    try {
      const res = await fetch(SERVER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: q.text, body: q.category, userId: 1 })
      });
      if (res.ok) {
        const created = await res.json();
        q.synced = true;
        q.serverId = created.id;
      }
    } catch { /* ignore network errors for simulation */ }
  }
  saveQuotes();
}

async function syncWithServer() {
  try {
    showNotice("Syncing with server...", "info", 1500);
    const serverQuotes = await fetchServerQuotes();

    // 1) Detect conflicts BEFORE merge
    conflicts = detectConflicts(quotes, serverQuotes);

    // 2) Default policy: server wins (auto-merge)
    quotes = applyServerWins(quotes, serverQuotes);
    saveQuotes(); populateCategories(); renderQuoteList(categoryFilter.value); renderConflicts();

    // 3) Push remaining local deltas (best-effort)
    await pushLocalChangesToServer();

    showNotice(`Sync complete. Merged ${serverQuotes.length} server items.`, "ok", 2400);
  } catch {
    showNotice("Sync failed. Check your connection.", "warn", 3000);
  }
}

/** ---------- Init ---------- */
function init() {
  loadQuotes();
  populateCategories();
  renderQuoteList(loadLastFilter());
  createAddQuoteForm();

  // Restore last viewed quote if available
  const last = loadLastQuote();
  if (last) quoteDisplay.textContent = `“${last.text}” — ${last.category}`;

  // Events
  btnRandom.addEventListener("click", showRandomQuote);
  btnClear.addEventListener("click", () => {
    if (!confirm("This will remove ALL quotes from local storage. Continue?")) return;
    quotes = []; saveQuotes(); populateCategories(); renderQuoteList("all");
    quoteDisplay.textContent = "All quotes cleared. Add some new ones!";
    showNotice("All quotes cleared.", "warn");
  });
  btnSync.addEventListener("click", syncWithServer);
  btnToggleConflicts.addEventListener("click", () => {
    const vis = conflictsPanel.classList.toggle("show");
    btnToggleConflicts.textContent = `Conflicts (${conflicts.length})`;
    if (vis && !conflicts.length) showNotice("No conflicts.", "info", 1500);
  });

  // Periodic sync
  setInterval(syncWithServer, SYNC_INTERVAL_MS);
}

init();
